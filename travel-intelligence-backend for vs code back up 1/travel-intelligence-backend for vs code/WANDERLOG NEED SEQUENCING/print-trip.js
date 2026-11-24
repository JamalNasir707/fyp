/**
 * TripNest print view — builds a Wanderlog-style printable itinerary.
 */
const PRINT_SPEED_KMH = 30;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isNoteOrChecklist(item) {
    return item?.type === 'note' || item?.type === 'checklist';
}

function haversineKm(aLat, aLon, bLat, bLon) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const sLat = toRad(aLat);
    const eLat = toRad(bLat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(sLat) * Math.cos(eLat) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function getPlaceCoords(place) {
    const lat = Number(place?.lat);
    const lon = Number(place?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { lat, lon };
    }
    const baseLat = 33.6844;
    const baseLon = 73.0479;
    const x = Number.isFinite(place?.x) ? place.x : 50;
    const y = Number.isFinite(place?.y) ? place.y : 50;
    return {
        lat: baseLat + ((50 - y) / 100) * 0.12,
        lon: baseLon + ((x - 50) / 100) * 0.12
    };
}

function formatDayHeading(dateStr, fallback) {
    const date = new Date(dateStr);
    if (!Number.isFinite(date.getTime())) {
        return fallback || 'Day';
    }
    let formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const day = date.getDate();
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';
    return formatted.replace(String(day), `${day}${suffix}`);
}

function formatMinutesLabel(minutes) {
    const m = Math.max(1, Math.round(Number(minutes) || 0));
    return `${m} min${m === 1 ? '' : 's'}`;
}

function kmToMiles(km) {
    return Number(km || 0) * 0.621371;
}

function formatMilesLabel(km) {
    const mi = kmToMiles(km);
    return `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
}

function getConnectionForDay(day, trip) {
    const places = (day.items || []).filter((item) => !isNoteOrChecklist(item));
    const map = new Map();
    const optimization = day?.optimization || null;
    if (optimization?.legs?.length) {
        optimization.legs.forEach((leg) => {
            map.set(String(leg.to_place_id), {
                from: leg.from_name,
                minutes: Number(leg.time_min) || 0,
                km: Number(leg.distance_km) || 0
            });
        });
        return map;
    }
    places.forEach((place, index) => {
        if (index === 0) return;
        const prev = places[index - 1];
        const a = getPlaceCoords(prev);
        const b = getPlaceCoords(place);
        const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
        const minutes = Math.max(1, Math.round((km / PRINT_SPEED_KMH) * 60));
        map.set(String(place.id), {
            from: prev.title,
            minutes,
            km
        });
    });
    return map;
}

function collectPoolPlaces(trip) {
    return (trip.placesPool || []).filter((item) => !isNoteOrChecklist(item));
}

function collectJournalEntries(trip) {
    const entries = [];
    const add = (place, context) => {
        if (!place?.title) return;
        const details = place.visitDetails && typeof place.visitDetails === 'object' ? place.visitDetails : null;
        const note = String(details?.notes ?? place.visitNote ?? '').trim();
        const location = String(place.visitLocation || '').trim();
        if (!note && !location && !place.visited) return;
        entries.push({
            title: place.title,
            context,
            note: note || '—',
            location: location || '—',
            visited: Boolean(place.visited)
        });
    };
    collectPoolPlaces(trip).forEach((place) => add(place, 'Places to visit'));
    (trip.days || []).forEach((day) => {
        const label = formatDayHeading(day.date, day.label);
        (day.items || []).filter((item) => !isNoteOrChecklist(item)).forEach((place) => add(place, label));
    });
    return entries;
}

function buildPrintModel(trip) {
    const currency = trip?.budget?.currency || 'PKR';
    const expenses = Array.isArray(trip.expenses) ? [...trip.expenses] : [];
    expenses.sort((a, b) => {
        const ta = new Date(a?.date).getTime() || 0;
        const tb = new Date(b?.date).getTime() || 0;
        return tb - ta;
    });
    const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const budgetLimit = Number(trip?.budget?.amount) || 0;

    const poolPlaces = collectPoolPlaces(trip);
    const days = (trip.days || []).map((day) => {
        const places = (day.items || []).filter((item) => !isNoteOrChecklist(item));
        const connections = getConnectionForDay(day, trip);
        let totalMinutes = 0;
        let totalKm = 0;
        places.forEach((place, index) => {
            if (index === 0) return;
            const conn = connections.get(String(place.id));
            if (conn) {
                totalMinutes += conn.minutes;
                totalKm += conn.km;
            }
        });
        return {
            id: day.id,
            label: formatDayHeading(day.date, day.label),
            dateRange: trip.dates || '',
            places: places.map((place, index) => {
                const conn = connections.get(String(place.id));
                return {
                    index: index + 1,
                    title: place.title || 'Untitled place',
                    note: place.note || '',
                    subtitle: place.subtitle || '',
                    connection: conn
                        ? {
                            from: conn.from,
                            minutes: conn.minutes,
                            miles: formatMilesLabel(conn.km),
                            minutesLabel: formatMinutesLabel(conn.minutes)
                        }
                        : null
                };
            }),
            summary: places.length
                ? `${formatMinutesLabel(totalMinutes)}, ${formatMilesLabel(totalKm)}`
                : ''
        };
    });

    return {
        title: trip.title || trip.name || 'My Trip',
        dates: trip.dates || formatTripDateRange(trip.startDate, trip.endDate) || '',
        notes: String(trip.notes || '').trim(),
        pool: {
            count: poolPlaces.length,
            places: poolPlaces.map((p) => ({
                title: p.title,
                note: p.note || '',
                subtitle: p.subtitle || ''
            }))
        },
        days,
        budget: {
            currency,
            limit: budgetLimit,
            spent: totalSpent,
            expenses: expenses.map((e) => ({
                description: e.description || 'Expense',
                category: e.category || 'Other',
                amount: Number(e.amount) || 0,
                date: e.date || ''
            }))
        },
        journalCount: collectJournalEntries(trip).length
    };
}

function formatTripDateRange(startDate, endDate) {
    if (!startDate && !endDate) return '';
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    return startDate || endDate || '';
}

function renderPrintDocument(model) {
    const poolList = model.pool.places.length
        ? `<ol class="PrintList PrintList--compact">
            ${model.pool.places.map((p) => `
                <li>
                    <strong>${escapeHtml(p.title)}</strong>
                    ${p.subtitle ? `<span class="PrintMuted"> · ${escapeHtml(p.subtitle)}</span>` : ''}
                    ${p.note ? `<div class="PrintNote">${escapeHtml(p.note)}</div>` : ''}
                </li>
            `).join('')}
           </ol>`
        : '<p class="PrintEmpty">No places in the pool yet.</p>';

    const itineraryHtml = model.days.length
        ? model.days.map((day) => {
            const stops = day.places.length
                ? day.places.map((place) => `
                    <div class="PrintStop">
                        ${place.connection ? `
                            <div class="PrintLeg">
                                <span class="PrintLeg__icon">🚗</span>
                                ${escapeHtml(place.connection.minutesLabel)} · ${escapeHtml(place.connection.miles)}
                            </div>
                        ` : ''}
                        <div class="PrintStop__row">
                            <div class="PrintStop__marker">${place.index}</div>
                            <div class="PrintStop__body">
                                <h4>${escapeHtml(place.title)}</h4>
                                ${place.note ? `<p>${escapeHtml(place.note)}</p>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')
                : '<p class="PrintEmpty">No places scheduled for this day.</p>';

            return `
                <section class="PrintDay">
                    <div class="PrintDay__header">
                        <h3>${escapeHtml(day.label)}</h3>
                        ${day.summary ? `<span class="PrintDay__stats">${escapeHtml(day.summary)}</span>` : ''}
                    </div>
                    <div class="PrintTimeline">${stops}</div>
                </section>
            `;
        }).join('')
        : '<p class="PrintEmpty">No itinerary days yet.</p>';

    const expenseRows = model.budget.expenses.length
        ? model.budget.expenses.map((e) => `
            <tr>
                <td>${escapeHtml(e.description)}</td>
                <td>${escapeHtml(e.category)}</td>
                <td>${escapeHtml(e.date)}</td>
                <td class="PrintAmount">${escapeHtml(model.budget.currency)} ${e.amount.toLocaleString()}</td>
            </tr>
        `).join('')
        : `<tr><td colspan="4" class="PrintEmpty">No expenses recorded.</td></tr>`;

    return `
        <article class="PrintDoc">
            <header class="PrintDoc__hero">
                <h1>${escapeHtml(model.title)}</h1>
                ${model.dates ? `<p class="PrintDoc__dates">📅 ${escapeHtml(model.dates)}</p>` : ''}
            </header>

            <section class="PrintSection">
                <h2>Places to visit <span class="PrintCount">${model.pool.count} place${model.pool.count === 1 ? '' : 's'}</span></h2>
                ${poolList}
            </section>

            <section class="PrintSection">
                <h2>Itinerary ${model.dates ? `<span class="PrintMuted">· ${escapeHtml(model.dates)}</span>` : ''}</h2>
                ${itineraryHtml}
            </section>

            ${model.notes ? `
                <section class="PrintSection">
                    <h2>Notes</h2>
                    <p class="PrintNoteBlock">${escapeHtml(model.notes)}</p>
                </section>
            ` : ''}

            <section class="PrintSection PrintSection--budget">
                <h2>Budget</h2>
                <div class="PrintBudgetSummary">
                    <div><span>Total spent</span><strong>${escapeHtml(model.budget.currency)} ${model.budget.spent.toLocaleString()}</strong></div>
                    <div><span>Budget limit</span><strong>${escapeHtml(model.budget.currency)} ${model.budget.limit.toLocaleString()}</strong></div>
                </div>
                <table class="PrintTable">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Date</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>${expenseRows}</tbody>
                </table>
            </section>
        </article>
    `;
}
