export default function SettingsPreferenceGroup({ title, helperText, name, options, value, onChange }) {
  return (
    <section className="TripHubSettingsSectionBlock">
      <div className="TripHubSettingsSectionBlock__heading">
        <h2>{title}</h2>
      </div>
      {helperText ? <p className="TripHubSettingsSectionBlock__helper">{helperText}</p> : null}

      <fieldset className="TripHubSettingsOptionsGroup">
        <legend className="TripHubSettingsOptionsGroup__legend">{title}</legend>
        {options.map((option) => (
          <label key={option.value} className="TripHubSettingsOption">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="TripHubSettingsOption__control" aria-hidden="true" />
            <span className="TripHubSettingsOption__content">
              <span className="TripHubSettingsOption__label">{option.label}</span>
              {option.meta ? <span className="TripHubSettingsOption__meta">{option.meta}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  )
}
