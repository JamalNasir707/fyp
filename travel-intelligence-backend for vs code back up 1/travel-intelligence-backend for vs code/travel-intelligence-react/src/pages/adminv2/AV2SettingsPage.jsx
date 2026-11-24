/**
 * AV2SettingsPage — Settings
 * ──────────────────────────
 * Refactored in Phase 0.5 to use the shared component library.
 * Visual output is IDENTICAL to Phase 0. COMPLETELY READ-ONLY.
 *
 * Changes vs Phase 0:
 *   - Settings are now rendered by a reusable SettingRow helper.
 *   - 4 new placeholder entries added (approved in architecture freeze):
 *     ALPHA, PREFERENCE_BOOST, avoid_crowds_default, max_travel_hours_default
 *     These are hardcoded constants in main.py that should be inspectable here.
 *   - Uses shared AdminPanel, AdminPageHeader, AdminSection, AdminButton.
 *
 * Future integration (Phase 4):
 *   - Replace hardcoded values with GET /api/admin/settings (reads app config)
 *   - Root Admin only: enable Edit buttons → PUT /api/admin/settings/{key}
 *   - Admin role: view only (Edit buttons remain disabled)
 *
 * Security note (frozen spec):
 *   NEVER expose MONGODB_URI, GOOGLE_CLIENT_ID, or any secret keys here.
 *   Only operational / algorithm parameters belong in this view.
 *
 * DO NOT enable editing in this phase.
 */
import {
  AdminPageHeader,
  AdminPanel,
  AdminSection,
  AdminButton,
  AdminPlaceholderBanner,
} from './components'

// ─── Reusable setting row ─────────────────────────────────────
function SettingRow({ label, keyName, value, hint, isPlaceholder = false }) {
  return (
    <div className="AV2SettingRow">
      <div className="AV2SettingRow__info">
        <div className="AV2SettingRow__label">{label}</div>
        <div className="AV2SettingRow__hint">{hint}</div>
      </div>
      <div className="AV2SettingRow__control">
        <input
          type="text"
          defaultValue={value}
          disabled
          aria-label={`Setting: ${label}`}
          className={`AV2SettingRow__input${isPlaceholder ? ' AV2SettingRow__input--placeholder' : ''}`}
        />
        {/* TODO(Phase 4): Enable this button for Root Admin role only */}
        {/* DO NOT enable editing until GET/PUT /api/admin/settings is implemented */}
        <AdminButton size="sm" disabled>Edit</AdminButton>
      </div>
    </div>
  )
}

// ─── Setting groups ───────────────────────────────────────────
// TODO(Phase 4): Replace all `value` fields with live GET /api/admin/settings response
const SETTING_GROUPS = [
  {
    title: 'Route Planning Defaults',
    settings: [
      {
        label: 'Score Weight',
        key: 'score_weight',
        value: '1.0',
        hint: 'Weight for total attraction score in TSP optimizer',
      },
      {
        label: 'Time Weight',
        key: 'time_weight',
        value: '0.05',
        hint: 'Weight penalizing travel time between stops',
      },
      {
        label: 'Cost Weight',
        key: 'cost_weight',
        value: '0.01',
        hint: 'Weight penalizing total estimated cost',
      },
      {
        label: 'Far Threshold (km)',
        key: 'far_threshold',
        value: '50',
        hint: 'Maximum km before a place is classified as "far"',
      },
      {
        // NEW — approved in architecture freeze — currently hardcoded in main.py as ALPHA = 0.4
        label: 'Alpha (Score/Time Blend)',
        key: 'alpha',
        value: '0.4',
        hint: 'ALPHA constant: blends score vs time objectives in optimizer (hardcoded in main.py)',
        isPlaceholder: true,
      },
      {
        // NEW — approved in architecture freeze — currently hardcoded as PREFERENCE_BOOST = 1.5
        label: 'Preference Boost',
        key: 'preference_boost',
        value: '1.5',
        hint: 'PREFERENCE_BOOST constant: multiplier applied when place matches user category preference (hardcoded in main.py)',
        isPlaceholder: true,
      },
      {
        // NEW — approved in architecture freeze
        label: 'Avoid Crowds (Default)',
        key: 'avoid_crowds_default',
        value: 'false',
        hint: 'Global default for crowd avoidance when user does not specify',
        isPlaceholder: true,
      },
      {
        // NEW — approved in architecture freeze
        label: 'Max Travel Hours (Default)',
        key: 'max_travel_hours_default',
        value: '8',
        hint: 'Default maximum daily travel time when user does not specify',
        isPlaceholder: true,
      },
    ],
  },
  {
    title: 'External APIs',
    settings: [
      {
        label: 'Use Live Data (Google Places)',
        key: 'use_live_data',
        value: 'false',
        hint: 'Toggle real Google Places API calls vs static dataset',
      },
      {
        label: 'OSRM Road-Aware Routing',
        key: 'road_aware',
        value: 'false',
        hint: 'Use real road distances via OSRM instead of haversine',
      },
      {
        label: 'OSRM Timeout (sec)',
        key: 'osrm_timeout',
        value: '8',
        hint: 'Maximum seconds to wait for OSRM router response',
      },
    ],
  },
  {
    title: 'Security & Sessions',
    settings: [
      {
        label: 'Session TTL (days)',
        key: 'session_ttl',
        value: '7',
        hint: 'How long user sessions remain valid before expiring',
      },
      {
        label: 'Allow Registration',
        key: 'allow_registration',
        value: 'true',
        hint: 'Enable or disable new user account creation',
      },
    ],
  },
]

export default function AV2SettingsPage() {
  return (
    <AdminSection>
      <AdminPageHeader
        title="Settings"
        sub="Platform configuration — route planning, APIs, and security policies. Read-only. Root Admin may edit in Phase 4."
      />

      {SETTING_GROUPS.map(group => (
        <AdminPanel key={group.title} title={group.title}>
          {group.settings.map(s => (
            <SettingRow
              key={s.key}
              label={s.label}
              keyName={s.key}
              value={s.value}
              hint={s.hint}
              isPlaceholder={s.isPlaceholder ?? false}
            />
          ))}
        </AdminPanel>
      ))}

      <AdminPlaceholderBanner
        title="Settings Editor Coming in Phase 4"
        sub="This page will read from and write to a backend settings store. Only Root Admin role will have write access. Dashed fields are new entries added in Phase 0.5 from the architecture freeze."
        phase="Phase 0.5 — Component Library"
      />
    </AdminSection>
  )
}
