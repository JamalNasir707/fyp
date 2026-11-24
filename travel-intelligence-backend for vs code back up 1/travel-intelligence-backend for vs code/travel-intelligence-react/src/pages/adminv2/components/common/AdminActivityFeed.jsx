/**
 * AdminActivityFeed
 * ─────────────────
 * Renders a list of activity/audit log events.
 * Used in both the Activity Logs page and (in future) the Dashboard recent-events panel.
 *
 * Props:
 *   events  {Array}    Required. Array of event objects:
 *     {
 *       icon:   string   — emoji icon
 *       color:  string   — hex background colour for the dot circle
 *       title:  string   — event description
 *       actor:  string   — username of who performed the action
 *       type:   string   — 'Auth' | 'Trip' | 'Admin' | 'User' | 'System'
 *       time:   string   — relative time string e.g. '2 min ago'
 *     }
 *
 * Future integration:
 *   Phase 2: Replace static `events` array with paginated data from
 *   GET /api/admin/activities?limit=N
 */
import { AdminBadge } from '../badges/AdminBadge'

const TYPE_COLOR = {
  Auth:   'green',
  Trip:   'blue',
  Admin:  'purple',
  User:   'amber',
  System: 'teal',
}

export function AdminActivityFeed({ events = [] }) {
  if (events.length === 0) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
        No activity recorded yet.
      </div>
    )
  }

  return (
    <div className="AV2ActivityList">
      {events.map((ev, i) => (
        <div key={i} className="AV2ActivityItem">
          <div
            className="AV2ActivityItem__dot"
            style={{ background: ev.color, fontSize: 16 }}
          >
            {ev.icon}
          </div>
          <div className="AV2ActivityItem__body">
            <p className="AV2ActivityItem__title">{ev.title}</p>
            <p className="AV2ActivityItem__meta">
              By <strong>{ev.actor}</strong>
              &nbsp;·&nbsp;
              <AdminBadge color={TYPE_COLOR[ev.type] ?? 'gray'}>{ev.type}</AdminBadge>
            </p>
          </div>
          <span className="AV2ActivityItem__time">{ev.time}</span>
        </div>
      ))}
    </div>
  )
}
