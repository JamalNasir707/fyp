import { useState } from 'react'

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.75 14.25a1 1 0 0 1 0-1.41l4.5-4.5a2.5 2.5 0 1 1 3.54 3.54l-2 2a1 1 0 1 1-1.42-1.42l2-2a.5.5 0 1 0-.7-.7l-4.5 4.5a1 1 0 0 1-1.42 0Zm-3.54 7.02a2.5 2.5 0 0 1 0-3.54l2-2a1 1 0 0 1 1.42 1.42l-2 2a.5.5 0 0 0 .7.7l4.5-4.5a1 1 0 0 1 1.42 1.42l-4.5 4.5a2.5 2.5 0 0 1-3.54 0Z" fill="currentColor" />
    </svg>
  )
}

export default function ProfileShareModal({ open, profileLink, onClose }) {
  const [copied, setCopied] = useState(false)

  if (!open) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(profileLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="TripHubDeleteModal" aria-hidden="false">
      <div className="TripHubDeleteModal__backdrop" onClick={onClose} />
      <div className="TripHubDeleteModal__dialog TripHubModalCard TripHubModalCard--share" role="dialog" aria-modal="true" aria-labelledby="share-profile-title">
        <button type="button" className="TripHubModalCard__close" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="share-profile-title">Share your profile</h2>
        <p>Share your TripNest profile link.</p>

        <div className="TripHubShareModal__linkRow">
          <div className="TripHubShareModal__link">
            <LinkIcon />
            <span>{profileLink}</span>
          </div>
          <button type="button" className="TripHubDeleteModal__confirm" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>

        <div className="TripHubShareModal__socials">
          <button type="button" className="TripHubShareModal__socialButton">
            <span>f</span>
            <small>Facebook</small>
          </button>
          <button type="button" className="TripHubShareModal__socialButton">
            <span>X</span>
            <small>X (Twitter)</small>
          </button>
        </div>
      </div>
    </div>
  )
}
