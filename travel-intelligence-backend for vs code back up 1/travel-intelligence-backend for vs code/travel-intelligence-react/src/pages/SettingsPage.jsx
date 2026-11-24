import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectedAccountsPage from '../components/ConnectedAccountsPage'
import ProfileEditorForm from '../components/ProfileEditorForm'
import ProMembershipPage from '../components/ProMembershipPage'
import SettingsLanguageDropdown from '../components/SettingsLanguageDropdown'
import SettingsNotificationsSection from '../components/SettingsNotificationsSection'
import SettingsPreferenceGroup from '../components/SettingsPreferenceGroup'
import TripHubHeader from '../components/TripHubHeader'
import LandingFooter from '../components/landing/LandingFooter'
import { useApp } from '../context/AppContext'
import useGlobalLanguagePreference from '../hooks/useGlobalLanguagePreference'
import { createProfileDraft } from '../lib/profile'
import { LANGUAGE_OPTIONS, readSettingsPreferences, writeSettingsPreferences } from '../lib/settingsPreferences'
import '../styles/landing.css'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

const preferenceSections = [
  {
    title: 'Unit and display preferences',
    items: [
      {
        key: 'dateFormat',
        title: 'Date Format',
        helperText: 'Choose how dates appear across your travel planning experience.',
        options: [
          { value: 'month-day', label: 'Month / Day' },
          { value: 'day-month', label: 'Day / Month' },
        ],
      },
      {
        key: 'distanceFormat',
        title: 'Distance Format',
        helperText: 'Pick the distance unit used when viewing routes and travel details.',
        options: [
          { value: 'kilometers', label: 'Kilometers' },
          { value: 'miles', label: 'Miles' },
        ],
      },
      {
        key: 'timeFormat',
        title: 'Time Format',
        helperText: 'Decide how TripNest should display times in schedules and plans.',
        options: [
          { value: '12-hour', label: '12 Hour' },
          { value: '24-hour', label: '24 Hour' },
        ],
      },
    ],
  },
  {
    title: 'Trip Planner',
    items: [
      {
        key: 'placeDescriptions',
        title: 'Place descriptions from web',
        helperText: 'Control where TripNest surfaces supporting web-based place descriptions.',
        options: [
          { value: 'show-below-custom-notes', label: 'Show in empty notes and below custom notes' },
          { value: 'show-only-empty-notes', label: 'Only show in empty notes' },
        ],
      },
      {
        key: 'expertTravelTips',
        title: 'Expert Travel Tips',
        helperText: 'Choose whether TripNest should surface general travel advice while planning.',
        options: [
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled' },
        ],
      },
    ],
  },
  {
    title: 'Trip Journal',
    items: [
      {
        key: 'photoUpload',
        title: 'Photo Upload',
        helperText: 'Choose how media uploads should behave when you are documenting trips.',
        options: [
          { value: 'wifi-only', label: 'Wi-Fi only' },
          { value: 'cellular-and-wifi', label: 'Cellular + Wi-Fi' },
        ],
      },
    ],
  },
]

const emailNotificationOptions = [
  {
    key: 'tripInvitations',
    label: 'Trip invitations',
    description: 'Receive email when someone invites you to collaborate on a trip.',
  },
  {
    key: 'tripUpdates',
    label: 'Trip updates',
    description: 'Receive email when a trip you are collaborating on is updated.',
  },
  {
    key: 'sharedItineraryChanges',
    label: 'Shared itinerary changes',
    description: 'Receive email when itinerary details are modified.',
  },
  {
    key: 'tripReminders',
    label: 'Trip reminders',
    description: 'Receive reminders before upcoming planned trips.',
  },
  {
    key: 'accountSecurity',
    label: 'Account security',
    description: 'Receive emails about login attempts and important security updates.',
  },
  {
    key: 'productUpdates',
    label: 'Product updates',
    description: 'Receive emails about new TripNest features and improvements.',
  },
  {
    key: 'newsAndAnnouncements',
    label: 'News and announcements',
    description: 'Receive major announcements from TripNest.',
  },
]

const pushNotificationOptions = [
  {
    key: 'tripInvitations',
    label: 'Trip invitations',
    description: 'Get notified when someone invites you to collaborate on a trip.',
  },
  {
    key: 'tripUpdates',
    label: 'Trip updates',
    description: 'Get notified when a trip you are part of receives updates.',
  },
  {
    key: 'sharedItineraryUpdates',
    label: 'Shared itinerary updates',
    description: 'Get notified when shared itinerary details change.',
  },
  {
    key: 'tripReminders',
    label: 'Trip reminders',
    description: 'Get reminders before upcoming trips and plan milestones.',
  },
  {
    key: 'collaborationActivity',
    label: 'Collaboration activity',
    description: 'Get notified when collaborators leave notes or interact with your shared plans.',
  },
  {
    key: 'productAnnouncements',
    label: 'Product announcements',
    description: 'Get notified about important TripNest releases and product news.',
  },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, updateProfile, deleteAccount } = useApp()
  const [globalLanguage, setGlobalLanguage] = useGlobalLanguagePreference()
  const [draft, setDraft] = useState(() => createProfileDraft(user))
  const [activeSection, setActiveSection] = useState('account')
  const [preferences, setPreferences] = useState(() => readSettingsPreferences())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sidebarNotice, setSidebarNotice] = useState('')
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const sidebarItems = [
    { key: 'account', label: 'Account', section: 'account' },
    { key: 'connected-accounts', label: 'Connected Accounts', section: 'connected-accounts' },
    { key: 'membership', label: 'Pro Membership', section: 'membership' },
    { key: 'preferences', label: 'User Preferences', section: 'preferences' },
    { key: 'notifications', label: 'Notifications', section: 'notifications' },
  ]

  useEffect(() => {
    setDraft(createProfileDraft(user))
  }, [user])

  useEffect(() => {
    writeSettingsPreferences(preferences)
  }, [preferences])

  useEffect(() => {
    setPreferences((prev) => (
      prev.language === globalLanguage
        ? prev
        : { ...prev, language: globalLanguage }
    ))
  }, [globalLanguage])

  function handleFieldChange(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

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

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSidebarNotice('')
    try {
      await updateProfile(draft)
    } catch (err) {
      setError(err.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setError('')
    try {
      await deleteAccount({ reason: deleteReason.trim() })
      window.alert('Account deleted successfully.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not delete account')
    } finally {
      setDeleting(false)
    }
  }

  const deleteEnabled = Boolean(deleteReason.trim() && deleteConfirmed && !deleting)

  function handlePreferenceChange(key, value) {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  function handleNotificationToggle(groupKey, optionKey, checked) {
    setPreferences((prev) => ({
      ...prev,
      [groupKey]: {
        ...prev[groupKey],
        [optionKey]: checked,
      },
    }))
  }

  function handleNotificationDisableToggle(flagKey, checked) {
    setPreferences((prev) => ({
      ...prev,
      [flagKey]: checked,
    }))
  }

  function handleLanguageChange(nextLanguage) {
    setPreferences((prev) => ({ ...prev, language: nextLanguage }))
    setGlobalLanguage(nextLanguage)
  }

  return (
    <div className="TripHubPage TripHubPage--settings">
      <TripHubHeader activePage="settings" />

      <main className="TripHubMain TripHubSettingsMain">
        <section className="TripHubSettingsLayout">
          <aside className="TripHubSettingsSidebar">
            <h1>Settings</h1>
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`TripHubSettingsSidebar__item${activeSection === item.section ? ' is-active' : ''}`}
                onClick={() => {
                  if (item.section) {
                    setActiveSection(item.section)
                    setSidebarNotice('')
                    return
                  }
                  setSidebarNotice('Coming Soon')
                }}
              >
                {item.label}
              </button>
            ))}
            {sidebarNotice ? <p className="TripHubSettingsSidebar__notice">{sidebarNotice}</p> : null}
          </aside>

          <section className="TripHubSettingsContent">
            <div className="TripHubProfilePanel TripHubSettingsPanel">
              {activeSection === 'account' ? (
                <>
                  <form onSubmit={handleSave}>
                    <ProfileEditorForm
                      draft={draft}
                      onChange={handleFieldChange}
                      onImageChange={handleImageChange}
                      disabled={saving || deleting}
                      showSubmitButton={false}
                    />
                    <div className="TripHubSettingsSaveRow">
                      <button type="submit" className="TripHubSettingsSaveButton" disabled={saving || deleting}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>

                  {error ? <p className="TripHubModalCard__error">{error}</p> : null}

                  <div className="TripHubSettingsRow TripHubSettingsRow--danger">
                    <span>Delete Account</span>
                    <button
                      type="button"
                      className="TripHubSettingsRow__action"
                      onClick={() => {
                        setDeleteReason('')
                        setDeleteConfirmed(false)
                        setDeleteStep(1)
                      }}
                    >
                      Delete Account
                    </button>
                  </div>
                </>
              ) : null}

              {activeSection === 'preferences' ? (
                <div className="TripHubSettingsPreferences">
                  <SettingsLanguageDropdown
                    label="Language"
                    helperText="Choose your preferred language. This updates the shared TripNest language preference on this device."
                    options={LANGUAGE_OPTIONS}
                    value={preferences.language}
                    onChange={handleLanguageChange}
                  />

                  {preferenceSections.map((section) => (
                    <div key={section.title} className="TripHubSettingsPreferences__section">
                      <div className="TripHubSettingsPreferences__sectionHeader">
                        <h2>{section.title}</h2>
                      </div>
                      <div className="TripHubSettingsPreferences__groups">
                        {section.items.map((item) => (
                          <SettingsPreferenceGroup
                            key={item.key}
                            title={item.title}
                            helperText={item.helperText}
                            name={item.key}
                            options={item.options}
                            value={preferences[item.key]}
                            onChange={(nextValue) => handlePreferenceChange(item.key, nextValue)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeSection === 'connected-accounts' ? (
                <ConnectedAccountsPage />
              ) : null}

              {activeSection === 'membership' ? (
                <ProMembershipPage />
              ) : null}

              {activeSection === 'notifications' ? (
                <div className="TripHubSettingsPreferences">
                  <SettingsNotificationsSection
                    title="Email Notifications"
                    description="Manage the TripNest updates that arrive in your inbox."
                    disableAll={preferences.disableEmailNotifications}
                    options={emailNotificationOptions}
                    values={preferences.emailNotifications}
                    onToggleDisableAll={(checked) => handleNotificationDisableToggle('disableEmailNotifications', checked)}
                    onToggleOption={(key, checked) => handleNotificationToggle('emailNotifications', key, checked)}
                  />

                  <SettingsNotificationsSection
                    title="Push Notifications"
                    description="Choose which TripNest alerts appear on this device."
                    disableAll={preferences.disablePushNotifications}
                    options={pushNotificationOptions}
                    values={preferences.pushNotifications}
                    onToggleDisableAll={(checked) => handleNotificationDisableToggle('disablePushNotifications', checked)}
                    onToggleOption={(key, checked) => handleNotificationToggle('pushNotifications', key, checked)}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </main>

      <LandingFooter />

      {deleteStep === 1 ? (
        <div className="TripHubDeleteModal" aria-hidden="false">
          <div className="TripHubDeleteModal__backdrop" onClick={() => setDeleteStep(0)} />
          <div className="TripHubDeleteModal__dialog TripHubModalCard" role="dialog" aria-modal="true" aria-labelledby="delete-account-step-one">
            <button type="button" className="TripHubModalCard__close" aria-label="Close" onClick={() => setDeleteStep(0)}>×</button>
            <h2 id="delete-account-step-one">Delete Account</h2>
            <p>Deleting the account is permanent.</p>
            <ul className="TripHubSettingsDeleteList">
              <li>Trips</li>
              <li>Guides</li>
              <li>Journals</li>
              <li>Saved data</li>
            </ul>
            <div className="TripHubModalCard__actions">
              <button type="button" className="TripHubDeleteModal__cancel" onClick={() => setDeleteStep(0)}>Keep my account</button>
              <button type="button" className="TripHubDeleteModal__confirm" onClick={() => setDeleteStep(2)}>Continue with account deletion</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteStep === 2 ? (
        <div className="TripHubDeleteModal" aria-hidden="false">
          <div className="TripHubDeleteModal__backdrop" onClick={() => setDeleteStep(0)} />
          <div className="TripHubDeleteModal__dialog TripHubModalCard TripHubModalCard--deleteFinal" role="dialog" aria-modal="true" aria-labelledby="delete-account-step-two">
            <button type="button" className="TripHubModalCard__close" aria-label="Close" onClick={() => setDeleteStep(0)}>×</button>
            <h2 id="delete-account-step-two">Delete Account</h2>
            <div className="TripHubSettingsWarning">
              <strong>Warning message</strong>
              <span>Please read carefully before deleting your TripNest account.</span>
            </div>
            <p>Deleting your account permanently removes your profile and related travel data.</p>
            <label className="TripHubProfileEditor__field">
              <span>Reason</span>
              <textarea
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Please tell us why you want to delete your account."
              />
            </label>
            <label className="TripHubSettingsCheckbox">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={(event) => setDeleteConfirmed(event.target.checked)}
              />
              <span>I understand this action permanently deletes my TripNest account and related data.</span>
            </label>
            <div className="TripHubModalCard__actions">
              <button type="button" className="TripHubDeleteModal__cancel" onClick={() => setDeleteStep(0)} disabled={deleting}>Cancel</button>
              <button type="button" className="TripHubDeleteModal__confirm" disabled={!deleteEnabled} onClick={handleDeleteAccount}>
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
