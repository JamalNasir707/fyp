# TRIPNEST MOBILE — MISSING FUNCTIONALITY & GAP REPORT

**Author:** Antigravity Audit Engine  
**Project Lead:** Arslan  
**Date:** November 2026  
**Scope:** Functional and UX parity comparison between TripNest Web and TripNest Mobile  

---

## Executive Summary

The TripNest Mobile application has a strong foundation and substantial work completed by Rai. The core navigation, authentication, trip creation wizard, itinerary stop manipulation, route optimization (TSP), personal and shared budgeting, map views, and administrative tools are implemented.

However, a strict code-level comparison against the Web reference application reveals **7 specific functional gaps** where mobile is missing features, using incomplete placeholders, or missing permission safeguards.

---

## Detailed Gap Analysis

### GAP 1: Workspace Topbar Three-Dot Action Menu
- **Severity / Priority:** **P0 — Critical for FYP**
- **Web Reference:** In `WorkspacePage.jsx` (`TopbarMenu.jsx`), clicking the `...` menu opens a dropdown with:
  1. *Trip Settings*: Toggle privacy between `private` and `public`.
  2. *Trip Preferences & Engine*: Adjust max budget, max travel hours, preferred categories.
  3. *View Only Mode*: Preview the itinerary as a read-only viewer.
  4. *Trip Journal*: Open trip notes, photos, and documented experiences.
  5. *Select / Bulk Mode*: Enable multi-stop select for bulk deletion or moving.
  6. *Print Trip*: Navigate to `/print-trip`.
- **Current Mobile Defect:**
  - `ItineraryScreen.js` has **no three-dot menu button at all** in its top navigation bar.
  - In `TripDetailScreen.js`, the ellipsis button (`ellipsis-horizontal`) is wired directly to `handleOpenNotesModal` instead of a comprehensive action menu.
- **Affected Files:**
  - `tripnest-mobile/src/screens/itinerary/ItineraryScreen.js`
  - `tripnest-mobile/src/screens/trips/TripDetailScreen.js`
- **Proposed Safe Solution:**
  - Create a reusable `TripActionMenuModal.js` component matching the Web actions:
    - Trip Settings (Privacy toggle: Public / Private via `updateTrip`)
    - Trip Preferences (budget, duration, pace)
    - View-Only Mode preview
    - Trip Journal / Notes viewer
    - Print / Export trip
  - Mount this action menu in both `ItineraryScreen.js` and `TripDetailScreen.js` via an ellipsis icon button.

---

### GAP 2: Hotels Search, Filtering & SerpAPI Lodging Integration
- **Severity / Priority:** **P1 — Important**
- **Web Reference:**
  - `WorkspacePage.jsx` explore mode has an 8-category selector: `All`, `Attractions`, `Restaurants`, `Cafes`, `Hotels`, `Nature`, `Historical`, `Shopping`.
  - Selecting "Hotels" queries the backend `GET /api/explore/places?lat={lat}&lon={lon}&query=Hotels in {destination}`.
  - The backend `serpapi_service.py` maps lodging types to category `"hotel"` and extracts: hotel name, star rating, review count, price level, directions link, phone number, operating hours, and photos.
  - Users can view hotel details, add hotels directly to an itinerary day or places pool, and click external booking links.
- **Current Mobile Defect:**
  - `ExploreScreen.js` defines only 4 hardcoded tiles: `Attraction`, `Scenic`, `Dining`, `Historic`.
  - The **"Hotels" category is completely missing**.
  - There is no star rating filter (e.g. 3★, 4★, 5★), no sorting by rating or review count, no hotel wishlist/favorites section, and no external booking redirect button.
- **Affected Files:**
  - `tripnest-mobile/src/screens/explore/ExploreScreen.js`
  - `tripnest-mobile/src/components/places/PlaceCard.js`
  - `tripnest-mobile/src/screens/saved/SavedPlacesScreen.js`
- **Proposed Safe Solution:**
  - Add a dedicated "Hotels" category tile to `ExploreScreen.js` with `queryKey: 'hotels lodging resort'`.
  - Add quick filter chips for Star Rating (Any, 3★+, 4★+, 5★) and Sort By (Rating, Reviews).
  - Surface hotel metadata on `PlaceCard.js` (price level, star rating, reviews, booking/directions link).
  - Add "Add Hotel to Trip" action (assign to a day or pool) and "Favorite Hotel" toggle.

---

### GAP 3: Notifications Center UI & Notification Navigation
- **Severity / Priority:** **P1 — Important**
- **Web Reference:**
  - In `TripHubHeader.jsx`, a `BellIcon` button with an unread badge counter opens a notification dropdown displaying:
    - Trip invitations (with inline "Accept" and "Decline" buttons).
    - Social follow alerts.
    - Itinerary updates.
    - "Mark all as read" button.
- **Current Mobile Defect:**
  - The backend endpoints exist (`GET /api/notifications`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/read-all`).
  - `apiService.js` and `AppContext.js` have complete notification functions.
  - However, **there is NO notification bell icon, screen, or modal in the mobile UI**. Users have no way to view incoming notifications, accept invitations, or mark them as read.
- **Affected Files:**
  - `tripnest-mobile/src/screens/home/HomeScreen.js`
  - `tripnest-mobile/src/navigation/AppNavigator.js`
  - New component: `tripnest-mobile/src/components/notifications/NotificationModal.js`
- **Proposed Safe Solution:**
  - Add a Bell icon button with an unread badge to `HomeScreen.js` and `ProfileScreen.js` header right.
  - Create `NotificationModal.js` rendering the list of user notifications from `notifications` in `AppContext.js`.
  - Support inline Accept/Decline for trip invitations and "Mark all as read".

---

### GAP 4: Token-Based Shared Trip Viewer & Can-Edit Copy Flow
- **Severity / Priority:** **P0 — Critical for FYP**
- **Web Reference:**
  - When a user shares a trip, the app creates:
    - View-Only share link: `https://tripnest.travel/share/{token}` (`GET /trips/shared/{token}`)
    - Can-Edit share link: `https://tripnest.travel/share/edit/{token}` (`GET /trips/shared/edit/{token}`)
  - Opening the edit share link triggers `copySharedEditTripRequest`, creating an independent copy in the recipient's personal trip collection.
- **Current Mobile Defect:**
  - `PublicTripScreen.js` only accepts a database trip ID (`tripId`) and calls `getPublicTripById(tripId)`.
  - There is **no mobile screen or flow to open, view, or copy a trip from a `shareToken` or `editShareToken`**.
- **Affected Files:**
  - `tripnest-mobile/src/screens/trips/PublicTripScreen.js`
  - `tripnest-mobile/src/screens/trips/TripsListScreen.js`
- **Proposed Safe Solution:**
  - Update `PublicTripScreen.js` to accept either `tripId` OR `shareToken` / `editShareToken`.
  - If a token is supplied, call `apiService.getSharedTrip(shareToken)` or `apiService.getSharedEditTrip(token)`.
  - For Can-Edit tokens, display an prominent "Import / Copy to My Trips" button calling `apiService.copySharedEditTrip`.
  - Add an "Open Shared Trip with Link / Code" option in `TripsListScreen.js`.

---

### GAP 5: View-Only Mode Permission Enforcement on Mobile
- **Severity / Priority:** **P0 — Critical for FYP**
- **Web Reference:**
  - In Web `TripViewPage.jsx`, when `permission === "view"`, all modifying actions are hidden:
    - Add stop, delete stop, move stop, drag-and-drop, and edit time are disabled.
    - Workspace editing is strictly read-only.
- **Current Mobile Defect:**
  - In `ItineraryScreen.js`, there is no `isViewOnly` or `permission === 'view'` check. If a user opens a view-only trip, all edit buttons (`Add Stop`, `Trash`, `Move`, `Optimize`) remain visible and clickable.
- **Affected Files:**
  - `tripnest-mobile/src/screens/itinerary/ItineraryScreen.js`
- **Proposed Safe Solution:**
  - Add an `isViewOnly` prop/param check in `ItineraryScreen.js`.
  - When `isViewOnly === true`:
    - Display a clear "View-Only Mode" banner at the top.
    - Hide or disable `Add Stop`, `Trash` icon, `Move` pill, `Time` edit pill, `Delete Day`, and `Optimize` button.

---

### GAP 6: Tripmate Member Trip Deletion Guard
- **Severity / Priority:** **P0 — Critical for FYP**
- **Web Reference:**
  - In `AppContext.jsx`:
    ```javascript
    if (record?.isTripmate) {
      throw new Error('Tripmate members cannot delete shared trips.')
    }
    ```
- **Current Mobile Defect:**
  - `deleteTrip` in Mobile `AppContext.js` immediately removes the trip locally and sends `DELETE /trips/{id}` to the backend without checking if `trip.isTripmate === true`.
- **Affected Files:**
  - `tripnest-mobile/src/context/AppContext.js`
  - `tripnest-mobile/src/screens/trips/TripsListScreen.js`
- **Proposed Safe Solution:**
  - Guard `deleteTrip` in `AppContext.js`: if `trip.isTripmate`, block deletion and display an alert explaining that only the trip organizer / owner can delete the shared trip.
  - In `TripsListScreen.js`, replace the "Delete" action for shared trips with "Leave Trip" (`removeTripMember`).

---

### GAP 7: AI Travel Assistant Mobile Interface
- **Severity / Priority:** **P1 — Important**
- **Web Reference:**
  - `AiAssistantModal.jsx` provides a full-featured AI chat powered by Google Gemini via backend `POST /api/ai/chat`.
  - The modal provides context-aware travel suggestions, itinerary feedback, and packing advice.
- **Current Mobile Defect:**
  - Backend route `POST /api/ai/chat` is live and working.
  - `apiClient.chatWithAi` and `AppContext.js` have `askAiAssistant` method.
  - However, **no UI component or button exists on Mobile to invoke the AI assistant**.
- **Affected Files:**
  - New component: `tripnest-mobile/src/components/ai/AiAssistantModal.js`
  - `tripnest-mobile/src/screens/home/HomeScreen.js`
  - `tripnest-mobile/src/screens/itinerary/ItineraryScreen.js`
- **Proposed Safe Solution:**
  - Create `AiAssistantModal.js` using existing Mobile styling tokens and `ModalSheet`.
  - Add a floating or header AI button on `HomeScreen.js` and `ItineraryScreen.js` to open the modal.
  - Pass the current trip context (`destination`, `daysCount`, `current stops`) to Gemini.

