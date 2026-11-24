/**
 * AdminButton
 * ──────────
 * Standardised button used in all admin panel actions.
 * Supports all action types from the frozen permission model:
 *   view, suspend, unsuspend, promote, demote, delete, export, ghost.
 *
 * Props:
 *   children   {ReactNode}   Required. Button label.
 *   variant    {string}      'primary' | 'ghost' | 'danger' | 'warning'. Default 'ghost'.
 *   size       {string}      'sm' | 'md'. Default 'md'.
 *   disabled   {boolean}     Optional. Default false.
 *   onClick    {function}    Optional. Click handler.
 *   type       {string}      Optional. HTML button type. Default 'button'.
 *   icon       {ReactNode}   Optional. Leading icon SVG.
 *   id         {string}      Optional. HTML id for testing.
 *
 * Permission model note (architecture freeze):
 *   - variant='danger' is reserved for: Delete User, Delete Trip, Clean Up Sessions
 *   - variant='warning' is reserved for: Suspend User
 *   - variant='primary' is reserved for: Confirm actions in modals
 *   - All dangerous variants are intentionally disabled in Phase 0.5.
 *     They will be enabled in Phase 2 when backend endpoints are ready.
 *
 * DO NOT connect onClick for Suspend / Delete / Promote / Demote in this phase.
 */
const VARIANT_CLASSES = {
  primary: 'AV2Btn AV2Btn--primary',
  ghost:   'AV2Btn AV2Btn--ghost',
  danger:  'AV2Btn AV2Btn--ghost',
  warning: 'AV2Btn AV2Btn--ghost',
}

const VARIANT_STYLES = {
  primary: {},
  ghost:   {},
  danger:  { color: '#ef4444', borderColor: '#fecaca' },
  warning: { color: '#f59e0b', borderColor: '#fde68a' },
}

const SIZE_STYLES = {
  sm: { fontSize: 12, padding: '4px 10px' },
  md: {},
}

export function AdminButton({
  children,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  icon,
  id,
}) {
  return (
    <button
      id={id}
      type={type}
      className={VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.ghost}
      style={{ ...VARIANT_STYLES[variant], ...SIZE_STYLES[size] }}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && icon}
      {children}
    </button>
  )
}
