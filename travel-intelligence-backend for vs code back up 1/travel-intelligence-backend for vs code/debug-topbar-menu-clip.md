[OPEN] Debug Session: topbar-menu-clip

## Symptom
- In Workspace top-right 3-dot menu, options (especially Print) are clipped / not fully visible.
- When the menu shows a scrollbar, trying to scroll/click the scrollbar causes the menu to close/vanish.

## Expected
- Menu opens fully within viewport (not clipped).
- Menu stays open while scrolling inside it (mouse wheel, trackpad, scrollbar drag).

## Hypotheses (Falsifiable)
- **A (Overflow clipping)**: Menu is rendered inside a parent with `overflow: hidden/auto`, so it gets clipped.
- **B (Outside click handler)**: A global “click outside” listener treats scrollbar interaction as outside click and closes the menu.
- **C (Wrong anchoring)**: Menu always anchors to the right and overflows viewport; needs flip-to-left logic near screen edge.
- **D (Focus/blur close)**: Menu closes on blur and scrollbar drag triggers blur, closing it immediately.
- **E (z-index stacking)**: Another overlay (map panel/headers) covers part of the menu making it appear clipped.

## Evidence to Collect
- Menu bounding rect vs viewport at open time.
- Parent overflow properties around menu.
- Sequence of open/close events with click targets (scrollbar drag vs inside menu).

## Runs
- `runId=pre-fix`: reproduce clipping + scrollbar-close and capture logs
- `runId=post-fix`: re-test after minimal fix

