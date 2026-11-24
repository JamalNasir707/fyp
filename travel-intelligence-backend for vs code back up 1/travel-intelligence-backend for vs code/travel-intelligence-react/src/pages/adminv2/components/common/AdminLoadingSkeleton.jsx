/**
 * AdminLoadingSkeleton
 * ────────────────────
 * Animated shimmer placeholder used while data is loading.
 * Used by AdminDataTable and can be used directly in any page.
 *
 * Props:
 *   width   {string|number}  Optional. Width. Default '100%'.
 *   height  {number}         Optional. Height in px. Default 20.
 *   radius  {number}         Optional. Border radius in px. Default 4.
 */
export function AdminLoadingSkeleton({ width = '100%', height = 20, radius = 4 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
        backgroundSize: '200% 100%',
        animation: 'av2SkeletonShimmer 1.4s ease infinite',
      }}
    />
  )
}
