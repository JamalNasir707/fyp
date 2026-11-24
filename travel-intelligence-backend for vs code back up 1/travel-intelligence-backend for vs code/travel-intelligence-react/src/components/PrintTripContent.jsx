function getPrintItemTitle(item) {
  if (item?.type === 'note') return item.title || 'Note'
  if (item?.type === 'checklist') return item.title || 'Checklist'
  return item?.title || 'Untitled place'
}

function getPrintItemDescription(item) {
  if (item?.note) return item.note
  if (item?.subtitle) return item.subtitle
  if (item?.content) return item.content
  if (Array.isArray(item?.items)) {
    return item.items
      .map((row) => row?.text || '')
      .filter(Boolean)
      .join(' • ')
  }
  return ''
}

function PrintStop({ item, index }) {
  const description = getPrintItemDescription(item)

  return (
    <div className="PrintStop">
      <div className="PrintStop__row">
        <div className="PrintStop__marker">{index + 1}</div>
        <div className="PrintStop__body">
          <h4>{getPrintItemTitle(item)}</h4>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
    </div>
  )
}

function PrintDaySection({ day }) {
  const items = Array.isArray(day?.items) ? day.items : []

  return (
    <section className="PrintDay">
      <div className="PrintDay__header">
        <h3>{day?.label || 'Day'}</h3>
      </div>
      <div className="PrintTimeline">
        {items.length ? items.map((item, index) => (
          <PrintStop key={item?.id || `${day?.id || 'day'}-${index}`} item={item} index={index} />
        )) : <p className="PrintEmpty">No places scheduled for this day.</p>}
      </div>
    </section>
  )
}

export default function PrintTripContent({ trip }) {
  const days = Array.isArray(trip?.days) ? trip.days : []

  return (
    <main id="print-root" className="PrintRoot">
      <div className="PrintDoc">
        <section className="PrintHero">
          <h1>{trip?.title || trip?.name || 'My Trip'}</h1>
          {trip?.dates ? <p>{trip.dates}</p> : null}
        </section>
        {days.length ? days.map((day, index) => (
          <PrintDaySection key={day?.id || `day-${index}`} day={day} />
        )) : <p className="PrintEmpty">No itinerary found.</p>}
      </div>
    </main>
  )
}
