import { useState } from 'react'
import { AdminButton } from '../buttons/AdminButton'

/**
 * AdminConfirmModal
 * ─────────────────
 * Reusable confirmation dialog for all destructive actions.
 * Designed to support the frozen permission model actions:
 *   Suspend | Unsuspend | Promote | Demote | Delete | Session Cleanup
 *
 * Props:
 *   open       {boolean}    Required. Whether the modal is visible.
 *   title      {string}     Required. Modal heading.
 *   message    {string}     Required. Confirmation message / warning.
 *   confirmLabel {string}   Optional. Confirm button text. Default 'Confirm'.
 *   cancelLabel  {string}   Optional. Cancel button text. Default 'Cancel'.
 *   variant    {string}     Optional. 'danger' | 'warning' | 'primary'. Default 'danger'.
 *   onConfirm  {function}   Required. Called when user confirms.
 *   onCancel   {function}   Required. Called when user cancels or closes.
 *   requireReason {boolean} Optional. Show a reason text field. Default false.
 *
 * Architecture note:
 *   This modal is intentionally unconnected in Phase 0.5.
 *   It will be wired to API calls in Phase 2 (backend endpoints ready).
 *   The `requireReason` prop is pre-built for the audit log requirement
 *   (all admin destructive actions must include a reason string per the spec).
 *
 * TODO(Phase 2): Wire onConfirm to:
 *   - Suspend:   PUT /api/admin/users/{id}/status { status:'suspended', reason }
 *   - Delete:    DELETE /api/admin/users/{id} or DELETE /api/admin/trips/{id}
 *   - Promote:   PUT /api/admin/users/{id}/role (Root Admin only)
 *   - Demote:    PUT /api/admin/users/{id}/role (Root Admin only)
 */
export function AdminConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  requireReason = false,
}) {
  const [reason, setReason] = useState('')

  if (!open) return null

  const handleConfirm = () => {
    onConfirm?.(requireReason ? reason : undefined)
    setReason('')
  }

  const handleCancel = () => {
    onCancel?.()
    setReason('')
  }

  return (
    <div className="TripHubDeleteModal" style={{ display: 'block' }}>
      <div className="TripHubDeleteModal__backdrop" onClick={handleCancel} />
      <div
        className="TripHubDeleteModal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="av2-confirm-title"
      >
        <h2 id="av2-confirm-title" style={{ marginBottom: 8 }}>{title}</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: requireReason ? 16 : 24 }}>
          {message}
        </p>

        {requireReason && (
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="av2-confirm-reason"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}
            >
              Reason <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              id="av2-confirm-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Enter reason for this action (will be recorded in audit log)…"
              rows={3}
              style={{
                width: '100%',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div className="TripHubDeleteModal__actions">
          <button
            type="button"
            className="TripHubDeleteModal__cancel"
            onClick={handleCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="TripHubDeleteModal__confirm"
            onClick={handleConfirm}
            disabled={requireReason && reason.trim().length === 0}
            style={variant === 'warning' ? { background: '#f59e0b', borderColor: '#f59e0b' } : {}}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
