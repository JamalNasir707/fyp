import { useEffect, useMemo, useState } from 'react'
import { ICON_CHOICES } from '../lib/sections'

const COLOR_CHOICES = ['#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#065f46', '#0f766e', '#1d4ed8', '#4c1d95', '#7c2d12']

function cloneData(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function ensureSectionAppearance(trip) {
  const appearance = trip?.sectionAppearance && typeof trip.sectionAppearance === 'object'
    ? trip.sectionAppearance
    : {}
  const pool = appearance.pool && typeof appearance.pool === 'object'
    ? appearance.pool
    : { color: '#3b82f6', icon: '123' }
  return { ...appearance, pool: { color: pool.color || '#3b82f6', icon: pool.icon || '123' } }
}

function normalizeCustomLists(customLists) {
  return (customLists || []).map((list) => ({
    ...list,
    color: list.color || '#10b981',
    icon: list.icon || '123',
    items: Array.isArray(list.items) ? list.items : [],
  }))
}

function normalizeDays(days) {
  return (days || []).map((day) => ({
    ...day,
    color: day.color || '#3b82f6',
    icon: day.icon || '123',
    items: Array.isArray(day.items) ? day.items : [],
  }))
}

function rebuildTripDayMetadata(trip, rawDays) {
  const hasValidStart = Number.isFinite(new Date(trip.startDate).getTime())
  const days = rawDays.map((day, index) => {
    let date = day.date
    if (hasValidStart) {
      const nextDate = new Date(trip.startDate)
      nextDate.setDate(nextDate.getDate() + index)
      date = nextDate.toDateString()
    }
    return {
      ...day,
      label: `Day ${index + 1}`,
      shortLabel: `Day ${index + 1}`,
      date,
    }
  })

  if (!hasValidStart || !days.length) {
    return { ...trip, days }
  }

  const endDate = new Date(trip.startDate)
  endDate.setDate(endDate.getDate() + days.length - 1)
  const endDateIso = endDate.toISOString().slice(0, 10)
  return {
    ...trip,
    days,
    endDate: endDateIso,
    dates: `${trip.startDate} - ${endDateIso}`,
  }
}

export default function ArrangementModal({ open, trip, initialSectionId = 'pool', onClose, onApply }) {
  const [draft, setDraft] = useState(() => {
    const base = cloneData(trip)
    return {
      ...base,
      sectionAppearance: ensureSectionAppearance(base),
      customLists: normalizeCustomLists(base.customLists),
      days: normalizeDays(base.days),
    }
  })
  const [activeSectionId, setActiveSectionId] = useState(initialSectionId || 'pool')

  useEffect(() => {
    if (!open) return
    const base = cloneData(trip)
    setDraft({
      ...base,
      sectionAppearance: ensureSectionAppearance(base),
      customLists: normalizeCustomLists(base.customLists),
      days: normalizeDays(base.days),
    })
    setActiveSectionId(initialSectionId || 'pool')
  }, [open, trip, initialSectionId])

  const sections = useMemo(() => {
    const listSections = (draft.customLists || []).map((list) => ({ id: `custom:${list.id}`, label: list.name || 'Custom list', group: 'custom' }))
    const daySections = (draft.days || []).map((day, index) => ({ id: `day:${day.id}`, label: day.shortLabel || `Day ${index + 1}`, group: 'day' }))
    return [
      { id: 'pool', label: 'Places pool', group: 'pool' },
      ...listSections,
      ...daySections,
    ]
  }, [draft.customLists, draft.days])

  if (!open) return null

  function getAppearance(sectionId) {
    if (sectionId === 'pool') return draft.sectionAppearance?.pool || { color: '#3b82f6', icon: '123' }
    if (sectionId.startsWith('custom:')) {
      const listId = sectionId.slice('custom:'.length)
      return draft.customLists.find((list) => list.id === listId) || { color: '#10b981', icon: '123' }
    }
    if (sectionId.startsWith('day:')) {
      const dayId = sectionId.slice('day:'.length)
      return draft.days.find((day) => day.id === dayId) || { color: '#3b82f6', icon: '123' }
    }
    return { color: '#3b82f6', icon: '123' }
  }

  function setColor(sectionId, color) {
    setDraft((prev) => {
      if (sectionId === 'pool') {
        return { ...prev, sectionAppearance: { ...ensureSectionAppearance(prev), pool: { ...ensureSectionAppearance(prev).pool, color } } }
      }
      if (sectionId.startsWith('custom:')) {
        const listId = sectionId.slice('custom:'.length)
        return { ...prev, customLists: prev.customLists.map((list) => (list.id === listId ? { ...list, color } : list)) }
      }
      if (sectionId.startsWith('day:')) {
        const dayId = sectionId.slice('day:'.length)
        return { ...prev, days: prev.days.map((day) => (day.id === dayId ? { ...day, color } : day)) }
      }
      return prev
    })
  }

  function setIcon(sectionId, icon) {
    setDraft((prev) => {
      if (sectionId === 'pool') {
        return { ...prev, sectionAppearance: { ...ensureSectionAppearance(prev), pool: { ...ensureSectionAppearance(prev).pool, icon } } }
      }
      if (sectionId.startsWith('custom:')) {
        const listId = sectionId.slice('custom:'.length)
        return { ...prev, customLists: prev.customLists.map((list) => (list.id === listId ? { ...list, icon } : list)) }
      }
      if (sectionId.startsWith('day:')) {
        const dayId = sectionId.slice('day:'.length)
        return { ...prev, days: prev.days.map((day) => (day.id === dayId ? { ...day, icon } : day)) }
      }
      return prev
    })
  }

  function moveSection(sectionId, direction) {
    setDraft((prev) => {
      if (sectionId.startsWith('custom:')) {
        const listId = sectionId.slice('custom:'.length)
        const index = prev.customLists.findIndex((list) => list.id === listId)
        const nextIndex = direction === 'up' ? index - 1 : index + 1
        if (index < 0 || nextIndex < 0 || nextIndex >= prev.customLists.length) return prev
        const next = [...prev.customLists]
        const [removed] = next.splice(index, 1)
        next.splice(nextIndex, 0, removed)
        return { ...prev, customLists: next }
      }
      if (sectionId.startsWith('day:')) {
        const dayId = sectionId.slice('day:'.length)
        const index = prev.days.findIndex((day) => day.id === dayId)
        const nextIndex = direction === 'up' ? index - 1 : index + 1
        if (index < 0 || nextIndex < 0 || nextIndex >= prev.days.length) return prev
        const next = [...prev.days]
        const [removed] = next.splice(index, 1)
        next.splice(nextIndex, 0, removed)
        const rebuilt = rebuildTripDayMetadata(prev, next)
        return { ...prev, days: rebuilt.days, endDate: rebuilt.endDate, dates: rebuilt.dates }
      }
      return prev
    })
  }

  const active = getAppearance(activeSectionId)
  const activeIconLabel = ICON_CHOICES.find((entry) => entry.id === (active.icon || '123'))?.label || ''

  function handleApply() {
    onApply({
      ...trip,
      sectionAppearance: draft.sectionAppearance,
      customLists: draft.customLists,
      days: draft.days,
      endDate: draft.endDate,
      dates: draft.dates,
    })
    onClose()
  }

  return (
    <div className="PlannerModalOverlay" onClick={onClose}>
      <div className="PlannerModalCard ArrangementModal" onClick={(event) => event.stopPropagation()}>
        <div className="ArrangementModal__header">
          <h3>Arrangement and color</h3>
          <button type="button" className="PlannerModalCloseButton" onClick={onClose}>×</button>
        </div>
        <div className="ArrangementModal__body">
          <div className="ArrangementModal__list">
            {sections.map((section) => {
              const appearance = getAppearance(section.id)
              const iconLabel = ICON_CHOICES.find((entry) => entry.id === (appearance.icon || '123'))?.label || ''
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`ArrangementModalRow${section.id === activeSectionId ? ' is-active' : ''}`}
                  onClick={() => setActiveSectionId(section.id)}
                >
                  <span className="ArrangementModalRow__handle">⋮⋮</span>
                  <span className="ArrangementModalRow__text">
                    <span className="ArrangementModalRow__name">{section.label}</span>
                    <span className="ArrangementModalRow__group">{section.group}</span>
                  </span>
                  <span className="ArrangementModalRow__meta">
                    <span className="ArrangementModalRow__dot" style={{ background: appearance.color || '#3b82f6' }} />
                    {iconLabel && iconLabel !== '123' ? <span className="ArrangementModalRow__icon">{iconLabel}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="ArrangementModal__editor">
            <div className="ArrangementModal__editorHeader">
              <div>
                <div className="ArrangementModal__editorTitle">Selected: {activeSectionId}</div>
                <div className="ArrangementModal__editorMeta">
                  <span className="ArrangementModalRow__dot" style={{ background: active.color || '#3b82f6' }} />
                  {activeIconLabel && activeIconLabel !== '123' ? <span>{activeIconLabel}</span> : <span>no icon</span>}
                </div>
              </div>
              <div className="ArrangementModal__moveButtons">
                <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => moveSection(activeSectionId, 'up')}>Move up</button>
                <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={() => moveSection(activeSectionId, 'down')}>Move down</button>
              </div>
            </div>

            <div className="ArrangementModal__picker">
              <div className="ArrangementModal__label">Color</div>
              <div className="ArrangementModal__colors">
                {COLOR_CHOICES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`ArrangementModalColor${(active.color || '') === color ? ' is-selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setColor(activeSectionId, color)}
                    aria-label={`Pick ${color}`}
                  >
                    {(active.color || '') === color ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="ArrangementModal__picker">
              <div className="ArrangementModal__label">Icon</div>
              <div className="ArrangementModal__icons">
                {ICON_CHOICES.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    className={`ArrangementModalIcon${(active.icon || '123') === icon.id ? ' is-selected' : ''}`}
                    onClick={() => setIcon(activeSectionId, icon.id)}
                  >
                    {icon.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="PlannerModalActions">
          <button type="button" className="PlannerPillButton PlannerPillButton--light" onClick={onClose}>Cancel</button>
          <button type="button" className="PlannerPillButton PlannerPillButton--accent" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
