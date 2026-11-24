[OPEN] Debug Session: time-editor-flicker

## Symptom
- In Workspace, clicking **Add time** opens the time editor popup.
- When hovering over the time input area to edit, the popup/page starts blinking/shaking heavily.

## Expected
- Time editor popup remains stable while hovering and editing start/end time.

## Hypotheses (Falsifiable)
- **A (Hover toggle loop)**: Mouse enter/leave handlers are opening/closing the time editor rapidly due to element overlap, causing visible flicker.
- **B (Layout shift loop)**: Hover/focus adds/removes DOM that changes card height/position, causing cursor to leave the target and retrigger close/open.
- **C (Event propagation)**: Click/hover events bubble to a parent handler (e.g., place card click/select) which causes state resets and re-renders.
- **D (Z-index / pointer events)**: Another overlay (e.g., map popup controls / sticky headers) competes for pointer events and forces repeated focus/blur.
- **E (State derived from hover)**: The editor state is derived from hover state rather than a stable “open” flag, so moving the mouse inside the popup flips the state.

## Evidence to Collect
- `timeEditorPlaceId` / related “open” state transitions with timestamps.
- Mouse enter/leave and focus/blur sequences on the time editor button + popup.
- Whether the popup is being unmounted/remounted repeatedly while hovering.

## Instrumentation Plan
- Add debug events at:
  - “Add time” button click
  - time editor open/close state changes
  - mouse enter/leave on the popup wrapper
  - focus/blur on time inputs

## Runs
- `runId=pre-fix`: reproduce flicker and capture logs
- `runId=post-fix`: after minimal stabilization fix, reproduce and compare

