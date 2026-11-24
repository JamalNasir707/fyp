# TRIPNEST WEB VS MOBILE — FULL FUNCTIONAL PARITY MATRIX

**Second-Pass Exhaustive Parity Audit**  
**Date:** November 2026  
**Project Lead:** Arslan  
**Classification Taxonomy:**
- **Class A:** Fully equivalent and tested.
- **Class B:** Implemented but partially equivalent (minor sub-feature or behavior variance).
- **Class C:** UI exists but functionality is missing or placeholder.
- **Class D:** Functionality exists in service/API client but UI integration is missing or incorrect.
- **Class E:** Completely missing in Mobile.
- **Class F:** Not verified.

---

## 1. Authentication & Session Management

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 1.1 | Standard User Registration | `LoginPage.jsx` / `SignupForm.jsx` | `RegisterScreen.js` | `POST /auth/register` | `POST /auth/register` | **Class A** | Fully equivalent. Both validate unique username/email, enforce password rules, and create active user records in MongoDB. |
| 1.2 | Standard User Login | `LoginPage.jsx` / `LoginForm.jsx` | `LoginScreen.js` | `POST /auth/login` | `POST /auth/login` | **Class A** | Fully equivalent. Validates bcrypt password, checks for `status !== "suspended"` (HTTP 403), returns token + user payload. |
| 1.3 | Google OAuth Sign-In | `LoginPage.jsx` (`@react-oauth/google`) | `LoginScreen.js` (`@react-native-google-signin`) | `POST /auth/google` | `POST /auth/google` | **Class A** | Fully equivalent. Both exchange token with backend verification against Google tokeninfo/userinfo endpoints and `GOOGLE_CLIENT_ID`. |
| 1.4 | Guest Explorer Mode | N/A (Web requires account) | `LoginScreen.js` (`handleGuestExplore`) | N/A | Local Mock Session | **Class A** | Mobile enhancement. Allows non-registered users to explore destinations and preview itinerary planning. |
| 1.5 | Startup Session Verification | `AppContext.jsx` (`verify()`) | `AppContext.js` (`hydrateApp()`) | `POST /auth/verify` | `POST /auth/verify` | **Class A** | Fully equivalent. Both verify stored token against active MongoDB sessions on boot; invalid tokens clear cache. |
| 1.6 | User Logout | `TripHubHeader.jsx` / `TopbarMenu.jsx` | `SettingsScreen.js` / `ProfileScreen.js` | `POST /auth/logout` | `POST /auth/logout` | **Class A** | Fully equivalent. Invalidate backend session token and purge local storage tokens. |

---

## 2. User Profile, Settings & Social Network

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 2.1 | View & Edit Profile | `ProfilePage.jsx` / `ProfileEditModal.jsx` | `ProfileScreen.js` (Edit Modal) | `PUT /account/profile` | `PUT /account/profile` | **Class A** | Fully equivalent. Edits name, username, email, avatar, bio. Mobile adds home city, travel style, and interests. |
| 2.2 | Public User Discovery Search | `TripHubHeader.jsx` | `ProfileScreen.js` (Search Modal) | `GET /api/users/search` | `GET /api/users/search` | **Class A** | Fully equivalent. Regex fuzzy search across usernames and display names with live suggestion results. |
| 2.3 | Public Traveler Profile | `ProfilePage.jsx` (`/profile/:username`) | `UserProfileScreen.js` | `GET /api/users/by-username/{username}` | `GET /api/users/by-username/{username}` | **Class A** | Fully equivalent. Displays public avatar, bio, follower count, and public trips. |
| 2.4 | Follow & Unfollow Network | `ProfilePage.jsx` | `UserProfileScreen.js` | `POST /api/users/{username}/follow`, `DELETE` | `POST /api/users/{username}/follow`, `DELETE` | **Class A** | Fully equivalent. Toggles follow state, increments/decrements follower counts, logs follow activity. |
| 2.5 | Follow Stats & Status | `ProfilePage.jsx` | `UserProfileScreen.js` / `ProfileScreen.js` | `GET /api/users/{username}/follow-status` | `GET /api/users/{username}/follow-status` | **Class A** | Fully equivalent. Returns `{ followerCount, followingCount, isFollowing }`. |
| 2.6 | Notifications Center UI | `TripHubHeader.jsx` (Bell Icon + Dropdown) | **None** (Only pending invite cards on Home) | `GET /api/notifications` | `GET /api/notifications` (in client only) | **Class D** | **GAP 3:** Backend and API client exist, but Mobile has NO notification bell in header, no notification center modal or screen to view follow alerts or mark read. |
| 2.7 | Mark Notifications Read | `TripHubHeader.jsx` | `AppContext.js` (`markNotificationRead`) | `PATCH /api/notifications/{id}/read` | `PATCH /api/notifications/{id}/read` | **Class D** | API client exists in Mobile, but no user-facing UI triggers it. |
| 2.8 | Mark All Read | `TripHubHeader.jsx` | `AppContext.js` (`markAllNotificationsRead`) | `POST /api/notifications/read-all` | `POST /api/notifications/read-all` | **Class D** | API client exists in Mobile, but no user-facing UI triggers it. |
| 2.9 | Unit Preferences (Date, Dist, Time) | `SettingsPage.jsx` | `SettingsScreen.js` | Local storage | Local storage | **Class A** | Fully equivalent. Configures month-day/day-month, km/miles, 12h/24h. |
| 2.10 | Trip Planner Preferences | `SettingsPage.jsx` | `SettingsScreen.js` | Local storage | Local storage | **Class A** | Fully equivalent. Configures web place descriptions and expert tips. |
| 2.11 | Journal Photo Upload Policy | `SettingsPage.jsx` | `SettingsScreen.js` | Local storage | Local storage | **Class A** | Fully equivalent. Wi-Fi only vs Cellular + Wi-Fi. |
| 2.12 | Granular Notification Switches | `SettingsPage.jsx` | `SettingsScreen.js` | Local storage | Local storage | **Class A** | Fully equivalent. Email and push notification toggles. |
| 2.13 | Account Deletion with Reason | `SettingsPage.jsx` | `SettingsScreen.js` | `DELETE /account` | `DELETE /account` | **Class A** | Fully equivalent. Captures reason, requires confirmation checkbox, cascades trip/session deletions. |

---

## 3. Home Screen, Dashboard & Trip Planning

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 3.1 | Dashboard Hero & Greeting | `HomePage.jsx` | `HomeScreen.js` | N/A | N/A | **Class A** | Fully equivalent. Displays active/upcoming trip hero cover with dynamic greeting. |
| 3.2 | Destination Search with Live Suggestions | `TripHubHeader.jsx` | `HomeScreen.js` | Local catalog | Local catalog | **Class A** | Fully equivalent. Type-ahead suggestions for destinations and attractions. |
| 3.3 | Curated Attractions Section | `HomePage.jsx` / `Explore` | `HomeScreen.js` | `GET /api/explore/places` | `GET /api/explore/places` | **Class A** | Fully equivalent. Filtered by category and 32 Pakistani cities with live photo updates. |
| 3.4 | Plan New Trip Wizard / Modal | `PlanTripPage.jsx` | `TripCreationWizard.js` | `POST /trips` | `POST /trips` | **Class A** | Fully equivalent. Multi-step wizard validating dates, province guessing, budget, questionnaire, and generating daily containers. |
| 3.5 | Saved Trips Grid / List | `HomePage.jsx` / `SavedTripsGrid.jsx` | `TripsListScreen.js` | `GET /trips` + `GET /api/tripmates/shared-trips` | `GET /trips` + `GET /api/tripmates/shared-trips` | **Class A** | Fully equivalent. Combines owned and shared trips with Tripmate role badges. |
| 3.6 | Tripmate Shared Trip Deletion Guard | `AppContext.jsx` (`removeTrip`) | `AppContext.js` (`deleteTrip`) | Frontend Guard | Missing Guard | **Class B** | **SECURITY GAP:** Web strictly blocks collaborators (`if (record.isTripmate) throw Error`). Mobile allows collaborator to trigger delete. |
| 3.7 | Activity History Log | `HistoryPage.jsx` | `HistoryScreen.js` | `GET /history?limit=100` | `GET /history?limit=100` | **Class A** | Fully equivalent. Displays activity stream (created, updated, renamed, deleted) with timestamps. |

---

## 4. Workspace & Itinerary Management

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 4.1 | Day Containers (1 to N Days) | `WorkspacePage.jsx` | `ItineraryScreen.js` | N/A | N/A | **Class A** | Fully equivalent. Seamlessly handles trips of any duration with calendar dates. |
| 4.2 | Add Day | `WorkspacePage.jsx` (`addDay`) | `ItineraryScreen.js` (`addDay`) | N/A | N/A | **Class A** | Fully equivalent. Appends day and computes next calendar date. |
| 4.3 | Insert Day After | `WorkspacePage.jsx` (`insertDayAfter`) | `ItineraryScreen.js` (`insertDayAfter`) | N/A | N/A | **Class A** | Fully equivalent. Inserts day at arbitrary index and shifts downstream dates. |
| 4.4 | Delete Day (Safe Preservation) | `WorkspacePage.jsx` (`deleteDay`) | `ItineraryScreen.js` (`deleteDay`) | N/A | N/A | **Class A** | Fully equivalent. Deletes day and safely relocates all its items to `placesPool`. |
| 4.5 | Edit Trip Dates Modal | `WorkspacePage.jsx` (`dateModalOpen`) | `ItineraryScreen.js` (`datesModalVisible`) | N/A | N/A | **Class A** | Fully equivalent. Rebuilds days and safely preserves out-of-range stops in `placesPool`. |
| 4.6 | Add Stop to Day | `WorkspacePage.jsx` (`submitQuickPlace`) | `ItineraryScreen.js` (`handleAddStopSubmit`) | N/A | N/A | **Class A** | Fully equivalent. Adds place with title, category, coords, notes. |
| 4.7 | Remove Stop from Day | `WorkspacePage.jsx` (`removeItem`) | `ItineraryScreen.js` (`removePlaceFromDay`) | N/A | N/A | **Class A** | Fully equivalent. Removes stop, linked expenses, and unselects map pin. |
| 4.8 | Move Stop Between Days & Pool | `WorkspacePage.jsx` / `ArrangementModal` | `ItineraryScreen.js` (Move Modal) | N/A | N/A | **Class A** | Fully equivalent. Relocates stop between any daily bucket and Places Pool. |
| 4.9 | Reorder Stops Within Day | `WorkspacePage.jsx` (Drag-and-Drop) | `ItineraryScreen.js` (Up/Down Buttons) | N/A | N/A | **Class A** | Fully equivalent. Modifies item sequence within container. |
| 4.10 | 12-Hour Time Scheduling | `PlannerItemCard.jsx` (`savePlaceTime`) | `ItineraryScreen.js` (Time Modal) | N/A | N/A | **Class A** | Fully equivalent. Arrival and departure time inputs formatted via `formatTime12h`. |
| 4.11 | Visit Journal & Mark Visited | `PlannerItemCard.jsx` (`saveVisitModal`) | `ItineraryScreen.js` (`detailsModalVisible`) | N/A | N/A | **Class A** | Fully equivalent. Visited checkbox, visited date, visited time, visit location, journal notes. |
| 4.12 | Note Items in Daily Containers | `WorkspacePage.jsx` (`createNoteItem`) | `ItineraryScreen.js` (`itemTypeToAdd === 'note'`) | N/A | N/A | **Class A** | Fully equivalent. Rich text notes stored alongside places. |
| 4.13 | Checklist Items in Daily Containers | `WorkspacePage.jsx` (`createChecklistItem`) | `ItineraryScreen.js` (`itemTypeToAdd === 'checklist'`) | N/A | N/A | **Class A** | Fully equivalent. Multi-row interactive checklists with checkable items. |
| 4.14 | Places Pool Management | `WorkspacePage.jsx` (`placesPool`) | `SavedPlacesScreen.js` (Pool Tab) | N/A | N/A | **Class A** | Fully equivalent. Unscheduled place holding pen, move to day, clear pool. |
| 4.15 | Custom Lists | `WorkspacePage.jsx` (`customLists`) | `SavedPlacesScreen.js` (Custom Lists Tab) | N/A | N/A | **Class A** | Fully equivalent. Custom lists with places and checklists. |
| 4.16 | Route Optimization (TSP 2-Opt) | `WorkspacePage.jsx` (`optimizeDay`) | `ItineraryScreen.js` (`optimizeDayRoute`) | `POST /v1/sequence/day` | `POST /v1/sequence/day` | **Class A** | Fully equivalent. 2-Opt TSP, OSRM road distance, duration, sequential 09:30 AM recalculation, distance saved banner. |
| 4.17 | Entire Itinerary Optimization | N/A (Web optimizes day-by-day) | `ItineraryScreen.js` (`optimizeTripItinerary`) | `POST /v1/sequence/day` in loop | `POST /v1/sequence/day` in loop | **Class A** | Mobile enhancement. Batch-optimizes all itinerary days in a single action. |
| 4.18 | Suggestion Engine Generator | `WorkspacePage.jsx` (`POST /optimize`) | N/A | `POST /optimize` | Missing Call | **Class B** | Mobile collects questionnaire in wizard, but lacks the workspace "Get suggestions" modal calling `POST /optimize` to generate complete proposed itineraries. |
| 4.19 | Map Visualization & Road Routes | `PlannerMapPanel.jsx` (Leaflet) | `InteractiveMap.js` (WebView Leaflet) | OSM / CartoDB tiles | OSM / CartoDB tiles | **Class A** | Fully equivalent. Color-coded pins, numbered markers, OSRM road path polylines, split-screen toggle. |
| 4.20 | Live Weather on Stop Cards | `PlannerItemCard.jsx` (`useWeather`) | **None** | `GET /weather` | `GET /weather` (Home only) | **Class E** | **NEW GAP:** Web displays live temperature, humidity, wind, and conditions on each stop card. Mobile stop cards omit weather. |
| 4.21 | Workspace Topbar 3-Dot Menu | `TopbarMenu.jsx` | **None / Notes only** | N/A | N/A | **Class C** | **GAP 1:** `ItineraryScreen.js` has no 3-dot menu. `TripDetailScreen.js` ellipsis button only opens notes modal. Missing: Trip Settings (Privacy), Engine Preferences, View-Only preview, Trip Journal, Select mode, Print. |
| 4.22 | Day Section 3-Dot Menu | `SectionMenu.jsx` | Inline button | N/A | N/A | **Class B** | Web has dropdown menu for rearranging, color selection, selecting all in day, insert day after, delete day. Mobile uses inline buttons. |
| 4.23 | Undo / Redo History Stack | `WorkspacePage.jsx` (`handleUndo`/`handleRedo`) | **None** | Client State | Missing | **Class E** | **NEW GAP:** Web has multi-step Undo/Redo stack for workspace operations. Mobile lacks Undo/Redo. |
| 4.24 | Bulk Selection & Multi-Actions | `WorkspacePage.jsx` (`bulkMode`, `BulkActionBar`) | **None** | Client State | Missing | **Class E** | **NEW GAP:** Web allows selecting multiple stops across containers for bulk move, bulk copy, and bulk delete. Mobile lacks bulk selection. |

---

## 5. Collaboration, Tripmates & Sharing Permissions

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 5.1 | Invite Collaborator | `TripmatesModal.jsx` | `TripDetailScreen.js` (Tripmates Sheet) | `POST /api/trips/{id}/members/invite` | `POST /api/trips/{id}/members/invite` | **Class A** | Fully equivalent. Invites by username or email. |
| 5.2 | View Members & Pending Invites | `TripmatesModal.jsx` | `TripDetailScreen.js` (Tripmates Sheet) | `GET /api/trips/{id}/members` | `GET /api/trips/{id}/members` | **Class A** | Fully equivalent. Lists owner, accepted members, and pending invitations. |
| 5.3 | Accept / Decline Invitation | `TripHubHeader.jsx` | `HomeScreen.js` (Pending Invites Card) | `POST /api/trips/invitations/{id}/respond` | `POST /api/trips/invitations/{id}/respond` | **Class A** | Fully equivalent. Responds with 'accept' or 'decline', updates membership status. |
| 5.4 | Remove Collaborator / Revoke Invite | `TripmatesModal.jsx` | `TripDetailScreen.js` (Tripmates Sheet) | `DELETE /api/trips/{id}/members/{userId}` | `DELETE /api/trips/{id}/members/{userId}` | **Class A** | Fully equivalent. Owner can remove members or revoke invitations. |
| 5.5 | Tripmate Itinerary Update | `AppContext.jsx` (`saveTrip`) | `AppContext.js` (`persistTripAsync`) | `PUT /api/tripmates/trips/{id}/itinerary` | `PUT /api/tripmates/trips/{id}/itinerary` | **Class A** | Fully equivalent. Collaborators update `days`, `placesPool`, and `customLists`. |
| 5.6 | Dedicated Tripmate Workspace | `TripmateWorkspacePage.jsx` | `TripDetailScreen.js` / `ItineraryScreen.js` | `GET /api/tripmates/trips/{id}` | `GET /api/tripmates/trips/{id}` | **Class A** | Fully equivalent. Accepted Tripmates access shared itinerary with collaborator badge and editing rights. |
| 5.7 | View-Only Share Token | `WorkspacePage.jsx` (Share Modal) | `TripDetailScreen.js` (Share Sheet) | `POST /trips/{id}/share-token` | `POST /trips/{id}/share-token` | **Class A** | Fully equivalent. Generates `sh_view_...` token and shareable URL. |
| 5.8 | Can-Edit Share Token | `WorkspacePage.jsx` (Share Modal) | `TripDetailScreen.js` (Share Sheet) | `POST /trips/{id}/share-token` | `POST /trips/{id}/share-token` | **Class A** | Fully equivalent. Generates `sh_edit_...` token. |
| 5.9 | Token-Based Shared Trip Viewer | `TripViewPage.jsx` (`/share/:token`) | `PublicTripScreen.js` | `GET /trips/shared/{token}` | Missing Call | **Class D** | **GAP 4:** `PublicTripScreen.js` only accepts database ID `tripId`. It does not accept `shareToken` or call `GET /trips/shared/{token}`. |
| 5.10 | Can-Edit Copy Duplication Flow | `TripViewPage.jsx` (`/share/edit/:token`) | `PublicTripScreen.js` | `POST /trips/shared/edit/{token}/copy` | Missing Call | **Class D** | **GAP 4:** `copySharedEditTrip` exists in `apiService.js` but is NOT called in `PublicTripScreen.js`. |
| 5.11 | Public Trips Read | `PublicTripPage.jsx` | `PublicTripScreen.js` | `GET /api/trips/public/{id}` | `GET /api/trips/public/{id}` | **Class A** | Fully equivalent. Accessible publicly if `privacy === "public"`. |

---

## 6. Budget, Expenses & Shared Budget

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 6.1 | Personal Trip Budget Cap | `WorkspacePage.jsx` (Budget Modal) | `TripDetailScreen.js` (Budget Modal) | Embedded in trip doc | Embedded in trip doc | **Class A** | Fully equivalent. Sets target budget amount and currency. |
| 6.2 | Personal Expenses CRUD | `WorkspacePage.jsx` | `TripDetailScreen.js` (Budget Tab) | Embedded in trip doc | Embedded in trip doc | **Class A** | Fully equivalent. Adds, edits, deletes personal expenses with category breakdown. |
| 6.3 | Shared Budget Expenses CRUD | `SharedBudgetSection.jsx` | `SharedBudgetModal.js` | `GET`, `POST`, `PUT`, `DELETE /api/shared-budget/trips/{id}/expenses` | Same endpoints | **Class A** | Fully equivalent. Multi-payer expenses, custom shares, category filters. |
| 6.4 | Shared Budget Settlements | `SharedBudgetSection.jsx` | `SharedBudgetModal.js` | `GET`, `POST`, `DELETE /api/shared-budget/trips/{id}/settlements` | Same endpoints | **Class A** | Fully equivalent. Records debt repayments between members and recalculates net balances. |
| 6.5 | Net Debt Balance Calculation | `SharedBudgetSection.jsx` | `SharedBudgetModal.js` | Frontend Math | Frontend Math | **Class A** | Fully equivalent. Computes who owes whom across all shared expenses and settlements. |

---

## 7. Explore, Places & SerpAPI Hotels

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 7.1 | Explore Places Search | `WorkspacePage.jsx` (Explore) | `ExploreScreen.js` | `GET /api/explore/places` | `GET /api/explore/places` | **Class A** | Fully equivalent. Searches places via SerpAPI Google Maps with in-memory caching. |
| 7.2 | Place Details & Reviews | `WorkspacePage.jsx` | `ExploreScreen.js` (Details Modal) | `GET /api/explore/place-details` | `GET /api/explore/place-details` | **Class A** | Fully equivalent. Fetches reviews, operating hours, phone, address. |
| 7.3 | Place Photo Gallery | `WorkspacePage.jsx` | `ExploreScreen.js` (Details Modal) | `GET /api/explore/place-photos` | `GET /api/explore/place-photos` | **Class A** | Fully equivalent. Fetches high-resolution images. |
| 7.4 | Explore Categories | `WorkspacePage.jsx` (8 categories) | `ExploreScreen.js` (4 categories) | Query parameters | Query parameters | **Class B** | **GAP 2:** Web supports 8 categories (`All`, `Attractions`, `Restaurants`, `Cafes`, `Hotels`, `Nature`, `Historical`, `Shopping`). Mobile only has 4 (`Attraction`, `Scenic`, `Dining`, `Historic`). |
| 7.5 | Hotels Search & Lodging Integration | `WorkspacePage.jsx` | **None** | `GET /api/explore/places?query=Hotels...` | Missing | **Class E** | **GAP 2:** Mobile completely omits the "Hotels" category tile, star rating filters (3★, 4★, 5★), and external hotel booking redirect buttons. |

---

## 8. AI Travel Assistant (Google Gemini)

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 8.1 | AI Travel Assistant Chatbot | `AiAssistantModal.jsx` | **None** (Only `apiService.chatWithAi`) | `POST /api/ai/chat` | `POST /api/ai/chat` (in client only) | **Class C** | **GAP 7:** Backend endpoint and mobile client wrapper exist, but there is NO Chatbot UI, screen, modal, or floating action button in Mobile. |
| 8.2 | Itinerary Context Injection | `AiAssistantModal.jsx` (`buildTripContextSummary`) | `AppContext.js` (`tripContext` param) | Body `trip_context` | Body `trip_context` | **Class C** | Web builds full markdown itinerary summary into the prompt; Mobile has the client parameter but no UI to invoke it. |
| 8.3 | Interactive AI Travel Cards | `AiTravelCards.jsx` | **None** | Markdown payloads | None | **Class E** | Web renders interactive cards (`RestaurantCard`, `HotelCard`, `AttractionCard`, `ChecklistCard`, `DayPlanCard`) inside the chat stream. |

---

## 9. Print & Export

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 9.1 | Print / Export Trip Document | `PrintTripPage.jsx` | `PrintTripScreen.js` | Local Snapshot | Route Params | **Class A** | Fully equivalent. Web uses `window.print()`; Mobile provides WebView HTML print document and OS native text sharing (`Share.share`). |

---

## 10. Administration Portal

| # | Feature / Sub-Feature | Web Component | Mobile Component | Web API Endpoint | Mobile API Endpoint | Classification | Parity Analysis & Notes |
|---|---|---|---|---|---|:---:|---|
| 10.1 | Admin Overview Metrics | `AdminPage.jsx` / `AV2DashboardPage.jsx` | `AdminScreen.js` (Overview Tab) | `GET /admin/overview` | `GET /admin/overview` | **Class A** | Fully equivalent. Displays counts for total users, total trips, and active sessions. |
| 10.2 | Admin Users Management | `AdminPage.jsx` / `AV2UsersPage.jsx` | `AdminScreen.js` (Users Tab) | `GET /admin/users` | `GET /admin/users` | **Class A** | Fully equivalent. Filter by role, status, provider, with user search. |
| 10.3 | Admin User Status Update | `AdminPage.jsx` | `AdminScreen.js` | `PATCH /admin/users/{id}/status` | `PATCH /admin/users/{id}/status` | **Class A** | Fully equivalent. Suspend and activate users. |
| 10.4 | Admin User Role Update | `AdminPage.jsx` | `AdminScreen.js` | `PATCH /admin/users/{id}/role` | `PATCH /admin/users/{id}/role` | **Class A** | Fully equivalent. Promote to admin or demote to user. |
| 10.5 | Admin Delete User | `AdminPage.jsx` | `AdminScreen.js` | `DELETE /admin/users/{id}` | `DELETE /admin/users/{id}` | **Class A** | Fully equivalent. Permanently deletes user account. |
| 10.6 | Admin Trips Management | `AdminPage.jsx` / `AV2TripsPage.jsx` | `AdminScreen.js` (Trips Tab) | `GET /admin/trips` | `GET /admin/trips` | **Class A** | Fully equivalent. Lists all trips with search query. |
| 10.7 | Admin Delete Trip | `AdminPage.jsx` | `AdminScreen.js` | `DELETE /admin/trips/{id}` | `DELETE /admin/trips/{id}` | **Class A** | Fully equivalent. Admin deletion of any trip. |

