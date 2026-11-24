# TRIPNEST MOBILE APPLICATION — COMPLETE SECOND-PASS FEATURE INVENTORY

**Implementation Audit & State of Truth**  
**Lead Developers:** Rai / Arslan  
**Architecture:** React Native (0.86.3) + Expo (~57.0.31) + React Navigation 7  
**Audit Date:** November 2026 (Second-Pass Deep Audit)  
**Scope:** Complete screen, component, service, state, API, and workflow mapping

---

## 1. System Architecture & Environment

- **Mobile Root Directory:** `tripnest-mobile`
- **Application Entrypoint:** `App.js`
- **Navigation Container:** `src/navigation/AppNavigator.js`
- **Bottom Tab Navigator:** `src/navigation/BottomTabNavigator.js`
- **Global Context Provider:** `src/context/AppContext.js`
- **API Client Layer:** `src/api/client.js`, `src/api/apiService.js`, `src/api/mockAdapter.js`
- **Environment Configuration:** `src/config/env.js` (`ENVIRONMENTS.MOCK` vs `ENVIRONMENTS.ISOLATED_DEV` vs `ENVIRONMENTS.PRODUCTION`)
- **Local Client Storage:** `src/utils/storage.js` (`AsyncStorage` abstraction with memory fallback)
- **Maps Engine:** `react-native-webview` with Leaflet.js and CartoDB Positron / OSM tiles (`src/components/map/InteractiveMap.js`)

---

## 2. Authentication, Account & Session Lifecycle

### 2.1 Standard Registration
- **Mobile Component:** `src/screens/auth/RegisterScreen.js`
- **API Call:** `apiService.register(payload)` -> `POST /auth/register`
- **Status:** **A. Fully equivalent and verified.**
- **Features:** Validates username, email, password, and confirmation; displays validation error banner; redirects to Login upon successful registration.

### 2.2 Standard Login
- **Mobile Component:** `src/screens/auth/LoginScreen.js`
- **API Call:** `apiService.login(credentials)` -> `POST /auth/login`
- **Status:** **A. Fully equivalent and verified.**
- **Features:** Username/password fields; password visibility toggle; error alert handling; sets session token in `appStorage`; immediately reloads user trips and invitations upon login. Supports guest explorer login (`guest_explorer`).

### 2.3 Google OAuth Sign-In
- **Mobile Component:** `src/screens/auth/LoginScreen.js`
- **SDK:** `@react-native-google-signin/google-signin`
- **API Call:** `apiService.googleLogin(tokenPayload)` -> `POST /auth/google`
- **Status:** **A. Fully equivalent and verified.**
- **Features:** Native Google sign-in modal; extracts `idToken` or `accessToken`; sends to backend; hydrates session token and user profile.

### 2.4 Session Verification & Hydration
- **Mobile Component:** `src/context/AppContext.js` (`hydrateApp()`)
- **API Call:** `apiService.verifyToken(token)` -> `POST /auth/verify`
- **Status:** **A. Fully equivalent and verified.**
- **Features:** Runs on mobile cold launch; verifies cached token in `appStorage`; validates against backend; hydrates user profile and traveler metadata; clears cache if expired.

### 2.5 Logout
- **Mobile Component:** `src/screens/settings/SettingsScreen.js`, `src/screens/profile/ProfileScreen.js`
- **API Call:** `apiService.logout(token)` -> `POST /auth/logout`
- **Status:** **A. Fully equivalent and verified.**
- **Features:** Invalidates backend session, clears token from `appStorage`, resets active trip and saved trips state, navigates to Login stack.

---

## 3. User Profile, Social Network & Settings

### 3.1 Profile Screen
- **Mobile Component:** `src/screens/profile/ProfileScreen.js`
- **Tabs:** `itineraries` ("My Trips"), `preferences`, `account`
- **Features:**
  - Avatar / initials display with verified image support.
  - Social follow metrics: `followerCount` and `followingCount`.
  - User search button opening `userSearchModalVisible` (`apiService.searchUsers`).
  - Edit Profile modal with name, username, email, bio, avatar URL, home city, travel style, interests.
  - Personal vs Shared trips filter.
  - Admin button visible only if `user.role === 'admin'`.
- **Status:** **A. Fully equivalent and verified.**

### 3.2 User Profile Screen (Public Traveler View)
- **Mobile Component:** `src/screens/profile/UserProfileScreen.js`
- **API Calls:**
  - `apiService.getPublicUserByUsername(username)` -> `GET /api/users/by-username/{username}`
  - `apiService.getFollowStatus(username, token)` -> `GET /api/users/{username}/follow-status`
  - `apiService.getPublicTripsByUsername(username)` -> `GET /api/users/{username}/public-trips`
  - `apiService.followUser(token, username)` -> `POST /api/users/{username}/follow`
  - `apiService.unfollowUser(token, username)` -> `DELETE /api/users/{username}/follow`
- **Status:** **A. Fully equivalent and verified.**

### 3.3 Settings Screen
- **Mobile Component:** `src/screens/settings/SettingsScreen.js`
- **Sections:**
  - *Account*: Name, username, email, bio, avatar editor.
  - *Preferences*: Date format (`month-day`/`day-month`), Distance format (`kilometers`/`miles`), Time format (`12-hour`/`24-hour`), Expert tips, Photo upload Wi-Fi only, Language.
  - *Notifications*: Granular switches for Email (invitations, updates, security) and Push (invitations, reminders, announcements).
  - *Membership*: Pro membership tier display.
  - *Delete Account*: Modal with required reason input, confirmation checkbox, calling `apiService.deleteAccount`.
- **Status:** **A. Fully equivalent and verified.**

### 3.4 Notifications Center UI
- **Mobile Component:** **MISSING UI**
- **Underlying Support:** `AppContext.js` has `notifications`, `unreadNotificationsCount`, `loadNotifications`, `markNotificationRead`, `markAllNotificationsRead`. `apiService.js` has all endpoints.
- **Current Defect:** There is **NO Bell icon** in `HomeScreen.js` header, **NO Notification screen or modal** to list notifications, view follow alerts, or mark all as read. (Only pending trip invitations are displayed in a home feed card).
- **Classification:** **C. UI exists as logic/API but presentation is missing.**

---

## 4. Home Screen, Dashboard & Trip Planning

### 4.1 Home Screen
- **Mobile Component:** `src/screens/home/HomeScreen.js`
- **Features:**
  - Brand header with logo mark and user avatar.
  - Greeting based on time of day (morning/afternoon/evening).
  - Destination Search Bar with real-time suggestion dropdown.
  - Pending Trip Invitations card with inline Accept / Decline buttons.
  - Active Itinerary hero card with cover image and quick link to open trip.
  - Curated Pakistan places section with 5 category filters (`All`, `Attraction`, `Scenic`, `Dining`, `Historic`) and 32 city filters.
  - Live photo synchronization via `fetchLiveCuratedAttractions`.
  - Floating "+ Plan New Trip" CTA opening `TripCreationWizard`.
- **Status:** **A. Fully equivalent and verified.**

### 4.2 Trip Creation Wizard
- **Mobile Component:** `src/components/trips/TripCreationWizard.js`
- **Steps:**
  1. *Destination*: Catalog selection or custom destination input with province guessing.
  2. *Dates & Budget*: Native `CalendarPicker` for start/end date selection; budget amount input.
  3. *Preferences*: Questionnaire (companion, travel style, budget tier, preferred categories).
  4. *Review & Places*: Pre-select attractions from catalog or search; generates initial daily schedule.
- **API Call:** `apiService.createTrip(token, newTrip)` -> `POST /trips`
- **Status:** **A. Fully equivalent and verified.**

### 4.3 Saved Trips List Screen
- **Mobile Component:** `src/screens/trips/TripsListScreen.js`
- **Features:**
  - Filter tabs: `All`, `Personal`, `Shared`, `Past`.
  - Search trips bar.
  - Trip cards with cover images, dates, duration, stop counts, Tripmate badges.
  - Three-dot options sheet: Open, Duplicate, Delete.
- **Status:** **B. Implemented but partially equivalent.**
  - *Defect:* Deleting a trip does not verify `!trip.isTripmate` before calling delete.

### 4.4 Activity History Screen
- **Mobile Component:** `src/screens/history/HistoryScreen.js`
- **API Call:** `apiService.getHistory(token)` -> `GET /history?limit=100`
- **Features:** Categorized event badges (`Created`, `Updated`, `Deleted`), timestamps, click-to-open trip.
- **Status:** **A. Fully equivalent and verified.**

---

## 5. Workspace & Itinerary Management

### 5.1 Day Architecture & Scheduling
- **Mobile Screens:** `src/screens/itinerary/ItineraryScreen.js`, `src/screens/trips/TripDetailScreen.js`
- **Operations:**
  - *Add Day*: Calls `addDay()` in context, appends next calendar date.
  - *Insert Day After*: Calls `insertDayAfter(dayId)` in context, shifts dates.
  - *Delete Day*: Calls `deleteDay(dayId)`, moves day's stops into `placesPool`.
  - *Edit Trip Dates*: Calls `updateTripDates(start, end)`, rebuilds days and relocates out-of-range stops to pool.
- **Status:** **A. Fully equivalent and verified.**

### 5.2 Stop / Location Management
- **Mobile Components:** `src/components/trips/DaySectionCard.js`, `src/components/places/PlaceItemCard.js`
- **Operations:**
  - *Add Stop*: Manual input, catalog search, or SerpAPI Google Maps search.
  - *Remove Stop*: Calls `removePlaceFromDay(dayId, placeId)`.
  - *Move Stop*: Move modal allows moving between any day and Places Pool.
  - *Reorder Stops*: Move up / move down buttons on each card.
  - *Time Scheduling*: Direct arrival/departure time modal (`formatTime12h`).
  - *Visit Tracking*: Mark visited checkbox; visit details modal (`visitedDate`, `visitedTime`, `visitLocation`, `notes`).
- **Status:** **A. Fully equivalent and verified.**

### 5.3 Notes & Checklists in Daily Containers
- **Operations:**
  - Add Note card: Rich text note with editing.
  - Add Checklist card: Multi-row checklist with checkable items.
- **Status:** **A. Fully equivalent and verified.**

### 5.4 Places Pool & Custom Lists
- **Mobile Screen:** `src/screens/saved/SavedPlacesScreen.js`
- **Features:**
  - Places Pool tab: View unscheduled places, assign to any day, clear pool.
  - Custom Lists tab: Create custom lists (e.g. "Packing", "Emergency Contacts"), add places or checklist rows, edit/delete list.
  - Global Wishlist tab: Bookmarked places from Explore.
- **Status:** **A. Fully equivalent and verified.**

### 5.5 Route Optimization Engine (TSP + OSRM)
- **Mobile Service:** `src/services/routeOptimizationService.js`
- **API Call:** `apiService.sequenceDay(payload)` -> `POST /v1/sequence/day`
- **Features:**
  - 2-Opt TSP solver via backend with OSRM road distance and driving times.
  - Automatically updates sequential times (09:30 AM start + travel times + 90 min visit duration).
  - Single-day optimization (`optimizeDayRoute`) and entire-itinerary optimization (`optimizeTripItinerary`).
  - Offline local fallback using Haversine calculation if backend is unreachable.
- **Status:** **A. Fully equivalent and verified.**

### 5.6 Map Visualization
- **Mobile Component:** `src/components/map/InteractiveMap.js`
- **Technology:** `react-native-webview` rendering Leaflet with CartoDB Positron / OSM tiles.
- **Features:**
  - Colored numbered pins matching day accent colors.
  - True OSRM road path polylines.
  - Marker tap synchronization with itinerary stop cards.
  - Split-screen map view in `ItineraryScreen.js`.
- **Status:** **A. Fully equivalent and verified.**

### 5.7 Workspace Topbar Three-Dot Action Menu
- **Mobile Screen:** `src/screens/itinerary/ItineraryScreen.js`, `src/screens/trips/TripDetailScreen.js`
- **Status:** **C. UI exists but functionality is missing / incomplete.**
  - In `ItineraryScreen.js`: No three-dot menu button exists in the top bar.
  - In `TripDetailScreen.js`: The ellipsis button is hardwired to open `handleOpenNotesModal`.
  - Actions missing from menu: Trip Settings (Privacy toggle), Trip Preferences & Engine, View Only Mode preview, Trip Journal modal, Select / Bulk mode.

### 5.8 Bulk Selection & Actions
- **Mobile Screens:** Not implemented.
- **Status:** **E. Completely missing in Mobile.**
  - Web allows selecting multiple stops across days and bulk moving, bulk copying, or bulk deleting them.

### 5.9 Undo / Redo Stack
- **Mobile Screens:** Not implemented.
- **Status:** **E. Completely missing in Mobile.**
  - Web tracks mutation history via `historyRef` with Undo and Redo topbar actions.

### 5.10 Live Weather on Itinerary Stop Cards
- **Mobile Screens:**
  - Home screen calls `getWeather` for the destination city.
  - Stop cards in `PlaceItemCard.js` do NOT call `useWeather` or render live temperature/weather icons.
- **Status:** **E. Completely missing on stop cards in Mobile.**

---

## 6. Collaboration, Tripmates & Sharing Permissions

### 6.1 Tripmates Collaboration
- **Mobile Screen / Sheet:** `src/screens/trips/TripDetailScreen.js` (`activeSheet === 'tripmates'`)
- **API Calls:**
  - `apiService.getTripMembers(token, tripId)` -> `GET /api/trips/{id}/members`
  - `apiService.inviteTripMember(token, tripId, identifier)` -> `POST /api/trips/{id}/members/invite`
  - `apiService.removeTripMember(token, tripId, userId)` -> `DELETE /api/trips/{id}/members/{userId}`
  - `apiService.getUserInvitations(token)` -> `GET /api/trips/invitations`
  - `apiService.respondToTripInvitation(token, inviteId, action)` -> `POST /api/trips/invitations/{id}/respond`
- **Features:** Shows owner, accepted members, pending invites; allows inviting by username/email; allows owner to revoke invites.
- **Status:** **A. Fully equivalent and verified.**

### 6.2 Token-Based Shared Trip Viewer & Can-Edit Copy Flow
- **Mobile Screen:** `src/screens/trips/PublicTripScreen.js`
- **Status:** **D. Functionality exists in API client but screen integration is incorrect.**
  - `PublicTripScreen.js` only accepts `tripId` and calls `getPublicTripById(tripId)`.
  - It does NOT accept `shareToken` or `editShareToken`.
  - It does NOT call `apiService.getSharedTrip` or `apiService.getSharedEditTrip`.
  - It does NOT support the Can-Edit copy flow (`copySharedEditTrip`).

### 6.3 Tripmate Member Trip Deletion Permission
- **Mobile Context:** `AppContext.js` (`deleteTrip`)
- **Status:** **B. Implemented but missing permission safeguard.**
  - Does NOT check `if (trip.isTripmate)` before attempting deletion.

---

## 7. Budget, Personal Expenses & Shared Budget

### 7.1 Personal Budget & Expenses
- **Mobile Screens:** `src/screens/trips/TripDetailScreen.js` (Budget tab)
- **Features:** Overall budget amount, currency, total spent, remaining balance, category breakdown chart (Transport, Food, Tickets, Hotel, Shopping, Misc), add/edit/delete personal expense.
- **Status:** **A. Fully equivalent and verified.**

### 7.2 Dedicated Shared Budget Subsystem
- **Mobile Component:** `src/components/trips/SharedBudgetModal.js`
- **API Calls:**
  - `apiService.listSharedBudgetExpenses` -> `GET /api/shared-budget/trips/{id}/expenses`
  - `apiService.createSharedBudgetExpense` -> `POST /api/shared-budget/trips/{id}/expenses`
  - `apiService.updateSharedBudgetExpense` -> `PUT /api/shared-budget/trips/{id}/expenses/{id}`
  - `apiService.deleteSharedBudgetExpense` -> `DELETE /api/shared-budget/trips/{id}/expenses/{id}`
  - `apiService.listSharedBudgetSettlements` -> `GET /api/shared-budget/trips/{id}/settlements`
  - `apiService.createSharedBudgetSettlement` -> `POST /api/shared-budget/trips/{id}/settlements`
  - `apiService.deleteSharedBudgetSettlement` -> `DELETE /api/shared-budget/trips/{id}/settlements/{id}`
- **Features:** Tabs: Expenses, Net Balances (who owes whom), Settlements; multi-payer split calculation; settlement recording.
- **Status:** **A. Fully equivalent and verified.**

---

## 8. Explore Places & SerpAPI Hotels

### 8.1 Explore Places
- **Mobile Screen:** `src/screens/explore/ExploreScreen.js`
- **API Calls:**
  - `apiService.getExplorePlaces` -> `GET /api/explore/places`
  - `apiService.getPlaceDetails` -> `GET /api/explore/place-details`
  - `apiService.getPlacePhotos` -> `GET /api/explore/place-photos`
- **Features:** Search places by query or GPS location ("Near Me"); view place details (reviews, operating hours, photos); add place directly to any trip day or pool; bookmark to wishlist.
- **Status:** **B. Implemented but partially equivalent.**
  - *Gap:* Only defines 4 categories (`Attraction`, `Scenic`, `Dining`, `Historic`). Missing `Hotels`, `Cafes`, `Nature`, `Shopping`.

### 8.2 Hotels Search & Lodging Integration
- **Mobile Screen:** `src/screens/explore/ExploreScreen.js`
- **Status:** **E. Completely missing in Mobile UI.**
  - No `Hotels` category tile.
  - No star rating filter (3★, 4★, 5★).
  - No external booking link or hotel wishlist filter.

---

## 9. AI Travel Assistant (Google Gemini)

- **Mobile Screen / Component:** **MISSING UI**
- **Underlying Support:**
  - `apiService.chatWithAi(prompt, tripContext)` -> `POST /api/ai/chat`
  - `AppContext.js` has `askAiAssistant(prompt, tripContext)`
- **Current Defect:** No screen, modal, or floating chat interface exists in Mobile to interact with the AI assistant.
- **Status:** **C. Underlying API exists but UI is completely missing.**

---

## 10. Print & Export

- **Mobile Screen:** `src/screens/trips/PrintTripScreen.js`
- **Features:**
  - Plain-text trip summary generator with native OS `Share.share`.
  - WebView printable HTML document view.
- **Status:** **A. Fully equivalent and verified.**

---

## 11. Administration Portal

- **Mobile Screen:** `src/screens/admin/AdminScreen.js`
- **API Calls:**
  - `apiService.getAdminOverview` -> `GET /admin/overview`
  - `apiService.getAdminUsers` -> `GET /admin/users`
  - `apiService.getAdminUserDetails` -> `GET /admin/users/{id}`
  - `apiService.updateAdminUserStatus` -> `PATCH /admin/users/{id}/status`
  - `apiService.updateAdminUserRole` -> `PATCH /admin/users/{id}/role`
  - `apiService.deleteAdminUser` -> `DELETE /admin/users/{id}`
  - `apiService.getAdminTrips` -> `GET /admin/trips`
  - `apiService.deleteAdminTrip` -> `DELETE /admin/trips/{id}`
- **Features:** Overview stats, users table with search and role/status filters, trip management with search and deletion.
- **Status:** **A. Fully equivalent and verified.**

