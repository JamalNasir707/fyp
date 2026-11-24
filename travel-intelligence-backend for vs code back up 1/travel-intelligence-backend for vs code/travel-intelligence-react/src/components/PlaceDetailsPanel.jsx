import { useWeather, isPlaceWithValidCoords } from '../hooks/useWeather'
import WeatherIcon from './WeatherIcon'

export default function PlaceDetailsPanel({
  selectedPlace,
  visitDetails,
  selectedPlaceExpenses,
  timeOptions,
  formatMoney,
  formatShortDate,
  onUpdateTime,
  onUpdateVisit,
  onUpdateLocation,
  onOpenExpenseEditor,
  onDeleteExpense,
}) {
  const { weather, loading: weatherLoading, error: weatherError } = useWeather(selectedPlace)

  if (!selectedPlace) {
    return <p className="PlannerEmptyState">Select a place to manage visit details, journal notes, time, and place-linked expenses.</p>
  }

  return (
    <div className="PlaceDetailsGrid">
      {isPlaceWithValidCoords(selectedPlace) ? (
        <div className="PlaceDetailsCard WeatherDetailsCard">
          <h4>Live Weather</h4>
          {weatherLoading ? (
            <div className="WeatherPlaceholder">Loading weather...</div>
          ) : weatherError ? (
            <div className="WeatherErrorText">Weather unavailable</div>
          ) : weather ? (
            <div className="WeatherStackedCard">
              <div className="WeatherHeaderSection">
                <WeatherIcon icon={weather.icon} description={weather.description} size={48} />
                <div className="WeatherHeaderTempGroup">
                  <div className="WeatherHeaderTemp">{weather.temperature}°C</div>
                  <div className="WeatherHeaderDesc">{weather.description}</div>
                  <div className="WeatherHeaderFeels">Feels like {weather.feels_like}°C</div>
                </div>
              </div>

              <div className="WeatherVerticalMetrics">
                <div className="WeatherMetricRow">
                  <span className="WeatherMetricRowLabel">💧 Humidity</span>
                  <span className="WeatherMetricRowVal">{weather.humidity}%</span>
                </div>

                <div className="WeatherMetricRow">
                  <span className="WeatherMetricRowLabel">🌬️ Wind Speed</span>
                  <span className="WeatherMetricRowVal">{weather.wind_speed} m/s</span>
                </div>

                <div className="WeatherMetricRow">
                  <span className="WeatherMetricRowLabel">☁️ Cloud Cover</span>
                  <span className="WeatherMetricRowVal">{weather.cloud_cover ?? 20}%</span>
                </div>

                <div className="WeatherMetricRow">
                  <span className="WeatherMetricRowLabel">🌡️ Pressure</span>
                  <span className="WeatherMetricRowVal">{weather.pressure ?? 1012} hPa</span>
                </div>
              </div>

              <div className="WeatherStackedFooter">
                <span>⏱ Updated just now</span>
              </div>
            </div>
          ) : (
            <div className="WeatherErrorText">Weather unavailable</div>
          )}
        </div>
      ) : null}
      <div className="PlaceDetailsCard">
        <h4>Schedule</h4>
        <div className="TripPrefGrid">
          <label className="TripPrefField">
            <span>Start Time</span>
            <select value={selectedPlace.startTime || ''} onChange={(event) => onUpdateTime('startTime', event.target.value)}>
              <option value="">Select...</option>
              {timeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="TripPrefField">
            <span>End Time</span>
            <select value={selectedPlace.endTime || ''} onChange={(event) => onUpdateTime('endTime', event.target.value)}>
              <option value="">Select...</option>
              {timeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="PlaceDetailsCard">
        <h4>Visit & Journal</h4>
        <label className="TripPrefToggle">
          <input
            type="checkbox"
            checked={Boolean(visitDetails.visited)}
            onChange={(event) => onUpdateVisit((details) => ({ ...details, visited: event.target.checked }))}
          />
          Mark as visited
        </label>
        <div className="TripPrefGrid">
          <label className="TripPrefField">
            <span>Visited Date</span>
            <input
              type="date"
              value={visitDetails.visitedDate || ''}
              onChange={(event) => onUpdateVisit((details) => ({ ...details, visitedDate: event.target.value || null }))}
            />
          </label>
          <label className="TripPrefField">
            <span>Visited Time</span>
            <input
              type="time"
              step="1800"
              value={visitDetails.visitedTime || ''}
              onChange={(event) => onUpdateVisit((details) => ({ ...details, visitedTime: event.target.value || null }))}
            />
          </label>
          <label className="TripPrefField TripPrefField--full">
            <span>Location</span>
            <input
              type="text"
              value={selectedPlace.visitLocation || ''}
              onChange={(event) => onUpdateLocation(event.target.value)}
              placeholder="Where have you been?"
            />
          </label>
        </div>
        <label className="TripPrefField TripPrefField--full">
          <span>Journal / Visit Notes</span>
          <textarea
            className="PlannerNoteInput"
            value={visitDetails.notes || ''}
            onChange={(event) => onUpdateVisit((details) => ({ ...details, notes: event.target.value }))}
            placeholder="Write what happened at this place..."
          />
        </label>
      </div>
      <div className="PlaceDetailsCard PlaceDetailsCard--full">
        <h4>Expenses for This Place</h4>
        {!selectedPlaceExpenses.length ? <p className="PlannerEmptyState">No expenses linked to this place yet.</p> : (
          <div className="PlannerExpenseList">
            {selectedPlaceExpenses.map((expense) => (
              <article key={expense.id} className="PlannerExpenseCard">
                <div>
                  <strong>{formatMoney(expense.amount)}</strong>
                  <div className="PlannerPlaceCard__meta">{expense.category} {expense.date ? `· ${formatShortDate(expense.date)}` : ''}</div>
                  {expense.note ? <div className="PlannerPlaceCard__note">{expense.note}</div> : null}
                </div>
                <div className="PlannerItemActionBar">
                  <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => onOpenExpenseEditor(selectedPlace.id, expense.id)}>Edit</button>
                  <button type="button" className="PlannerInlineDanger" onClick={() => onDeleteExpense(expense.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
