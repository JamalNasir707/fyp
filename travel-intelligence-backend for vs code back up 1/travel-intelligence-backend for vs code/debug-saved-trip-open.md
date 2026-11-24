[OPEN] Debug Session: saved-trip-open

## Symptom
- Home shows saved trips from MongoDB.
- Clicking an older saved trip opens Workspace blank or without saved locations/itinerary.
- New trips may work, but old trips fail.

## Expected
- Any saved trip (old or new) should open in Workspace with destination, dates, and saved itinerary/locations populated.

## Hypotheses (Falsifiable)
- **A (Shape mismatch)**: Backend returns older trips nested under `data.*`, but frontend expects a flat TripNest trip shape (e.g., `destination`, `days`, `placesPool`), causing Workspace to render empty.
- **B (Normalization gap)**: `ensureWorkspaceParityTrip` (or equivalent) is not applied when opening a saved trip, so required defaults/arrays are missing.
- **C (ID mismatch)**: Click handler passes the wrong identifier or wrong trip object (e.g., `trip.id` vs `trip.tripId`), so AppContext loads a different/empty trip.
- **D (Field name mismatch)**: Itinerary/locations are stored as `data.itinerary` / `data.preferences` but Workspace expects `days` / `enginePreferences` / `placesPool`, so content never appears even though data exists.
- **E (Overwriting)**: On navigation to Workspace, persisted local workspace state overwrites the selected saved trip, replacing it with an empty template.

## Evidence to Collect
- Raw trip objects returned by `/trips` (one “old” failing and one “new” working).
- What object is passed from Home click -> AppContext -> Workspace.
- The final normalized trip shape right before Workspace render.

## Instrumentation Plan
- Add debug events (no business logic change) at:
  - Home: saved-trip click handler (log selected trip keys + nested `data` keys)
  - AppContext: when “open trip” / “set active trip” happens (log pre/post normalized shape)
  - Workspace: on mount (log activeTrip snapshot keys)

## Runs
- `runId=pre-fix`: reproduce the bug and capture logs
- `runId=post-fix`: after implementing normalization fix, reproduce again and compare

## Constraints
- Do not touch: Plan Trip UI, Workspace UI design, map, preferences/suggestions modal, old frontend folder, MongoDB data, ports, admin/user auth.

