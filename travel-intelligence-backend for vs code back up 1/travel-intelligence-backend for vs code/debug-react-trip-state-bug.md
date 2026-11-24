[OPEN] React trip creation and save-state bug

## Session
- session_id: `react-trip-state-bug`
- started_at: `2026-06-10`
- status: `OPEN`

## Scope
- Fix only React trip creation/current trip/save persistence logic.
- Do not touch backend unless evidence shows the bug is backend-related.
- Do not touch `WANDERLOG NEED SEQUENCING`.

## Symptoms
- Creating a second trip still opens the workspace with the old trip.
- `Save Trip` says "Saved" but the saved trips list is not correct.

## Initial Hypotheses
1. Creating a new trip queues session data but does not replace the active trip in storage/state.
2. Workspace bootstrapping falls back to demo/default trip data instead of the newly created trip.
3. Save Trip persists stale in-memory state rather than the latest active trip.
4. Home and Workspace use different precedence rules for storage keys.
5. A workspace parity/demo helper masks legitimate empty/new trips and reloads sample data.

## Evidence Plan
- Inspect trip creation flow from Plan Trip page.
- Inspect AppContext bootstrapping and active trip selection.
- Inspect saved-trip persistence helpers and storage precedence.
- Compare with old frontend flow only as reference.
- Apply minimal fix only after evidence identifies the failing branch.

## Evidence Collected
- `PlanTripPage.jsx` created a fresh trip payload but only wrote it to `sessionStorage` before navigating to `/workspace`.
- `HomePage.jsx` queued saved-trip ids in `sessionStorage` before navigating to `/workspace`.
- `AppContext.jsx` consumed queued trip data only once in a `useEffect(..., [])`, which runs only on the first provider mount.
- `WorkspacePage.jsx` renders title, dates, and save behavior strictly from `activeTrip`.
- `saveTrip()` persisted `activeTrip`, so if `activeTrip` stayed stale, the wrong trip was being saved.

## Hypothesis Status
1. Creating a new trip queues session data but does not replace the active trip in storage/state. `CONFIRMED`
2. Workspace bootstrapping falls back to demo/default trip data instead of the newly created trip. `NOT PRIMARY ROOT CAUSE`
3. Save Trip persists stale in-memory state rather than the latest active trip. `CONFIRMED`
4. Home and Workspace use different precedence rules for storage keys. `PARTIALLY SUPPORTED`
5. A workspace parity/demo helper masks legitimate empty/new trips and reloads sample data. `NOT PRIMARY ROOT CAUSE`

## Applied Fix
- `PlanTripPage.jsx`: set the fresh trip directly as `activeTrip` via context before navigating to workspace.
- `HomePage.jsx`: load the selected saved trip directly into `activeTrip` via context before navigating to workspace.

## Scope Confirmation
- Backend not touched.
- Old frontend folder not touched.
