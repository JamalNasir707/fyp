export default function SettingsNotificationsSection({
  title,
  description,
  disableAll,
  options,
  values,
  onToggleDisableAll,
  onToggleOption,
}) {
  return (
    <section className="TripHubSettingsPreferences__section">
      <div className="TripHubSettingsNotifications__header">
        <div>
          <h2>{title}</h2>
        </div>

        <label className="TripHubSettingsCheckbox TripHubSettingsCheckbox--toggle">
          <input
            type="checkbox"
            checked={disableAll}
            onChange={(event) => onToggleDisableAll(event.target.checked)}
          />
          <span>Disable All</span>
        </label>
      </div>

      <div className={`TripHubSettingsCollapse${disableAll ? ' is-collapsed' : ''}`}>
        <div className="TripHubSettingsCollapse__inner">
          {description ? <p className="TripHubSettingsNotifications__helper">{description}</p> : null}
          <div className="TripHubSettingsNotifications__list">
            {options.map((option) => (
              <label key={option.key} className="TripHubSettingsNotificationItem">
                <input
                  type="checkbox"
                  checked={Boolean(values?.[option.key])}
                  onChange={(event) => onToggleOption(option.key, event.target.checked)}
                />
                <span className="TripHubSettingsNotificationItem__control" aria-hidden="true" />
                <span className="TripHubSettingsNotificationItem__content">
                  <span className="TripHubSettingsNotificationItem__label">{option.label}</span>
                  <span className="TripHubSettingsNotificationItem__description">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
