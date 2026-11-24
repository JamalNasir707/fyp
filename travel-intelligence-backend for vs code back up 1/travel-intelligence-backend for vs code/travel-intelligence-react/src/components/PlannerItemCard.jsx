import { useEffect, useState } from 'react'
import SectionBadge from './SectionBadge'
import { useWeather, isPlaceWithValidCoords } from '../hooks/useWeather'
import WeatherIcon from './WeatherIcon'

export default function PlannerItemCard({
  item,
  containerId,
  index,
  appearance,
  isChecked,
  isActive,
  isTimeEditing,
  expenseTotal,
  moveDestinations,
  connection,
  onDragStart,
  onDragEnd,
  onToggleActive,
  onToggleSelected,
  onUpdateNote,
  onUpdateChecklist,
  onAddChecklistRowAfter,
  onAddChecklistRow,
  onRemoveChecklistRow,
  onMoveItem,
  onRemoveItem,
  onOpenTimeEditor,
  onCancelTimeEditor,
  onSaveTime,
  onMarkVisited,
  onMarkNotVisited,
  onOpenJournal,
  onOpenExpense,
  onUiAction,
  onOpenMap,
  formatTimeLabel,
  elementRef,
}) {
  // #region debug-point A:init
  const __dbgUrl = 'http://127.0.0.1:7778/event'
  const __dbgSession = 'time-editor-flicker'
  const __dbgRun = 'post-fix'
  const __dbg = (hypothesisId, msg, data) => {
    fetch(__dbgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: __dbgSession,
        runId: __dbgRun,
        hypothesisId,
        location: 'PlannerItemCard.jsx',
        msg: `[DEBUG] ${msg}`,
        data,
        traceId: `${containerId}:${String(item?.id || '')}`,
        ts: Date.now(),
      }),
    }).catch(() => {})
  }
  // #endregion

  const moveOptions = moveDestinations.filter((entry) => entry.id !== containerId)
  const [draftStartTime, setDraftStartTime] = useState(item.startTime || '')
  const [draftEndTime, setDraftEndTime] = useState(item.endTime || '')
  const { weather, loading: weatherLoading, error: weatherError } = useWeather(item)

  useEffect(() => {
    setDraftStartTime(item.startTime || '')
    setDraftEndTime(item.endTime || '')
  }, [item.id, item.startTime, item.endTime])

  function renderMoveSelect() {
    return (
      <select
        className="PlannerMoveSelect"
        defaultValue=""
        onChange={(event) => {
          const { value } = event.target
          onMoveItem(containerId, item.id, value)
          event.target.value = ''
        }}
      >
        <option value="">Move to…</option>
        {moveOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select>
    )
  }

  const visited = Boolean(item.visitDetails?.visited ?? item.visited)

  if (item.type === 'note') {
    return (
      <article
        ref={elementRef}
        className="PlannerPlaceCard PlannerPlaceCard--react PlannerPlaceCard--note"
        style={{ '--section-accent': appearance.color }}
        draggable
        onDragStart={() => onDragStart(containerId, item.id)}
        onDragEnd={onDragEnd}
      >
        <div className="PlannerPlaceCard__bodyReact">
          <div className="PlannerCardRow">
            <input
              type="checkbox"
              className="PlannerSelectCheckbox"
              checked={isChecked}
              onChange={(event) => onToggleSelected(item.id, event.target.checked)}
            />
            <SectionBadge color={appearance.color} icon={appearance.icon} label="" compact />
            <strong>Note</strong>
          </div>
          <textarea
            className="PlannerNoteInput"
            data-note-input={item.id}
            value={item.content || ''}
            onChange={(event) => onUpdateNote(containerId, item.id, event.target.value)}
            placeholder="Write your trip notes here..."
          />
          <div className="PlannerItemActionBar">
            {renderMoveSelect()}
          </div>
        </div>
        <button type="button" className="PlannerDeleteButton" onClick={() => onRemoveItem(containerId, item.id)} aria-label="Delete item">🗑</button>
      </article>
    )
  }

  if (item.type === 'checklist') {
    return (
      <article
        ref={elementRef}
        className="PlannerPlaceCard PlannerPlaceCard--react PlannerPlaceCard--checklist"
        style={{ '--section-accent': appearance.color }}
        draggable
        onDragStart={() => onDragStart(containerId, item.id)}
        onDragEnd={onDragEnd}
      >
        <div className="PlannerPlaceCard__bodyReact PlannerChecklist">
          <div className="PlannerCardRow">
            <input
              type="checkbox"
              className="PlannerSelectCheckbox"
              checked={isChecked}
              onChange={(event) => onToggleSelected(item.id, event.target.checked)}
            />
            <SectionBadge color={appearance.color} icon={appearance.icon} label="" compact />
            <input
              className="PlannerChecklist__title"
              data-checklist-title={item.id}
              value={item.title || ''}
              onChange={(event) => onUpdateChecklist(containerId, item.id, (entry) => ({ ...entry, title: event.target.value }))}
            />
          </div>
          <div className="PlannerChecklist__rows">
            {(item.items || []).map((row) => (
              <label key={row.id} className="PlannerChecklist__row">
                <input
                  type="checkbox"
                  checked={Boolean(row.checked)}
                  onChange={(event) => onUpdateChecklist(containerId, item.id, (entry) => ({
                    ...entry,
                    items: entry.items.map((current) => (current.id === row.id ? { ...current, checked: event.target.checked } : current)),
                  }))}
                />
                <input
                  className="PlannerChecklist__input"
                  value={row.text || ''}
                  onChange={(event) => onUpdateChecklist(containerId, item.id, (entry) => ({
                    ...entry,
                    items: entry.items.map((current) => (current.id === row.id ? { ...current, text: event.target.value } : current)),
                  }))}
                  placeholder="Checklist item"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      onAddChecklistRowAfter(containerId, item.id, row.id)
                    }
                  }}
                />
                <button type="button" className="PlannerChecklist__delete" onClick={() => onRemoveChecklistRow(containerId, item.id, row.id)}>×</button>
              </label>
            ))}
          </div>
          <div className="PlannerItemActionBar">
            <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => onAddChecklistRow(containerId, item.id)}>Add Row</button>
            {renderMoveSelect()}
          </div>
        </div>
        <button type="button" className="PlannerDeleteButton" onClick={() => onRemoveItem(containerId, item.id)} aria-label="Delete item">🗑</button>
      </article>
    )
  }

  return (
    <article
      ref={elementRef}
      className={`PlannerPlaceCard PlannerPlaceCard--react${isChecked ? ' is-selected' : ''}${isTimeEditing ? ' is-time-editing' : ''}`}
      style={{ '--section-accent': appearance.color }}
      draggable
      onDragStart={() => onDragStart(containerId, item.id)}
      onDragEnd={onDragEnd}
      onClick={() => onToggleActive(item.id)}
      onMouseEnter={() => __dbg('A', 'card mouseenter', { isActive, isTimeEditing })}
      onMouseLeave={() => __dbg('A', 'card mouseleave', { isActive, isTimeEditing })}
    >
      {connection ? (
        <div className={`PlannerConnectionRow${connection.optimized ? ' is-optimized' : ''}`}>
          {connection.durationLabel} · {connection.distanceLabel} · Directions from {connection.from}
        </div>
      ) : null}
      <div className="PlannerPlaceCard__row">
        <input
          type="checkbox"
          className="PlannerSelectCheckbox"
          checked={isChecked}
          onChange={(event) => onToggleSelected(item.id, event.target.checked)}
          onClick={(event) => event.stopPropagation()}
          aria-label="Select item"
        />
        <div className="PlannerPlaceCard__marker" style={{ background: item.color || appearance.color }}>
          {index + 1}
        </div>
        <div className="PlannerPlaceCard__body">
          <div className="PlannerPlaceCard__content">
            <div className="PlannerPlaceCard__text">
              <div className="PlannerPlaceTitleRow">
                <h4>{item.title}</h4>
                {isPlaceWithValidCoords(item) ? (
                  weatherLoading ? (
                    <span className="PlannerWeatherBadge PlannerWeatherBadge--loading" title="Loading weather...">--°C</span>
                  ) : weatherError ? null : weather ? (
                    <span className="PlannerWeatherBadge" title={weather.description}>
                      <WeatherIcon icon={weather.icon} description={weather.description} size={18} />
                      <span>{weather.temperature}°C</span>
                    </span>
                  ) : null
                ) : null}
              </div>
              <p>{item.note || item.subtitle || item.category || 'Pakistan'}</p>
              {(item.startTime || item.endTime || Number(expenseTotal || 0) > 0) ? (
                <div className="PlaceMetaRow">
                  {item.startTime || item.endTime ? <div className="PlaceTime">{`${formatTimeLabel(item.startTime)}${item.startTime && item.endTime ? ' - ' : ''}${formatTimeLabel(item.endTime)}`}</div> : null}
                  {Number(expenseTotal || 0) > 0 ? <div className="PlaceCost">💰 PKR {Number(expenseTotal || 0).toLocaleString()}</div> : null}
                </div>
              ) : null}
            </div>
            <div className="PlannerPlaceCard__actions" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="PlannerDeleteButton"
                onClick={() => onRemoveItem(containerId, item.id)}
                aria-label="Delete place"
              >
                🗑
              </button>
              {renderMoveSelect()}
              <button type="button" className="PlannerMiniButton" onClick={() => onOpenMap(item.id)}>Map</button>
            </div>
            {item.image ? (
              <img src={item.image} alt={item.title} />
            ) : (
              <div className="PlannerPlaceCard__thumbPlaceholder" aria-hidden="true" />
            )}
          </div>
          {isActive ? (
            <div className="PlaceActions" onClick={(event) => event.stopPropagation()}>
              {visited ? (
                <>
                  <button type="button" className="PlaceActionLink" onClick={() => onOpenJournal(item.id)}>See in journal</button>
                  <button type="button" className="PlaceActionLink" onClick={() => onMarkNotVisited(item.id)}>Mark as not visited</button>
                </>
              ) : (
                <button type="button" onClick={() => onMarkVisited(item.id)}>✔ Mark as visited</button>
              )}
              <button
                type="button"
                onClick={() => {
                  __dbg('B', 'add time click', { isActive, isTimeEditing })
                  onOpenTimeEditor(item.id)
                }}
              >
                ⏰ Add time
              </button>
              <button type="button" onClick={onUiAction}>📎 Attach</button>
              <button type="button" onClick={() => onOpenExpense(item.id, null)}>💲 Add cost</button>
              {isTimeEditing ? (
                <div
                  className="TimePopup"
                  onMouseEnter={() => __dbg('C', 'popup mouseenter', { isActive, isTimeEditing })}
                  onMouseLeave={() => __dbg('C', 'popup mouseleave', { isActive, isTimeEditing })}
                >
                  <div className="TimeRow">
                    <div className="TimeField">
                      <div className="TimeLabel">Start time</div>
                      <input
                        type="time"
                        value={draftStartTime}
                        onChange={(event) => setDraftStartTime(event.target.value)}
                        onFocus={() => __dbg('D', 'start focus', { value: draftStartTime })}
                        onBlur={() => __dbg('D', 'start blur', { value: draftStartTime })}
                        onMouseEnter={() => __dbg('D', 'start mouseenter', null)}
                        onMouseLeave={() => __dbg('D', 'start mouseleave', null)}
                      />
                    </div>
                    <div className="TimeSeparator">-</div>
                    <div className="TimeField">
                      <div className="TimeLabel">End time</div>
                      <input
                        type="time"
                        value={draftEndTime}
                        onChange={(event) => setDraftEndTime(event.target.value)}
                        onFocus={() => __dbg('D', 'end focus', { value: draftEndTime })}
                        onBlur={() => __dbg('D', 'end blur', { value: draftEndTime })}
                        onMouseEnter={() => __dbg('D', 'end mouseenter', null)}
                        onMouseLeave={() => __dbg('D', 'end mouseleave', null)}
                      />
                    </div>
                  </div>
                  <div className="TimePopup__actions">
                    <button
                      type="button"
                      onClick={() => {
                        __dbg('E', 'time cancel click', null)
                        onCancelTimeEditor()
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        __dbg('E', 'time save click', { draftStartTime, draftEndTime })
                        onSaveTime(item.id, draftStartTime, draftEndTime)
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
