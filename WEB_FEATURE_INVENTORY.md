# TRIPNEST WEB APPLICATION — COMPREHENSIVE FEATURE INVENTORY

**Reference Implementation & Source of Truth**  
**Author / Lead Developer:** Arslan  
**Application Architecture:** React (Vite 8, React 19) + FastAPI (Python 3.11) + MongoDB Atlas  
**Audit Date:** November 2026

---

## 1. Project Directory & Environment

- **Web Frontend Root:** `travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code\travel-intelligence-react`
- **Shared Python Backend Root:** `travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code`
- **Entry File:** `travel-intelligence-react/src/App.jsx`
- **Global Context:** `travel-intelligence-react/src/context/AppContext.jsx`
- **API Base:** `http://127.0.0.1:8000` (configured in `src/lib/constants.js`)

---

## 2. Authentication, Session & User Lifecycle

### 2.1 Standard Registration
- **Frontend Component:** `src/pages/LoginPage.jsx` (initialMode: `"register"`)
- **Backend Endpoint:** `POST /auth/register`
- **Payload:** `{ username: string, email: string, password: string }`
- **Response:** `{ success: true, message: string, user_id: string, username: string }`
- **Auth/Authz:** Public; validates unique username and email in MongoDB `users` collection.
- **Persistence:** Created user document with bcrypt-hashed password, default role `"user"`, status `"active"`.

### 2.2 Standard Login
- **Frontend Component:** `src/pages/LoginPage.jsx`
- **Backend Endpoint:** `POST /auth/login`
- **Payload:** `{ username: string, password: string }`
- **Response:** `{ success: true, token: string, user: { id, username, email, role, name, bio, profileImage }, expires_at: string }`
- **Persistence:** Token stored in `localStorage.getItem('token')`; user payload in `localStorage.getItem('user')`.
- **Status Check:** Explicitly checks user `status !== "suspended"`; throws HTTP 403 if suspended.

### 2.3 Google OAuth Sign-In
- **Frontend Component:** `src/pages/LoginPage.jsx` (`@react-oauth/google`)
- **Backend Endpoint:** `POST /auth/google`
- **Payload:** `{ access_token?: string, id_token?: string }`
- **Response:** Same session shape as standard login.
- **Verification:** Backend verifies token with Google OAuth2 endpoints (`tokeninfo` or `userinfo`), checks audience against `GOOGLE_CLIENT_ID`, extracts verified email and profile picture.

### 2.4 Session Verification & Hydration
- **Frontend Component:** `AppContext.jsx` (`verify()`)
- **Backend Endpoint:** `POST /auth/verify`
- **Payload:** `{ token: string }`
- **Response:** `{ success: true, user: UserPayload }`
- **Behavior:** Runs on application startup; if token is invalid or expired, clears session and workspace cache.

### 2.5 Logout
- **Frontend Component:** `TripHubHeader.jsx`, `TopbarMenu.jsx`, `AppContext.jsx` (`logout()`)
- **Backend Endpoint:** `POST /auth/logout`
- **Payload:** `{ token: string }`
- **Persistence:** Removes token from MongoDB active sessions collection and clears `localStorage`.

---

## 3. Profile, Social & Account Management

### 3.1 View & Edit Profile
- **Frontend Component:** `src/pages/ProfilePage.jsx`, `src/components/ProfileEditModal.jsx`
- **Backend Endpoint:** `PUT /account/profile`
- **Payload:** `{ name: string, username: string, email: string, profileImage?: string, bio?: string }`
- **Auth:** Bearer token required.
- **Persistence:** Updates `users` collection in MongoDB, returns updated user document.

### 3.2 Public User Discovery & Profile
- **Frontend Component:** `src/pages/ProfilePage.jsx` (`/profile/:username`)
- **Backend Endpoints:**
  - `GET /api/users/search?q={query}&limit=8`: Fuzzy search users by username/name.
  - `GET /api/users/by-username/{username}`: Public profile details.
  - `GET /api/users/{username}/public-trips`: List public itineraries for user.
- **Auth:** Public read; no token required.

### 3.3 Follow & Unfollow Network
- **Frontend Component:** `src/pages/ProfilePage.jsx`
- **Backend Endpoints:**
  - `POST /api/users/{username}/follow`: Follow user. Creates notification for target.
  - `DELETE /api/users/{username}/follow`: Unfollow user.
  - `GET /api/users/{username}/follow-status`: Returns `{ followerCount, followingCount, isFollowing }`.
- **Auth:** Bearer token required for follow/unfollow; optional for viewing stats.

### 3.4 Notifications Center
- **Frontend Component:** `src/components/TripHubHeader.jsx` (`BellIcon` dropdown)
- **Backend Endpoints:**
  - `GET /api/notifications?limit=30`: List notifications (trip invitations, follow events, itinerary updates).
  - `PATCH /api/notifications/{id}/read`: Mark single notification read.
  - `POST /api/notifications/read-all`: Mark all notifications read.
- **Behavior:** Unread badge counter, inline accept/decline action on invitation notifications.

### 3.5 Account Settings & Preferences
- **Frontend Component:** `src/pages/SettingsPage.jsx`
- **Persistence:** `localStorage` (`tripnest_settings_preferences`)
- **Configurable Settings:**
  - Date format (`month-day` / `day-month`)
  - Distance unit (`kilometers` / `miles`)
  - Time format (`12-hour` / `24-hour`)
  - Place descriptions from web
  - Expert travel tips (enabled/disabled)
  - Photo upload network policy (`wifi-only` / `cellular-and-wifi`)
  - Granular email notification switches

### 3.6 Account Deletion
- **Frontend Component:** `src/pages/SettingsPage.jsx`
- **Backend Endpoint:** `DELETE /account`
- **Payload:** `{ reason?: string }`
- **Behavior:** Deletes user record and associated trips, invalidates all sessions.

---

## 4. Trip Planning, Creation & Management

### 4.1 Plan New Trip
- **Frontend Component:** `src/pages/PlanTripPage.jsx`
- **Backend Endpoint:** `POST /trips`
- **Input Parameters:** Destination / Trip name, province selection (or auto-guess), start date, end date.
- **Validation:** Minimum date today, end date >= start date, non-empty destination.
- **Payload Generator:** `buildNewTripPayload()` creates template with daily buckets (`day-1`, `day-2`, etc.) and default engine preferences.
- **Redirect:** On success, redirects to `/workspace`.

### 4.2 Saved Trips Grid & History
- **Frontend Component:** `src/pages/HomePage.jsx`, `src/components/TripHubSavedTripsGrid.jsx`, `src/pages/HistoryPage.jsx`
- **Backend Endpoints:**
  - `GET /trips`: Returns owned trips for user.
  - `GET /api/tripmates/shared-trips`: Returns shared trips where user is an accepted collaborator.
  - `GET /history?limit=100`: Returns activity logs (trip creations, edits, optimizations).
- **Behavior:** Combines owned and shared trips into a single deduped list. Shared trips display Tripmate role badge.

### 4.3 Trip Deletion & Ownership Protection
- **Backend Endpoint:** `DELETE /trips/{trip_id}`
- **Security Check:** Verifies requesting user is the trip owner; Tripmates cannot delete shared trips (`if (record.isTripmate) throw Error`).

---

## 5. Workspace & Itinerary Management (Highest Priority)

### 5.1 Day & Date Architecture
- **Data Structure:** `days: [ { id: string, label: string, shortLabel: string, date: string, items: [] } ]`
- **Duration Support:** Seamless support from 1-day to 10+ day trips.
- **Add Day:** Appends day, increments index, computes next calendar date.
- **Insert Day After:** Inserts day at arbitrary position, shifts dates.
- **Delete Day:** Removes day; existing places are safely moved to `placesPool` to prevent accidental loss.

### 5.2 Stop / Location Management
- **Item Types Supported:**
  - `place`: standard stop with `title`, `subtitle`, `category`, `lat`, `lon`, `startTime`, `endTime`, `note`, `visitDetails`.
  - `note`: rich text note card for instructions or tips.
  - `checklist`: interactive packing/prep checklist with checkable items.
- **Trash Action:** Removes item immediately from container, removes associated expenses, updates map selection.
- **Time Editor:** Direct 12-hour time editing (`formatTime12h`) for arrival and departure.
- **Day Assignment & Reordering:**
  - Drag-and-drop between days and pool on web (`handleDrop`).
  - Move to another day via modal.
  - Reorder up / down within day.

### 5.3 Places Pool (Unscheduled Places)
- **Data Structure:** `placesPool: []`
- **Behavior:** Holds curated or discovered places not yet assigned to a specific day. Can be moved to any day at any time.

### 5.4 Custom Lists
- **Data Structure:** `customLists: [ { id, title, description, color, items: [] } ]`
- **Behavior:** Secondary custom buckets (e.g. "Rainy Day Backup", "Food Wishlist"). Supports places and checklist rows.

### 5.5 Three-Dot Action Menus
- **TopbarMenu (Trip Level):**
  - Trip settings (Privacy toggle: Private / Public)
  - Trip preferences & engine (Budget, travel hours, categories)
  - View only mode (`/trip-view`)
  - View trip journal modal (`showTripJournal`)
  - Select mode (Bulk delete / bulk move)
  - Print this trip (`/print-trip`)
- **SectionMenu (Day Level):**
  - Insert day after
  - Optimize day route (TSP)
  - Delete day (moves stops to pool)
  - Add note / checklist

### 5.6 Route Optimization Engine
- **Backend Endpoint:** `POST /v1/sequence/day` (also alias `/sequence/day`)
- **Algorithm:** 2-Opt TSP solver (`solve_tsp`) combined with OSRM driving distance and duration calculations (`_fetch_osrm_route`).
- **Response Format:**
  - `order`: optimized sequence of location IDs.
  - `metrics`: `{ totalDistanceKm, distanceSavedKm, estimatedTravelTimeHours, travelTimeSavedHours }`.
  - `legs`: array of leg details between consecutive stops (`fromPlaceId`, `toPlaceId`, `distanceKm`, `estimatedTravelTimeMin`).
- **Workspace Integration:** Reorders stops, computes sequential arrival times (starting at 09:30 AM + driving times + 90 min visit duration), displays distance saved banner.

### 5.7 Suggestion Engine
- **Backend Endpoint:** `POST /optimize`
- **Inputs:** `max_budget`, `max_travel_hours`, `preferred_categories`, `province`, `start_lat`, `start_lon`, `travel_style`, `environment`, `crowd_preference`.
- **Logic:** Scores and ranks candidates, clusters locations spatially, executes time-aware selection, runs TSP, returns complete proposed itinerary.

### 5.8 Map Visualization
- **Component:** `PlannerMapPanel.jsx` (React Leaflet)
- **Features:**
  - Color-coded markers matching day accents.
  - Polylines connecting consecutive stops for each day.
  - Interactive popup with stop name, category, and direct action to remove/edit.
  - Full split-screen mode with draggable panel divider.

---

## 6. Collaboration, Tripmates & Sharing Permissions

### 6.1 Tripmates Collaboration
- **Backend Router:** `app/routes/tripmates.py`
- **Endpoints:**
  - `POST /api/trips/{id}/members/invite`: Invite user by email or username.
  - `GET /api/trips/{id}/members`: List owner, accepted members, and pending invitations.
  - `GET /api/trips/invitations`: List pending invitations for current user.
  - `POST /api/trips/invitations/{id}/respond`: Accept or decline invitation.
  - `DELETE /api/trips/{id}/members/{userId}`: Remove collaborator.
  - `PUT /api/tripmates/trips/{id}/itinerary`: Update itinerary by collaborator (days, placesPool, customLists).

### 6.2 Share Token Generation & Permissions
- **Backend Endpoint:** `POST /trips/{id}/share-token`
- **Permissions Supported:**
  - `view`: generates a read-only share token (`GET /trips/shared/{token}`).
  - `edit`: generates a can-edit copy token (`GET /trips/shared/edit/{token}`).
- **Can-Edit Copy Flow:** `POST /trips/shared/edit/{token}/copy` duplicates the trip into the recipient's personal account while preserving original.

### 6.3 Public Trips
- **Backend Endpoint:** `GET /api/trips/public/{trip_id}`
- **Access Rule:** Accessible publicly if `privacy === "public"`.

---

## 7. Shared Budget & Expense Management

### 7.1 Trip Budget
- **Data Structure:** `trip.budget: { currency: "PKR", amount: number }`
- **Features:** Overall budget cap, remaining balance, category breakdown chart.

### 7.2 Personal / Trip Expenses
- **Data Structure:** `trip.expenses: [ { id, name, amount, category, date, note, placeId } ]`
- **Categories:** Transport, Food, Tickets, Hotel, Shopping, Misc.

### 7.3 Dedicated Tripmates Shared Budget
- **Backend Router:** `app/routes/shared_budget.py`
- **Endpoints:**
  - `GET /api/shared-budget/trips/{id}/expenses`: List shared expenses.
  - `POST /api/shared-budget/trips/{id}/expenses`: Add expense with payer and split participants.
  - `PUT /api/shared-budget/trips/{id}/expenses/{id}`: Edit expense.
  - `DELETE /api/shared-budget/trips/{id}/expenses/{id}`: Delete expense.
  - `GET /api/shared-budget/trips/{id}/settlements`: List settlement payments.
  - `POST /api/shared-budget/trips/{id}/settlements`: Record settlement payment.
  - `DELETE /api/shared-budget/trips/{id}/settlements/{id}`: Delete settlement.

---

## 8. Explore, Places & SerpAPI Hotels

### 8.1 Explore Places Search
- **Backend Endpoints:**
  - `GET /api/explore/places?lat={lat}&lon={lon}&query={query}`: Fetches Google Maps places via SerpAPI with 1-hour in-memory cache.
  - `GET /api/explore/place-details?place_id={id}&data_id={id}`: Fetches place reviews, hours, phone, description.
  - `GET /api/explore/place-photos?data_id={id}`: Fetches high-resolution photo array.
- **Web Categories:** 8 category pills:
  1. All
  2. Attractions
  3. Restaurants
  4. Cafes
  5. Hotels
  6. Nature
  7. Historical
  8. Shopping

### 8.2 Hotel Search & Integration
- **Category Query:** When `Hotels` is selected, backend executes Google Maps search for lodging in the target location.
- **Fields Extracted:** Hotel name, star rating, review count, price level, address, thumbnail, directions link, phone.
- **Workflow:** Add hotel directly to day's itinerary or places pool; external link redirect for booking/navigation.

---

## 9. AI Travel Assistant

- **Backend Router:** `app/routes/ai.py`
- **Endpoint:** `POST /api/ai/chat`
- **Payload:** `{ prompt: string, trip_context?: string }`
- **Service:** Calls Google Gemini API (`generate_response`) with destination context and itinerary data.
- **Frontend Component:** `src/components/AiAssistantModal.jsx` provides markdown rendering, prompt suggestions, and context-aware responses.

---

## 10. Print & Export

- **Frontend Component:** `src/pages/PrintTripPage.jsx`
- **Workflow:** `queuePrint()` snapshots active workspace into storage; opens clean print-optimized layout with daily schedule, map overview, and notes; calls `window.print()`.

---

## 11. Administration

- **Frontend Components:** `src/pages/AdminPage.jsx`, `src/pages/AdminV2Page.jsx`
- **Backend Endpoints:**
  - `GET /admin/overview`: Summary stats (total users, trips, active sessions).
  - `GET /admin/users`: User list with search, role, status filters, pagination.
  - `GET /admin/users/{id}`: User profile and activity details.
  - `PATCH /admin/users/{id}/status`: Suspend or activate user.
  - `PATCH /admin/users/{id}/role`: Update user role (`admin` / `user`).
  - `DELETE /admin/users/{id}`: Delete user.
  - `GET /admin/trips`: List all system trips.
  - `DELETE /admin/trips/{id}`: Admin delete trip.
- **Authorization:** `require_admin` dependency checks `current_user.role === "admin"`.

