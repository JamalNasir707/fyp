import { useEffect, useMemo, useState } from 'react'
import ProfileEditorForm from './ProfileEditorForm'
import { createProfileDraft } from '../lib/profile'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

export default function ProfileEditModal({ open, user, saving = false, onClose, onSave }) {
  const initialDraft = useMemo(() => createProfileDraft(user), [user])
  const [draft, setDraft] = useState(initialDraft)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(createProfileDraft(user))
    setError('')
  }, [open, user])

  if (!open) return null

  async function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setDraft((prev) => ({ ...prev, profileImage: dataUrl }))
      setError('')
    } catch (err) {
      setError(err.message || 'Could not preview image')
    } finally {
      event.target.value = ''
    }
  }

  function handleFieldChange(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      await onSave(draft)
    } catch (err) {
      setError(err.message || 'Could not save profile')
    }
  }

  return (
    <div className="TripHubDeleteModal" aria-hidden="false">
      <div className="TripHubDeleteModal__backdrop" onClick={onClose} />
      <div className="TripHubDeleteModal__dialog TripHubModalCard TripHubModalCard--profile" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <button type="button" className="TripHubModalCard__close" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="edit-profile-title">Edit Profile</h2>
        <form onSubmit={handleSubmit}>
          <ProfileEditorForm
            draft={draft}
            onChange={handleFieldChange}
            onImageChange={handleImageChange}
            disabled={saving}
            submitLabel={saving ? 'Saving...' : 'Save'}
            showSubmitButton={false}
          />

          {error ? <p className="TripHubModalCard__error">{error}</p> : null}

          <div className="TripHubModalCard__actions">
            <button type="submit" className="TripHubDeleteModal__confirm" disabled={saving}>Save</button>
            <button type="button" className="TripHubDeleteModal__cancel" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
