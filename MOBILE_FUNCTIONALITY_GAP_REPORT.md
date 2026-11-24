# TRIPNEST MOBILE — WORKFLOW PARITY & FUNCTIONALITY GAP REPORT

**End-to-End User Journey Audit**  
**Project Lead:** Arslan  
**Date:** November 2026 (Second-Pass Deep Audit)

---

## 1. Executive Summary

This report traces complete, multi-step user workflows through TripNest Web and compares them step-by-step against TripNest Mobile.  
While atomic unit operations (such as registering, fetching trips, or viewing a map) often succeed independently, the end-to-end user workflows break down at specific transition points in Mobile.

---

## 2. Workflow 1: Trip Lifecycle & Workspace Persistence
**Flow:** `Register → Login → Create Trip → Schedule Days → Edit Stops & Times → Auto/Manual Save → Reload App`

### Web Execution:
1. User registers or logs in; session token is written to `localStorage`.
2. User navigates to `/plan-trip`, enters destination ("Islamabad"), selects dates ("Apr 4 - Apr 9").
3. Web generates daily buckets, commits to `POST /trips`, and automatically redirects to `/workspace`.
4. User edits stop arrival/departure times, drags a place between Day 1 and Day 2, and adds a packing checklist.
5. `saveTrip` triggers background sync to `PUT /trips/{id}`. `saveStatus` indicates "Saved".
6. User closes and refreshes browser: session token is validated via `POST /auth/verify`, active workspace is re-hydrated from `localStorage.getItem('tripnest_active_workspace')`, and trips list is reloaded from `GET /trips`.

### Mobile Execution:
1. User registers or logs in; session token is saved in `appStorage`.
2. User taps "+ Plan New Trip", completes the 4-step wizard, and calls `apiService.createTrip`.
3. App navigates to `TripDetailScreen` and opens `ItineraryScreen`.
4. User edits stop arrival/departure times via modal and moves a place to Day 2 via Move modal.
5. `commitTripMutation` serializes changes via `persistQueueRef` to `PUT /trips/{id}`. Save pill shows "Saved".
6. User force-quits and relaunches app: `hydrateApp()` verifies token, restores active trip, and re-fetches saved trips.

### Parity Assessment:
- **Verdict:** **Fully Equivalent (Pass)**. Both platforms preserve data fidelity, handle multi-day trip generation, and persist mutations reliably.

---

## 3. Workflow 2: Tripmates Collaboration & Real-Time Roster
**Flow:** `Trip Owner Creates Trip → Invites Tripmate (Username/Email) → Invitee Logs In → Receives Notification / Invite → Accepts → Both Collaborate on Itinerary`

### Web Execution:
1. User A (Owner) opens trip workspace and clicks "Tripmates" button.
2. User A enters User B's username ("arslan_traveler") and clicks "Invite".
3. Backend creates pending invitation in `trip_members` and writes a `tripmate_invite` record in `notifications`.
4. User B logs in on their device:
   - Header `BellIcon` shows an unread badge counter (e.g. `1`).
   - Clicking bell opens notifications dropdown displaying "User A invited you to collaborate on 'Trip to Islamabad'".
   - User B clicks the inline **Accept** button.
5. Backend marks invitation `status: "accepted"`.
6. Web automatically fires `reloadTrips()`, and the shared trip immediately appears in User B's Dashboard with a `Tripmate • Member` badge.
7. User B opens `/workspace?mode=tripmate&tripId=...` and adds stops or checklist items. Edits save to `PUT /api/tripmates/trips/{id}/itinerary`.
8. User A and User B both view updated itinerary.

### Mobile Execution:
1. User A opens `TripDetailScreen`, navigates to Tripmates action row, enters User B's username, and sends invite.
2. Backend creates the pending invite and notification record.
3. User B logs in on Mobile:
   - **MISSING NOTIFICATION BELL:** User B has no notification bell in the header!
   - *Workaround in Mobile:* User B scrolls down their `HomeScreen.js` feed, where a special `userInvitations` card is displayed.
   - User B clicks "Accept".
4. Backend marks invitation accepted, and trip appears in User B's `TripsListScreen.js` under "Shared" filter.
5. User B opens trip and modifies daily stops. Mobile recognizes `trip.isTripmate === true` and routes persistence through `apiService.updateTripmateItinerary`.

### Parity Assessment:
- **Verdict:** **Partially Equivalent (Minor Gap)**. The collaboration and itinerary updating mechanics work, but User B is dependent on the home feed card rather than a universal header notification badge.

---

## 4. Workflow 3: Shared Trip Links & Can-Edit Copy Duplication
**Flow:** `Owner Generates Share Link → Generates View-Only or Can-Edit Link → Recipient Opens Link → Views Preview or Clones Independent Copy`

### Web Execution:
1. Owner opens Share modal and selects permission mode:
   - *View-Only*: Web calls `POST /trips/{id}/share-token` with `{ permission: "view" }`, producing `https://tripnest.travel/share/{token}`.
   - *Can-Edit Copy*: Web calls with `{ permission: "edit" }`, producing `https://tripnest.travel/share/edit/{token}`.
2. User C (unauthenticated or authenticated) opens `https://tripnest.travel/share/sh_view_123`:
   - Routed to `TripViewPage.jsx`.
   - Fetches trip via `GET /trips/shared/sh_view_123`.
   - Renders clean read-only timeline and map view. All editing controls (add stop, delete day, drag) are completely disabled.
3. User D (authenticated) opens `https://tripnest.travel/share/edit/sh_edit_456`:
   - Routed to `TripViewPage.jsx`.
   - Component detects `isEditSharedMode && authToken`.
   - Automatically executes `copySharedEditTripRequest(authToken, editToken)`.
   - Backend duplicates the trip document into User D's personal account (`ownerId: User D`).
   - User D is immediately redirected to `/workspace` with their own independent editable copy.

### Mobile Execution:
1. Owner opens Share sheet in `TripDetailScreen.js` and generates a share token.
2. Recipient opens Mobile app with a share link or navigates to `PublicTripScreen`:
   - **BREAKDOWN:** `PublicTripScreen.js` expects `route.params.tripId`. It does NOT accept `shareToken` or `editShareToken`!
   - `PublicTripScreen.js` attempts to call `getPublicTripById(tripId)`. If the trip was private and shared via token, this call **fails with HTTP 404**!
   - `getSharedTrip` and `getSharedEditTrip` are implemented in `apiService.js` but never hooked up in `PublicTripScreen.js`.
   - The Can-Edit copy flow (`copySharedEditTrip`) is completely absent from the mobile UI.

### Parity Assessment:
- **Verdict:** **Broken Workflow (P0 Gap)**. Token-based sharing and can-edit copy duplication fail completely on Mobile.

---

## 5. Workflow 4: Tripmate Member Permission Safeguards
**Flow:** `Owner Shares Trip with Collaborator → Collaborator Tries to Delete Trip → System Rejects Action`

### Web Execution:
1. Collaborator opens shared trip where `isTripmate === true`.
2. If Collaborator attempts to delete the trip from dashboard or workspace menu:
   - `AppContext.jsx` executes:
     ```javascript
     if (record?.isTripmate) {
       throw new Error('Tripmate members cannot delete shared trips.')
     }
     ```
   - An error alert is shown: "Tripmate members cannot delete shared trips."
   - The deletion is blocked on the client and never sent to the backend.

### Mobile Execution:
1. Collaborator opens `TripsListScreen.js` or `TripDetailScreen.js`.
2. Collaborator taps ellipsis button on shared trip card and taps "Delete".
3. **BREAKDOWN:** Mobile `AppContext.js` does NOT check `record.isTripmate`.
4. Mobile immediately removes the trip from `savedTrips` in local state and sends `DELETE /trips/{trip_id}` to the server.
5. The backend rejects the deletion with HTTP 403/404, but the mobile UI has already deleted the trip from local state, causing a desynchronized UI state until the user force-reloads.

### Parity Assessment:
- **Verdict:** **Security & Permission Safeguard Defect (P0 Gap)**. Mobile lacks client-side ownership validation for trip deletion.

---

## 6. Workflow 5: Explore Places, Save to Wishlist & Add to Itinerary
**Flow:** `Explore Screen → Search Places by Query or GPS → Inspect Place Details & Reviews → Add to Day / Pool → Save to Wishlist`

### Web Execution:
1. In `WorkspacePage.jsx`, user toggles Explore mode.
2. Selects category pill or types query; results stream from SerpAPI Google Maps engine.
3. User clicks attraction card: detailed slideout panel displays star rating, reviews, operating hours, phone, and photos.
4. User clicks "Add to Day 1" or "Add to Places Pool". Stop is immediately inserted with verified photo and coordinates.

### Mobile Execution:
1. User taps "Explore" tab in bottom navigation.
2. User searches "Centaurus Mall" or uses GPS "Near Me" locator.
3. Results render in `PlaceCard.js` with photos, ratings, and categories.
4. User taps card to open `ModalSheet` showing full operating hours, reviews, address, and phone.
5. User taps "Add to Trip" -> selects target trip and target day.
6. User taps bookmark icon to save to global `wishlist`.

### Parity Assessment:
- **Verdict:** **Fully Equivalent (Pass)**. The mobile experience matches and enhances Web with GPS proximity and native modal sheets.

---

## 7. Workflow 6: Hotel Search, Filtering & Booking Redirect
**Flow:** `Explore Mode → Select Hotels Category → Filter by Star Rating (3★, 4★, 5★) → Inspect Lodging Details → View External Booking Link`

### Web Execution:
1. In `WorkspacePage.jsx` explore mode, user clicks the **"Hotels"** category pill.
2. Web fires `GET /api/explore/places?lat=...&lon=...&query=Hotels in {destination}`.
3. SerpAPI service identifies lodging establishments and surfaces:
   - Hotel star ratings (e.g. 4.5★) and user review counts.
   - Price level indicators (`$$$`).
   - Amenities and operating hours.
   - External directions and booking links.
4. User clicks external link to open booking page or adds hotel as lodging stop in itinerary.

### Mobile Execution:
1. User taps "Explore" tab.
2. **BREAKDOWN:** `CATEGORY_TILES` only lists 4 categories: `Attraction`, `Scenic`, `Dining`, `Historic`.
3. The **"Hotels" category does not exist**.
4. There are no star rating filter chips (3★+, 4★+, 5★), no price level sorting, and no external booking redirect button on `PlaceCard.js`.

### Parity Assessment:
- **Verdict:** **Completely Missing Feature in Mobile (P1 Gap)**. Hotel discovery and lodging workflows cannot be performed in Mobile.

---

## 8. Workflow 7: Shared Budget, Splitting & Debt Settlements
**Flow:** `Collaborative Trip → Open Shared Budget → Add Shared Expense with Custom Multipliers → Review Net Balances → Settle Debt Payment`

### Web Execution:
1. In workspace, user scrolls to "Shared Budget & Expenses" section.
2. Clicks "+ Add Shared Expense":
   - Enters title ("Villa Rental"), amount (PKR 30,000), category ("Sleep").
   - Selects payer (User A).
   - Selects participants and applies custom split multipliers (User A = 1x, User B = 2x).
   - Commits to `POST /api/shared-budget/trips/{id}/expenses`.
3. Clicks "Balances" tab:
   - System computes net balances: "User B owes User A PKR 20,000".
4. Clicks "Settle Up":
   - Records payment of PKR 20,000 from User B to User A.
   - Commits to `POST /api/shared-budget/trips/{id}/settlements`.
   - Balances reset to zero.

### Mobile Execution:
1. In `TripDetailScreen.js`, user taps "Dedicated Shared Budget & Balances" action row.
2. `SharedBudgetModal.js` opens with 3 tabs: `Expenses`, `Balances`, `Settlements`.
3. User adds expense with payer selection and participant shares; saves to backend.
4. Net balance card calculates debts and who owes whom.
5. User records settlement payment; net balances recalibrate.

### Parity Assessment:
- **Verdict:** **Fully Equivalent (Pass)**. Both platforms provide complete shared budget financial workflows.

---

## 9. Workflow 8: AI Travel Assistant Chatbot (Google Gemini)
**Flow:** `Workspace Sidebar → Open AI Assistant → Itinerary Context Injected → Ask Travel Question → Receive Markdown + Interactive Cards`

### Web Execution:
1. In `WorkspacePage.jsx`, user clicks "AI Assistant" button in the sidebar.
2. `AiAssistantModal.jsx` opens:
   - Automatically serializes destination, dates, daily schedule, and notes into `trip_context`.
   - Surfaces prompt suggestions: "🍽️ Recommend restaurants in Lahore", "🏨 Hotel suggestions", "📦 Packing checklist".
3. User sends query: backend routes through `POST /api/ai/chat` to Google Gemini.
4. Response renders with formatted Markdown and interactive action cards (`RestaurantCard`, `HotelCard`, `AttractionCard`).
5. User can click "Add to Day" directly from an AI attraction card into their itinerary.

### Mobile Execution:
1. User searches for AI Assistant in `ItineraryScreen.js` or `TripDetailScreen.js`.
2. **BREAKDOWN:** There is **NO AI Assistant button, screen, or modal** anywhere in the Mobile UI.
3. While `apiService.chatWithAi` exists in code, a mobile user has zero access to the AI Travel Assistant.

### Parity Assessment:
- **Verdict:** **Completely Missing Feature in Mobile UI (P1 Gap)**.

