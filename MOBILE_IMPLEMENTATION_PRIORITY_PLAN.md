# TripNest Mobile: Complete Implementation Priority Plan
**Second-Pass Web-to-Mobile Parity Roadmap**  
**Audit Date:** November 2026  
**Status:** Pre-Implementation Architectural Blueprint (Strictly Read-Only Phase)

---

## Executive Strategy & Architectural Guidelines

This implementation plan bridges all 10 identified feature, workflow, and security gaps between the TripNest Web and TripNest Mobile applications. Every proposed phase adheres to the following core tenets:

1. **Zero Breaking Changes:** Existing mobile database models, local storage keys (`@tripnest_trips`, `@tripnest_user`), and navigation hierarchies are preserved or extended with backward-compatible schemas.
2. **Strict Backend Schema Alignment:** No new ad-hoc backend endpoints are required; mobile will consume the existing, production-tested FastAPI routes (`/api/ai/chat`, `/api/trips/share/*`, `/api/trips/shared-edit/*`, `/api/notifications/*`, `/api/hotels/*`, `/api/optimize`).
3. **Defense-in-Depth Authorization:** Collaborator security checks (`!isTripmate`, `can_edit` vs `view_only`) must be enforced on the client side before triggering dispatch mutations and deleting records.
4. **Native-First Mobile UI/UX:** Web features are mapped directly to idiomatic React Native paradigms (BottomSheets, ActionSheets, Native Pickers, Floating Modals, Haptic feedback) rather than naive desktop ports.

---

## Comprehensive Gap Classification & Priority Index

| Gap ID | Feature Area | Severity | Priority Tier | Primary Target Files |
|---|---|---|---|---|
| **GAP-01** | Collaborator Deletion Authorization Guard | Critical Security | **Phase 1: P0 (Blocker)** | `src/context/AppContext.js`, `src/screens/TripDetailScreen.js` |
| **GAP-02** | Token-Based Shared Trip Viewer & Copy Flow | High Functional | **Phase 1: P0 (Blocker)** | `src/screens/PublicTripScreen.js`, `src/services/apiService.js`, `src/navigation/AppNavigator.js` |
| **GAP-03** | Workspace 3-Dot Action Menu & Modal Dialogs | High Functional | **Phase 2: P1 (High)** | `src/screens/ItineraryScreen.js`, `src/screens/TripDetailScreen.js`, `src/components/itinerary/WorkspaceActionSheet.js` |
| **GAP-04** | AI Travel Assistant Chatbot (Google Gemini) | High Feature | **Phase 2: P1 (High)** | `src/screens/ChatbotScreen.js`, `src/components/common/FloatingChatButton.js`, `src/services/apiService.js` |
| **GAP-05** | Notifications Center UI & Unread Indicator | Medium Functional | **Phase 2: P1 (High)** | `src/components/notifications/NotificationModal.js`, `src/context/NotificationContext.js`, `src/components/common/Header.js` |
| **GAP-06** | Hotels & Lodging (SerpAPI) Explore Tab | Medium Feature | **Phase 3: P2 (Medium)** | `src/screens/ExploreScreen.js`, `src/components/explore/HotelCard.js`, `src/components/explore/HotelDetailModal.js` |
| **GAP-07** | Live Weather per Stop Card | Low Visual | **Phase 3: P2 (Medium)** | `src/components/itinerary/PlaceItemCard.js`, `src/services/apiService.js`, `src/hooks/useWeather.js` |
| **GAP-08** | Multi-Stop Bulk Selection & Bulk Move/Delete | Medium Ergonomic | **Phase 4: P3 (Refinement)** | `src/screens/ItineraryScreen.js`, `src/components/itinerary/BulkActionToolbar.js` |
| **GAP-09** | Workspace Mutation Undo / Redo Stack | Low Ergonomic | **Phase 4: P3 (Refinement)** | `src/context/AppContext.js`, `src/hooks/useUndoRedo.js`, `src/screens/ItineraryScreen.js` |
| **GAP-10** | Backend Engine Suggestion Generator (`/optimize`) | Medium AI Feature | **Phase 4: P3 (Refinement)** | `src/screens/CreateTripScreen.js`, `src/services/apiService.js` |

---

## Detailed Phase Execution Roadmap

### Phase 1: Security Hardening & Sharing Parity (P0)

#### Target 1.1: Tripmate Collaborator Deletion Guard (`GAP-01`)
* **Objective:** Prevent collaborators with shared trips from triggering backend deletion or desynchronizing server state when trying to remove a shared trip from their local view.
* **Component Changes:**
  - `src/context/AppContext.js`:
    - Refactor `deleteTrip(tripId)`:
      ```javascript
      const deleteTrip = async (tripId) => {
        const trip = trips.find(t => t.id === tripId || t._id === tripId);
        if (trip?.isTripmate) {
          // Collaborator is leaving or removing from their list, not deleting owner's trip
          setTrips(prev => prev.filter(t => (t.id || t._id) !== tripId));
          await saveTripsToStorage(trips.filter(t => (t.id || t._id) !== tripId));
          return { success: true, message: 'Removed from your shared trips' };
        }
        // Primary Owner: Send DELETE to API
        return await apiService.deleteTrip(tripId);
      };
      ```
  - `src/screens/TripDetailScreen.js`:
    - Update deletion confirmation modal text: If `trip.isTripmate`, display *"Remove Trip: This trip was shared with you. Removing it will only remove it from your device, not delete the owner's trip."*

#### Target 1.2: Token-Based Shared Trip Link & Copy Flow (`GAP-02`)
* **Objective:** Enable mobile users to open view-only (`/trip/share/{token}`) and collaborative (`/trip/shared-edit/{token}`) links and clone them into their own workspace.
* **Component Changes:**
  - `src/services/apiService.js`:
    - Export `getSharedTrip(shareToken)`: `GET /api/trips/share/${shareToken}`
    - Export `getSharedEditTrip(editToken)`: `GET /api/trips/shared-edit/${editToken}`
    - Export `copySharedEditTrip(editToken)`: `POST /api/trips/shared-edit/${editToken}/copy`
  - `src/screens/PublicTripScreen.js`:
    - Accept both `route.params.tripId` and `route.params.token` / `route.params.editToken`.
    - Detect mode: If token provided, query `apiService.getSharedTrip` or `getSharedEditTrip`.
    - Add "Save to My Trips" / "Copy Itinerary" button at the bottom navigation bar.
    - On copy, call `copySharedEditTrip` (or clone local structure via `addTrip`), alert success, and navigate directly into the newly created trip workspace.
  - `src/navigation/AppNavigator.js`:
    - Configure deep linking routing prefixes: `tripnest://trip/share/:token` and `https://tripnest.app/trip/share/:token`.

---

### Phase 2: Core Workspace UX, AI Chatbot & Notifications (P1)

#### Target 2.1: Workspace Topbar 3-Dot Action Menu (`GAP-03`)
* **Objective:** Bring full parity to the Itinerary Workspace actions available on Web.
* **Component Changes:**
  - Create `src/components/itinerary/WorkspaceActionSheet.js`:
    - ActionSheet / BottomSheet options:
      1. **Trip Settings:** Change title, dates, banner cover photo, currency.
      2. **Preferences & Budget:** Set default daily budget, pace (relaxed/packed), dietary notes.
      3. **Export / Share Link:** Generate & copy Public Share Token / View-Only URL.
      4. **Trip Journal & Notes:** Launch rich notes editor modal.
      5. **Select Mode:** Toggle multi-stop selection toolbar.
  - `src/screens/ItineraryScreen.js`:
    - Add top-right 3-dot ellipsis icon (`Ionicons` `ellipsis-vertical`) in the navigation header.
    - Wire onPress event to open `WorkspaceActionSheet`.

#### Target 2.2: AI Travel Assistant Chatbot UI (`GAP-04`)
* **Objective:** Allow mobile users to interact with the backend Gemini-powered conversational agent for real-time travel recommendations and itinerary assistance.
* **Component Changes:**
  - Create `src/screens/ChatbotScreen.js`:
    - Bubble conversation interface (`FlatList` inverted or standard with auto-scroll).
    - Quick-prompt recommendation pills (*"Suggest dinner spots in Tokyo"*, *"What should I pack for Paris?"*, *"Optimize Day 2"*).
    - Direct integration with `apiService.chatWithAi(message, history, currentTripContext)`.
    - "Add to Itinerary" action on suggested places from the bot response.
  - Create `src/components/common/FloatingChatButton.js`:
    - Floating action button (FAB) present on Dashboard and Itinerary screens.
    - Tapping navigates to `ChatbotScreen` or pops open a slide-up modal with context of the current active trip.

#### Target 2.3: Notifications Center UI (`GAP-05`)
* **Objective:** Provide a dedicated notifications viewer for trip invites, collaborator edits, and new follower alerts.
* **Component Changes:**
  - Create `src/components/notifications/NotificationModal.js` or `src/screens/NotificationsScreen.js`:
    - List item rendering for each notification type: `trip_invite`, `collaborator_edit`, `follow_alert`.
    - "Mark All as Read" header button (`PUT /api/notifications/read-all`).
    - Swipe-to-dismiss single notification (`DELETE /api/notifications/{id}`).
    - Tap-to-navigate (e.g. tapping a trip invite opens the trip preview; tapping a follower opens `UserProfileScreen`).
  - Add Bell Icon badge in `src/components/common/Header.js`:
    - Poll or fetch unread count on mount: `GET /api/notifications/unread-count`.
    - Badge with counter showing unread notifications.

---

### Phase 3: Explore Lodging & Live Weather per Stop (P2)

#### Target 3.1: Hotels & Lodging Explore Integration (`GAP-06`)
* **Objective:** Complete parity with Web SerpAPI lodging search, star rating filters, and booking links.
* **Component Changes:**
  - `src/screens/ExploreScreen.js`:
    - Add "Hotels & Lodging" pill in the categories filter (`Attractions`, `Food & Drink`, `Hotels`, `Hidden Gems`).
    - Add Price / Star Rating filter slider / pills (`Any`, `3★+`, `4★+`, `5★`).
  - Create `src/components/explore/HotelCard.js`:
    - Display thumbnail image, star rating, price per night, amenities badges (WiFi, Pool, Breakfast).
    - "Book Now" external link button via `Linking.openURL(hotel.booking_url)`.
    - "Add to Day" picker button to insert hotel as a stop in the active trip.

#### Target 3.2: Live Weather per Stop Card (`GAP-07`)
* **Objective:** Display temperature and forecast icon on individual stop cards in the Itinerary.
* **Component Changes:**
  - Create `src/hooks/useWeather.js`:
    - Fetch forecast using stop coordinates `(lat, lng)` and stop scheduled date.
    - Cache results in memory to avoid duplicate network calls.
  - `src/components/itinerary/PlaceItemCard.js`:
    - Integrate weather badge in top-right or metadata row: `☀️ 24°C` or `🌧️ 16°C`.
    - Tapping weather opens mini forecast popup.

---

### Phase 4: Ergonomic Refinements & Advanced Engines (P3)

#### Target 4.1: Multi-Stop Bulk Selection & Operations (`GAP-08`)
* **Objective:** Enable multi-stop select mode for bulk deletion and moving between days.
* **Component Changes:**
  - `src/screens/ItineraryScreen.js`:
    - Add `isSelectMode` state.
    - When active, each `PlaceItemCard` displays a selection checkbox.
  - Create `src/components/itinerary/BulkActionToolbar.js`:
    - Floating bottom toolbar displaying:
      - Selected count (*"3 places selected"*).
      - "Move to Day..." button (opens Day picker modal).
      - "Delete Selected" button (with confirmation alert).
      - "Done" button to exit select mode.

#### Target 4.2: Workspace Undo / Redo History Stack (`GAP-09`)
* **Objective:** Allow accidental stop deletions or re-orderings to be reverted instantly.
* **Component Changes:**
  - Create `src/hooks/useUndoRedo.js`:
    - Maintains a past/future state stack of itinerary stops.
    - Limits history depth to 15 snapshots for mobile memory efficiency.
  - `src/screens/ItineraryScreen.js`:
    - Surface Undo / Redo icon buttons in top header whenever the history stack allows.

#### Target 4.3: Backend Engine Suggestion Generator (`GAP-10`)
* **Objective:** Connect the trip creation wizard to the backend optimization algorithm (`POST /api/optimize`).
* **Component Changes:**
  - `src/screens/CreateTripScreen.js`:
    - Add toggle: *"Use AI Route Optimizer & Suggestion Engine"*.
    - If checked, post destination, dates, budget tier, and category weights to `/api/optimize`.
    - Hydrate the newly generated trip with the returned optimized daily itinerary stops.

---

## Verification & QA Testing Strategy

Each completed target must pass the following test matrix before merge:

1. **Authentication & Token Persistence Test:**
   - Log out, log in, restart application; verify state persistence in `AsyncStorage`.
2. **Offline Resilience Test:**
   - Put mobile device in Airplane mode; verify cached trips and itinerary render without crashing.
3. **Collaborator Permission Isolation Test:**
   - Log in as Tripmate; verify "Edit" buttons are hidden if `view_only`. Verify deleting shared trip removes only local reference and does not alter backend trip for the owner.
4. **Deep-Link Validation:**
   - Open `tripnest://trip/share/<token>` in mobile browser or emulator terminal; verify app launches directly into `PublicTripScreen` with full itinerary loaded.
5. **Memory & Performance Audit:**
   - Verify smooth 60fps scrolling on `ItineraryScreen` when handling multi-day trips with 30+ stops.

---

## Architectural Sign-off
This document concludes the pre-implementation phase. Implementation will proceed strictly in accordance with this 4-phase sequence upon user approval.

