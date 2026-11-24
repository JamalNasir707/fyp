import { useId, useRef } from 'react'
import { getInitials } from '../lib/profile'

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15.86 3.9 4.24 4.24-10.56 10.56-4.89.66.66-4.89L15.86 3.9Zm.7-1.41 1.3-1.3a1.5 1.5 0 0 1 2.12 0l2.83 2.83a1.5 1.5 0 0 1 0 2.12l-1.3 1.3-4.95-4.95Z" fill="currentColor" />
    </svg>
  )
}

export default function ProfileEditorForm({
  draft,
  onChange,
  onImageChange,
  disabled = false,
  submitLabel = 'Save',
  showSubmitButton = true,
}) {
  const fileInputId = useId()
  const fileInputRef = useRef(null)

  return (
    <div className="TripHubProfileEditor">
      <div className="TripHubProfileEditor__avatarWrap">
        <div className="TripHubProfileEditor__avatar">
          {draft.profileImage ? (
            <img src={draft.profileImage} alt={draft.name || draft.username || 'Profile'} />
          ) : (
            <span>{getInitials(draft)}</span>
          )}
        </div>
        <button
          type="button"
          className="TripHubProfileEditor__avatarEdit"
          aria-label="Change profile image"
          onClick={() => fileInputRef.current?.click()}
        >
          <PencilIcon />
        </button>
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept="image/*"
          hidden
          onChange={onImageChange}
        />
      </div>

      <div className="TripHubProfileEditor__fields">
        <label className="TripHubProfileEditor__field">
          <span>Name</span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => onChange('name', event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="TripHubProfileEditor__field">
          <span>Username</span>
          <input
            type="text"
            value={draft.username}
            onChange={(event) => onChange('username', event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="TripHubProfileEditor__field">
          <span>Email</span>
          <input
            type="email"
            value={draft.email}
            onChange={(event) => onChange('email', event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="TripHubProfileEditor__field">
          <div className="TripHubProfileEditor__fieldHeader">
            <span>Bio</span>
            <span className="TripHubProfileEditor__charCount">
              {(draft.bio || '').length} / 250
            </span>
          </div>
          <textarea
            value={draft.bio || ''}
            onChange={(event) => onChange('bio', event.target.value.slice(0, 250))}
            placeholder="Tell others a bit about yourself..."
            maxLength={250}
            rows={3}
            disabled={disabled}
          />
        </label>
      </div>

      {showSubmitButton ? (
        <button type="submit" className="TripHubCtaButton TripHubCtaButton--inline" disabled={disabled}>
          {submitLabel}
        </button>
      ) : null}
    </div>
  )
}
