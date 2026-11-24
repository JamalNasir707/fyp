# Debug Session: workspace-not-showing [OPEN]

## Symptom
- The frontend appears not to be running correctly.
- The saved trips list is visible.
- A saved trip shows a three-dot menu in the old frontend, but the current React frontend differs.
- Clicking a saved trip does not show the main workspace.

## Expected
- The frontend dev server runs normally.
- Clicking a saved trip opens the main workspace.
- Saved-trip behavior matches the original frontend where applicable.

## Hypotheses
1. The frontend dev server is not currently running, so the user is seeing stale or partial content.
2. The saved-trip selection succeeds, but the workspace crashes during render due to a recent parity change.
3. The saved-trip click handler or route transition is broken, so the app never enters the workspace view.
4. The workspace loads, but a runtime error in the itinerary/header/menu subtree prevents content from rendering.
5. The selected trip/auth state is not being restored correctly after loading a saved trip.

## Planned Evidence
- Start backend/frontend and verify both URLs respond.
- Inspect current saved-trip/workspace route code and current diagnostics.
- Reproduce by building and, if needed, running the dev server.
- Check for runtime/render errors tied to the recent itinerary parity changes.

## Status
- Session opened.
- No business logic changed yet.

## Evidence Collected
- Backend is reachable at `http://127.0.0.1:8000/`.
- Frontend dev server is running at `http://127.0.0.1:5174/`.
- The current React home page only opened a trip via the inner `Open` button; clicking the card body itself did not route to the workspace.
- `WorkspacePage.jsx` assumes `activeTrip.days`, `activeTrip.placesPool`, `activeTrip.customLists`, and `activeTrip.expenses` exist.
- `ensureWorkspaceParityTrip()` previously returned many partially shaped saved trips unchanged, so older saved records could reach the workspace with missing arrays/objects and break rendering.

## Fix Applied
- Normalized loaded trip shape in `src/lib/trips.js` so saved trips always provide safe arrays/objects expected by `WorkspacePage`.
- Switched home-page trip opening to the shared `queueLoadTrip()` helper.
- Made the saved-trip card itself open the workspace, not just the inner button.

## Verification
- Diagnostics are clean for `src/lib/trips.js` and `src/pages/HomePage.jsx`.
- `npm run build` passes successfully.
