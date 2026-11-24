# TRIPNEST WEB APPLICATION — COMPLETE SECOND-PASS FEATURE INVENTORY

**Reference Implementation & Source of Truth**  
**Author / Lead Developer:** Arslan  
**Architecture:** React 19 (Vite 8) + FastAPI (Python 3.11) + MongoDB Atlas  
**Audit Date:** November 2026 (Second-Pass Deep Audit)  
**Scope:** Complete feature, sub-feature, component, hook, state, and API mapping

---

## 1. System Architecture & Entrypoints

- **Web Frontend Root:** `travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code\travel-intelligence-react`
- **Frontend Entrypoint:** `src/App.jsx`
- **Global State & Session Provider:** `src/context/AppContext.jsx`
- **Shared Python Backend Root:** `travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code`
- **Backend Application Main:** `app/main.py`
- **Database Engine:** MongoDB Atlas (collections: `users`, `sessions`, `trips`, `trip_members`, `shared_budget_expenses`, `shared_budget_settlements`, `activities`, `notifications`, `locations`)
- **Third-Party APIs:** Google Identity Services (OAuth2), SerpAPI (Google Places & Lodging), OpenWeatherMap API, Google Gemini AI (GenAI SDK), OpenStreetMap / OSRM routing.

---

## 2. Authentication, Account & Session Lifecycle

### 2.1 Standard User Registration
- **Web Component:** `src/pages/LoginPage.jsx` (initialMode: `"register"`), `src/components/auth/SignupForm.jsx`
- **API Endpoint:** `POST /auth/register`
- **Payload Schema:** `{ username: string, email: string, password: string }`
- **Response Schema:** `{ success: true, message: string, user_id: string, username: string }`
- **Business Logic & Validation:**
  - Validates non-empty username, email, and password.
  - Enforces case-insensitive uniqueness check on username and email in MongoDB `users` collection.
  - Hashes passwords using bcrypt with secure salt rounds.
  - Assigns default account role `"user"` and default status `"active"`.
- **Error Handling:** Returns HTTP 400 with duplicate field details if username or email is taken.

### 2.2 Standard User Login
- **Web Component:** `src/pages/LoginPage.jsx`, `src/components/auth/LoginForm.jsx`
- **API Endpoint:** `POST /auth/login`
- **Payload Schema:** `{ username: string, password: string }`
- **Response Schema:** `{ success: true, token: string, user: { id, username, email, role, name, bio, profileImage }, expires_at: string }`
- **Business Logic & Authorization:**
  - Verifies bcrypt password hash against stored user record.
  - Checks user status: if `status === "suspended"`, immediately rejects with HTTP 403 Forbidden (`"Your account has been suspended."`).
  - Generates secure session token and writes session record to MongoDB `sessions` collection with 30-day TTL.
  - Returns authenticated user profile payload.
- **Persistence:** Stored in `localStorage.setItem('token', token)` and `localStorage.setItem('user', JSON.stringify(user))`.

### 2.3 Google OAuth2 Sign-In
- **Web Component:** `src/pages/LoginPage.jsx`, `src/components/landing/GoogleButton.jsx`
- **SDK / Library:** Google Identity Services (`window.google.accounts.oauth2.initTokenClient`)
- **API Endpoint:** `POST /auth/google`
- **Payload Schema:** `{ access_token?: string, id_token?: string }`
- **Response Schema:** Identical session shape to Standard Login.
- **Business Logic & Verification:**
  - Backend queries Google OAuth2 tokeninfo endpoint (`https://oauth2.googleapis.com/tokeninfo`) or OpenID userinfo (`https://openidconnect.googleapis.com/v1/userinfo`).
  - Verifies audience against `GOOGLE_CLIENT_ID`.
  - Verifies `email_verified === true`.
  - Automatically provisions new user document if email not previously registered, or links Google identity to existing user.
  - Enforces account status check (`status !== "suspended"`).
  - Issues authoritative session token.

### 2.4 Session Verification & Hydration
- **Web Component:** `src/context/AppContext.jsx` (`verify()`), invoked inside `AppProvider` boot effect.
- **API Endpoint:** `POST /auth/verify`
- **Payload Schema:** `{ token: string }`
- **Response Schema:** `{ success: true, user: UserPayload }`
- **Behavior:**
  - Validates session token against active sessions collection in MongoDB.
  - If valid, updates local user state and persists fresh user record.
  - If token expired or revoked, triggers `clearSession()`, clears active workspace and print snapshots, and resets auth state to unauthenticated.

### 2.5 User Logout
- **Web Component:** `src/components/TripHubHeader.jsx`, `src/pages/WorkspacePage.jsx`, `src/context/AppContext.jsx` (`logout()`)
- **API Endpoint:** `POST /auth/logout`
- **Payload Schema:** `{ token: string }`
- **Response Schema:** `{ success: true, message: string }`
- **Behavior:** Deletes session token document from MongoDB `sessions` collection and cleanses `localStorage`.

---

## 3. User Profile, Social Network & Global Preferences

### 3.1 Profile View & Edit
- **Web Components:** `src/pages/ProfilePage.jsx`, `src/components/ProfileEditModal.jsx`, `src/components/ProfileEditorForm.jsx`
- **API Endpoint:** `PUT /account/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Payload Schema:** `{ name?: string, username?: string, email?: string, profileImage?: string, bio?: string }`
- **Response Schema:** `{ success: true, user: UserPayload }`
- **Validation:** Enforces authenticated user ownership; updates MongoDB `users` collection.

### 3.2 Public User Discovery & Public Profile
- **Web Components:** `src/pages/ProfilePage.jsx` (`/profile/:username`), `src/components/TripHubHeader.jsx` (Search user dropdown)
- **API Endpoints:**
  - `GET /api/users/search?q={query}&limit=8`: Fuzzy regex search over usernames and display names.
  - `GET /api/users/by-username/{username}`: Returns public profile (name, username, bio, profileImage, createdAt).
  - `GET /api/users/{username}/public-trips`: Lists trips authored by user marked `privacy: "public"`.
- **Authorization:** Public access; no authentication token required.

### 3.3 Follow & Unfollow Network
- **Web Component:** `src/pages/ProfilePage.jsx`
- **API Endpoints:**
  - `POST /api/users/{username}/follow`: Follows target user; inserts record into `user_follows` collection; generates a `follow` notification for target user.
  - `DELETE /api/users/{username}/follow`: Unfollows target user.
  - `GET /api/users/{username}/follow-status`: Returns `{ followerCount: number, followingCount: number, isFollowing: boolean }`.
- **Authorization:** Bearer token required for follow/unfollow; optional token for viewing status to compute `isFollowing`.

### 3.4 Notifications Center
- **Web Components:** `src/components/TripHubHeader.jsx` (`BellIcon` button with badge count and dropdown panel)
- **API Endpoints:**
  - `GET /api/notifications?limit=30`: Fetches list of notifications for authenticated user.
  - `PATCH /api/notifications/{id}/read`: Marks individual notification read.
  - `POST /api/notifications/read-all`: Marks all notifications as read in batch.
- **Notification Types Handled:**
  - `tripmate_invite`: Collaborative trip invitation. Renders inline **Accept** and **Decline** action buttons.
  - `user_followed`: Notification when another traveler follows the user.
  - `trip_update`: Notification when a collaborator modifies a shared trip.
- **State Synchronization:** Automatically triggers `reloadTrips()` when an invitation is accepted from the notification dropdown.

### 3.5 Global User Preferences & Display Settings
- **Web Component:** `src/pages/SettingsPage.jsx`
- **Persistence:** Client `localStorage` (`tripnest_settings_preferences`)
- **Settings Taxonomy:**
  1. *Unit & Display Preferences*:
     - Date format: `month-day` ("Apr 4") vs `day-month` ("4 Apr")
     - Distance format: `kilometers` vs `miles`
     - Time format: `12-hour` ("09:30 AM") vs `24-hour` ("09:30")
  2. *Trip Planner*:
     - Place descriptions from web: `show-below-custom-notes` vs `show-only-empty-notes`
     - Expert travel tips: `enabled` vs `disabled`
  3. *Trip Journal*:
     - Photo upload network policy: `wifi-only` vs `cellular-and-wifi`
  4. *Email Notification Switches*:
     - `tripInvitations`, `tripUpdates`, `sharedItineraryChanges`, `tripReminders`, `accountSecurity`
  5. *Push Notification Switches*:
     - `tripInvitations`, `tripUpdates`, `sharedItineraryUpdates`, `tripReminders`, `collaborationActivity`, `productAnnouncements`

### 3.6 Account Deletion
- **Web Component:** `src/pages/SettingsPage.jsx`
- **API Endpoint:** `DELETE /account`
- **Payload Schema:** `{ reason?: string }`
- **Business Logic:** Deletes user record, cascades deletion to all user-owned trips, removes all active sessions, and logs deletion reason.

---

## 4. Trip Planning, Creation & Dashboard

### 4.1 Plan New Trip
- **Web Component:** `src/pages/PlanTripPage.jsx`
- **API Endpoint:** `POST /trips`
- **Form Inputs:**
  - Destination / Trip name (e.g. "Islamabad", "Hunza", "Karachi")
  - Province selection (auto-guessed via `guessProvinceFromTripName`)
  - Start date (`YYYY-MM-DD`) and End date (`YYYY-MM-DD`)
- **Validation:** Minimum date today, end date >= start date, destination cannot be empty.
- **Payload Generator:** `buildNewTripPayload()` constructs full trip document with default daily containers (`day-1`, `day-2`, etc.), engine preferences, empty places pool, and default packing checklist.
- **Redirect:** On HTTP 200, persists workspace snapshot and navigates to `/workspace`.

### 4.2 Saved Trips Grid (Dashboard)
- **Web Components:** `src/pages/HomePage.jsx`, `src/components/TripHubSavedTripsGrid.jsx`
- **API Endpoints:**
  - `GET /trips`: Returns owned trips for user.
  - `GET /api/tripmates/shared-trips`: Returns trips where user is an accepted Tripmate.
- **Data Merging & Deduplication:** `AppContext.jsx` (`fetchCombinedUserTrips`) combines owned and shared trips into a unified list. Shared trips display a distinct `Tripmate • Member` badge.

### 4.3 Activity History Log
- **Web Component:** `src/pages/HistoryPage.jsx`
- **API Endpoint:** `GET /history?limit=100`
- **Service Layer:** `app/services/activity/activity_service.py`
- **Event Types:** `trip_created`, `trip_updated`, `trip_renamed`, `trip_deleted`, `route_optimized`.

### 4.4 Trip Deletion & Ownership Security
- **Web Component:** `src/components/TripHubSavedTripsGrid.jsx`, `src/pages/WorkspacePage.jsx`
- **API Endpoint:** `DELETE /trips/{trip_id}`
- **Security Check in Web Frontend:**
  ```javascript
  if (record?.isTripmate) {
    throw new Error('Tripmate members cannot delete shared trips.')
  }
  ```
  Web strictly guards against Tripmate collaborators deleting shared trips.

---

## 5. Workspace & Itinerary Management

### 5.1 Day Architecture & Calendar Synchronization
- **Data Structure:**
  ```json
  "days": [
    {
      "id": "day-1",
      "label": "Day 1",
      "shortLabel": "Day 1",
      "date": "Sat Apr 04 2026",
      "items": []
    }
  ]
  ```
- **Operations:**
  - *Add Day*: Appends `day-{Date.now()}`, recalculates sequential dates, updates `endDate`.
  - *Insert Day After*: Inserts a new day directly after the selected day index and shifts downstream calendar dates.
  - *Delete Day*: Deletes selected day; crucially moves all its stops into `placesPool` to prevent data loss.
  - *Edit Trip Dates Modal*: Modifies start date and end date; calls `getAffectedOutOfRangeDays` to identify out-of-bounds days and safely relocates their stops to `placesPool`.

### 5.2 Stop & Item Types in Containers
- The workspace supports 3 distinct polymorphic items in any day, places pool, or custom list:
  1. **Place Stop (`type: "place"`):**
     - Fields: `id`, `place_id`, `data_id`, `title`, `subtitle`, `category`, `lat`, `lon`, `startTime`, `endTime`, `note`, `image`, `visitDetails`, `visitLocation`.
  2. **Note Card (`type: "note"`):**
     - Rich text card for general instructions, flight numbers, or local advice.
  3. **Checklist Card (`type: "checklist"`):**
     - Interactive checklist card with rows `{ id, text, checked: boolean }` and row-level add/delete.

### 5.3 Stop Management Operations
- **Quick Add Place:** Inline form at top of every day and places pool.
- **Move Stop Between Days & Pool:**
  - Drag-and-drop between containers (`handleDragStart`, `handleDrop`).
  - Dropdown selector on card (`PlannerMoveSelect`).
  - Modal selector (`ArrangementModal`).
- **Reorder Stops Within Day:**
  - Drag-and-drop reordering.
  - Move up / move down actions.
- **Time Scheduling:**
  - Direct 12-hour arrival and departure time editor (`startTime`, `endTime`).
  - Formatting via `formatTime12h`.
- **Visit Journal & Visited Toggle:**
  - Mark visited checkbox (`visitDetails.visited: true`).
  - Visit details modal: `visitedDate`, `visitedTime`, `visitLocation`, `notes`.
- **Duplicate Stop:** Creates deep copy of stop (`duplicateItem`).
- **Remove Stop:** Deletes stop, removes linked expense records, and clears map selection.

### 5.4 Places Pool (Unscheduled Discovered Places)
- Holds attractions discovered through Explore, suggestions, or date contractions that have not yet been assigned to a day.
- Features: Add place, clear pool, move to day, reorder.

### 5.5 Custom Lists
- Arbitrary secondary buckets (e.g. "Packing Essentials", "Rainy Day Backup").
- Supports items of type `place` or `checklist`.

### 5.6 Undo / Redo History Stack
- Maintained via `historyRef` in `WorkspacePage.jsx`.
- Snapshots workspace state before destructive operations.
- Undo and Redo buttons in topbar header.

### 5.7 Bulk Select & Bulk Actions
- Enabled via "Select mode" in TopbarMenu.
- Checkboxes appear on every stop across all containers.
- Actions: Select All in Day, Select All in Pool, Bulk Move to Container, Bulk Copy, Bulk Delete.

### 5.8 Route Optimization Engine (TSP + OSRM)
- **API Endpoint:** `POST /v1/sequence/day` (alias `/sequence/day`)
- **Request Payload:**
  ```json
  {
    "dayId": "day-1",
    "start": { "lat": 31.5204, "lon": 74.3587 },
    "options": {
      "algorithm": "nearest_neighbor",
      "returnToStart": false,
      "speedKmh": 30,
      "roadAware": true
    },
    "locations": [
      { "id": "loc-1", "name": "Place A", "lat": 31.52, "lon": 74.35 },
      { "id": "loc-2", "name": "Place B", "lat": 31.55, "lon": 74.38 }
    ]
  }
  ```
- **Response Format:**
  - `order`: Array of optimized place IDs.
  - `metrics`: `{ beforeDistanceKm, totalDistanceKm, distanceSavedKm, beforeTravelTimeHours, estimatedTravelTimeHours, travelTimeSavedHours, speedKmhUsed }`.
  - `legs`: Array of leg segments with road distance and driving duration.
  - `truth`: `{ source, distanceModel, timeModel, roadAware }`.
- **Workspace Post-Processing:** Automatically re-sequences arrival and departure times starting at 09:30 AM + driving times + 90 min visit duration.

### 5.9 Suggestion Generator Engine
- **API Endpoint:** `POST /optimize`
- **Request Payload:** Complete questionnaire (budget, travel style, companions, crowd preference, weights, province, lat/lon).
- **Backend Flow:** Candidate scoring (`score_and_rank_candidates`), spatial clustering (`cluster_locations`), time-aware selection (`select_locations_time_aware`), TSP routing (`solve_tsp`).
- **Modal Display:** Interactive review modal with selection toggles, utility score, and options to "Add selected to pool" or "Apply as system itinerary".

### 5.10 Live Weather Integration per Place
- **Web Hook:** `src/hooks/useWeather.js`
- **API Endpoint:** `GET /weather?lat={lat}&lon={lon}&units=metric`
- **Display Component:** `src/components/WeatherIcon.jsx` inside `PlannerItemCard.jsx`.
- **Data Rendered:** Live temperature (°C), weather icon, condition description, humidity, and wind speed directly on the stop card.

### 5.11 Map Visualization & Panel Splitter
- **Web Component:** `src/components/PlannerMapPanel.jsx` (React Leaflet)
- **Features:**
  - Color-coded pins matching day accent colors.
  - Polylines connecting consecutive stops for each day.
  - Click-to-focus on map marker from itinerary card.
  - Draggable split-view divider resizing the map panel (`mapPanelWidth` persisted in storage).

### 5.12 Topbar Three-Dot Action Menu
- **Web Component:** `src/components/TopbarMenu.jsx`
- **Menu Items:**
  1. `⚙️ Trip settings`: Toggle trip privacy (Public vs Private) and rename trip.
  2. `🎛️ Trip preferences & engine`: Open engine configuration and questionnaire.
  3. `👁️ View only mode`: Preview the itinerary as a read-only viewer (`/trip-view`).
  4. `📖 View trip journal`: Open documented trip notes, visited dates, and experiences.
  5. `☑️ Select mode`: Enable bulk selection checkboxes across all containers.
  6. `🖨️ Print this trip`: Snapshot active workspace and route to `/print-trip`.

### 5.13 Section Three-Dot Menu (Day & Pool Level)
- **Web Component:** `src/components/SectionMenu.jsx`
- **Day Menu Items:**
  - Optimize route
  - Rearrange sections
  - Change color
  - Select all items in day
  - Expand / Collapse all days
  - Insert day after
  - Delete day (danger)
- **Pool Menu Items:**
  - Delete section / Clear pool (danger)
  - Rearrange sections
  - Change color or icon
  - Select all items in pool
  - Collapse / Expand all sections

---

## 6. Collaboration, Tripmates & Sharing Permissions

### 6.1 Tripmates Collaboration Roster
- **Web Component:** `src/components/TripmatesModal.jsx`
- **Backend Router:** `app/routes/tripmates.py`
- **Endpoints & Operations:**
  - `POST /api/trips/{id}/members/invite`: Invite user by username or email.
  - `GET /api/trips/{id}/members`: List owner, accepted members, and pending invitations.
  - `GET /api/trips/invitations`: List pending invitations for authenticated user.
  - `POST /api/trips/invitations/{id}/respond`: Accept or decline invitation.
  - `DELETE /api/trips/{id}/members/{userId}`: Remove collaborator or cancel pending invitation.
  - `GET /api/tripmates/trips/{id}`: Retrieve shared trip document for an accepted collaborator.
  - `PUT /api/tripmates/trips/{id}/itinerary`: Update itinerary by collaborator (updates `days`, `placesPool`, `customLists`).
  - `GET /api/tripmates/shared-trips`: Retrieve all trips where user is an accepted Tripmate.

### 6.2 Token-Based Trip Sharing & Permissions
- **Web Component:** `src/pages/WorkspacePage.jsx` (Share modal), `src/pages/TripViewPage.jsx`
- **API Endpoint:** `POST /trips/{id}/share-token`
- **Payload Schema:** `{ permission: "view" | "edit" }`
- **Permission Modes:**
  1. `permission: "view"`: Generates read-only token (`sh_view_...`).
     - Share URL: `https://tripnest.travel/share/{token}`
     - Consumed by: `GET /trips/shared/{token}`
  2. `permission: "edit"`: Generates can-edit copy token (`sh_edit_...`).
     - Share URL: `https://tripnest.travel/share/edit/{token}`
     - Consumed by: `GET /trips/shared/edit/{token}`
     - **Can-Edit Copy Flow:** `POST /trips/shared/edit/{token}/copy` duplicates the trip into the recipient's personal account while preserving original author ownership.

### 6.3 Public Trips
- **Web Component:** `src/pages/PublicTripPage.jsx` (`/trips/public/:tripId`)
- **API Endpoint:** `GET /api/trips/public/{trip_id}`
- **Security Rule:** Allows public unauthenticated read only if trip document has `privacy: "public"`.

---

## 7. Shared Budget, Expenses & Settlement Balances

### 7.1 Personal Trip Budget
- **Data Structure:** `trip.budget: { currency: "PKR", amount: number }`
- **Personal Expenses:** `trip.expenses: [ { id, name, amount, category, date, note, placeId } ]`
- **Categories:** Transport, Food, Tickets, Hotel, Shopping, Misc.

### 7.2 Dedicated Tripmates Shared Budget
- **Web Component:** `src/components/SharedBudgetSection.jsx`
- **Backend Router:** `app/routes/shared_budget.py`
- **Collection:** `shared_budget_expenses`, `shared_budget_settlements`
- **Endpoints:**
  - `GET /api/shared-budget/trips/{id}/expenses`: List shared expenses.
  - `POST /api/shared-budget/trips/{id}/expenses`: Add expense with multiple payers, participant shares, multipliers.
  - `PUT /api/shared-budget/trips/{id}/expenses/{id}`: Edit expense details or splits.
  - `DELETE /api/shared-budget/trips/{id}/expenses/{id}`: Delete shared expense.
  - `GET /api/shared-budget/trips/{id}/settlements`: List settlement payments.
  - `POST /api/shared-budget/trips/{id}/settlements`: Record debt settlement payment between two members.
  - `DELETE /api/shared-budget/trips/{id}/settlements/{id}`: Delete recorded settlement.
- **Financial Logic:** Computes net balances for every traveler (who owes whom), category summaries, and payment settlement options.

---

## 8. Explore Places, Google Maps & SerpAPI Hotels

### 8.1 Explore Places Search
- **Web Component:** `src/pages/WorkspacePage.jsx` (Explore mode)
- **API Endpoints:**
  - `GET /api/explore/places?lat={lat}&lon={lon}&query={query}`: Fetches places via SerpAPI Google Maps engine with 1-hour in-memory cache.
  - `GET /api/explore/place-details?place_id={id}&data_id={id}`: Fetches operating hours, user reviews, address, phone, descriptions.
  - `GET /api/explore/place-photos?data_id={id}`: Fetches photo gallery.
- **Categories Supported in Web (8 categories):**
  1. `All`
  2. `Attractions`
  3. `Restaurants`
  4. `Cafes`
  5. `Hotels`
  6. `Nature`
  7. `Historical`
  8. `Shopping`

### 8.2 Hotel Search, Filtering & Booking Redirect
- When `Hotels` category is selected, backend queries Google Maps for lodging/resorts in destination.
- Surfaces star ratings (e.g. 4.2★), review counts, price tier (`$$`), directions links, and telephone numbers.
- Direct actions: "Add Hotel to Day", "Add to Places Pool", and external booking redirect.

---

## 9. AI Travel Assistant (Google Gemini)

- **Web Component:** `src/components/AiAssistantModal.jsx`, `src/components/AiTravelCards.jsx`
- **Backend Router:** `app/routes/ai.py`
- **API Endpoint:** `POST /api/ai/chat`
- **Payload Schema:** `{ prompt: string, trip_context?: string }`
- **Backend Service:** Calls Google Gemini API (`generate_response`) with destination context, dates, budget, companions, and active daily schedule.
- **Interactive UI Cards in Chat:**
  - `RestaurantCard`: Shows cuisine, rating, price tier, thumbnail, map link.
  - `HotelCard`: Shows star rating, amenities, price, booking link.
  - `AttractionCard`: Shows category, open hours, description, add-to-trip button.
  - `ChecklistCard`: Interactive packing checklist.
  - `DayPlanCard`: Full structured daily schedule suggestion.

---

## 10. Print & Export

- **Web Component:** `src/pages/PrintTripPage.jsx`, `src/components/PrintTripContent.jsx`
- **Workflow:** `queuePrint()` snapshots workspace into `sessionStorage` (`tripnest_print_snapshot`); renders clean, printer-friendly CSS stylesheet with itinerary timeline, notes, and packing list; invokes browser `window.print()`.

---

## 11. Administration Portal

- **Web Components:** `src/pages/AdminPage.jsx`, `src/pages/AdminV2Page.jsx`
- **API Endpoints:**
  - `GET /admin/overview`: Summary metrics (users count, trips count, active sessions).
  - `GET /admin/users`: User list with search, role filter, status filter, pagination.
  - `GET /admin/users/{id}`: Detailed user profile and activity timeline.
  - `PATCH /admin/users/{id}/status`: Suspend or activate user account.
  - `PATCH /admin/users/{id}/role`: Upgrade/downgrade role (`admin` / `user`).
  - `DELETE /admin/users/{id}`: Permanently delete user.
  - `GET /admin/trips`: List all system trips with search.
  - `DELETE /admin/trips/{id}`: Admin delete trip.
- **Authorization Dependency:** `require_admin` verifies `current_user.role === "admin"`.

