# TRIPNEST WEB API VS MOBILE API COVERAGE AUDIT

**Exhaustive Backend & Endpoint Consumption Audit**  
**Project Lead:** Arslan  
**Date:** November 2026 (Second-Pass Deep Audit)  
**Backend Framework:** FastAPI (Python 3.11)  
**Web HTTP Client:** Fetch API (`src/lib/session.js`)  
**Mobile HTTP Client:** Fetch API / unified switcher (`src/api/client.js`, `src/api/apiService.js`)

---

## 1. Master Backend Endpoint Inventory & Coverage

| Endpoint Path | HTTP Method | Auth Required | Consumed by Web? | Consumed by Mobile? | Mobile Coverage Status | Audit Notes |
|---|---|:---:|:---:|:---:|:---:|---|
| `/auth/register` | `POST` | No | Yes (`registerRequest`) | Yes (`apiService.register`) | **Full Parity** | Identical request payload `{ username, email, password }` and response format. |
| `/auth/login` | `POST` | No | Yes (`loginRequest`) | Yes (`apiService.login`) | **Full Parity** | Identical request payload `{ username, password }`. Both check 403 suspended status. |
| `/auth/google` | `POST` | No | Yes (`googleLoginRequest`) | Yes (`apiService.googleLogin`) | **Full Parity** | Web passes `access_token`; Mobile passes `id_token` or `access_token`. Backend supports both. |
| `/auth/verify` | `POST` | No | Yes (`verifyTokenRequest`) | Yes (`apiService.verifyToken`) | **Full Parity** | Payload `{ token }`. Hydrates session on startup. |
| `/auth/logout` | `POST` | No | Yes (`logoutRequest`) | Yes (`apiService.logout`) | **Full Parity** | Invalidate active MongoDB session token. |
| `/account/profile` | `PUT` | Bearer Token | Yes (`updateProfileRequest`) | Yes (`apiService.updateProfile`) | **Full Parity** | Both send `{ name, username, email, profileImage, bio }`. |
| `/account` | `DELETE` | Bearer Token | Yes (`deleteAccountRequest`) | Yes (`apiService.deleteAccount`) | **Full Parity** | Both send optional `{ reason }`. Deletes user and associated data. |
| `/trips` | `GET` | Bearer Token | Yes (`fetchTripsRequest`) | Yes (`apiService.getTrips`) | **Full Parity** | Returns `{ success: true, trips: [] }`. |
| `/trips` | `POST` | Bearer Token | Yes (`createTripRequest`) | Yes (`apiService.createTrip`) | **Full Parity** | Sends `{ trip: {...} }`. Persists initial itinerary. |
| `/trips/{trip_id}` | `PUT` | Bearer Token | Yes (`updateTripRequest`) | Yes (`apiService.updateTrip`) | **Full Parity** | Sends `{ trip: {...} }`. Updates owned trip document. |
| `/trips/{trip_id}` | `DELETE` | Bearer Token | Yes (`deleteTripRequest`) | Yes (`apiService.deleteTrip`) | **Discrepancy in Guard** | Web guards against Tripmate deleting shared trip. Mobile client calls endpoint without frontend guard. |
| `/trips/{trip_id}/share-token` | `POST` | Bearer Token | Yes (`getTripShareTokenRequest`) | Yes (`apiService.getTripShareToken`) | **Full Parity** | Payload `{ permission: 'view' \| 'edit' }`. Returns `{ shareToken }`. |
| `/trips/shared/{share_token}` | `GET` | No | Yes (`fetchSharedTripRequest`) | Defined in client, **Not called in UI** | **Unconsumed in Mobile UI** | `PublicTripScreen.js` fails to consume this endpoint when a user opens a view-only share link. |
| `/trips/shared/edit/{token}` | `GET` | No | Yes (`fetchSharedEditTripRequest`) | Defined in client, **Not called in UI** | **Unconsumed in Mobile UI** | `PublicTripScreen.js` fails to consume this endpoint when a user opens an edit share link. |
| `/trips/shared/edit/{token}/copy` | `POST` | Bearer Token | Yes (`copySharedEditTripRequest`) | Defined in client, **Not called in UI** | **Unconsumed in Mobile UI** | Mobile UI has no button or handler to clone/duplicate the shared trip into user's account. |
| `/api/trips/public/{trip_id}` | `GET` | No | Yes (`PublicTripPage`) | Yes (`PublicTripScreen`) | **Full Parity** | Only returns trip if marked `privacy: "public"`. |
| `/api/trips/{id}/members/invite` | `POST` | Bearer Token | Yes (`sendTripInvitationRequest`) | Yes (`apiService.inviteTripMember`) | **Full Parity** | Payload `{ identifier: username \| email }`. |
| `/api/trips/{id}/members` | `GET` | Bearer Token | Yes (`getTripMembersRequest`) | Yes (`apiService.getTripMembers`) | **Full Parity** | Returns `{ owner, members: [], pendingInvites: [] }`. |
| `/api/trips/invitations` | `GET` | Bearer Token | Yes (`getUserInvitationsRequest`) | Yes (`apiService.getUserInvitations`) | **Full Parity** | Returns pending invites for current user. |
| `/api/trips/invitations/{id}/respond` | `POST` | Bearer Token | Yes (`respondToTripInvitationRequest`) | Yes (`apiService.respondToTripInvitation`) | **Full Parity** | Payload `{ action: 'accept' \| 'decline' }`. |
| `/api/trips/{id}/members/{user_id}` | `DELETE` | Bearer Token | Yes (`removeTripMemberRequest`) | Yes (`apiService.removeTripMember`) | **Full Parity** | Owner removes member or revokes pending invite. |
| `/api/tripmates/trips/{trip_id}` | `GET` | Bearer Token | Yes (`getSharedTripmateTripRequest`) | Yes (`apiService.getSharedTripmateTrip`) | **Full Parity** | Returns canonical shared trip document for accepted member. |
| `/api/tripmates/trips/{trip_id}/itinerary` | `PUT` | Bearer Token | Yes (`updateTripmateItineraryRequest`) | Yes (`apiService.updateTripmateItinerary`) | **Full Parity** | Payload `{ days, placesPool, customLists }`. Allows collaborator edits without altering owner metadata. |
| `/api/tripmates/shared-trips` | `GET` | Bearer Token | Yes (`fetchMySharedTripmateTripsRequest`) | Yes (`apiService.getSharedTripmateTrips`) | **Full Parity** | Returns list of trips where user is an accepted collaborator. |
| `/api/shared-budget/trips/{id}/expenses` | `GET` | Bearer Token | Yes (`listSharedBudgetExpensesRequest`) | Yes (`apiService.listSharedBudgetExpenses`) | **Full Parity** | Returns shared expenses with payers and participant shares. |
| `/api/shared-budget/trips/{id}/expenses` | `POST` | Bearer Token | Yes (`createSharedBudgetExpenseRequest`) | Yes (`apiService.createSharedBudgetExpense`) | **Full Parity** | Creates shared expense. |
| `/api/shared-budget/trips/{id}/expenses/{id}` | `PUT` | Bearer Token | Yes (`updateSharedBudgetExpenseRequest`) | Yes (`apiService.updateSharedBudgetExpense`) | **Full Parity** | Updates shared expense. |
| `/api/shared-budget/trips/{id}/expenses/{id}` | `DELETE` | Bearer Token | Yes (`deleteSharedBudgetExpenseRequest`) | Yes (`apiService.deleteSharedBudgetExpense`) | **Full Parity** | Deletes shared expense. |
| `/api/shared-budget/trips/{id}/settlements` | `GET` | Bearer Token | Yes (`listSharedBudgetSettlementsRequest`) | Yes (`apiService.listSharedBudgetSettlements`) | **Full Parity** | Returns debt repayments. |
| `/api/shared-budget/trips/{id}/settlements` | `POST` | Bearer Token | Yes (`createSharedBudgetSettlementRequest`) | Yes (`apiService.createSharedBudgetSettlement`) | **Full Parity** | Records settlement payment. |
| `/api/shared-budget/trips/{id}/settlements/{id}` | `DELETE` | Bearer Token | Yes (`deleteSharedBudgetSettlementRequest`) | Yes (`apiService.deleteSharedBudgetSettlement`) | **Full Parity** | Deletes settlement payment. |
| `/api/explore/places` | `GET` | No | Yes (`fetchExplorePlacesRequest`) | Yes (`apiService.getExplorePlaces`) | **Query Difference** | Web queries all 8 categories including "Hotels in ...". Mobile only queries 4 categories and omits Hotels. |
| `/api/explore/place-details` | `GET` | No | Yes (`fetchPlaceDetailsRequest`) | Yes (`apiService.getPlaceDetails`) | **Full Parity** | Params `place_id`, `data_id`. Returns operating hours, reviews, phone. |
| `/api/explore/place-photos` | `GET` | No | Yes (`fetchPlacePhotosRequest`) | Yes (`apiService.getPlacePhotos`) | **Full Parity** | Returns photo URLs. |
| `/api/users/search` | `GET` | No | Yes (`searchUsersRequest`) | Yes (`apiService.searchUsers`) | **Full Parity** | Query `?q={query}&limit=8`. |
| `/api/users/by-username/{username}` | `GET` | No | Yes (`fetchPublicUserByUsernameRequest`) | Yes (`apiService.getPublicUserByUsername`) | **Full Parity** | Public profile lookup. |
| `/api/users/{username}/public-trips` | `GET` | No | Yes (`fetchPublicTripsByUsernameRequest`) | Yes (`apiService.getPublicTripsByUsername`) | **Full Parity** | List public trips for user. |
| `/api/users/{username}/follow` | `POST` | Bearer Token | Yes (`followUserRequest`) | Yes (`apiService.followUser`) | **Full Parity** | Follows user. |
| `/api/users/{username}/follow` | `DELETE` | Bearer Token | Yes (`unfollowUserRequest`) | Yes (`apiService.unfollowUser`) | **Full Parity** | Unfollows user. |
| `/api/users/{username}/follow-status` | `GET` | Optional Token | Yes (`fetchFollowStatusRequest`) | Yes (`apiService.getFollowStatus`) | **Full Parity** | Returns follower counts and `isFollowing`. |
| `/api/notifications` | `GET` | Bearer Token | Yes (`fetchNotificationsRequest`) | Defined in client, **Not called in UI** | **Unconsumed in Mobile UI** | Mobile has no notification center bell or screen. |
| `/api/notifications/{id}/read` | `PATCH` | Bearer Token | Yes (`markNotificationAsReadRequest`) | Defined in client, **Not called in UI** | **Unconsumed in Mobile UI** | No UI triggers single notification read. |
| `/api/notifications/read-all` | `POST` | Bearer Token | Yes (`markAllNotificationsAsReadRequest`) | Defined in client, **Not called in UI** | **Unconsumed in Mobile UI** | No UI triggers mark all as read. |
| `/api/ai/chat` | `POST` | No | Yes (`AiAssistantModal.jsx`) | Defined in client, **Not called in UI** | **Unconsumed in Mobile UI** | Mobile has `apiService.chatWithAi` but no chatbot screen or modal. |
| `/v1/sequence/day` | `POST` | No | Yes (`optimizeDay`) | Yes (`apiService.sequenceDay`) | **Full Parity** | 2-Opt TSP solver + OSRM road distance routing. |
| `/optimize` | `POST` | No | Yes (`WorkspacePage.jsx`) | **Not consumed in Mobile** | **Unconsumed in Mobile** | Web runs complete questionnaire scoring and candidate clustering; Mobile uses local wizard presets. |
| `/weather` | `GET` | No | Yes (`useWeather` on stop card) | Yes (`HomeScreen.js` only) | **Partial Consumption** | Web consumes `/weather` for every stop card. Mobile only consumes it on Home for the main city. |
| `/history` | `GET` | Bearer Token | Yes (`fetchActivityHistoryRequest`) | Yes (`apiService.getHistory`) | **Full Parity** | Activity audit log. |
| `/admin/overview` | `GET` | Bearer Admin | Yes (`fetchAdminOverviewRequest`) | Yes (`apiService.getAdminOverview`) | **Full Parity** | System counts. |
| `/admin/users` | `GET` | Bearer Admin | Yes (`fetchAdminUsersRequest`) | Yes (`apiService.getAdminUsers`) | **Full Parity** | User listing and search. |
| `/admin/users/{id}` | `GET` | Bearer Admin | Yes (`fetchAdminUserDetailsRequest`) | Yes (`apiService.getAdminUserDetails`) | **Full Parity** | User details and activity. |
| `/admin/users/{id}/status` | `PATCH` | Bearer Admin | Yes (`updateUserStatusRequest`) | Yes (`apiService.updateAdminUserStatus`) | **Full Parity** | Suspend/activate user. |
| `/admin/users/{id}/role` | `PATCH` | Bearer Admin | Yes (`updateUserRoleRequest`) | Yes (`apiService.updateAdminUserRole`) | **Full Parity** | Change role (`admin`/`user`). |
| `/admin/users/{id}` | `DELETE` | Bearer Admin | Yes (`deleteUserRequest`) | Yes (`apiService.deleteAdminUser`) | **Full Parity** | Admin delete user. |
| `/admin/trips` | `GET` | Bearer Admin | Yes (`fetchAdminTripsRequest`) | Yes (`apiService.getAdminTrips`) | **Full Parity** | List all trips. |
| `/admin/trips/{id}` | `DELETE` | Bearer Admin | Yes (`deleteAdminTripRequest`) | Yes (`apiService.deleteAdminTrip`) | **Full Parity** | Admin delete trip. |

---

## 2. Detailed Discrepancy & Gap Breakdown

### 2.1 Backend Endpoints with Client Code but Missing UI Presentation in Mobile
1. **`GET /api/notifications`**, **`PATCH /api/notifications/{id}/read`**, **`POST /api/notifications/read-all`**:
   - `client.js` and `apiService.js` implement these methods perfectly.
   - `AppContext.js` wraps them in `loadNotifications`, `markNotificationRead`, and `markAllNotificationsRead`.
   - **Defect:** No screen or header icon triggers these calls in Mobile.
2. **`POST /api/ai/chat`**:
   - `client.js` implements `chatWithAi(prompt, tripContext)`.
   - `AppContext.js` wraps it in `askAiAssistant`.
   - **Defect:** No Chatbot modal, screen, or floating button exists in Mobile.
3. **`GET /trips/shared/{share_token}`** and **`GET /trips/shared/edit/{token}`**:
   - `client.js` implements `getSharedTrip` and `getSharedEditTrip`.
   - **Defect:** `PublicTripScreen.js` ignores token parameters and only calls `getPublicTripById(tripId)`.
4. **`POST /trips/shared/edit/{token}/copy`**:
   - `client.js` implements `copySharedEditTrip(token, editShareToken)`.
   - **Defect:** Never invoked anywhere in Mobile UI.

### 2.2 Endpoints Completely Missing Consumption in Mobile
1. **`POST /optimize`**:
   - The engine suggestion generator endpoint is heavily used in Web to score, cluster, and rank candidate attractions across an entire province based on constraints (max budget, max travel hours, crowd preferences, weights).
   - In Mobile, this endpoint is never called; Mobile relies strictly on local catalog presets in `TripCreationWizard.js`.

### 2.3 Endpoints with Partial Query Parameter Mismatches
1. **`GET /api/explore/places`**:
   - In Web, the user can query 8 categories, including `Hotels in {destination}`. The backend serpapi service handles lodging searches and returns hotel-specific fields.
   - In Mobile, `ExploreScreen.js` restricts searches to 4 non-hotel categories (`Attraction`, `Scenic`, `Dining`, `Historic`).
2. **`GET /weather`**:
   - In Web, `PlannerItemCard.jsx` consumes this endpoint for every stop in the workspace with valid coordinates (`useWeather(place)`).
   - In Mobile, only `HomeScreen.js` consumes it once for the destination city; individual stops in `ItineraryScreen.js` do not show live weather.

### 2.4 Authorization & Ownership Check Differences
1. **Trip Deletion Ownership Verification**:
   - In Web (`AppContext.jsx`):
     ```javascript
     if (record?.isTripmate) {
       throw new Error('Tripmate members cannot delete shared trips.')
     }
     ```
   - In Mobile (`AppContext.js`):
     ```javascript
     async function deleteTrip(tripId) {
       // NO CHECK FOR record.isTripmate!
       await apiService.deleteTrip(token, tripId)
     }
     ```
   - A collaborator can attempt to delete a shared trip from mobile. Although the backend will reject unauthorized deletion if the requester is not the document owner, the mobile UI optimistically purges the trip locally from `savedTrips`, causing state desynchronization.

