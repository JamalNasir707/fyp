const placeCatalog = {
    'centaurus-mall': {
        id: 'centaurus-mall',
        title: 'Centaurus Mall',
        subtitle: 'Islamabad',
        note: 'Open 11:00–0:00 · Sleek, upmarket retail complex with 300+ stores, a food court, cinema, and amusement park.',
        image: 'assets/images/trip-pakistan.jpg',
        color: '#2ab7a9',
        x: 59,
        y: 46,
        budget: 1200
    },
    'faisal-masjid': {
        id: 'faisal-masjid',
        title: 'Faisal Masjid, Islamabad',
        subtitle: 'Islamabad',
        note: 'Open 24 hours · Established in 1987, this iconic contemporary mosque is designed to resemble a Bedouin tent.',
        image: 'assets/images/guide-britain.jpg',
        color: '#6f42c1',
        x: 57,
        y: 44,
        budget: 0
    },
    'safa-gold-mall': {
        id: 'safa-gold-mall',
        title: 'Safa Gold Mall',
        subtitle: 'Islamabad',
        note: 'Open 11:00–23:00 · Multi-level mall with well-known chain retailers and a popular food court.',
        image: 'assets/images/guide-japan.jpg',
        color: '#2196f3',
        x: 61,
        y: 48,
        budget: 900
    },
    'f7-markaz': {
        id: 'f7-markaz',
        title: 'F-7 Markaz (Jinnah Super Market)',
        subtitle: 'Islamabad',
        note: 'Open 0:00–1:00, 11:00–1:00 · Add notes, links, and temporary stop details here.',
        image: 'assets/images/HotelBookingView__image.png',
        color: '#f25e25',
        x: 60,
        y: 49,
        budget: 1500
    },
    'pakistan-monument': {
        id: 'pakistan-monument',
        title: 'Pakistan Monument',
        subtitle: 'Islamabad',
        note: 'From the web · Dedicated to national unity, this monument is shaped like blooming flower petals and houses a museum.',
        image: 'assets/images/HotelSearchWithAirbnbHeaderPromo_promo.png',
        color: '#22c55e',
        x: 58,
        y: 47,
        budget: 500
    },
    'lok-virsa': {
        id: 'lok-virsa',
        title: 'Lok Virsa Heritage Museum',
        subtitle: 'Islamabad',
        note: 'National folk museum with galleries, craft displays, and regional cultural collections.',
        image: 'assets/images/trip-pakistan.jpg',
        color: '#ef4444',
        x: 62,
        y: 50,
        budget: 700
    },
    'margala-hills': {
        id: 'margala-hills',
        title: 'Margala Hills',
        subtitle: 'Islamabad',
        note: 'Popular green escape with lookout points, easy hikes, and city views.',
        image: 'assets/images/guide-plovdiv.jpg',
        color: '#14b8a6',
        x: 55,
        y: 40,
        budget: 0
    },
    'rawal-lake': {
        id: 'rawal-lake',
        title: 'Rawal Lake',
        subtitle: 'Islamabad',
        note: 'Waterfront stop with open views and picnic spots near the city.',
        image: 'assets/images/guide-britain.jpg',
        color: '#f59e0b',
        x: 65,
        y: 55,
        budget: 300
    }
};

const suggestionOrder = [
    'lok-virsa',
    'margala-hills',
    'rawal-lake'
];

function fallbackClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function cloneData(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : fallbackClone(value);
}

function makeInstanceId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createCatalogPlace(catalogId) {
    const base = cloneData(placeCatalog[catalogId]);
    return {
        ...base,
        id: makeInstanceId(catalogId),
        catalogId,
        startTime: null,
        endTime: null,
        visited: false,
        visitNote: '',
        visitLocation: ''
    };
}

function createCustomPlace(title) {
    return {
        id: makeInstanceId('custom'),
        catalogId: null,
        title,
        subtitle: 'Custom place',
        note: 'Placeholder details',
        image: 'assets/images/trip-pakistan.jpg',
        color: '#111827',
        x: 52,
        y: 52,
        budget: 0,
        startTime: null,
        endTime: null,
        visited: false,
        visitNote: '',
        visitLocation: ''
    };
}

function createNoteItem() {
    return {
        id: makeInstanceId('note'),
        type: 'note',
        content: ''
    };
}

function createChecklistRow() {
    return {
        id: makeInstanceId('checkitem'),
        text: '',
        checked: false
    };
}

function createChecklistItem() {
    return {
        id: makeInstanceId('checklist'),
        type: 'checklist',
        title: '',
        items: []
    };
}

function insertItem(containerType, containerId, index, itemType) {
    const normalizedContainerType = containerType === 'itinerary'
        ? 'day'
        : containerType === 'places'
            ? 'pool'
            : containerType;
    const normalizedContainerId = normalizedContainerType === 'pool'
        ? 'pool'
        : containerId;
    if (itemType === 'place') {
        const selector = normalizedContainerType === 'day'
            ? `form[data-add-form="day"][data-day-id="${normalizedContainerId}"] input[name="placeName"]`
            : normalizedContainerType === 'pool'
                ? 'form[data-add-form="pool"] input[name="placeName"]'
                : normalizedContainerType === 'custom'
                    ? `form[data-add-form="custom"][data-custom-id="${normalizedContainerId}"] input[name="placeName"]`
                    : '';
        if (!selector) {
            return null;
        }
        const input = plannerMain.querySelector(selector);
        input?.focus();
        return null;
    }

    const container = getContainer(normalizedContainerType, normalizedContainerId);
    if (!Array.isArray(container)) {
        return null;
    }
    const safeIndex = Number.isFinite(index)
        ? Math.max(0, Math.min(index, container.length))
        : container.length;
    const newItem = itemType === 'note'
        ? createNoteItem()
        : itemType === 'checklist'
            ? createChecklistItem()
            : null;
    if (!newItem) {
        return null;
    }
    saveState();
    container.splice(safeIndex, 0, newItem);
    return newItem;
}

const uiState = {
    pendingToastTarget: null,
    activeSidebarId: 'section-overview',
    dragContext: null,
    selectedItems: [],
    activePlaceId: null,
    activeInsertMenu: null,
    activeNotePlaceId: null,
    chooseLocationPlaceId: null,
    activeJournalPlaceId: null,
    tripSettingsOpen: false,
    tripJournalOverviewOpen: false,
    tripPreferencesOpen: false,
    engineSuggestionsOpen: false,
    engineSuggestionsLoading: false,
    engineSuggestionsError: null,
    engineSuggestionsPreview: null,
    optimizationPreview: null,
    optimizedDays: new Map(),
    optimizationHighlightIds: new Set(),
    optimizationHighlightUntil: 0,
    optimizationHighlightTimer: null,
    optimizationShiftById: new Map(),
    optimizationShiftUntil: 0,
    expenses: [],
    expenseSort: 'date_desc',
    budgetModal: {
        isOpen: false
    },
    expenseModal: {
        isOpen: false,
        editingExpenseId: null,
        placeId: null
    },
    timeEditor: {
        placeId: null
    },
    sectionTitles: {
        notes: 'Notes',
        pool: 'Places to visit'
    },
    collapsedSections: new Set(),
    editingTitleKey: null,
    poolSection: {
        color: '#3b82f6',
        icon: '123'
    },
    arrangementModal: {
        isOpen: false,
        activeSectionId: 'section-pool',
        editingSectionId: null
    }
};

const OPTIMIZATION_SPEED_KMH = 30;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getDayById(dayId) {
    return trip.days.find((day) => day.id === dayId) || null;
}

function getDayPlaceItems(day) {
    return (Array.isArray(day?.items) ? day.items : []).filter((item) => !isNoteItem(item) && !isChecklistItem(item));
}

function getDayOrderIds(day) {
    return getDayPlaceItems(day).map((item) => String(item.id));
}

function getOrderSignature(orderIds) {
    return (Array.isArray(orderIds) ? orderIds : []).map((id) => String(id)).join('|');
}

function getDayBudgetEstimate(day) {
    const places = getDayPlaceItems(day);
    const explicitExpenseTotal = places.reduce((sum, item) => {
        const total = (trip.expenses || [])
            .filter((expense) => expense.placeId === item.id)
            .reduce((inner, expense) => inner + (Number(expense.amount) || 0), 0);
        return sum + total;
    }, 0);
    if (explicitExpenseTotal > 0) {
        return explicitExpenseTotal;
    }
    return places.reduce((sum, item) => sum + (Number(item.budget) || 0), 0);
}

function getActiveDayOptimization(day) {
    if (!day) {
        return null;
    }
    const info = uiState.optimizedDays?.get?.(day.id) || null;
    if (!info) {
        return null;
    }
    const currentSignature = getOrderSignature(getDayOrderIds(day));
    const storedSignature = getOrderSignature(info.orderIds || []);
    if (!currentSignature || currentSignature !== storedSignature) {
        return null;
    }
    return info;
}

function buildLegsFromOrderIds(orderIds, coordsById, speedKmhUsed, namesById) {
    const legs = [];
    const safeSpeed = Number(speedKmhUsed) > 0 ? Number(speedKmhUsed) : OPTIMIZATION_SPEED_KMH;
    for (let i = 1; i < orderIds.length; i += 1) {
        const fromId = String(orderIds[i - 1]);
        const toId = String(orderIds[i]);
        const from = coordsById.get(fromId);
        const to = coordsById.get(toId);
        if (!from || !to) {
            continue;
        }
        const distanceKm = haversineMeters(from.lat, from.lon, to.lat, to.lon) / 1000;
        const timeMin = Math.max(1, Math.round((distanceKm / safeSpeed) * 60));
        legs.push({
            from_place_id: fromId,
            to_place_id: toId,
            from_name: namesById.get(fromId) || fromId,
            to_name: namesById.get(toId) || toId,
            distance_km: Number(distanceKm.toFixed(2)),
            time_min: timeMin
        });
    }
    return legs;
}

function normalizeBackendLegs(rawLegs) {
    if (!Array.isArray(rawLegs)) {
        return [];
    }
    return rawLegs.map((leg) => ({
        from_place_id: String(leg?.fromPlaceId ?? leg?.from_place_id ?? ''),
        to_place_id: String(leg?.toPlaceId ?? leg?.to_place_id ?? ''),
        from_name: String(leg?.fromName ?? leg?.from_name ?? leg?.fromPlaceId ?? ''),
        to_name: String(leg?.toName ?? leg?.to_name ?? leg?.toPlaceId ?? ''),
        distance_km: Number(leg?.distanceKm ?? leg?.distance_km ?? 0),
        time_min: Number(leg?.estimatedTravelTimeMin ?? leg?.time_min ?? 0),
        time_hours: Number(leg?.estimatedTravelTimeHours ?? leg?.estimated_travel_time_hours ?? 0)
    })).filter((leg) => leg.from_place_id && leg.to_place_id);
}

function buildOptimizationSummary({
    beforeKm,
    afterKm,
    beforeHours,
    afterHours,
    estimatedCost,
    backendUsed,
    fallbackUsed,
    constraintStatus
}) {
    const beforeDistance = Number(beforeKm) || 0;
    const afterDistance = Number(afterKm) || 0;
    const beforeTravelMin = Math.round((Number(beforeHours) || 0) * 60);
    const afterTravelMin = Math.round((Number(afterHours) || 0) * 60);
    const distanceSavedRaw = beforeDistance - afterDistance;
    const timeSavedRaw = beforeTravelMin - afterTravelMin;
    const distanceSaved = Math.abs(distanceSavedRaw) < 0.005 ? 0 : Number(distanceSavedRaw.toFixed(2));
    const timeSaved = Math.abs(timeSavedRaw) < 0.5 ? 0 : timeSavedRaw;
    const baseline = beforeDistance > 0 ? beforeDistance : Math.max(afterDistance, 1);
    const improvementRatio = baseline > 0 ? (beforeDistance - afterDistance) / baseline : 0;
    const satisfactionScore = Math.round(clamp(60 + (improvementRatio * 40) - (fallbackUsed ? 8 : 0), 0, 100));
    return {
        before_distance_km: Number(beforeDistance.toFixed(2)),
        after_distance_km: Number(afterDistance.toFixed(2)),
        distance_saved_km: Number(distanceSaved.toFixed(2)),
        before_travel_time_min: beforeTravelMin,
        after_travel_time_min: afterTravelMin,
        time_saved_min: timeSaved,
        estimated_cost: Math.round(Number(estimatedCost) || 0),
        satisfaction_score: satisfactionScore,
        constraint_status: constraintStatus,
        backend_used: Boolean(backendUsed),
        fallback_used: Boolean(fallbackUsed)
    };
}

function normalizeAppliedOptimizationSummary(summary) {
    const raw = summary && typeof summary === 'object' ? { ...summary } : {};
    const distanceSaved = Number(raw.distance_saved_km) || 0;
    const timeSaved = Number(raw.time_saved_min) || 0;
    return {
        ...raw,
        distance_saved_km: Math.abs(distanceSaved) < 0.05 ? 0 : Number(distanceSaved.toFixed(2)),
        time_saved_min: Math.abs(timeSaved) < 0.5 ? 0 : Math.round(timeSaved),
        estimated_cost: Math.round(Number(raw.estimated_cost) || 0),
        satisfaction_score: Math.round(Number(raw.satisfaction_score) || 0),
        backend_used: Boolean(raw.backend_used),
        fallback_used: Boolean(raw.fallback_used),
        fallback_reason: raw.fallback_reason ? String(raw.fallback_reason) : ''
    };
}

let arrangementDraggedSectionId = null;
let historyStack = [];
let redoStack = [];
let appMode = 'planner';
let allDaysCollapsed = false;

const trip = {
    title: 'Trip to Islamabad',
    dates: '4/4 - 9/4',
    notes: '',
    placesPool: [],
    customLists: [],
    expenses: [],
    days: [
        {
            id: 'day-1',
            label: 'Saturday, 4th April',
            shortLabel: 'Sat 4/4',
            items: [createCatalogPlace('centaurus-mall')]
        },
        {
            id: 'day-2',
            label: 'Sunday, 5th April',
            shortLabel: 'Sun 5/4',
            items: [createCatalogPlace('faisal-masjid')]
        },
        {
            id: 'day-3',
            label: 'Monday, 6th April',
            shortLabel: 'Mon 6/4',
            items: [createCatalogPlace('safa-gold-mall')]
        },
        {
            id: 'day-4',
            label: 'Tuesday, 7th April',
            shortLabel: 'Tue 7/4',
            items: [createCatalogPlace('f7-markaz')]
        },
        {
            id: 'day-5',
            label: 'Wednesday, 8th April',
            shortLabel: 'Wed 8/4',
            items: [createCatalogPlace('pakistan-monument')]
        },
        {
            id: 'day-6',
            label: 'Thursday, 9th April',
            shortLabel: 'Thu 9/4',
            items: []
        }
    ],
    budget: {
        currency: 'PKR',
        amount: 0
    },
    map: {
        selectedPlaceId: null
    }
};

function applyTripSnapshot(snapshot) {
    const next = JSON.parse(snapshot);
    Object.keys(trip).forEach((key) => {
        delete trip[key];
    });
    Object.assign(trip, next);
    if (typeof ensureEnginePreferences === 'function') {
        ensureEnginePreferences(trip);
    }
}

function getSavedTrips() {
    return JSON.parse(localStorage.getItem('trips') || '[]');
}

function setSavedTrips(trips) {
    localStorage.setItem('trips', JSON.stringify(trips));
}

function saveCurrentTrip() {
    const trips = getSavedTrips();
    const newTrip = {
        id: Date.now(),
        name: trip.name || trip.title || 'My Trip',
        startDate: trip.startDate,
        endDate: trip.endDate,
        data: cloneData(trip)
    };
    trips.push(newTrip);
    setSavedTrips(trips);
    persistActiveWorkspace();
    showToast('Trip saved to home');
}

function loadTrip(tripId) {
    const trips = getSavedTrips();
    const found = trips.find((t) => t.id === tripId);
    if (!found) return false;
    applyTripSnapshot(JSON.stringify(found.data));
    historyStack = [];
    redoStack = [];
    appMode = 'planner';
    renderPlanner();
    return true;
}

function applyNewTripBootstrap(payload) {
    if (!payload || !Array.isArray(payload.days) || !payload.days.length) {
        return false;
    }
    saveState();
    trip.name = payload.name || 'My Trip';
    trip.title = payload.title || (trip.name ? `Trip to ${trip.name}` : 'My Trip');
    trip.dates = payload.dates || formatTripDateRange(payload.startDate, payload.endDate);
    trip.startDate = payload.startDate;
    trip.endDate = payload.endDate;
    trip.days = payload.days;
    trip.placesPool = payload.placesPool || [];
    trip.customLists = payload.customLists || [];
    trip.expenses = payload.expenses || [];
    trip.notes = payload.notes || '';
    trip.budget = payload.budget || { currency: 'PKR', amount: 0 };
    trip.map = payload.map || { selectedPlaceId: null };
    trip.enginePreferences = payload.enginePreferences || trip.enginePreferences;
    if (typeof ensureEnginePreferences === 'function') {
        ensureEnginePreferences(trip);
    }
    historyStack = [];
    redoStack = [];
    appMode = 'planner';
    renderPlanner();
    return true;
}

function formatTripDateRange(startDate, endDate) {
    if (!startDate && !endDate) return trip.dates || '';
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    return startDate || endDate || '';
}

function applySessionBootstrap() {
    if (typeof getSavedTrips !== 'function') {
        return false;
    }
    const loadRaw = sessionStorage.getItem('tripnest_load_trip_id');
    if (loadRaw) {
        sessionStorage.removeItem('tripnest_load_trip_id');
        const loaded = loadTrip(Number(loadRaw));
        if (loaded) {
            persistActiveWorkspace();
            return true;
        }
    }
    const newRaw = sessionStorage.getItem('tripnest_new_trip');
    if (newRaw) {
        sessionStorage.removeItem('tripnest_new_trip');
        try {
            const payload = JSON.parse(newRaw);
            if (applyNewTripBootstrap(payload)) {
                persistActiveWorkspace();
                return true;
            }
        } catch {
            // ignore invalid bootstrap payload
        }
    }
    return false;
}

function persistActiveWorkspace() {
    if (typeof saveActiveWorkspace === 'function') {
        saveActiveWorkspace(cloneData(trip));
    }
}

function restoreActiveWorkspace() {
    if (typeof readActiveWorkspace !== 'function') {
        return false;
    }
    const data = readActiveWorkspace();
    if (!data) {
        return false;
    }
    applyTripSnapshot(JSON.stringify(data));
    historyStack = [];
    redoStack = [];
    appMode = 'planner';
    renderPlanner();
    return true;
}

function initPlannerApp() {
    if (applySessionBootstrap()) {
        return;
    }
    if (restoreActiveWorkspace()) {
        return;
    }
    window.location.href = 'home.html';
}

function renderSavedTrips() {
    const trips = getSavedTrips();
    if (!trips.length) {
        return '';
    }
    return `
        <div class="SavedTrips">
            <h3>Your Trips</h3>
            ${trips.map((t) => `
                <div class="TripCard" data-trip-id="${t.id}">
                    <strong>${t.name}</strong><br/>
                    <small>${t.startDate || ''} - ${t.endDate || ''}</small>
                </div>
            `).join('')}
        </div>
    `;
}

function saveState() {
    const snapshot = JSON.stringify(trip);
    historyStack.push(snapshot);
    if (historyStack.length > 50) {
        historyStack.shift();
    }
    redoStack = [];
}

function undo() {
    if (historyStack.length === 0) {
        showToast('Nothing to undo');
        return;
    }
    const current = JSON.stringify(trip);
    redoStack.push(current);
    const prev = historyStack.pop();
    applyTripSnapshot(prev);
    renderPlanner();
}

function redo() {
    if (redoStack.length === 0) {
        showToast('Nothing to redo');
        return;
    }
    const current = JSON.stringify(trip);
    historyStack.push(current);
    if (historyStack.length > 50) {
        historyStack.shift();
    }
    const next = redoStack.pop();
    applyTripSnapshot(next);
    renderPlanner();
}

trip.map.selectedPlaceId = trip.days[0]?.items[0]?.id || null;

const plannerApp = document.getElementById('plannerApp');
const plannerMain = document.getElementById('plannerMain');
const plannerSidebar = document.getElementById('plannerSidebar');
const plannerMapPanel = document.getElementById('plannerMapPanel');
const plannerToast = document.getElementById('plannerToast');

function ensureDragStyles() {
    if (document.getElementById('plannerDragStyles')) {
        return;
    }
    const style = document.createElement('style');
    style.id = 'plannerDragStyles';
    style.textContent = `
        .PlannerPlaceCard { cursor: grab; }
        .PlannerPlaceCard:active { cursor: grabbing; }
        .PlannerDropSlot { display: block; min-height: 14px; }
        .PlannerDropSlot.drag-over { outline: 2px solid rgba(59, 130, 246, 0.35); outline-offset: -2px; }
        .PlannerConnectionRow { padding-left: 0; }
        .PlannerPlaceCard__row { display: flex; align-items: center; gap: 10px; }
        .PlannerSelectCheckbox { width: 18px; height: 18px; margin: 0; flex: 0 0 auto; align-self: center; }
        .PlannerPlaceCard__body { display: flex; align-items: stretch; justify-content: space-between; gap: 12px; flex: 1 1 auto; min-width: 0; }
        .PlannerPlaceCard__marker { position: static; left: auto; top: auto; width: 26px; height: 26px; flex: 0 0 auto; }
        .PlannerPlaceCard__content { min-width: 0; flex: 1 1 auto; }
        .PlannerPlaceCard__actions { flex: 0 0 auto; align-items: center; }
        .PlannerPlaceCard.is-selected { background: rgba(59, 130, 246, 0.06); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25); }
        .PlannerBulkBar { position: sticky; top: 0; z-index: 30; background: #111827; color: #fff; border-radius: 12px; padding: 10px 12px; margin: 12px; display: flex; align-items: center; gap: 10px; }
        .PlannerBulkBar__count { font-weight: 600; }
        .PlannerBulkBar__spacer { flex: 1 1 auto; }
        .PlannerBulkBar select { background: #1f2937; color: #fff; border: 1px solid rgba(255,255,255,0.18); border-radius: 10px; padding: 8px 10px; }
        .PlannerBulkBar__danger { background: #ef4444; border: 1px solid rgba(0,0,0,0.08); color: #fff; border-radius: 10px; padding: 8px 12px; }
        .PlannerBulkBar__clear { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.18); border-radius: 10px; padding: 6px 10px; font-size: 16px; line-height: 1; }
        .PlannerBulkBar__clear:hover { background: rgba(255,255,255,0.08); }
        .PlannerOptimizedChip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; font-weight: 600; font-size: 12px; background: rgba(34, 197, 94, 0.14); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.22); }
        .PlannerOptimizedChip__delta { color: rgba(17, 24, 39, 0.9); background: rgba(255, 255, 255, 0.85); padding: 2px 8px; border-radius: 999px; }
        .PlannerPlaceCard.is-optimized-highlight { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25); background: rgba(34, 197, 94, 0.06); }
        .OptimizationPreview { max-width: 720px; width: calc(100vw - 48px); }
        .OptimizationPreview__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .OptimizationPreview__source { font-size: 12px; color: rgba(55, 65, 81, 0.9); background: rgba(243, 244, 246, 0.9); border: 1px solid rgba(229, 231, 235, 1); padding: 6px 10px; border-radius: 999px; }
        .OptimizationPreview__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .OptimizationPreviewCard { border: 1px solid rgba(229, 231, 235, 1); border-radius: 14px; padding: 12px; background: rgba(249, 250, 251, 0.9); }
        .OptimizationPreviewCard h4 { margin: 0 0 8px 0; font-size: 13px; color: rgba(17, 24, 39, 0.9); }
        .OptimizationMetricRow { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .OptimizationMetricRow strong { font-size: 18px; color: rgba(17, 24, 39, 0.95); }
        .OptimizationMetricRow span { font-size: 12px; color: rgba(75, 85, 99, 0.95); }
        .OptimizationDelta { margin-top: 10px; font-weight: 700; font-size: 13px; }
        .OptimizationDelta.is-better { color: #16a34a; }
        .OptimizationDelta.is-worse { color: #dc2626; }
        .OptimizationMovedList { margin: 10px 0 0 0; padding: 0; list-style: none; max-height: 180px; overflow: auto; }
        .OptimizationMovedList li { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(229, 231, 235, 1); }
        .OptimizationMovedList li:last-child { border-bottom: none; }
        .OptimizationMovedItemName { font-weight: 600; color: rgba(17, 24, 39, 0.95); }
        .OptimizationMovedItemShift { font-size: 12px; color: rgba(55, 65, 81, 0.95); background: rgba(229, 231, 235, 0.9); padding: 2px 8px; border-radius: 999px; }
        .OptimizationReason { margin-top: 12px; font-size: 13px; color: rgba(55, 65, 81, 0.95); line-height: 1.35; }
        .OptimizationOrders { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
        .OptimizationOrderList { margin: 0; padding-left: 18px; font-size: 13px; color: rgba(17, 24, 39, 0.92); }
        .OptimizationOrderList li { margin: 6px 0; }
        .OptimizationFlags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .OptimizationFlag { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 999px; border: 1px solid rgba(229,231,235,1); background: rgba(255,255,255,0.9); color: rgba(17,24,39,0.9); }
        .OptimizationFlag.is-yes { border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.10); color: rgba(22,163,74,1); }
        .OptimizationFlag.is-no { border-color: rgba(239,68,68,0.30); background: rgba(239,68,68,0.08); color: rgba(185,28,28,1); }
        .OptimizationInlineSummary { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 14px; }
        .PlannerConnectionRow.is-optimized { color: #16a34a; }
        .OptimizationDebug details { margin-top: 12px; }
        .OptimizationDebug summary { cursor: pointer; font-weight: 700; font-size: 13px; color: rgba(17,24,39,0.9); }
        .OptimizationDebug pre { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(17,24,39,0.92); color: rgba(255,255,255,0.95); font-size: 12px; overflow: auto; max-height: 220px; }
        .OptimizationShiftBadge { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(34,197,94,0.12); color: rgba(22,163,74,1); border: 1px solid rgba(34,197,94,0.22); }
        .PlannerExploreActions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .PlannerTripCard__prefs { margin-top: 8px; font-size: 13px; }
        .TripPrefsModal { max-width: 640px; width: calc(100vw - 32px); }
        .TripPrefsIntro, .TripPrefsHint { font-size: 13px; color: rgba(55,65,81,0.95); line-height: 1.4; margin: 0 0 12px; }
        .TripPrefsSubhead { margin: 16px 0 8px; font-size: 15px; }
        .TripPrefGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .TripPrefField { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
        .TripPrefField--full { grid-column: 1 / -1; }
        .TripPrefField input, .TripPrefField select { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(209,213,219,1); }
        .TripPrefToggles { display: grid; gap: 10px; margin-bottom: 12px; }
        .TripPrefToggle { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
        .EngineStopList { max-height: 280px; overflow: auto; border: 1px solid rgba(229,231,235,1); border-radius: 12px; padding: 8px; margin: 12px 0; }
        .EngineStopRow { display: flex; gap: 10px; padding: 10px 8px; border-bottom: 1px solid rgba(243,244,246,1); cursor: pointer; }
        .EngineStopRow__content { flex: 1; min-width: 0; }
        .EngineStopRow__meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
        .EngineIntelligence { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
        .EngineIntelligence span { font-size: 11px; font-weight: 600; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 4px; display: inline-block; width: fit-content; }
        .EngineStopRow:last-child { border-bottom: none; }
        .EngineMetaGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
        .EngineMetaGrid div { background: rgba(249,250,251,1); border-radius: 10px; padding: 8px; font-size: 12px; }
        .EngineMetaGrid span { display: block; color: rgba(107,114,128,1); }
        .EngineErrorBanner { background: rgba(254,226,226,1); color: #b91c1c; padding: 10px 12px; border-radius: 10px; margin-bottom: 10px; font-size: 13px; }
    `;
    document.head.appendChild(style);
}

function clonePlace(placeId, title) {
    if (placeId && placeCatalog[placeId]) {
        return createCatalogPlace(placeId);
    }
    return createCustomPlace(title);
}

function getPlaceById(placeId) {
    return findPlaceLocationById(placeId)?.place || null;
}

function getNoteById(noteId) {
    const item = findPlaceLocationById(noteId)?.place || null;
    return item && isNoteItem(item) ? item : null;
}

function getChecklistById(checklistId) {
    const item = findPlaceLocationById(checklistId)?.place || null;
    return item && isChecklistItem(item) ? item : null;
}

function commitNoteContent(noteId, content) {
    const note = getNoteById(noteId);
    if (!note) {
        return;
    }
    const next = String(content ?? '');
    if (note.content === next) {
        return;
    }
    saveState();
    note.content = next;
}

function commitChecklistTitle(checklistId, title) {
    const checklist = getChecklistById(checklistId);
    if (!checklist) {
        return;
    }
    const next = String(title ?? '');
    if (checklist.title === next) {
        return;
    }
    saveState();
    checklist.title = next;
}

function addChecklistRow(checklistId, afterRowId = null) {
    const checklist = getChecklistById(checklistId);
    if (!checklist) {
        return null;
    }
    const nextRow = createChecklistRow();
    if (!Array.isArray(checklist.items)) {
        checklist.items = [];
    }
    const index = afterRowId
        ? checklist.items.findIndex((row) => row.id === afterRowId)
        : -1;
    saveState();
    if (index === -1) {
        checklist.items.push(nextRow);
    } else {
        checklist.items.splice(index + 1, 0, nextRow);
    }
    return nextRow;
}

function removeChecklistRow(checklistId, rowId) {
    const checklist = getChecklistById(checklistId);
    if (!checklist || !Array.isArray(checklist.items)) {
        return false;
    }
    const index = checklist.items.findIndex((row) => row.id === rowId);
    if (index === -1) {
        return false;
    }
    saveState();
    checklist.items.splice(index, 1);
    return true;
}

function toggleChecklistRow(checklistId, rowId, checked) {
    const checklist = getChecklistById(checklistId);
    if (!checklist || !Array.isArray(checklist.items)) {
        return;
    }
    const row = checklist.items.find((entry) => entry.id === rowId);
    if (!row) {
        return;
    }
    const next = Boolean(checked);
    if (row.checked === next) {
        return;
    }
    saveState();
    row.checked = next;
}

function setChecklistRowText(checklistId, rowId, text) {
    const checklist = getChecklistById(checklistId);
    if (!checklist || !Array.isArray(checklist.items)) {
        return;
    }
    const row = checklist.items.find((entry) => entry.id === rowId);
    if (!row) {
        return;
    }
    row.text = String(text ?? '');
}

function commitChecklistRowText(checklistId, rowId, text) {
    const checklist = getChecklistById(checklistId);
    if (!checklist || !Array.isArray(checklist.items)) {
        return;
    }
    const row = checklist.items.find((entry) => entry.id === rowId);
    if (!row) {
        return;
    }
    const next = String(text ?? '');
    if (row.text === next) {
        return;
    }
    saveState();
    row.text = next;
}

function getHalfHourTimeOptions() {
    const options = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
        const hour24 = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const suffix = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const label = `${hour12}:${minute === 0 ? '00' : '30'} ${suffix}`;
        options.push(label);
    }
    return options;
}

function renderTimeOptions(selectedValue) {
    const options = getHalfHourTimeOptions();
    return `
        <option value="">Select…</option>
        ${options.map((label) => `<option value="${label}"${selectedValue === label ? ' selected' : ''}>${label}</option>`).join('')}
    `;
}

function formatTime12h(time) {
    if (!time) return '';
    const parts = String(time).split(':');
    if (parts.length < 2) return '';
    const hour = parts[0];
    const minute = parts[1];
    let h = parseInt(hour, 10);
    if (!Number.isFinite(h)) return '';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${minute} ${ampm}`;
}

function formatDurationMinutes(totalMinutes) {
    const minutesValue = Math.max(0, Math.round(Number(totalMinutes) || 0));
    if (minutesValue < 60) {
        return `${minutesValue} min`;
    }
    const hours = Math.floor(minutesValue / 60);
    const minutes = minutesValue % 60;
    if (minutes === 0) {
        return `${hours} hr`;
    }
    return `${hours} hr ${minutes} min`;
}

function formatDayLabel(dateStr) {
    const date = new Date(dateStr);
    if (!Number.isFinite(date.getTime())) {
        return '';
    }
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    let formatted = date.toLocaleDateString('en-US', options);
    const day = date.getDate();
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';
    return formatted.replace(day, `${day}${suffix}`);
}

function formatExpenseDateLabel(dateStr) {
    const date = new Date(dateStr);
    if (!Number.isFinite(date.getTime())) {
        return '';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function toIsoDateKey(dateStr) {
    const date = new Date(dateStr);
    if (!Number.isFinite(date.getTime())) {
        return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function monthIsoFromDateStr(dateStr) {
    const iso = toIsoDateKey(dateStr);
    if (!iso) {
        return '';
    }
    return `${iso.slice(0, 7)}-01`;
}

function shiftMonthIso(monthIso, deltaMonths) {
    const match = String(monthIso || '').match(/^(\d{4})-(\d{2})-01$/);
    if (!match) {
        return '';
    }
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const date = new Date(year, monthIndex + deltaMonths, 1);
    if (!Number.isFinite(date.getTime())) {
        return '';
    }
    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
    return `${nextYear}-${nextMonth}-01`;
}

function formatMonthTitle(monthIso) {
    const match = String(monthIso || '').match(/^(\d{4})-(\d{2})-01$/);
    if (!match) {
        return '';
    }
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const date = new Date(year, monthIndex, 1);
    if (!Number.isFinite(date.getTime())) {
        return '';
    }
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function buildExpenseCalendarMarkup(monthIso, selectedIso, allowedDays) {
    const match = String(monthIso || '').match(/^(\d{4})-(\d{2})-01$/);
    if (!match) {
        return '';
    }
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const monthStart = new Date(year, monthIndex, 1);
    if (!Number.isFinite(monthStart.getTime())) {
        return '';
    }
    const allowedMap = new Map((allowedDays || []).map((entry) => [entry.iso, entry.tripDate]));
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
        cells.push('<div class="ExpenseCalBlank"></div>');
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const tripDate = allowedMap.get(iso) || '';
        const isAllowed = Boolean(tripDate);
        const isSelected = iso === selectedIso;
        cells.push(`
            <button type="button" class="ExpenseCalDay${isSelected ? ' is-selected' : ''}" data-expense-cal-day="true"${isAllowed ? ` data-trip-date="${escapeHtmlAttr(tripDate)}" data-iso="${iso}"` : ''}${isAllowed ? '' : ' disabled'}>
                ${day}
            </button>
        `);
    }
    return `
        <div class="ExpenseCalHeader">
            <button type="button" class="ExpenseCalNav" data-expense-cal-prev="true" aria-label="Previous month">‹</button>
            <div class="ExpenseCalTitle">${escapeHtmlText(formatMonthTitle(monthIso))}</div>
            <button type="button" class="ExpenseCalNav" data-expense-cal-next="true" aria-label="Next month">›</button>
        </div>
        <div class="ExpenseCalWeekdays">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label) => `<div class="ExpenseCalWeekday">${label}</div>`).join('')}
        </div>
        <div class="ExpenseCalGrid">
            ${cells.join('')}
        </div>
    `;
}

function buildVisitCalendarMarkup(monthIso, selectedIso, allowedDays) {
    const match = String(monthIso || '').match(/^(\d{4})-(\d{2})-01$/);
    if (!match) {
        return '';
    }
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    const monthStart = new Date(year, monthIndex, 1);
    if (!Number.isFinite(monthStart.getTime())) {
        return '';
    }
    const allowedMap = new Map((allowedDays || []).map((entry) => [entry.iso, entry.tripDate]));
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
        cells.push('<div class="ExpenseCalBlank"></div>');
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const tripDate = allowedMap.get(iso) || '';
        const isAllowed = Boolean(tripDate);
        const isSelected = iso === selectedIso;
        cells.push(`
            <button type="button" class="ExpenseCalDay${isSelected ? ' is-selected' : ''}" data-visit-cal-day="true"${isAllowed ? ` data-trip-date="${escapeHtmlAttr(tripDate)}" data-iso="${iso}"` : ''}${isAllowed ? '' : ' disabled'}>
                ${day}
            </button>
        `);
    }
    return `
        <div class="ExpenseCalHeader">
            <button type="button" class="ExpenseCalNav" data-visit-cal-prev="true" aria-label="Previous month">‹</button>
            <div class="ExpenseCalTitle">${escapeHtmlText(formatMonthTitle(monthIso))}</div>
            <button type="button" class="ExpenseCalNav" data-visit-cal-next="true" aria-label="Next month">›</button>
        </div>
        <div class="ExpenseCalWeekdays">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label) => `<div class="ExpenseCalWeekday">${label}</div>`).join('')}
        </div>
        <div class="ExpenseCalGrid">
            ${cells.join('')}
        </div>
    `;
}

function buildVisitTimeOptions(selectedLabel) {
    const safeSelected = String(selectedLabel || '');
    const options = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
        const hour24 = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const hour12 = (hour24 % 12) || 12;
        const suffix = hour24 < 12 ? 'AM' : 'PM';
        const label = `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
        options.push(`
            <button type="button" class="VisitTimeOption${label === safeSelected ? ' is-selected' : ''}" data-visit-time-option="${escapeHtmlAttr(label)}">
                ${escapeHtmlText(label)}
            </button>
        `);
    }
    return options.join('');
}

function ensureVisitDetails(place) {
    if (!place) {
        return null;
    }
    if (place.visitDetails && typeof place.visitDetails === 'object') {
        if (!Array.isArray(place.visitDetails.media)) {
            place.visitDetails.media = [];
        }
        if (typeof place.visitDetails.visited !== 'boolean') {
            place.visitDetails.visited = true;
        }
        if (typeof place.visitDetails.notes !== 'string') {
            place.visitDetails.notes = '';
        }
        if (place.visitDetails.visitedDate === undefined) {
            place.visitDetails.visitedDate = null;
        }
        if (place.visitDetails.visitedTime === undefined) {
            place.visitDetails.visitedTime = null;
        }
        return place.visitDetails;
    }
    place.visitDetails = {
        visited: true,
        notes: '',
        media: [],
        visitedDate: null,
        visitedTime: null
    };
    return place.visitDetails;
}

function captureVisitModalDraft(placeId) {
    if (!placeId) {
        return null;
    }
    const place = getPlaceById(placeId);
    if (!place) {
        return null;
    }
    const details = ensureVisitDetails(place);
    if (!details) {
        return null;
    }
    const notesRaw = plannerMain.querySelector(`[data-visit-textarea="${placeId}"]`)?.value || '';
    const visitedDateRaw = plannerMain.querySelector('[data-visit-date="true"]')?.value || '';
    const visitedTimeRaw = plannerMain.querySelector('[data-visit-time="true"]')?.value || '';
    details.visited = true;
    details.notes = String(notesRaw).trim();
    details.visitedDate = String(visitedDateRaw).trim() || null;
    details.visitedTime = String(visitedTimeRaw).trim() || null;
    return details;
}

function getExpenseById(expenseId) {
    return (trip.expenses || []).find((expense) => expense.id === expenseId) || null;
}

function getExpenseDefaultDate(placeId) {
    ensureItineraryDates();
    if (placeId) {
        const location = findPlaceLocationById(placeId);
        if (location?.type === 'day') {
            const day = trip.days.find((entry) => entry.id === location.id);
            if (day?.date) {
                return day.date;
            }
        }
    }
    const firstDayDate = trip.days[0]?.date;
    return firstDayDate || '';
}

function openExpenseModal({ placeId = null, expenseId = null } = {}) {
    uiState.expenseModal.isOpen = true;
    uiState.expenseModal.editingExpenseId = expenseId;
    uiState.expenseModal.placeId = placeId;
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function closeExpenseModal() {
    uiState.expenseModal.isOpen = false;
    uiState.expenseModal.editingExpenseId = null;
    uiState.expenseModal.placeId = null;
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function parseExpenseAmount(value) {
    const raw = String(value || '').trim();
    const cleaned = raw.replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
}

function saveExpenseFromModal() {
    const modal = plannerMain.querySelector('[data-expense-modal]');
    if (!modal) {
        return;
    }
    const editingId = uiState.expenseModal.editingExpenseId;
    const placeId = uiState.expenseModal.placeId;
    const amount = parseExpenseAmount(modal.querySelector('[data-expense-amount]')?.value);
    const category = String(modal.querySelector('[data-expense-category]')?.value || 'Other');
    const description = String(modal.querySelector('[data-expense-description]')?.value || '').trim();
    const paidBy = String(modal.querySelector('[data-expense-paidby]')?.value || 'You');
    const splitType = String(modal.querySelector('[data-expense-split]')?.value || 'dont_split');
    const date = String(modal.querySelector('[data-expense-date]')?.value || '').trim();
    if (!Number.isFinite(amount) || amount <= 0) {
        return;
    }
    const payload = {
        id: editingId || makeInstanceId('expense'),
        placeId: placeId || null,
        description: description || (placeId ? (getPlaceById(placeId)?.title || 'Expense') : 'Expense'),
        amount,
        category,
        date: placeId ? (date || getExpenseDefaultDate(placeId)) : (date || ''),
        paidBy,
        splitType
    };
    saveState();
    if (editingId) {
        setExpenses((prev) => prev.map((expense) => expense.id === editingId ? payload : expense));
    } else {
        setExpenses((prev) => [...prev, payload]);
    }
    closeExpenseModal();
}

function deleteExpenseById(expenseId) {
    if (!expenseId) {
        return;
    }
    saveState();
    setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function deleteExpenseFromModal() {
    const editingId = uiState.expenseModal.editingExpenseId;
    if (!editingId) {
        closeExpenseModal();
        return;
    }
    deleteExpenseById(editingId);
    closeExpenseModal();
}

function renderExpenseModal() {
    if (!uiState.expenseModal.isOpen) {
        return '';
    }
    ensureItineraryDates();
    const editingId = uiState.expenseModal.editingExpenseId;
    const editing = editingId ? getExpenseById(editingId) : null;
    const placeId = editing?.placeId || uiState.expenseModal.placeId || null;
    const place = placeId ? getPlaceById(placeId) : null;
    const amountValue = editing ? String(editing.amount ?? '') : '';
    const categoryValue = editing?.category || 'Activities';
    const descriptionValue = editing?.description || (place?.title || '');
    const paidByValue = editing?.paidBy || 'You';
    const splitValue = editing?.splitType || 'dont_split';
    const dayDateSet = new Set(trip.days.map((day) => day.date).filter(Boolean));
    const isBudgetNewExpense = !editingId && !placeId;
    const dateValue = editing?.date && dayDateSet.has(editing.date)
        ? editing.date
        : (isBudgetNewExpense ? '' : getExpenseDefaultDate(placeId));
    const title = editing ? 'Edit expense' : 'Add expense';
    const categories = [
        { value: 'Sightseeing', label: '🏛 Sightseeing' },
        { value: 'Food', label: '🍽 Food' },
        { value: 'Activities', label: '🎟 Activities' },
        { value: 'Transport', label: '🚕 Travel' },
        { value: 'Lodging', label: '🏨 Lodging' },
        { value: 'Shopping', label: '🛍 Shopping' },
        { value: 'Other', label: '➕ Other' }
    ];
    const allowedDays = trip.days
        .filter((day) => Boolean(day.date))
        .map((day) => ({ iso: toIsoDateKey(day.date), tripDate: day.date }));
    const selectedIso = toIsoDateKey(dateValue);
    const initialMonthIso = monthIsoFromDateStr(dateValue) || (allowedDays[0]?.tripDate ? monthIsoFromDateStr(allowedDays[0].tripDate) : '');
    return `
        <div class="PlannerModalOverlay" data-expense-overlay="true">
            <div class="PlannerModal ExpenseModal" role="dialog" aria-modal="true" aria-label="${title}" data-expense-modal="true">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">${title}</div>
                    <button type="button" class="PlannerModalClose" data-expense-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    <div class="ExpenseModalSection ExpenseModalSection--amount">
                        <div class="ExpenseAmountRow">
                            <div class="ExpenseAmountCurrency">${escapeHtmlText(trip.budget.currency)}</div>
                            <input type="text" class="ExpenseAmountInput" data-expense-amount="true" value="${escapeHtmlAttr(amountValue)}" placeholder="0">
                        </div>
                    </div>

                    <div class="ExpenseModalSection">
                        <div class="ExpenseFieldLabel">Category</div>
                        <select class="ExpenseSelect" data-expense-category="true">
                            ${categories.map((entry) => `<option value="${entry.value}"${entry.value === categoryValue ? ' selected' : ''}>${escapeHtmlText(entry.label)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="ExpenseModalSection">
                        <div class="ExpenseFieldLabel">Description</div>
                        <textarea class="ExpenseTextarea" rows="2" data-expense-description="true" placeholder="Add description (optional)">${escapeHtmlText(descriptionValue)}</textarea>
                    </div>

                    <div class="ExpenseModalSection">
                        <div class="ExpenseFieldLabel">Details</div>
                        <div class="ExpenseMetaRow">
                            <div class="ExpenseMetaField">
                                <div class="ExpenseMetaLabel">Paid by</div>
                                <input type="text" class="ExpenseInput" data-expense-paidby="true" value="${escapeHtmlAttr(paidByValue)}" placeholder="You">
                            </div>
                            <div class="ExpenseMetaField">
                                <div class="ExpenseMetaLabel">Split</div>
                                <select class="ExpenseSelect" data-expense-split="true">
                                    <option value="individuals"${splitValue === 'individuals' ? ' selected' : ''}>Individuals</option>
                                    <option value="everyone"${splitValue === 'everyone' ? ' selected' : ''}>Everyone</option>
                                    <option value="dont_split"${splitValue === 'dont_split' ? ' selected' : ''}>Don't split</option>
                                </select>
                            </div>
                            <div class="ExpenseMetaField">
                                <div class="ExpenseMetaLabel">Date</div>
                                <div class="ExpenseDateField" data-expense-date-field="true">
                                    <input type="hidden" data-expense-date="true" value="${escapeHtmlAttr(dateValue)}">
                                    <button type="button" class="ExpenseDateTrigger" data-expense-date-trigger="true" aria-haspopup="dialog" aria-expanded="false">
                                        <span class="ExpenseDateValue">${escapeHtmlText(formatExpenseDateLabel(dateValue) || 'Select date')}</span>
                                        <span class="ExpenseDateCaret">▾</span>
                                    </button>
                                    <div class="ExpenseDatePicker" data-expense-date-picker="true" data-month-iso="${escapeHtmlAttr(initialMonthIso)}" data-selected-iso="${escapeHtmlAttr(selectedIso)}" data-allowed="${escapeHtmlAttr(JSON.stringify(allowedDays))}">
                                        ${buildExpenseCalendarMarkup(initialMonthIso, selectedIso, allowedDays)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="PlannerModalFooter">
                    <div class="ExpenseModalActions">
                        <button type="button" class="PlannerTextButton" data-expense-delete-modal="true"${editing ? '' : ' disabled'}>Delete</button>
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-expense-save="true">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function openBudgetModal() {
    uiState.budgetModal.isOpen = true;
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function closeBudgetModal() {
    uiState.budgetModal.isOpen = false;
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function saveBudgetFromModal() {
    const modal = plannerMain.querySelector('[data-budget-modal]');
    if (!modal) {
        return;
    }
    const inputValue = modal.querySelector('[data-budget-input]')?.value || '';
    const parsed = parseFloat(String(inputValue).replace(/[^\d.]/g, '')) || 0;
    saveState();
    setBudgetValue(parsed);
    closeBudgetModal();
}

function renderBudgetModal() {
    if (!uiState.budgetModal.isOpen) {
        return '';
    }
    const value = getBudgetValue();
    const label = value > 0 ? 'Edit budget' : 'Set budget';
    return `
        <div class="PlannerModalOverlay" data-budget-overlay="true">
            <div class="PlannerModal" role="dialog" aria-modal="true" aria-label="${label}" data-budget-modal="true">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">${label}</div>
                    <button type="button" class="PlannerModalClose" data-budget-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    <div class="PlannerModalField">
                        <input type="text" data-budget-input="true" value="${escapeHtmlAttr(value ? String(value) : '')}" placeholder="${escapeHtmlAttr(trip.budget?.currency || 'PKR')} 0">
                    </div>
                </div>
                <div class="PlannerModalFooter">
                    <div class="ExpenseModalActions">
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-budget-save="true">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderVisitModal() {
    const placeId = uiState.activeNotePlaceId;
    if (!placeId) {
        return '';
    }
    const place = getPlaceById(placeId);
    if (!place) {
        return '';
    }
    const timeLabel = place.startTime || place.endTime
        ? `${formatTime12h(place.startTime)}${place.startTime && place.endTime ? ' - ' : ''}${formatTime12h(place.endTime)}`
        : '';
    const image = place.image || 'assets/images/trip-pakistan.jpg';
    const details = place.visitDetails && typeof place.visitDetails === 'object' ? place.visitDetails : null;
    const notesValue = String(details?.notes ?? place.visitNote ?? '');
    const visitedDateValue = String(details?.visitedDate || '').trim();
    const visitedTimeValue = String(details?.visitedTime || '').trim();
    const media = Array.isArray(details?.media) ? details.media : [];
    const allowedDays = trip.days
        .filter((day) => Boolean(day.date))
        .map((day) => ({ iso: toIsoDateKey(day.date), tripDate: day.date }));
    const selectedIso = toIsoDateKey(visitedDateValue);
    const initialMonthIso = monthIsoFromDateStr(visitedDateValue) || (allowedDays[0]?.tripDate ? monthIsoFromDateStr(allowedDays[0].tripDate) : '');
    return `
        <div class="PlannerModalOverlay" data-visit-overlay="true">
            <div class="PlannerModal VisitModal" role="dialog" aria-modal="true" aria-label="Add more about your visit" data-visit-modal="true">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Add more about your visit</div>
                    <button type="button" class="PlannerModalClose" data-visit-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    <div class="VisitModalHeader">
                        <div class="VisitModalHeader__text">
                            <div class="VisitModalHeader__title">${place.title}</div>
                            ${timeLabel ? `<div class="VisitModalHeader__time">${timeLabel}</div>` : ''}
                            <div class="VisitModalHeader__stamps">
                                <div class="ExpenseDateField VisitStampField" data-visit-date-field="true">
                                    <button type="button" class="ExpenseDateTrigger" data-visit-date-trigger="true" aria-expanded="false">
                                        <span class="ExpenseDateValue">${escapeHtmlText(formatExpenseDateLabel(visitedDateValue) || 'Select date')}</span>
                                        <span class="ExpenseDateCaret">▼</span>
                                    </button>
                                    <input type="hidden" data-visit-date="true" value="${escapeHtmlAttr(visitedDateValue)}">
                                    <div class="ExpenseDatePicker VisitDatePicker" data-visit-date-picker="true" data-month-iso="${escapeHtmlAttr(initialMonthIso)}" data-selected-iso="${escapeHtmlAttr(selectedIso)}" data-allowed="${escapeHtmlAttr(JSON.stringify(allowedDays))}">
                                        ${initialMonthIso ? buildVisitCalendarMarkup(initialMonthIso, selectedIso, allowedDays) : ''}
                                    </div>
                                </div>
                                <div class="VisitTimeField" data-visit-time-field="true">
                                    <button type="button" class="ExpenseDateTrigger" data-visit-time-trigger="true" aria-expanded="false">
                                        <span class="VisitTimeValue">${escapeHtmlText(visitedTimeValue || 'Select time')}</span>
                                        <span class="ExpenseDateCaret">▼</span>
                                    </button>
                                    <input type="hidden" data-visit-time="true" value="${escapeHtmlAttr(visitedTimeValue)}">
                                    <div class="VisitTimePicker" data-visit-time-picker="true">
                                        <div class="VisitTimeList">
                                            ${buildVisitTimeOptions(visitedTimeValue)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <img class="VisitModalHeader__image" src="${image}" alt="${place.title}">
                    </div>
                    <div class="VisitModalMedia" data-visit-media-trigger="true">
                        <input type="file" multiple accept="image/*" data-visit-media-input="true" hidden>
                        <div class="VisitMediaGrid">
                            <button type="button" class="VisitMediaAddTile" data-visit-media-add="true" aria-label="Add photos">
                                <div class="VisitModalMedia__icon">+</div>
                            </button>
                            ${media.map((src, index) => `
                                <div class="VisitMediaThumb">
                                    <img src="${src}" alt="Visit media ${index + 1}">
                                    <button type="button" class="VisitMediaRemove" data-visit-media-remove="${index}" aria-label="Remove photo">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="VisitModalMedia__label">${media.length ? 'Add more photos' : 'Pick media from your gallery'}</div>
                    </div>
                    <div class="VisitModalNotes">
                        <div class="VisitModalNotes__label">Notes</div>
                        <textarea class="VisitModalNotes__input" data-visit-textarea="${placeId}" placeholder="Write a note...">${escapeHtmlText(notesValue)}</textarea>
                    </div>
                    <div class="VisitModalFooter">
                        <button type="button" class="PlannerModalDone VisitModalSave" data-visit-save="${placeId}">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderChooseLocationModal() {
    const placeId = uiState.chooseLocationPlaceId;
    if (!placeId) {
        return '';
    }
    const place = getPlaceById(placeId);
    const image = place?.image || 'assets/images/trip-pakistan.jpg';
    return `
        <div class="PlannerModalOverlay" data-choose-location-overlay="true">
            <div class="PlannerModal ChooseLocationModal" role="dialog" aria-modal="true" aria-label="Choose a location">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Choose a location</div>
                    <button type="button" class="PlannerModalClose" data-choose-location-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    <input class="ChooseLocationInput" data-choose-location-input="true" type="text" placeholder="Where have you been?" value="${place?.visitLocation || ''}">
                    <img class="ChooseLocationMap" src="${image}" alt="Map placeholder">
                    <div class="ChooseLocationFooter">
                        <button type="button" class="PlannerModalDone ChooseLocationSelect" data-choose-location-select="true">Select this location</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function collectTripJournalEntries() {
    const entries = [];
    const add = (place, context) => {
        if (!place?.title) return;
        const details = place.visitDetails && typeof place.visitDetails === 'object' ? place.visitDetails : null;
        const note = String(details?.notes ?? place.visitNote ?? '').trim();
        const location = String(place.visitLocation || '').trim();
        entries.push({
            id: place.id,
            title: place.title,
            context,
            note: note || 'No note saved',
            location: location || 'No location selected',
            visited: Boolean(place.visited),
            image: place.image || 'assets/images/trip-pakistan.jpg'
        });
    };
    (trip.placesPool || []).filter((item) => !isNoteItem(item) && !isChecklistItem(item)).forEach((place) => {
        add(place, 'Places to visit');
    });
    trip.days.forEach((day) => {
        const label = formatDayLabel(day.date) || day.label;
        getDayPlaceItems(day).forEach((place) => add(place, label));
    });
    return entries;
}

function renderTripSettingsModal() {
    if (!uiState.tripSettingsOpen) {
        return '';
    }
    const titleValue = escapeHtmlText(trip.title || '');
    const nameValue = escapeHtmlText(trip.name || '');
    const startValue = escapeHtmlText(trip.startDate || '');
    const endValue = escapeHtmlText(trip.endDate || '');
    const notesValue = escapeHtmlText(trip.notes || '');
    return `
        <div class="PlannerModalOverlay" data-trip-settings-overlay="true">
            <div class="PlannerModal" role="dialog" aria-modal="true" aria-label="Trip settings">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Trip settings</div>
                    <button type="button" class="PlannerModalClose" data-trip-settings-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody TripSettingsBody">
                    <label class="TripSettingsField">
                        <span>Trip title</span>
                        <input type="text" id="trip-settings-title" value="${titleValue}" placeholder="Trip to Islamabad">
                    </label>
                    <label class="TripSettingsField">
                        <span>Destination</span>
                        <input type="text" id="trip-settings-name" value="${nameValue}" placeholder="Where to?">
                    </label>
                    <div class="TripSettingsRow">
                        <label class="TripSettingsField">
                            <span>Start date</span>
                            <input type="date" id="trip-settings-start" value="${startValue}">
                        </label>
                        <label class="TripSettingsField">
                            <span>End date</span>
                            <input type="date" id="trip-settings-end" value="${endValue}">
                        </label>
                    </div>
                    <label class="TripSettingsField">
                        <span>Trip notes</span>
                        <textarea id="trip-settings-notes" rows="4" placeholder="Notes for this trip">${notesValue}</textarea>
                    </label>
                    <div class="VisitModalFooter">
                        <button type="button" class="PlannerModalDone" data-trip-settings-save="true">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTripJournalOverviewModal() {
    if (!uiState.tripJournalOverviewOpen) {
        return '';
    }
    const entries = collectTripJournalEntries();
    const body = entries.length
        ? entries.map((entry) => `
            <article class="TripJournalRow">
                <img src="${entry.image}" alt="">
                <div>
                    <div class="TripJournalRow__title">${escapeHtmlText(entry.title)}</div>
                    <div class="TripJournalRow__meta">${escapeHtmlText(entry.context)}${entry.visited ? ' · Visited' : ''}</div>
                    <div class="TripJournalRow__label">Location</div>
                    <div>${escapeHtmlText(entry.location)}</div>
                    <div class="TripJournalRow__label">Notes</div>
                    <div>${escapeHtmlText(entry.note)}</div>
                    <button type="button" class="PlannerTextButton" data-open-journal-from-overview="${entry.id}">Open place journal</button>
                </div>
            </article>
        `).join('')
        : '<p class="PlannerEmptyState">No journal entries yet. Mark places as visited and add notes from the itinerary.</p>';

    return `
        <div class="PlannerModalOverlay" data-trip-journal-overlay="true">
            <div class="PlannerModal TripJournalModal" role="dialog" aria-modal="true" aria-label="Trip journal">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Trip journal</div>
                    <button type="button" class="PlannerModalClose" data-trip-journal-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody TripJournalBody">${body}</div>
            </div>
        </div>
    `;
}

function openTripSettings() {
    uiState.tripSettingsOpen = true;
    uiState.tripJournalOverviewOpen = false;
    renderPlanner();
}

function openTripJournalOverview() {
    uiState.tripJournalOverviewOpen = true;
    uiState.tripSettingsOpen = false;
    renderPlanner();
}

function closeTripModals() {
    uiState.tripSettingsOpen = false;
    uiState.tripJournalOverviewOpen = false;
    uiState.tripPreferencesOpen = false;
    uiState.engineSuggestionsOpen = false;
    uiState.engineSuggestionsLoading = false;
}

function openPrintTripPage() {
    persistActiveWorkspace();
    queuePrintSnapshot(cloneData(trip));
    window.open('print-trip.html?auto=1', '_blank', 'noopener');
}

function ensureTripEnginePrefs() {
    if (typeof ensureEnginePreferences === 'function') {
        ensureEnginePreferences(trip);
    }
}

function pickEngineCategoryColor(category) {
    const key = String(category || '').toLowerCase();
    const map = {
        park: '#22c55e',
        mountain: '#78716c',
        historical: '#a16207',
        urban: '#3b82f6',
        scenic: '#06b6d4',
        quiet: '#8b5cf6'
    };
    return map[key] || '#111827';
}

function normalizePlaceTitleKey(title) {
    return String(title || '').trim().toLowerCase();
}

function tripAlreadyHasPlaceTitle(title) {
    const key = normalizePlaceTitleKey(title);
    if (!key) {
        return false;
    }
    const allItems = [
        ...(trip.placesPool || []),
        ...trip.days.flatMap((day) => day.items || [])
    ];
    return allItems.some((item) => {
        if (isNoteItem(item) || isChecklistItem(item)) {
            return false;
        }
        return normalizePlaceTitleKey(item.title) === key;
    });
}

function createPlaceFromEngineStop(stop, index) {
    const title = String(stop?.name || stop?.title || `Place ${index + 1}`).trim();
    const lat = Number(stop?.lat);
    const lon = Number(stop?.lon);
    const category = String(stop?.category || 'place');
    return {
        id: makeInstanceId('engine'),
        catalogId: null,
        engineSource: true,
        title,
        subtitle: category,
        note: `Suggested by engine · ${category}`,
        image: 'assets/images/trip-pakistan.jpg',
        color: pickEngineCategoryColor(category),
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        budget: Number(stop?.cost) || 0,
        startTime: null,
        endTime: null,
        visited: false,
        visitNote: '',
        visitLocation: ''
    };
}

function addEngineStopsToPool(stops) {
    const list = Array.isArray(stops) ? stops : [];
    if (!list.length) {
        showToast('No places to add');
        return { added: [], skipped: [] };
    }
    saveState();
    if (!Array.isArray(trip.placesPool)) {
        trip.placesPool = [];
    }
    const added = [];
    const skipped = [];
    list.forEach((stop, index) => {
        const title = String(stop?.name || '').trim();
        if (!title || tripAlreadyHasPlaceTitle(title)) {
            if (title) {
                skipped.push(title);
            }
            return;
        }
        const place = createPlaceFromEngineStop(stop, index);
        trip.placesPool.push(place);
        added.push(place);
    });
    if (added.length) {
        trip.map.selectedPlaceId = added[0].id;
    }
    closeEngineModals();
    renderPlanner();
    if (added.length) {
        showToast(`Added ${added.length} place(s) to pool`, 'section-pool');
    } else {
        showToast('No new places added (duplicates skipped)');
    }
    return { added, skipped };
}

function closeEngineModals() {
    uiState.engineSuggestionsOpen = false;
    uiState.engineSuggestionsLoading = false;
}

function openTripPreferencesModal() {
    ensureTripEnginePrefs();
    uiState.tripPreferencesOpen = true;
    uiState.tripSettingsOpen = false;
    uiState.tripJournalOverviewOpen = false;
    uiState.engineSuggestionsOpen = false;
    renderPlanner();
}

async function fetchEngineSuggestions() {
    ensureTripEnginePrefs();
    uiState.engineSuggestionsOpen = true;
    uiState.engineSuggestionsLoading = true;
    uiState.engineSuggestionsError = null;
    renderPlanner();
    const { payload } = buildOptimizeRequest(trip);
    try {
        const response = await fetch(`${ENGINE_API_BASE}/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(detail || `Request failed (${response.status})`);
        }
        const data = await response.json();
        trip.lastEngineResult = data;
        uiState.engineSuggestionsPreview = {
            stops: Array.isArray(data.optimized_route) ? data.optimized_route : [],
            meta: {
                utility_score: data.utility_score,
                total_locations_selected: data.total_locations_selected,
                constraints_used: data.constraints_used,
                province: data.province,
                budget_used: data.budget_used,
                total_time_hours: data.total_time_hours,
                total_distance_km: data.total_distance_km
            },
            requestPayload: payload,
            responsePayload: data
        };
        uiState.engineSuggestionsLoading = false;
        uiState.engineSuggestionsError = null;
        renderPlanner();
    } catch (error) {
        uiState.engineSuggestionsLoading = false;
        uiState.engineSuggestionsError = error?.message || 'Could not reach optimization backend';
        renderPlanner();
        showToast('Engine unavailable — start backend on port 8000');
    }
}

function openEngineSuggestionsFlow() {
    uiState.tripPreferencesOpen = false;
    fetchEngineSuggestions();
}

function saveTripPreferencesFromModal() {
    const root = plannerMain.querySelector('[data-trip-prefs-modal]');
    if (!root || typeof ensureEnginePreferences !== 'function') {
        return;
    }
    ensureTripEnginePrefs();
    const prefs = trip.enginePreferences;
    prefs.province = root.querySelector('#pref-province')?.value || prefs.province;
    prefs.useBudget = Boolean(root.querySelector('#pref-use-budget')?.checked);
    prefs.useTimeLimit = Boolean(root.querySelector('#pref-use-time')?.checked);
    prefs.useCategories = Boolean(root.querySelector('#pref-use-categories')?.checked);
    prefs.useCrowdFilter = Boolean(root.querySelector('#pref-use-crowds')?.checked);
    const manualMaxBudget = Number(root.querySelector('#pref-max-budget')?.value);
    const manualMaxHours = Number(root.querySelector('#pref-max-hours')?.value);
    const catsRaw = root.querySelector('#pref-categories')?.value || '';
    prefs.preferredCategories = catsRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (typeof readQuestionnaireFromModal === 'function') {
        applyQuestionnaireToPreferences(prefs, readQuestionnaireFromModal(root));
    }
    if (Number.isFinite(manualMaxBudget) && manualMaxBudget >= 0) {
        prefs.maxBudget = manualMaxBudget;
    }
    if (Number.isFinite(manualMaxHours) && manualMaxHours > 0) {
        prefs.maxTravelHours = manualMaxHours;
    }
    const coords = typeof PROVINCE_COORDS !== 'undefined' ? PROVINCE_COORDS[prefs.province] : null;
    if (coords) {
        prefs.startLat = coords.lat;
        prefs.startLon = coords.lon;
    }
    saveState();
    closeTripModals();
    renderPlanner();
    showToast('Trip preferences saved');
}

function confirmEngineSuggestionsToPool() {
    const root = plannerMain.querySelector('[data-engine-suggestions-modal]');
    if (!root) {
        return;
    }
    const preview = uiState.engineSuggestionsPreview;
    const stops = Array.isArray(preview?.stops) ? preview.stops : [];
    const selected = [];
    root.querySelectorAll('[data-engine-stop-index]').forEach((input) => {
        if (!input.checked) {
            return;
        }
        const index = Number(input.dataset.engineStopIndex);
        if (Number.isFinite(index) && stops[index]) {
            selected.push(stops[index]);
        }
    });
    addEngineStopsToPool(selected);
}

function applyEngineSuggestionsToDays() {
    const root = plannerMain.querySelector('[data-engine-suggestions-modal]');
    if (!root) {
        return;
    }
    const preview = uiState.engineSuggestionsPreview;
    const stops = Array.isArray(preview?.stops) ? preview.stops : [];
    if (!stops.length) {
        showToast('No engine stops to apply');
        return;
    }
    const selectedStops = [];
    root.querySelectorAll('[data-engine-stop-index]').forEach((input) => {
        if (!input.checked) {
            return;
        }
        const index = Number(input.dataset.engineStopIndex);
        if (Number.isFinite(index) && stops[index]) {
            selectedStops.push(stops[index]);
        }
    });
    if (!selectedStops.length) {
        showToast('Select at least one place');
        return;
    }

    const itinerary = Array.isArray(preview?.responsePayload?.itinerary) ? preview.responsePayload.itinerary : [];
    saveState();
    trip.placesPool = [];
    const dayCount = Math.max(1, Array.isArray(trip.days) ? trip.days.length : 0);
    if (!Array.isArray(trip.days) || trip.days.length === 0) {
        trip.days = [{ id: 'day-1', label: 'Day 1', shortLabel: 'Day 1', date: new Date().toDateString(), items: [] }];
    }
    trip.days.forEach((day) => {
        day.items = [];
        if (day.optimization) {
            delete day.optimization;
        }
    });

    const chunkSize = Math.max(1, Math.ceil(selectedStops.length / dayCount));
    const created = [];
    selectedStops.forEach((stop, index) => {
        const dayIndex = Math.min(dayCount - 1, Math.floor(index / chunkSize));
        const day = trip.days[dayIndex];
        const place = createPlaceFromEngineStop(stop, index);
        const it = itinerary[index];
        if (it && typeof it === 'object') {
            const arrival = String(it.arrival_time || '').trim();
            const departure = String(it.departure_time || '').trim();
            place.startTime = arrival || null;
            place.endTime = departure || null;
        }
        day.items.push(place);
        created.push(place);
    });

    if (created.length) {
        trip.map.selectedPlaceId = created[0].id;
    }

    closeEngineModals();
    renderPlanner();
    if (typeof toggleRoutes === 'function') {
        toggleRoutes(true);
    }
    showToast('Applied as system itinerary');
}

function renderTripPreferencesModal() {
    if (!uiState.tripPreferencesOpen) {
        return '';
    }
    ensureTripEnginePrefs();
    const prefs = trip.enginePreferences;
    const provinces = Object.keys(typeof PROVINCE_COORDS !== 'undefined' ? PROVINCE_COORDS : { Punjab: true });
    const provinceOptions = provinces.map((name) => {
        const selected = name === prefs.province ? ' selected' : '';
        return `<option value="${escapeHtmlAttr(name)}"${selected}>${escapeHtmlText(name)}</option>`;
    }).join('');
    const categoriesValue = escapeHtmlAttr((prefs.preferredCategories || []).join(', '));
    const questionnaireHtml = typeof renderQuestionnaireFields === 'function' ? renderQuestionnaireFields() : '';
    return `
        <div class="PlannerModalOverlay" data-trip-prefs-overlay="true">
            <div class="PlannerModal TripPrefsModal" role="dialog" aria-modal="true" data-trip-prefs-modal="true">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Trip preferences & engine</div>
                    <button type="button" class="PlannerModalClose" data-trip-prefs-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody TripPrefsBody">
                    <p class="TripPrefsIntro">Turn constraints on or off. The engine only uses what you enable. Your days are never changed automatically.</p>
                    <label class="TripPrefField TripPrefField--full">
                        <span>Province (dataset filter)</span>
                        <select id="pref-province">${provinceOptions}</select>
                    </label>
                    <div class="TripPrefToggles">
                        <label class="TripPrefToggle"><input type="checkbox" id="pref-use-budget" ${prefs.useBudget ? 'checked' : ''}> Use budget limit</label>
                        <label class="TripPrefField"><span>Max budget (PKR)</span><input type="number" id="pref-max-budget" min="0" step="500" value="${Number(prefs.maxBudget) || 5000}"></label>
                        <label class="TripPrefToggle"><input type="checkbox" id="pref-use-time" ${prefs.useTimeLimit ? 'checked' : ''}> Use time limit</label>
                        <label class="TripPrefField"><span>Max travel hours</span><input type="number" id="pref-max-hours" min="1" max="1000" step="1" value="${Number(prefs.maxTravelHours) || 12}"></label>
                        <label class="TripPrefToggle"><input type="checkbox" id="pref-use-categories" ${prefs.useCategories ? 'checked' : ''}> Use category preferences</label>
                        <label class="TripPrefField TripPrefField--full"><span>Categories (comma-separated)</span><input type="text" id="pref-categories" value="${categoriesValue}" placeholder="park, scenic, historical"></label>
                        <label class="TripPrefToggle"><input type="checkbox" id="pref-use-crowds" ${prefs.useCrowdFilter ? 'checked' : ''}> Avoid crowded places</label>
                    </div>
                    <h3 class="TripPrefsSubhead">Travel questionnaire</h3>
                    <p class="TripPrefsHint">Answers map to budget, time, and categories when those toggles are on.</p>
                    ${questionnaireHtml}
                    <div class="VisitModalFooter">
                        <button type="button" class="PlannerModalDone" data-trip-prefs-save="true">Save preferences</button>
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-engine-fetch-inline="true">Get suggestions now</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderEngineSuggestionsModal() {
    if (!uiState.engineSuggestionsOpen) {
        return '';
    }
    const loading = uiState.engineSuggestionsLoading;
    const error = uiState.engineSuggestionsError;
    const preview = uiState.engineSuggestionsPreview;
    const stops = Array.isArray(preview?.stops) ? preview.stops : [];
    const meta = preview?.meta || {};
    const itinerary = Array.isArray(preview?.responsePayload?.itinerary) ? preview.responsePayload.itinerary : [];
    if (loading) {
        return `
            <div class="PlannerModalOverlay" data-engine-suggestions-overlay="true">
                <div class="PlannerModal" role="dialog" aria-modal="true" data-engine-suggestions-modal="true">
                    <div class="PlannerModalHeader"><div class="PlannerModalTitle">Engine suggestions</div></div>
                    <div class="PlannerModalBody"><div class="PlannerEmptyState">Calling optimization engine…</div></div>
                </div>
            </div>
        `;
    }
    const metaRows = [
        ['Province', meta.province],
        ['Places selected', meta.total_locations_selected],
        ['Utility score', meta.utility_score],
        ['Budget used', meta.budget_used],
        ['Total time (h)', meta.total_time_hours],
        ['Distance (km)', meta.total_distance_km]
    ].filter((row) => row[1] != null && row[1] !== '');
    const constraints = meta.constraints_used && typeof meta.constraints_used === 'object'
        ? Object.entries(meta.constraints_used).map(([k, v]) => `${k}: ${v}`).join(' · ')
        : '';
    const requestJson = preview?.requestPayload ? safeJson(preview.requestPayload) : '';
    const responseJson = preview?.responsePayload ? safeJson(preview.responsePayload) : '';
    const itineraryMarkup = itinerary.length
        ? `
            <details style="margin-top:12px;">
                <summary style="cursor:pointer; font-weight:700;">Backend itinerary preview</summary>
                <div style="margin-top:10px; overflow:auto; border:1px solid rgba(229,231,235,1); border-radius:12px;">
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <thead>
                            <tr style="text-align:left; background:rgba(249,250,251,1);">
                                <th style="padding:10px; border-bottom:1px solid rgba(229,231,235,1);">#</th>
                                <th style="padding:10px; border-bottom:1px solid rgba(229,231,235,1);">Place</th>
                                <th style="padding:10px; border-bottom:1px solid rgba(229,231,235,1);">Arrival</th>
                                <th style="padding:10px; border-bottom:1px solid rgba(229,231,235,1);">Visit</th>
                                <th style="padding:10px; border-bottom:1px solid rgba(229,231,235,1);">Departure</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itinerary.map((row, idx) => `
                                <tr>
                                    <td style="padding:10px; border-bottom:1px solid rgba(243,244,246,1);">${idx + 1}</td>
                                    <td style="padding:10px; border-bottom:1px solid rgba(243,244,246,1);">${escapeHtmlText(row?.name || '')}</td>
                                    <td style="padding:10px; border-bottom:1px solid rgba(243,244,246,1);">${escapeHtmlText(row?.arrival_time || '')}</td>
                                    <td style="padding:10px; border-bottom:1px solid rgba(243,244,246,1);">${escapeHtmlText(String(row?.visit_duration_hours ?? ''))}</td>
                                    <td style="padding:10px; border-bottom:1px solid rgba(243,244,246,1);">${escapeHtmlText(row?.departure_time || '')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </details>
        `
        : '';
    const traceMarkup = `
        <details style="margin-top:12px;">
            <summary style="cursor:pointer; font-weight:700;">Engine trace (trust)</summary>
            <div style="margin-top:10px; font-size:12px;">
                <div><strong>Endpoint:</strong> ${escapeHtmlText(`${ENGINE_API_BASE}/optimize`)}</div>
                <div style="margin-top:8px; font-weight:700;">Request payload</div>
                <pre style="margin-top:6px; padding:10px 12px; border-radius:12px; background:rgba(17,24,39,0.92); color:rgba(255,255,255,0.95); overflow:auto; max-height:220px;">${escapeHtmlText(requestJson)}</pre>
                <div style="margin-top:10px; font-weight:700;">Response payload</div>
                <pre style="margin-top:6px; padding:10px 12px; border-radius:12px; background:rgba(17,24,39,0.92); color:rgba(255,255,255,0.95); overflow:auto; max-height:220px;">${escapeHtmlText(responseJson)}</pre>
            </div>
        </details>
    `;
    const listMarkup = stops.length
        ? stops.map((stop, index) => {
            const name = escapeHtmlText(stop.name || `Stop ${index + 1}`);
            const cat = escapeHtmlText(stop.category || '');
            const dur = stop.visit_duration != null ? `${stop.visit_duration}h visit` : '';
            const intelligence = Array.isArray(stop.why_selected) && stop.why_selected.length
                ? `<div class="EngineIntelligence">${stop.why_selected.map(s => `<span>✨ ${escapeHtmlText(s)}</span>`).join('')}</div>`
                : '';
            return `
                <label class="EngineStopRow">
                    <input type="checkbox" checked data-engine-stop-index="${index}">
                    <div class="EngineStopRow__content">
                        <strong>${name}</strong>
                        ${cat ? `<div class="EngineStopRow__meta">${cat}</div>` : ''}
                        ${dur ? `<div class="EngineStopRow__meta">${dur}</div>` : ''}
                        ${intelligence}
                    </div>
                </label>
            `;
        }).join('')
        : '<div class="PlannerEmptyState">No stops returned. Try relaxing constraints in Trip preferences.</div>';
    return `
        <div class="PlannerModalOverlay" data-engine-suggestions-overlay="true">
            <div class="PlannerModal EngineSuggestionsModal" role="dialog" aria-modal="true" data-engine-suggestions-modal="true">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Engine suggestions → places pool</div>
                    <button type="button" class="PlannerModalClose" data-engine-suggestions-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    ${error ? `<div class="EngineErrorBanner">${escapeHtmlText(error)}</div>` : ''}
                    ${metaRows.length ? `
                        <div class="EngineMetaGrid">
                            ${metaRows.map(([label, value]) => `<div><span>${escapeHtmlText(label)}</span><strong>${escapeHtmlText(value)}</strong></div>`).join('')}
                        </div>
                    ` : ''}
                    ${constraints ? `<p class="TripPrefsHint">Constraints used: ${escapeHtmlText(constraints)}</p>` : ''}
                    <p class="TripPrefsHint">Selected places are added only to <strong>Places to visit</strong>. Drag them into days yourself.</p>
                    <div class="EngineStopList">${listMarkup}</div>
                    ${itineraryMarkup}
                    ${traceMarkup}
                    <div class="VisitModalFooter">
                        <button type="button" class="PlannerModalDone" data-engine-suggestions-apply="true" ${!stops.length ? 'disabled' : ''}>Add selected to pool</button>
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-engine-suggestions-apply-days="true" ${!stops.length ? 'disabled' : ''}>Apply as system itinerary</button>
                        <button type="button" class="PlannerTextButton" data-engine-suggestions-refresh="true">Regenerate</button>
                        <button type="button" class="PlannerTextButton" data-trip-prefs-open-inline="true">Edit preferences</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function bindTripPreferencesModal() {
    const prefsModal = plannerMain.querySelector('[data-trip-prefs-modal]');
    if (prefsModal && typeof writeQuestionnaireToModal === 'function' && trip.enginePreferences?.questionnaire) {
        writeQuestionnaireToModal(prefsModal, trip.enginePreferences.questionnaire);
    }
    const overlay = plannerMain.querySelector('[data-trip-prefs-overlay]');
    overlay?.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeTripModals();
            renderPlanner();
        }
    });
    plannerMain.querySelector('[data-trip-prefs-close]')?.addEventListener('click', () => {
        closeTripModals();
        renderPlanner();
    });
    plannerMain.querySelector('[data-trip-prefs-save]')?.addEventListener('click', saveTripPreferencesFromModal);
    plannerMain.querySelector('[data-engine-fetch-inline]')?.addEventListener('click', () => {
        saveTripPreferencesFromModal();
        openEngineSuggestionsFlow();
    });
    const engineOverlay = plannerMain.querySelector('[data-engine-suggestions-overlay]');
    engineOverlay?.addEventListener('click', (event) => {
        if (event.target === engineOverlay) {
            closeEngineModals();
            renderPlanner();
        }
    });
    plannerMain.querySelector('[data-engine-suggestions-close]')?.addEventListener('click', () => {
        closeEngineModals();
        renderPlanner();
    });
    plannerMain.querySelector('[data-engine-suggestions-apply]')?.addEventListener('click', confirmEngineSuggestionsToPool);
    plannerMain.querySelector('[data-engine-suggestions-apply-days]')?.addEventListener('click', applyEngineSuggestionsToDays);
    plannerMain.querySelector('[data-engine-suggestions-refresh]')?.addEventListener('click', fetchEngineSuggestions);
    plannerMain.querySelector('[data-trip-prefs-open-inline]')?.addEventListener('click', openTripPreferencesModal);
}

function saveTripSettingsFromModal() {
    const titleInput = document.getElementById('trip-settings-title');
    const nameInput = document.getElementById('trip-settings-name');
    const startInput = document.getElementById('trip-settings-start');
    const endInput = document.getElementById('trip-settings-end');
    const notesInput = document.getElementById('trip-settings-notes');
    saveState();
    const nextTitle = (titleInput?.value || '').trim();
    const nextName = (nameInput?.value || '').trim();
    trip.title = nextTitle || trip.title || 'My Trip';
    trip.name = nextName || trip.name || '';
    if (startInput?.value) trip.startDate = startInput.value;
    if (endInput?.value) trip.endDate = endInput.value;
    if (trip.startDate && trip.endDate) {
        trip.dates = formatTripDateRange(trip.startDate, trip.endDate);
    }
    trip.notes = notesInput?.value || '';
    closeTripModals();
    renderPlanner();
    showToast('Trip settings saved');
}

function renderJournalModal() {
    const placeId = uiState.activeJournalPlaceId;
    if (!placeId) {
        return '';
    }
    const place = getPlaceById(placeId);
    if (!place) {
        return '';
    }
    const details = place.visitDetails && typeof place.visitDetails === 'object' ? place.visitDetails : null;
    const visitedDateValue = String(details?.visitedDate || '').trim();
    const visitedTimeValue = String(details?.visitedTime || '').trim();
    let visitedDateLabel = '';
    if (visitedDateValue) {
        const date = new Date(visitedDateValue);
        if (Number.isFinite(date.getTime())) {
            visitedDateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }
    const visitStamp = [visitedDateLabel, visitedTimeValue].filter(Boolean).join(' • ');
    const scheduleLabel = place.startTime || place.endTime
        ? `${formatTime12h(place.startTime)}${place.startTime && place.endTime ? ' - ' : ''}${formatTime12h(place.endTime)}`
        : '';
    const timeLabel = visitStamp || scheduleLabel || 'No time added';
    const locationLabel = (place.visitLocation || '').trim() || 'No location selected';
    const noteLabel = (String(details?.notes ?? place.visitNote ?? '')).trim() || 'No note saved';
    return `
        <div class="PlannerModalOverlay" data-journal-overlay="true">
            <div class="PlannerModal VisitModal" role="dialog" aria-modal="true" aria-label="Trip Journal">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Trip Journal</div>
                    <button type="button" class="PlannerModalClose" data-journal-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    <div class="VisitModalHeader">
                        <div class="VisitModalHeader__text">
                            <div class="VisitModalHeader__title">${place.title}</div>
                            <div class="VisitModalHeader__time">${timeLabel}</div>
                        </div>
                        <img class="VisitModalHeader__image" src="${place.image || 'assets/images/trip-pakistan.jpg'}" alt="${place.title}">
                    </div>
                    <div class="VisitModalNotes">
                        <div class="VisitModalNotes__label">Location</div>
                        <div>${locationLabel}</div>
                    </div>
                    <div class="VisitModalNotes">
                        <div class="VisitModalNotes__label">Notes</div>
                        <div>${noteLabel}</div>
                    </div>
                    <div class="VisitModalFooter">
                        <button type="button" class="PlannerModalDone" data-journal-close="true">Done</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createCustomList(name = 'Untitled') {
    const items = [];
    return {
        id: makeInstanceId('list'),
        name,
        color: '#10b981',
        icon: '123',
        items,
        places: items
    };
}

function isNoteItem(item) {
    return Boolean(item && item.type === 'note');
}

function isChecklistItem(item) {
    return Boolean(item && item.type === 'checklist');
}

function getPlaceIdentity(place) {
    if (!place || isNoteItem(place) || isChecklistItem(place)) {
        return null;
    }
    return place.catalogId || place.title.trim().toLowerCase();
}

function getAllContainers() {
    return [
        { type: 'pool', id: 'pool', items: trip.placesPool },
        ...trip.customLists.map((list) => ({ type: 'custom', id: list.id, items: list.items })),
        ...trip.days.map((day) => ({ type: 'day', id: day.id, items: day.items }))
    ];
}

function findPlaceLocationById(placeId) {
    for (const container of getAllContainers()) {
        const index = container.items.findIndex((item) => item.id === placeId);
        if (index !== -1) {
            return {
                type: container.type,
                id: container.id,
                index,
                place: container.items[index]
            };
        }
    }
    return null;
}

function findPlaceLocationByIdentity(identity) {
    for (const container of getAllContainers()) {
        const index = container.items.findIndex((item) => {
            const itemIdentity = getPlaceIdentity(item);
            return itemIdentity && itemIdentity === identity;
        });
        if (index !== -1) {
            return {
                type: container.type,
                id: container.id,
                index,
                place: container.items[index]
            };
        }
    }
    return null;
}

function logTripState() {
    console.log(trip);
}

function getSelectedPlaceIds() {
    return Array.from(uiState.selectedItems || []);
}

function getSelectedPlaceIdsInOrder() {
    const selectedList = Array.from(uiState.selectedItems || []);
    if (!selectedList.length) {
        return [];
    }
    const selected = new Set(selectedList);
    const ordered = [];
    getAllContainers().forEach((container) => {
        container.items.forEach((item) => {
            if (selected.has(item.id)) {
                ordered.push(item.id);
            }
        });
    });
    return ordered;
}

function togglePlaceSelection(placeId, isSelected) {
    if (!placeId) {
        return;
    }
    const selected = Array.from(uiState.selectedItems || []);
    const has = selected.includes(placeId);
    if (isSelected && !has) {
        selected.push(placeId);
    }
    if (!isSelected && has) {
        uiState.selectedItems = selected.filter((id) => id !== placeId);
    } else {
        uiState.selectedItems = selected;
    }
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function clearSelection() {
    if (!Array.isArray(uiState.selectedItems) || uiState.selectedItems.length === 0) {
        return;
    }
    uiState.selectedItems = [];
}

function getItemsForSection(sectionId) {
    if (!sectionId) {
        return null;
    }
    if (sectionId === 'section-pool') {
        return trip.placesPool;
    }
    if (sectionId.startsWith('section-custom-')) {
        const listId = sectionId.slice('section-custom-'.length);
        return trip.customLists.find((list) => list.id === listId)?.items || null;
    }
    if (sectionId.startsWith('section-day-')) {
        const tail = sectionId.slice('section-day-'.length);
        const dayId = tail.startsWith('day-') ? tail : `day-${tail}`;
        return trip.days.find((day) => day.id === dayId)?.items || null;
    }
    if (sectionId.startsWith('section-')) {
        const possibleDayId = sectionId.slice('section-'.length);
        return trip.days.find((day) => day.id === possibleDayId)?.items || null;
    }
    return null;
}

function getSelectToggleLabel(sectionId) {
    const items = getItemsForSection(sectionId) || [];
    const selected = new Set(uiState.selectedItems || []);
    const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
    return allSelected ? 'Deselect all' : 'Select all';
}

function selectAllInSection(sectionId) {
    if (!sectionId) {
        return;
    }
    const items = getItemsForSection(sectionId);
    if (!items) {
        return;
    }
    const selected = new Set(uiState.selectedItems || []);
    const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
    if (allSelected) {
        uiState.selectedItems = (uiState.selectedItems || []).filter((id) => !items.some((item) => item.id === id));
    } else {
        const merged = new Set(uiState.selectedItems || []);
        items.forEach((item) => merged.add(item.id));
        uiState.selectedItems = Array.from(merged);
    }
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function getSectionTitle(titleKey, fallback) {
    return uiState.sectionTitles[titleKey] || fallback;
}

function isSectionCollapsed(sectionId) {
    return uiState.collapsedSections.has(sectionId);
}

function toggleSectionCollapsed(sectionId) {
    if (!sectionId) {
        return;
    }
    if (uiState.collapsedSections.has(sectionId)) {
        uiState.collapsedSections.delete(sectionId);
    } else {
        uiState.collapsedSections.add(sectionId);
    }
}

function collapseAllSections() {
    uiState.collapsedSections.add('section-notes');
    uiState.collapsedSections.add('section-pool');
    trip.customLists.forEach((list) => {
        uiState.collapsedSections.add(`section-custom-${list.id}`);
    });
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function expandAllSections() {
    uiState.collapsedSections.delete('section-notes');
    uiState.collapsedSections.delete('section-pool');
    trip.customLists.forEach((list) => {
        uiState.collapsedSections.delete(`section-custom-${list.id}`);
    });
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function getPreItinerarySectionIds() {
    return [
        'section-notes',
        'section-pool',
        ...trip.customLists.map((list) => `section-custom-${list.id}`)
    ];
}

function getCollapseAllLabel() {
    const allCollapsed = getPreItinerarySectionIds().every((id) => uiState.collapsedSections.has(id));
    return allCollapsed ? 'Expand all sections' : 'Collapse all sections';
}

function renderSectionMenu(sectionType, sectionId) {
    const collapseLabel = getCollapseAllLabel();
    const selectLabel = getSelectToggleLabel(sectionId);
    const items = sectionType === 'notes'
        ? [
            'Delete section',
            collapseLabel
        ]
        : [
            'Delete section',
            'Rearrange sections',
            'Change color or icon',
            selectLabel,
            collapseLabel
        ];
    return `
        <div class="PlannerSectionMenu dropdown">
            <button type="button" class="PlannerSection__menu" data-section-menu-button="true" aria-haspopup="true" aria-expanded="false">⋯</button>
            <div class="dropdown-menu dropdown-menu-right" data-section-menu-items="true">
                ${items.map((label) => {
        const attrs = label === 'Collapse all sections'
            ? ' data-collapse-all="true" data-menu-action="collapse-all"'
            : label === 'Expand all sections'
                ? ' data-expand-all="true" data-menu-action="expand-all"'
                : '';
        return `<button type="button" class="dropdown-item" data-menu-item="${label}"${attrs}>${label}</button>`;
    }).join('')}
            </div>
        </div>
    `;
}

function renderDayMenu(day) {
    const sectionId = `section-${day.id}`;
    const selectLabel = getSelectToggleLabel(sectionId);
    const collapseLabel = allDaysCollapsed ? 'Expand all days' : 'Collapse all days';
    return `
        <div class="PlannerSectionMenu dropdown">
            <button type="button" class="PlannerSection__menu" data-section-menu-button="true" aria-haspopup="true" aria-expanded="false">⋯</button>
            <div class="dropdown-menu dropdown-menu-right" data-section-menu-items="true">
                <button type="button" class="dropdown-item" data-menu-item="Rearrange sections">Rearrange sections</button>
                <button type="button" class="dropdown-item" data-menu-item="Change color">Change color</button>
                <button type="button" class="dropdown-item" data-menu-item="${selectLabel}">${selectLabel}</button>
                <button type="button" class="dropdown-item" data-menu-item="${collapseLabel}" data-toggle-all-days="true">${collapseLabel}</button>
                <button type="button" class="dropdown-item" data-menu-item="Add places to journal">Add places to journal</button>
                <button type="button" class="dropdown-item" data-menu-item="Insert day after" data-insert-day-after="${day.id}">Insert day after</button>
                <button type="button" class="dropdown-item" data-menu-item="Delete day" data-delete-day="${day.id}">Delete day</button>
            </div>
        </div>
    `;
}

function syncAllDaysCollapsedUi() {
    plannerMain.querySelectorAll('.PlannerDaySection').forEach((section) => {
        section.classList.toggle('collapsed', allDaysCollapsed);
    });
    plannerMain.querySelectorAll('[data-toggle-all-days="true"]').forEach((button) => {
        const label = allDaysCollapsed ? 'Expand all days' : 'Collapse all days';
        button.dataset.menuItem = label;
        button.textContent = label;
    });
}

function toggleAllDaysCollapsed() {
    allDaysCollapsed = !allDaysCollapsed;
    syncAllDaysCollapsedUi();
}

function formatShortDayLabelValue(dateStr) {
    const date = new Date(dateStr);
    if (!Number.isFinite(date.getTime())) {
        return '';
    }
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${weekday} ${month}/${day}`;
}

function getItineraryStartDate() {
    const startFromTrip = new Date(trip.startDate);
    if (Number.isFinite(startFromTrip.getTime())) {
        return startFromTrip;
    }
    const first = trip.days.find((day) => Number.isFinite(new Date(day.date).getTime()));
    if (first) {
        return new Date(first.date);
    }
    const rangeMatch = String(trip.dates || '').match(/(\d{1,2})\/(\d{1,2})/);
    const labelMatch = String(trip.days[0]?.shortLabel || '').match(/(\d{1,2})\/(\d{1,2})/);
    const match = rangeMatch || labelMatch;
    if (match) {
        const year = new Date().getFullYear();
        const month = parseInt(match[1], 10) - 1;
        const day = parseInt(match[2], 10);
        const candidate = new Date(year, month, day);
        if (Number.isFinite(candidate.getTime())) {
            return candidate;
        }
    }
    return null;
}

function recalculateItineraryDates() {
    const start = getItineraryStartDate();
    if (!start) {
        return;
    }
    const current = new Date(start);
    trip.days.forEach((day) => {
        const dateStr = current.toDateString();
        day.date = dateStr;
        day.shortLabel = formatShortDayLabelValue(dateStr) || day.shortLabel;
        current.setDate(current.getDate() + 1);
    });
}

function ensureItineraryDates() {
    if (!Array.isArray(trip.days) || trip.days.length === 0) {
        return;
    }
    const needsDates = trip.days.some((day) => !day.date);
    if (needsDates) {
        recalculateItineraryDates();
    }
}

function createItineraryDayId() {
    const used = new Set(trip.days.map((day) => day.id));
    let max = 0;
    trip.days.forEach((day) => {
        const match = String(day.id || '').match(/^day-(\d+)$/);
        if (!match) return;
        const value = parseInt(match[1], 10);
        if (Number.isFinite(value)) {
            max = Math.max(max, value);
        }
    });
    let next = max + 1;
    while (used.has(`day-${next}`)) {
        next += 1;
    }
    return `day-${next}`;
}

function insertDayAfter(dayId) {
    const index = trip.days.findIndex((day) => day.id === dayId);
    if (index === -1) {
        return;
    }
    const newDay = {
        id: createItineraryDayId(),
        label: `Day ${trip.days.length + 1}`,
        shortLabel: '',
        date: '',
        items: []
    };
    saveState();
    trip.days.splice(index + 1, 0, newDay);
    recalculateItineraryDates();
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function deleteDay(dayId) {
    const index = trip.days.findIndex((day) => day.id === dayId);
    if (index === -1) {
        return;
    }
    const day = trip.days[index];
    const removedItemIds = new Set((day.items || []).map((item) => item.id));
    saveState();
    trip.days.splice(index, 1);
    uiState.collapsedSections.delete(`section-${dayId}`);
    uiState.selectedItems = (uiState.selectedItems || []).filter((id) => !removedItemIds.has(id));
    recalculateItineraryDates();
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function deleteSection(sectionId) {
    if (!sectionId) {
        return;
    }
    if (sectionId === 'section-notes') {
        saveState();
        trip.notes = '';
    } else if (sectionId === 'section-pool') {
        saveState();
        const poolIds = new Set(trip.placesPool.map((place) => place.id));
        uiState.selectedItems = (uiState.selectedItems || []).filter((id) => !poolIds.has(id));
        trip.placesPool = [];
    } else if (sectionId.startsWith('section-custom-')) {
        const listId = sectionId.slice('section-custom-'.length);
        const index = trip.customLists.findIndex((list) => list.id === listId);
        if (index === -1) {
            return;
        }
        saveState();
        const listIds = new Set(trip.customLists[index].items.map((place) => place.id));
        uiState.selectedItems = (uiState.selectedItems || []).filter((id) => !listIds.has(id));
        trip.customLists.splice(index, 1);
        uiState.collapsedSections.delete(sectionId);
        if (uiState.arrangementModal?.activeSectionId === sectionId) {
            uiState.arrangementModal.activeSectionId = 'section-pool';
        }
    } else {
        return;
    }
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function commitCustomListTitle(listId, nextValue) {
    const list = trip.customLists.find((entry) => entry.id === listId);
    if (!list) {
        return;
    }
    const value = String(nextValue || '').trim();
    saveState();
    list.name = value || 'Untitled';
    uiState.editingTitleKey = null;
}

function getArrangementSections() {
    const poolSubtitle = trip.placesPool.slice(0, 2).map((place) => place.title).join(', ');
    return [
        {
            id: 'section-pool',
            name: getSectionTitle('pool', 'Places to visit'),
            subtitle: poolSubtitle,
            group: 'pool'
        },
        ...trip.customLists.map((list) => ({
            id: `section-custom-${list.id}`,
            name: list.name,
            subtitle: list.items.slice(0, 2).map((place) => place.title).join(', '),
            group: 'custom'
        }))
    ];
}

function getSectionAppearance(sectionId) {
    if (sectionId === 'section-pool') {
        return uiState.poolSection;
    }
    if (sectionId && sectionId.startsWith('section-custom-')) {
        const listId = sectionId.slice('section-custom-'.length);
        return trip.customLists.find((list) => list.id === listId) || null;
    }
    if (sectionId && sectionId.startsWith('section-')) {
        const possibleDayId = sectionId.slice('section-'.length);
        const day = trip.days.find((entry) => entry.id === possibleDayId);
        if (day) {
            if (!day.color) {
                day.color = '#3b82f6';
            }
            if (!day.icon) {
                day.icon = '123';
            }
            return day;
        }
    }
    return null;
}

function setSectionColor(sectionId, color) {
    const target = getSectionAppearance(sectionId);
    if (!target) {
        return;
    }
    if (sectionId !== 'section-pool') {
        saveState();
    }
    target.color = color;
}

function setSectionIcon(sectionId, icon) {
    const target = getSectionAppearance(sectionId);
    if (!target) {
        return;
    }
    if (sectionId !== 'section-pool') {
        saveState();
    }
    target.icon = icon;
}

function openArrangementModal(sectionId) {
    uiState.arrangementModal.isOpen = true;
    uiState.arrangementModal.activeSectionId = sectionId || 'section-pool';
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function closeArrangementModal() {
    uiState.arrangementModal.isOpen = false;
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function renderArrangementModal() {
    if (!uiState.arrangementModal.isOpen) {
        return '';
    }
    const sections = getArrangementSections();
    const daySections = trip.days.map((day) => ({
        id: `section-${day.id}`,
        name: formatDayLabel(day.date) || day.label,
        subtitle: day.items.filter((item) => !isNoteItem(item)).slice(0, 2).map((place) => place.title).join(', '),
        group: 'day'
    }));
    const activeId = uiState.arrangementModal.activeSectionId || sections[0]?.id || 'section-pool';
    const active = getSectionAppearance(activeId) || uiState.poolSection;
    const editingId = uiState.arrangementModal.editingSectionId;
    const colors = ['#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#065f46', '#0f766e', '#1d4ed8', '#4c1d95', '#7c2d12'];
    const icons = [
        { id: '123', label: '123' },
        { id: 'car', label: '🚗' },
        { id: 'food', label: '🍽' },
        { id: 'hotel', label: '🛏' },
        { id: 'map', label: '🗺' },
        { id: 'pin', label: '📍' },
        { id: 'coffee', label: '☕' },
        { id: 'ticket', label: '🎟' }
    ];
    return `
        <div class="PlannerModalOverlay" data-arrangement-overlay="true">
            <div class="PlannerModal" role="dialog" aria-modal="true" aria-label="Arrangement and color">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Arrangement and color</div>
                    <button type="button" class="PlannerModalClose" data-arrangement-close="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    <div class="PlannerModalSectionList">
                        ${sections.map((section) => {
                            const appearance = getSectionAppearance(section.id) || uiState.poolSection;
                            const isActive = section.id === activeId;
                            const isEditing = section.id === editingId;
                            const iconValue = appearance?.icon;
                            const iconLabel = iconValue && iconValue !== '123' ? icons.find((i) => i.id === iconValue)?.label || '' : '';
                            return `
                                <button type="button" class="PlannerModalRow${isActive ? ' is-active' : ''}" data-arrangement-select="${section.id}" data-arrangement-drop="${section.id}" data-arrangement-group="${section.group}">
                                    <span class="PlannerModalHandle">⋮⋮</span>
                                    <span class="PlannerModalRowText">
                                        <span class="PlannerModalRowName">${section.name}</span>
                                        ${section.subtitle ? `<span class="PlannerModalRowSub">${section.subtitle}</span>` : ''}
                                    </span>
                                    <span class="PlannerModalRowMeta">
                                        <span class="PlannerModalDot" style="background:${appearance?.color || '#3b82f6'}"></span>
                                        ${iconLabel ? `<span class="PlannerModalIcon">${iconLabel}</span>` : ''}
                                        <button type="button" class="PlannerModalEditButton" data-arrangement-edit="${section.id}" aria-label="Edit">🎨</button>
                                    </span>
                                </button>
                                ${isEditing ? `
                                <div class="PlannerModalPickers" data-arrangement-panel="${section.id}">
                                    <div class="PlannerModalPickerLabel">Color</div>
                                    <div class="PlannerModalColors">
                                        ${colors.map((color) => `
                                            <button type="button" class="PlannerModalColor${appearance?.color === color ? ' is-selected' : ''}" data-arrangement-color="${color}" aria-label="Pick color" style="background:${color}">
                                                ${appearance?.color === color ? '✓' : ''}
                                            </button>
                                        `).join('')}
                                    </div>
                                    <div class="PlannerModalPickerLabel">Icon</div>
                                    <div class="PlannerModalIcons">
                                        ${icons.map((icon) => `
                                            <button type="button" class="PlannerModalIconButton${(appearance?.icon || '123') === icon.id ? ' is-selected' : ''}" data-arrangement-icon="${icon.id}" aria-label="Pick icon">
                                                ${icon.label}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                            `;
                        }).join('')}
                        <div class="PlannerModalGroupLabel">Itinerary</div>
                        ${daySections.map((section) => {
                            const appearance = getSectionAppearance(section.id) || { color: '#3b82f6', icon: '123' };
                            const isActive = section.id === activeId;
                            const isEditing = section.id === editingId;
                            const iconValue = appearance?.icon;
                            const iconLabel = iconValue && iconValue !== '123' ? icons.find((i) => i.id === iconValue)?.label || '' : '';
                            return `
                                <button type="button" class="PlannerModalRow${isActive ? ' is-active' : ''}" data-arrangement-select="${section.id}" data-arrangement-drop="${section.id}" data-arrangement-group="${section.group}">
                                    <span class="PlannerModalHandle">⋮⋮</span>
                                    <span class="PlannerModalRowText">
                                        <span class="PlannerModalRowName">${section.name}</span>
                                        ${section.subtitle ? `<span class="PlannerModalRowSub">${section.subtitle}</span>` : ''}
                                    </span>
                                    <span class="PlannerModalRowMeta">
                                        <span class="PlannerModalDot" style="background:${appearance?.color || '#3b82f6'}"></span>
                                        ${iconLabel ? `<span class="PlannerModalIcon">${iconLabel}</span>` : ''}
                                        <button type="button" class="PlannerModalEditButton" data-arrangement-edit="${section.id}" aria-label="Edit">🎨</button>
                                    </span>
                                </button>
                                ${isEditing ? `
                                <div class="PlannerModalPickers" data-arrangement-panel="${section.id}">
                                    <div class="PlannerModalPickerLabel">Color</div>
                                    <div class="PlannerModalColors">
                                        ${colors.map((color) => `
                                            <button type="button" class="PlannerModalColor${appearance?.color === color ? ' is-selected' : ''}" data-arrangement-color="${color}" aria-label="Pick color" style="background:${color}">
                                                ${appearance?.color === color ? '✓' : ''}
                                            </button>
                                        `).join('')}
                                    </div>
                                    <div class="PlannerModalPickerLabel">Icon</div>
                                    <div class="PlannerModalIcons">
                                        ${icons.map((icon) => `
                                            <button type="button" class="PlannerModalIconButton${(appearance?.icon || '123') === icon.id ? ' is-selected' : ''}" data-arrangement-icon="${icon.id}" aria-label="Pick icon">
                                                ${icon.label}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                            `;
                        }).join('')}
                    </div>
                    <div class="PlannerModalFooter">
                        <button type="button" class="PlannerModalDone" data-arrangement-done="true">Done</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function startEditingTitle(titleKey) {
    uiState.editingTitleKey = titleKey;
}

function commitEditingTitle(titleKey, nextValue, fallbackValue) {
    const value = String(nextValue || '').trim();
    uiState.sectionTitles[titleKey] = value || fallbackValue;
    uiState.editingTitleKey = null;
}

function parseDestination(value) {
    const parts = String(value || '').split('|');
    if (parts.length !== 2) {
        return null;
    }
    const [type, id] = parts;
    if (!type || !id) {
        return null;
    }
    return { type, id };
}

function renderBulkActionBar() {
    const count = Array.isArray(uiState.selectedItems) ? uiState.selectedItems.length : 0;
    if (count === 0) {
        return '';
    }
    const optionMarkup = `
        <option value="pool|pool">Places to visit</option>
        ${trip.customLists.map((list) => `<option value="custom|${list.id}">${list.name}</option>`).join('')}
        ${trip.days.map((day) => `<option value="day|${day.id}">${formatDayLabel(day.date) || day.shortLabel}</option>`).join('')}
    `;
    return `
        <div class="PlannerBulkBar" id="plannerBulkBar">
            <div class="PlannerBulkBar__count">${count} item${count === 1 ? '' : 's'} selected</div>
            <div class="PlannerBulkBar__spacer"></div>
            <select data-bulk-move="true">
                <option value="">Move to</option>
                ${optionMarkup}
            </select>
            <select data-bulk-copy="true">
                <option value="">Copy to</option>
                ${optionMarkup}
            </select>
            <button type="button" class="PlannerBulkBar__danger" data-bulk-delete="true">Delete</button>
            <button type="button" class="PlannerBulkBar__clear" data-bulk-clear="true" aria-label="Clear selection">✕</button>
        </div>
    `;
}

function getSidebarItems() {
    return [
        { id: 'section-overview', label: 'Overview' },
        { id: 'section-explore', label: 'Explore' },
        { id: 'section-notes', label: 'Notes' },
        { id: 'section-pool', label: 'Places to visit' },
        ...trip.customLists.map((list) => ({ id: `section-custom-${list.id}`, label: list.name })),
        { id: 'section-itinerary', label: 'Itinerary', children: trip.days.map((day) => ({ id: `section-${day.id}`, label: formatDayLabel(day.date) || day.shortLabel })) },
        { id: 'section-budget', label: 'Budget' }
    ];
}

function flattenItinerary() {
    const ordered = [];
    trip.days.forEach((day) => {
        day.items.forEach((item) => {
            ordered.push({
                dayId: day.id,
                dayLabel: formatDayLabel(day.date) || day.label,
                item
            });
        });
    });
    return ordered;
}

function flattenItineraryPlaces() {
    const ordered = [];
    trip.days.forEach((day) => {
        day.items.forEach((item) => {
            if (!isNoteItem(item) && !isChecklistItem(item)) {
                ordered.push({
                    dayId: day.id,
                    dayLabel: formatDayLabel(day.date) || day.label,
                    item
                });
            }
        });
    });
    return ordered;
}

function getAllBudgetItems() {
    const ordered = flattenItineraryPlaces();
    return ordered.map(({ item }) => item);
}

function setExpenses(updater) {
    const current = Array.isArray(trip.expenses) ? trip.expenses : [];
    const next = typeof updater === 'function' ? updater(current) : updater;
    trip.expenses = Array.isArray(next) ? next : [];
}

function calculateTotalSpent() {
    return (trip.expenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
}

function getSortedExpenses() {
    const sortKey = uiState.expenseSort || 'date_desc';
    const expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
    const copy = [...expenses];
    const getTime = (expense) => {
        const time = new Date(expense?.date).getTime();
        return Number.isFinite(time) ? time : 0;
    };
    const getAmount = (expense) => Number(expense?.amount) || 0;
    const getCategory = (expense) => String(expense?.category || '');
    const getId = (expense) => String(expense?.id || '');
    if (sortKey === 'date_asc') {
        copy.sort((a, b) => (getTime(a) - getTime(b)) || getId(a).localeCompare(getId(b)));
    } else if (sortKey === 'amount_desc') {
        copy.sort((a, b) => (getAmount(b) - getAmount(a)) || getTime(b) - getTime(a) || getId(a).localeCompare(getId(b)));
    } else if (sortKey === 'amount_asc') {
        copy.sort((a, b) => (getAmount(a) - getAmount(b)) || getTime(b) - getTime(a) || getId(a).localeCompare(getId(b)));
    } else if (sortKey === 'category_asc') {
        copy.sort((a, b) => getCategory(a).localeCompare(getCategory(b), undefined, { sensitivity: 'base' }) || getTime(b) - getTime(a) || getId(a).localeCompare(getId(b)));
    } else {
        copy.sort((a, b) => (getTime(b) - getTime(a)) || getId(a).localeCompare(getId(b)));
    }
    return copy;
}

function getBudgetValue() {
    if (typeof trip.budget === 'number') {
        return Number(trip.budget) || 0;
    }
    return Number(trip.budget?.amount) || 0;
}

function setBudgetValue(value) {
    const next = Number(value) || 0;
    if (typeof trip.budget === 'number') {
        trip.budget = next;
        return;
    }
    if (!trip.budget || typeof trip.budget !== 'object') {
        trip.budget = { currency: 'PKR', amount: next };
        return;
    }
    trip.budget.amount = next;
}

function getBudgetProgress() {
    const spent = calculateTotalSpent();
    const budget = getBudgetValue();
    if (budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
}

function calculateBudgetTotal() {
    return calculateTotalSpent();
}

function getConnectionsMap() {
    const connections = new Map();
    const day = arguments[0] ? getDayById(arguments[0]) : null;
    const ordered = day
        ? getDayPlaceItems(day).map((item) => ({ dayId: day.id, item }))
        : flattenItineraryPlaces();
    const optimization = day ? getActiveDayOptimization(day) : null;
    if (optimization?.legs?.length) {
        optimization.legs.forEach((leg) => {
            connections.set(String(leg.to_place_id), {
                from: leg.from_name,
                minutes: Number(leg.time_min) || 0,
                distanceLabel: `${Number(leg.distance_km || 0).toFixed(Number(leg.distance_km || 0) < 10 ? 1 : 0)} km`,
                optimized: true
            });
        });
        return connections;
    }
    if (day && roadLegsByDay instanceof Map && roadLegSignatureByDay instanceof Map) {
        const currentSignature = getOrderSignature(getDayOrderIds(day));
        const storedSignature = roadLegSignatureByDay.get(day.id);
        const roadLegs = roadLegsByDay.get(day.id);
        if (currentSignature && storedSignature && currentSignature === storedSignature && roadLegs instanceof Map && roadLegs.size) {
            roadLegs.forEach((leg, toPlaceId) => {
                connections.set(String(toPlaceId), {
                    from: String(leg?.from_name || ''),
                    minutes: Number(leg?.time_min) || 0,
                    distanceLabel: `${Number(leg?.distance_km || 0).toFixed(Number(leg?.distance_km || 0) < 10 ? 1 : 0)} km`,
                    optimized: false
                });
            });
            if (connections.size) {
                return connections;
            }
        }
    }
    ordered.forEach((entry, index) => {
        if (index === 0) {
            return;
        }
        const previous = ordered[index - 1];
        const currentCoords = getPlaceLatLon(entry.item);
        const previousCoords = getPlaceLatLon(previous.item);
        const distanceKm = haversineMeters(previousCoords.lat, previousCoords.lon, currentCoords.lat, currentCoords.lon) / 1000;
        const minutes = Math.max(1, Math.round((distanceKm / OPTIMIZATION_SPEED_KMH) * 60));
        connections.set(entry.item.id, {
            from: previous.item.title,
            minutes,
            distanceLabel: `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`,
            optimized: false
        });
    });
    return connections;
}

function getPlaceLatLon(place) {
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

function haversineMeters(aLat, aLon, bLat, bLon) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const sLat = toRad(aLat);
    const eLat = toRad(bLat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(sLat) * Math.cos(eLat) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function getStableOptimizationKey(location) {
    const name = String(location?.name || '').trim().toLowerCase();
    const id = String(location?.id || '').trim().toLowerCase();
    return `${name}|${id}`;
}

function solveTspNearestNeighbor(locations, startLat, startLon) {
    const remaining = locations.map((entry) => ({ ...entry }));
    const ordered = [];
    let currentLat = Number(startLat);
    let currentLon = Number(startLon);
    if (!Number.isFinite(currentLat) || !Number.isFinite(currentLon)) {
        currentLat = Number(remaining[0]?.lat);
        currentLon = Number(remaining[0]?.lon);
    }
    while (remaining.length) {
        let bestIndex = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        let bestKey = '';
        for (let i = 0; i < remaining.length; i += 1) {
            const candidate = remaining[i];
            const dist = haversineMeters(currentLat, currentLon, candidate.lat, candidate.lon);
            const candidateKey = getStableOptimizationKey(candidate);
            if (dist < bestDist - 1e-6 || (Math.abs(dist - bestDist) <= 1e-6 && (!bestKey || candidateKey < bestKey))) {
                bestDist = dist;
                bestIndex = i;
                bestKey = candidateKey;
            }
        }
        const [picked] = remaining.splice(bestIndex, 1);
        ordered.push(picked);
        currentLat = picked.lat;
        currentLon = picked.lon;
    }
    return ordered;
}

function improveRoute2Opt(route) {
    const distanceAt = (list, i, j) => haversineMeters(list[i].lat, list[i].lon, list[j].lat, list[j].lon);
    const totalDistance = (list) => {
        let sum = 0;
        for (let i = 1; i < list.length; i += 1) {
            sum += distanceAt(list, i - 1, i);
        }
        return sum;
    };
    let best = route.slice();
    let bestDist = totalDistance(best);
    const maxPasses = 6;
    for (let pass = 0; pass < maxPasses; pass += 1) {
        let improved = false;
        for (let i = 1; i < best.length - 2; i += 1) {
            for (let k = i + 1; k < best.length - 1; k += 1) {
                const candidate = best.slice(0, i)
                    .concat(best.slice(i, k + 1).reverse())
                    .concat(best.slice(k + 1));
                const candDist = totalDistance(candidate);
                if (candDist + 1e-6 < bestDist) {
                    best = candidate;
                    bestDist = candDist;
                    improved = true;
                }
            }
        }
        if (!improved) {
            break;
        }
    }
    return best;
}

function reorderDayPlacesPreservingNonPlaceItems(day, orderedPlaceIds) {
    const items = Array.isArray(day?.items) ? day.items : [];
    const placeSlots = [];
    const placeById = new Map();
    items.forEach((item, index) => {
        if (!isNoteItem(item) && !isChecklistItem(item)) {
            placeSlots.push(index);
            placeById.set(String(item.id), item);
        }
    });
    if (placeSlots.length < 2) {
        return false;
    }
    const nextPlaces = [];
    (orderedPlaceIds || []).forEach((id) => {
        const place = placeById.get(String(id));
        if (place) {
            nextPlaces.push(place);
            placeById.delete(String(id));
        }
    });
    placeSlots.forEach((slotIndex) => {
        const original = items[slotIndex];
        if (placeById.has(String(original.id))) {
            nextPlaces.push(original);
            placeById.delete(String(original.id));
        }
    });
    const nextItems = items.slice();
    placeSlots.forEach((slotIndex, i) => {
        nextItems[slotIndex] = nextPlaces[i];
    });
    day.items = nextItems;
    return true;
}

function formatSigned(value, fractionDigits) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return '';
    }
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(fractionDigits)}`;
}

function computeRouteDistanceMeters(orderIds, coordsById) {
    const ids = Array.isArray(orderIds) ? orderIds : [];
    let total = 0;
    for (let i = 1; i < ids.length; i += 1) {
        const a = coordsById.get(String(ids[i - 1]));
        const b = coordsById.get(String(ids[i]));
        if (a && b) {
            total += haversineMeters(a.lat, a.lon, b.lat, b.lon);
        }
    }
    return total;
}

function getOptimizationDebugEnabled() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const queryFlag = params.get('debug');
        if (queryFlag === '1' || queryFlag === 'true') {
            return true;
        }
        const stored = window.localStorage.getItem('tripnest_debug_opt') || '';
        return stored === '1' || stored === 'true';
    } catch {
        return false;
    }
}

function safeJson(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '"<unserializable>"';
    }
}

async function fetchOptimizedOrderDetailed({ payload }) {
    const baseUrl = String(window.OPTIMIZE_ROUTE_BASE || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const explicitUrl = window.OPTIMIZE_ROUTE_URL ? String(window.OPTIMIZE_ROUTE_URL) : null;
    const candidateUrls = explicitUrl
        ? [explicitUrl]
        : [`${baseUrl}/v1/sequence/day`, `${baseUrl}/sequence/day`];
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    try {
        let last = null;
        for (const url of candidateUrls) {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            const status = response.status;
            const ok = response.ok;
            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }
            let order = null;
            if (ok && Array.isArray(data)) {
                order = data.map((id) => String(id));
            } else if (ok && Array.isArray(data?.order)) {
                order = data.order.map((id) => String(id));
            }
            last = { url, ok, status, order, data };
            if (order && order.length) {
                return { ...last, error: null };
            }
            if (status !== 404 && ok) {
                return { ...last, error: null };
            }
        }
        if (last) {
            return { ...last, error: last.ok ? null : `http_${last.status || 'error'}` };
        }
        return { url: candidateUrls[0], ok: false, status: null, order: null, data: null, error: 'network' };
    } catch (error) {
        const aborted = error && typeof error === 'object' && error.name === 'AbortError';
        return {
            url: candidateUrls[0],
            ok: false,
            status: null,
            order: null,
            data: null,
            error: aborted ? 'timeout' : 'network'
        };
    } finally {
        window.clearTimeout(timer);
    }
}

function renderOptimizationPreviewModal() {
    const preview = uiState.optimizationPreview;
    if (!preview || !preview.dayId) {
        return '';
    }
    const day = trip.days.find((entry) => entry.id === preview.dayId);
    const dayLabel = day ? (formatDayLabel(day.date) || day.label) : preview.dayId;
    const beforeKm = Number(preview.before?.totalKm) || 0;
    const afterKm = Number(preview.after?.totalKm) || 0;
    const beforeHours = Number(preview.before?.estimatedHours) || 0;
    const afterHours = Number(preview.after?.estimatedHours) || 0;
    const deltaKm = afterKm - beforeKm;
    const deltaMinutes = Math.round((afterHours - beforeHours) * 60);
    const better = deltaKm < -1e-6 || deltaMinutes < 0;
    const worse = deltaKm > 1e-6 || deltaMinutes > 0;
    const deltaClass = better ? 'is-better' : worse ? 'is-worse' : '';
    const moved = Array.isArray(preview.moved) ? preview.moved : [];
    const movedMarkup = moved.length
        ? `
            <ul class="OptimizationMovedList">
                ${moved.slice(0, 10).map((entry) => `
                    <li>
                        <span class="OptimizationMovedItemName">${escapeHtmlText(entry.name || entry.id)}</span>
                        <span class="OptimizationMovedItemShift">${Number(entry.from) + 1} → ${Number(entry.to) + 1}</span>
                    </li>
                `).join('')}
                ${moved.length > 10 ? `<li><span class="OptimizationMovedItemName">+${moved.length - 10} more</span><span class="OptimizationMovedItemShift"></span></li>` : ''}
            </ul>
        `
        : '<div class="PlannerEmptyState">No places changed position.</div>';
    const sourceLabel = preview.usedBackend
        ? 'Sequenced by backend'
        : 'Sequenced locally (fallback)';
    const applyDisabled = false;
    const fallbackUsed = Boolean(preview.fallbackUsed);
    const backendUsed = Boolean(preview.usedBackend);
    const beforeList = Array.isArray(preview.before?.orderIds) ? preview.before.orderIds : [];
    const afterList = Array.isArray(preview.after?.orderIds) ? preview.after.orderIds : [];
    const nameById = new Map((Array.isArray(preview.locations) ? preview.locations : []).map((loc) => [String(loc.id), String(loc.name || loc.id)]));
    const debugEnabled = Boolean(preview.debugEnabled);
    const requestJson = preview.requestPayload ? safeJson(preview.requestPayload) : '';
    const responseJson = preview.responsePayload ? safeJson(preview.responsePayload) : '';
    const summary = preview.summary || {};
    const estimatedCost = Number(summary.estimated_cost) || 0;
    const satisfactionScore = Number(summary.satisfaction_score) || 0;
    const constraintStatus = String(summary.constraint_status || (backendUsed ? 'passed' : 'passed_with_fallback'));
    const flagsMarkup = `
        <div class="OptimizationFlags">
            <span class="OptimizationFlag ${backendUsed ? 'is-yes' : 'is-no'}">Backend used: ${backendUsed ? 'YES' : 'NO'}</span>
            <span class="OptimizationFlag ${fallbackUsed ? 'is-yes' : 'is-no'}">Fallback used: ${fallbackUsed ? 'YES' : 'NO'}</span>
            <span class="OptimizationFlag">Source: ${escapeHtmlText(preview.source || sourceLabel)}</span>
            <span class="OptimizationFlag">Constraint: ${escapeHtmlText(constraintStatus)}</span>
            ${preview.endpointUrl ? `<span class="OptimizationFlag">Endpoint: ${escapeHtmlText(preview.endpointUrl)}</span>` : ''}
            ${preview.fallbackReason ? `<span class="OptimizationFlag">Fallback reason: ${escapeHtmlText(preview.fallbackReason)}</span>` : ''}
        </div>
    `;
    const ordersMarkup = `
        <div class="OptimizationOrders">
            <div class="OptimizationPreviewCard">
                <h4>Input order (before)</h4>
                <ol class="OptimizationOrderList">
                    ${beforeList.map((id) => `<li>${escapeHtmlText(nameById.get(String(id)) || id)}</li>`).join('')}
                </ol>
            </div>
            <div class="OptimizationPreviewCard">
                <h4>Optimized order (after)</h4>
                <ol class="OptimizationOrderList">
                    ${afterList.map((id) => `<li>${escapeHtmlText(nameById.get(String(id)) || id)}</li>`).join('')}
                </ol>
            </div>
        </div>
    `;
    return `
        <div class="PlannerModalOverlay" data-opt-preview-overlay="true">
            <div class="PlannerModal OptimizationPreview" role="dialog" aria-modal="true" aria-label="Optimization preview">
                <div class="PlannerModalHeader">
                    <div class="PlannerModalTitle">Optimization preview · ${escapeHtmlText(dayLabel)}</div>
                    <button type="button" class="PlannerModalClose" data-opt-preview-cancel="true" aria-label="Close">×</button>
                </div>
                <div class="PlannerModalBody">
                    <div class="OptimizationPreview__meta">
                        <div class="OptimizationPreview__source">${escapeHtmlText(sourceLabel)}</div>
                        <div class="OptimizationPreview__source">Speed: ${Number(preview.speedKmhUsed || 30)} km/h</div>
                    </div>
                    ${flagsMarkup}
                    <div class="OptimizationPreview__grid">
                        <div class="OptimizationPreviewCard">
                            <h4>Distance</h4>
                            <div class="OptimizationMetricRow">
                                <strong>${beforeKm.toFixed(1)} km</strong>
                                <span>Before</span>
                            </div>
                            <div class="OptimizationMetricRow" style="margin-top:6px;">
                                <strong>${afterKm.toFixed(1)} km</strong>
                                <span>After</span>
                            </div>
                            <div class="OptimizationDelta ${deltaClass}">
                                Δ ${formatSigned(deltaKm, 1)} km
                            </div>
                        </div>
                        <div class="OptimizationPreviewCard">
                            <h4>Estimated travel time</h4>
                            <div class="OptimizationMetricRow">
                                <strong>${Math.round(beforeHours * 60)} min</strong>
                                <span>Before</span>
                            </div>
                            <div class="OptimizationMetricRow" style="margin-top:6px;">
                                <strong>${Math.round(afterHours * 60)} min</strong>
                                <span>After</span>
                            </div>
                            <div class="OptimizationDelta ${deltaClass}">
                                Δ ${formatSigned(deltaMinutes, 0)} min
                            </div>
                        </div>
                        <div class="OptimizationPreviewCard">
                            <h4>Estimated cost</h4>
                            <div class="OptimizationMetricRow">
                                <strong>${formatCurrency(estimatedCost)}</strong>
                                <span>Day estimate</span>
                            </div>
                            <div class="OptimizationDelta">
                                Constraint: ${escapeHtmlText(constraintStatus)}
                            </div>
                        </div>
                        <div class="OptimizationPreviewCard">
                            <h4>Satisfaction score</h4>
                            <div class="OptimizationMetricRow">
                                <strong>${Math.round(satisfactionScore)}</strong>
                                <span>0-100</span>
                            </div>
                            <div class="OptimizationDelta ${backendUsed ? 'is-better' : ''}">
                                ${backendUsed ? 'Backend-informed order applied' : 'Fallback route sequencing used'}
                            </div>
                        </div>
                    </div>
                    ${ordersMarkup}
                    <div class="OptimizationPreviewCard" style="margin-top:12px;">
                        <h4>What changed</h4>
                        ${movedMarkup}
                        <div class="OptimizationReason">
                            ${escapeHtmlText(preview.reason || 'Places reordered to reduce travel distance using coordinate-based sequencing.')}
                        </div>
                    </div>
                    ${debugEnabled ? `
                        <div class="OptimizationPreviewCard OptimizationDebug" style="margin-top:12px;">
                            <h4>Developer observability</h4>
                            <details>
                                <summary>View request/response payloads</summary>
                                <div style="margin-top:8px; font-weight:700; font-size:12px;">Request payload</div>
                                <pre>${escapeHtmlText(requestJson)}</pre>
                                <div style="margin-top:10px; font-weight:700; font-size:12px;">Response payload</div>
                                <pre>${escapeHtmlText(responseJson)}</pre>
                                <div style="margin-top:10px; font-weight:700; font-size:12px;">Final ordering (after)</div>
                                <pre>${escapeHtmlText(safeJson(afterList))}</pre>
                            </details>
                        </div>
                    ` : ''}
                </div>
                <div class="PlannerModalFooter">
                    <div class="ExpenseModalActions">
                        <button type="button" class="PlannerTextButton" data-opt-preview-cancel="true">Cancel</button>
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-opt-preview-apply="true"${applyDisabled ? ' disabled' : ''}>Apply optimization</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function closeOptimizationPreview() {
    if (!uiState.optimizationPreview) {
        return;
    }
    uiState.optimizationPreview = null;
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function scheduleOptimizationHighlightClear() {
    if (uiState.optimizationHighlightTimer) {
        window.clearTimeout(uiState.optimizationHighlightTimer);
    }
    uiState.optimizationHighlightTimer = window.setTimeout(() => {
        uiState.optimizationHighlightTimer = null;
        uiState.optimizationHighlightIds = new Set();
        uiState.optimizationHighlightUntil = 0;
        uiState.optimizationShiftById = new Map();
        uiState.optimizationShiftUntil = 0;
        const scrollTop = plannerMain.scrollTop;
        renderPlanner();
        plannerMain.scrollTop = scrollTop;
    }, 2600);
}

function applyOptimizationPreview() {
    const preview = uiState.optimizationPreview;
    if (!preview || !preview.dayId) {
        return;
    }
    const day = trip.days.find((entry) => entry.id === preview.dayId);
    if (!day) {
        showToast('Unable to apply optimization: day not found');
        closeOptimizationPreview();
        return;
    }
    const orderedIds = Array.isArray(preview.after?.orderIds) ? preview.after.orderIds : [];
    if (orderedIds.length < 2) {
        showToast('Nothing to optimize');
        closeOptimizationPreview();
        return;
    }
    const currentOrderIds = getDayOrderIds(day);
    const orderChanged = getOrderSignature(currentOrderIds) !== getOrderSignature(orderedIds);
    if (orderChanged) {
        saveState();
        const changed = reorderDayPlacesPreservingNonPlaceItems(day, orderedIds);
        if (!changed) {
            historyStack.pop();
            showToast('Nothing to optimize');
            closeOptimizationPreview();
            return;
        }
    }
    trip.map.selectedPlaceId = orderedIds[0] || trip.map.selectedPlaceId || null;
    const beforeKm = Number(preview.before?.totalKm) || 0;
    const afterKm = Number(preview.after?.totalKm) || 0;
    const beforeHours = Number(preview.before?.estimatedHours) || 0;
    const afterHours = Number(preview.after?.estimatedHours) || 0;
    const appliedSummary = normalizeAppliedOptimizationSummary(
        preview.summary || buildOptimizationSummary({
            beforeKm,
            afterKm,
            beforeHours,
            afterHours,
            estimatedCost: 0,
            backendUsed: Boolean(preview.usedBackend),
            fallbackUsed: Boolean(preview.fallbackUsed),
            constraintStatus: preview?.summary?.constraint_status || 'passed'
        })
    );
    appliedSummary.fallback_reason = preview.fallbackReason || '';
    const savedKm = Number(appliedSummary.distance_saved_km) || 0;
    const savedMinutes = Number(appliedSummary.time_saved_min) || 0;
    uiState.optimizedDays.set(preview.dayId, {
        deltaKm: savedKm,
        deltaMinutes: savedMinutes,
        ts: Date.now(),
        summary: appliedSummary,
        legs: Array.isArray(preview.legs) ? preview.legs : [],
        orderIds: orderedIds.map((id) => String(id)),
        backendUsed: Boolean(preview.usedBackend),
        fallbackUsed: Boolean(preview.fallbackUsed),
        speedKmhUsed: Number(preview.speedKmhUsed) || OPTIMIZATION_SPEED_KMH
    });
    const moved = Array.isArray(preview.moved) ? preview.moved : [];
    uiState.optimizationHighlightIds = new Set(moved.map((entry) => entry.id).filter(Boolean));
    uiState.optimizationHighlightUntil = Date.now() + 2500;
    uiState.optimizationShiftById = new Map(moved.map((entry) => [String(entry.id), { from: entry.from, to: entry.to }]));
    uiState.optimizationShiftUntil = Date.now() + 2500;
    uiState.optimizationPreview = null;
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
    scheduleOptimizationHighlightClear();
    if (orderChanged) {
        showToast(`Applied optimization (${savedKm.toFixed(1)} km saved, ${Math.round(savedMinutes)} min saved)`, `section-${preview.dayId}`);
    } else {
        showToast('Optimization applied. No place order changed.', `section-${preview.dayId}`);
    }
}

async function optimizeRouteForDay(dayId) {
    const day = trip.days.find((entry) => entry.id === dayId);
    if (!day) {
        showToast('Unable to optimize: day not found');
        return;
    }
    const places = (day.items || []).filter((item) => !isNoteItem(item) && !isChecklistItem(item));
    if (places.length < 2) {
        showToast('Add at least 2 places to optimize');
        return;
    }
    const previousOrderIds = places.map((place) => String(place.id));
    const previousOrderNames = places.map((place) => place.title);
    const locations = places.map((place) => {
        const coords = getPlaceLatLon(place);
        return {
            id: String(place.id),
            name: place.title,
            lat: coords.lat,
            lon: coords.lon
        };
    });
    const invalidLocation = locations.find((loc) => !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon));
    if (invalidLocation) {
        showToast(`Unable to optimize: ${invalidLocation.name || invalidLocation.id} does not have usable coordinates`);
        return;
    }
    const start = locations[0];
    const requestPayload = {
        dayId,
        start: { lat: start?.lat, lon: start?.lon },
        options: { speedKmh: OPTIMIZATION_SPEED_KMH, returnToStart: false, roadAware: true },
        locations
    };
    const backendResult = await fetchOptimizedOrderDetailed({ payload: requestPayload });
    const backendOrder = Array.isArray(backendResult?.order) ? backendResult.order : null;
    const fallbackUsed = !(backendOrder && backendOrder.length);
    const fallbackReason = fallbackUsed
        ? backendResult?.error
            ? backendResult.error
            : backendResult && backendResult.ok === false
                ? `http_${backendResult.status || 'error'}`
                : 'no_order_returned'
        : null;
    if (fallbackUsed && Number(backendResult?.status) === 404) {
        showToast('Backend route optimization endpoint not found (404). Start the correct backend on port 8000.');
    }
    const orderedIds = backendOrder && backendOrder.length
        ? backendOrder
        : improveRoute2Opt(solveTspNearestNeighbor(locations, start?.lat, start?.lon)).map((loc) => loc.id);

    const seen = new Set();
    const finalOrderedIds = [];
    orderedIds.forEach((id) => {
        const key = String(id);
        if (!seen.has(key)) {
            seen.add(key);
            finalOrderedIds.push(key);
        }
    });
    previousOrderIds.forEach((id) => {
        if (!seen.has(id)) {
            seen.add(id);
            finalOrderedIds.push(id);
        }
    });
    const coordsById = new Map(locations.map((loc) => [String(loc.id), loc]));
    const backendMetrics = backendResult?.data?.metrics || {};
    const speedKmhUsed = Number(backendMetrics?.speedKmhUsed) || OPTIMIZATION_SPEED_KMH;
    const beforeMeters = computeRouteDistanceMeters(previousOrderIds, coordsById);
    const afterMetersLocal = computeRouteDistanceMeters(finalOrderedIds, coordsById);
    const beforeKmLocal = beforeMeters / 1000;
    const beforeHoursLocal = beforeKmLocal / speedKmhUsed;
    const backendBeforeKm = Number(backendMetrics?.beforeDistanceKm);
    const backendAfterKm = Number(backendMetrics?.totalDistanceKm);
    const backendBeforeHours = Number(backendMetrics?.beforeTravelTimeHours);
    const backendAfterHours = Number(backendMetrics?.estimatedTravelTimeHours);
    const beforeKm = Number.isFinite(backendBeforeKm) && !fallbackUsed ? backendBeforeKm : beforeKmLocal;
    const afterKm = Number.isFinite(backendAfterKm) && !fallbackUsed ? backendAfterKm : (afterMetersLocal / 1000);
    const beforeHours = Number.isFinite(backendBeforeHours) && !fallbackUsed ? backendBeforeHours : beforeHoursLocal;
    const afterHours = Number.isFinite(backendAfterHours) && !fallbackUsed ? backendAfterHours : (afterKm / speedKmhUsed);
    const newOrderNames = finalOrderedIds.map((id) => coordsById.get(id)?.name || id);
    const namesById = new Map(locations.map((loc) => [String(loc.id), String(loc.name || loc.id)]));
    const backendLegs = normalizeBackendLegs(backendResult?.data?.legs);
    const legs = backendLegs.length && !fallbackUsed
        ? backendLegs
        : buildLegsFromOrderIds(finalOrderedIds, coordsById, speedKmhUsed, namesById);
    const estimatedCost = getDayBudgetEstimate(day);
    const constraintStatus = finalOrderedIds.length === previousOrderIds.length
        ? (fallbackUsed ? 'passed_with_fallback' : 'passed')
        : 'partial';
    const summary = buildOptimizationSummary({
        beforeKm,
        afterKm,
        beforeHours,
        afterHours,
        estimatedCost,
        backendUsed: Boolean(backendOrder && backendOrder.length),
        fallbackUsed,
        constraintStatus
    });
    const orderUnchanged = previousOrderIds.length === finalOrderedIds.length
        && previousOrderIds.every((id, index) => id === finalOrderedIds[index]);
    console.log('[OptimizeRoute] Previous order:', previousOrderNames);
    console.log('[OptimizeRoute] New order:', newOrderNames);
    console.log('[OptimizeRoute] Total distance before (km):', Number(beforeKm.toFixed(2)));
    console.log('[OptimizeRoute] Total distance after (km):', Number(afterKm.toFixed(2)));
    console.log('[OptimizeRoute] Estimated time before (hours):', Number(beforeHours.toFixed(2)));
    console.log('[OptimizeRoute] Estimated time after (hours):', Number(afterHours.toFixed(2)));
    console.log('[OptimizeRoute] Backend used:', Boolean(backendOrder && backendOrder.length));
    console.log('[OptimizeRoute] Fallback used:', fallbackUsed);
    if (fallbackUsed) {
        console.log('[OptimizeRoute] Fallback reason:', fallbackReason);
    }
    if (getOptimizationDebugEnabled()) {
        console.log('[OptimizeRoute] Request payload:', requestPayload);
        console.log('[OptimizeRoute] Backend response:', backendResult);
        console.log('[OptimizeRoute] Final ordered ids:', finalOrderedIds);
    }

    const oldIndexById = new Map(previousOrderIds.map((id, index) => [id, index]));
    const newIndexById = new Map(finalOrderedIds.map((id, index) => [id, index]));
    const moved = finalOrderedIds
        .map((id) => {
            const from = oldIndexById.get(id);
            const to = newIndexById.get(id);
            return {
                id,
                name: coordsById.get(id)?.name || id,
                from: Number.isFinite(from) ? from : -1,
                to: Number.isFinite(to) ? to : -1
            };
        })
        .filter((entry) => entry.from >= 0 && entry.to >= 0 && entry.from !== entry.to);

    uiState.optimizationPreview = {
        dayId,
        before: { orderIds: previousOrderIds, totalKm: beforeKm, estimatedHours: beforeHours },
        after: { orderIds: finalOrderedIds, totalKm: afterKm, estimatedHours: afterHours },
        moved,
        usedBackend: Boolean(backendOrder && backendOrder.length),
        fallbackUsed,
        fallbackReason,
        source: fallbackUsed ? 'local_fallback' : String(backendResult?.data?.truth?.source || 'backend_sequencing'),
        endpointUrl: backendResult?.url || '',
        requestPayload,
        responsePayload: backendResult,
        debugEnabled: getOptimizationDebugEnabled(),
        locations: locations.map((loc) => ({ id: String(loc.id), name: String(loc.name || loc.id) })),
        speedKmhUsed,
        reason: fallbackUsed
            ? 'Backend sequencing was unavailable, so a safe local nearest-neighbor fallback was used.'
            : 'Backend nearest-neighbor sequencing optimized the selected day order.',
        orderUnchanged,
        summary,
        legs
    };
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
}

function getContainer(type, id) {
    if (type === 'pool') {
        return trip.placesPool;
    }
    if (type === 'custom') {
        return trip.customLists.find((list) => list.id === id)?.items || [];
    }
    if (type === 'day') {
        return trip.days.find((day) => day.id === id)?.items || [];
    }
    return [];
}

function removePlaceFromSource(placeId, sourceType, sourceId) {
    const container = getContainer(sourceType, sourceId);
    const index = container.findIndex((item) => item.id === placeId);
    if (index === -1) {
        return null;
    }
    const [place] = container.splice(index, 1);
    return place;
}

function insertPlaceIntoContainer(place, targetType, targetId, targetIndex) {
    const container = getContainer(targetType, targetId);
    const index = Number.isFinite(targetIndex) ? targetIndex : container.length;
    container.splice(index, 0, place);
}

function applyMove({ placeId, fromType, fromId, toType, toId, targetIndex }) {
    const sourceLocation = findPlaceLocationById(placeId);
    if (!sourceLocation) {
        return null;
    }
    const sourceContainer = getContainer(sourceLocation.type, sourceLocation.id);
    const [place] = sourceContainer.splice(sourceLocation.index, 1);
    if (sourceLocation.type === toType && sourceLocation.id === toId) {
        const nextIndex = sourceLocation.index < targetIndex ? targetIndex - 1 : targetIndex;
        sourceContainer.splice(nextIndex, 0, place);
    } else {
        insertPlaceIntoContainer(place, toType, toId, targetIndex);
    }
    return place;
}

function movePlace({ placeId, fromType, fromId, toType, toId, targetIndex }) {
    saveState();
    const place = applyMove({ placeId, fromType, fromId, toType, toId, targetIndex });
    if (!place) {
        historyStack.pop();
        return;
    }
    if (!isNoteItem(place)) {
        trip.map.selectedPlaceId = place.id;
    }
    logTripState();
    renderPlanner();
    showToast('Moved 1 place', getSectionTargetForContainer(toType, toId));
}

function moveItem({ itemId, toType, toId, targetIndex }) {
    saveState();
    const item = applyMove({ placeId: itemId, fromType: '', fromId: '', toType, toId, targetIndex });
    if (!item) {
        historyStack.pop();
        return;
    }
    if (!isNoteItem(item)) {
        trip.map.selectedPlaceId = item.id;
    }
    renderPlanner();
    showToast('Moved 1 item', getSectionTargetForContainer(toType, toId));
}

function removePlaceById(placeId) {
    const location = findPlaceLocationById(placeId);
    if (!location) {
        return null;
    }
    const container = getContainer(location.type, location.id);
    const index = container.findIndex((item) => item.id === placeId);
    if (index === -1) {
        return null;
    }
    container.splice(index, 1);
    return location;
}

function deletePlace(placeId) {
    const location = findPlaceLocationById(placeId);
    if (!location) {
        return;
    }
    saveState();
    const container = getContainer(location.type, location.id);
    const [removed] = container.splice(location.index, 1);
    if (!removed) {
        historyStack.pop();
        return;
    }
    uiState.selectedItems = (uiState.selectedItems || []).filter((id) => id !== placeId);
    if (trip.map.selectedPlaceId === placeId) {
        trip.map.selectedPlaceId = null;
    }
    renderPlanner();
    const label = isNoteItem(removed) ? 'note' : 'place';
    showToast(`Deleted 1 ${label}`, getSectionTargetForContainer(location.type, location.id));
}

function bulkDeleteSelectedPlaces() {
    const ids = getSelectedPlaceIdsInOrder();
    if (!ids.length) {
        return;
    }
    saveState();
    let lastLocation = null;
    ids.forEach((itemId) => {
        const location = removePlaceById(itemId);
        if (location) {
            lastLocation = location;
        }
    });
    const selectedIds = new Set(ids);
    if (trip.map.selectedPlaceId && selectedIds.has(trip.map.selectedPlaceId)) {
        trip.map.selectedPlaceId = null;
    }
    if (uiState.activePlaceId && selectedIds.has(uiState.activePlaceId)) {
        uiState.activePlaceId = null;
    }
    clearSelection();
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
    showToast(`Deleted ${ids.length} item${ids.length === 1 ? '' : 's'}`, lastLocation ? getSectionTargetForContainer(lastLocation.type, lastLocation.id) : null);
}

function bulkMoveSelectedPlaces(destination) {
    const parsed = parseDestination(destination);
    if (!parsed) {
        return;
    }
    const ids = getSelectedPlaceIdsInOrder();
    if (!ids.length) {
        return;
    }
    saveState();
    let targetIndex = getContainer(parsed.type, parsed.id).length;
    ids.forEach((itemId) => {
        const location = findPlaceLocationById(itemId);
        if (!location) {
            return;
        }
        applyMove({
            placeId: itemId,
            fromType: location.type,
            fromId: location.id,
            toType: parsed.type,
            toId: parsed.id,
            targetIndex
        });
        targetIndex += 1;
    });
    clearSelection();
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
    showToast(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'}`, getSectionTargetForContainer(parsed.type, parsed.id));
}

function duplicatePlaceInstance(place) {
    const copy = cloneData(place);
    const key = isNoteItem(copy) ? 'note' : (copy.catalogId || 'custom');
    copy.id = makeInstanceId(key);
    return copy;
}

function bulkCopySelectedPlaces(destination) {
    const parsed = parseDestination(destination);
    if (!parsed) {
        return;
    }
    const ids = getSelectedPlaceIdsInOrder();
    if (!ids.length) {
        return;
    }
    saveState();
    let targetIndex = getContainer(parsed.type, parsed.id).length;
    ids.forEach((placeId) => {
        const location = findPlaceLocationById(placeId);
        if (!location) {
            return;
        }
        const copy = duplicatePlaceInstance(location.place);
        insertPlaceIntoContainer(copy, parsed.type, parsed.id, targetIndex);
        targetIndex += 1;
    });
    clearSelection();
    const scrollTop = plannerMain.scrollTop;
    renderPlanner();
    plannerMain.scrollTop = scrollTop;
    showToast(`Copied ${ids.length} item${ids.length === 1 ? '' : 's'}`, getSectionTargetForContainer(parsed.type, parsed.id));
}

function getSectionTargetForContainer(type, id) {
    if (type === 'pool') {
        return 'section-pool';
    }
    if (type === 'custom') {
        return `section-custom-${id}`;
    }
    if (type === 'day') {
        return `section-${id}`;
    }
    return 'section-overview';
}

function showToast(message, targetId) {
    uiState.pendingToastTarget = targetId || null;
    plannerToast.innerHTML = `
        <span>${message}</span>
        ${targetId ? '<button type="button" class="PlannerToast__button" data-toast-go="true">Go there</button>' : ''}
    `;
    plannerToast.classList.add('is-visible');
    window.clearTimeout(showToast.hideTimer);
    showToast.hideTimer = window.setTimeout(() => {
        plannerToast.classList.remove('is-visible');
        uiState.pendingToastTarget = null;
    }, 2800);
}

function hideToast() {
    plannerToast.classList.remove('is-visible');
    uiState.pendingToastTarget = null;
}

function scrollToSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) {
        return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('PlannerSection--focus');
    window.setTimeout(() => target.classList.remove('PlannerSection--focus'), 1200);
}

function formatCurrency(value) {
    return `${trip.budget.currency} ${value.toLocaleString()}.00`;
}

function getSelectedPlace() {
    const ordered = flattenItineraryPlaces();
    const poolPlace = trip.placesPool.find((item) => !isNoteItem(item) && !isChecklistItem(item)) || null;
    return ordered.find(({ item }) => item.id === trip.map.selectedPlaceId)?.item || ordered[0]?.item || poolPlace;
}

function renderSidebar() {
    const items = getSidebarItems();
    plannerSidebar.innerHTML = items.map((item) => {
        const active = uiState.activeSidebarId === item.id ? ' is-active' : '';
        const children = item.children ? item.children.map((child) => `
            <button type="button" class="PlannerSidebar__child${uiState.activeSidebarId === child.id ? ' is-active' : ''}" data-scroll-target="${child.id}">${child.label}</button>
        `).join('') : '';
        return `
            <div class="PlannerSidebar__group">
                <button type="button" class="PlannerSidebar__item${active}" data-scroll-target="${item.id}">${item.label}</button>
                ${children}
            </div>
        `;
    }).join('') + `
        <div class="PlannerSidebar__footer">
            <button type="button" class="PlannerSidebar__support" data-collapse-all="true">Collapse all sections</button>
            <button type="button" class="PlannerSidebar__support">Support</button>
            <button type="button" class="PlannerSidebar__support">Hide sidebar</button>
        </div>
    `;
}

function renderExploreCards() {
    return suggestionOrder.map((id) => {
        const place = placeCatalog[id];
        return `
            <article class="PlannerExploreCard">
                <img src="${place.image}" alt="${place.title}">
                <div class="PlannerExploreCard__body">
                    <div>
                        <h3>${place.title}</h3>
                        <p>${place.note}</p>
                    </div>
                    <button type="button" class="PlannerAddButton" data-add-suggestion="${place.id}">Add to trip</button>
                </div>
            </article>
        `;
    }).join('');
}

function renderInsertZoneForContainer(containerType, containerId, index) {
    const active = uiState.activeInsertMenu;
    const isOpen = Boolean(
        active
        && (
            (active.containerType && active.containerId)
                ? (active.containerType === containerType && active.containerId === containerId)
                : (containerType === 'day' && active.dayId === containerId)
        )
        && active.index === index
    );
    const dayAttr = containerType === 'day' ? ` data-day-id="${containerId}"` : '';
    return `
        <div class="InsertZone${isOpen ? ' is-open' : ''}" data-container-type="${containerType}" data-container-id="${containerId}" data-index="${index}"${dayAttr}>
            <div class="InsertLine"></div>
            <button type="button" class="InsertBtn">+</button>
            ${isOpen ? `
                <div class="InsertMenu">
                    <div data-action="add-place">📍 Add a place</div>
                    <div data-action="add-note">📝 Add a note</div>
                    <div data-action="add-checklist">✔ Add a checklist</div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderInsertZone(dayId, index) {
    return renderInsertZoneForContainer('day', dayId, index);
}

function escapeHtmlText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function escapeHtmlAttr(value) {
    return escapeHtmlText(value)
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderNoteCard(noteItem, type, id, isSelected) {
    const content = escapeHtmlText(noteItem.content);
    return `
        <article class="PlannerPlaceCard PlannerNoteCard${isSelected ? ' is-selected' : ''}" draggable="true" data-item-id="${noteItem.id}" data-note-id="${noteItem.id}" data-source-type="${type}" data-source-id="${id}">
            <div class="PlannerPlaceCard__row">
                <input type="checkbox" class="PlannerSelectCheckbox PlannerNoteCheckbox" data-select-item-id="${noteItem.id}" ${isSelected ? 'checked' : ''} aria-label="Select item">
                <div class="PlannerPlaceCard__marker PlannerNoteCard__marker">📝</div>
                <div class="PlannerPlaceCard__body">
                    <div class="PlannerPlaceCard__content PlannerNoteCard__content">
                        <div class="PlannerPlaceCard__text">
                            <textarea class="PlannerNoteInput" rows="2" data-note-input="${noteItem.id}" placeholder="Write a note...">${content}</textarea>
                        </div>
                        <div class="PlannerPlaceCard__actions">
                            <button type="button" class="PlannerDeleteButton" data-delete-id="${noteItem.id}">🗑</button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderChecklistCard(checklistItem, type, id, isSelected) {
    const title = escapeHtmlAttr(checklistItem.title);
    const rows = Array.isArray(checklistItem.items) ? checklistItem.items : [];
    const rowsMarkup = rows.map((row) => {
        const text = escapeHtmlAttr(row.text);
        const checked = Boolean(row.checked);
        return `
            <div class="PlannerChecklistRow${checked ? ' is-checked' : ''}" data-checklist-row="${row.id}">
                <input type="checkbox" class="PlannerChecklistRowCheckbox" data-checklist-row-toggle="${checklistItem.id}" data-checklist-row-id="${row.id}" ${checked ? 'checked' : ''} aria-label="Toggle checklist item">
                <input type="text" class="PlannerChecklistRowInput" data-checklist-row-input="${checklistItem.id}" data-checklist-row-id="${row.id}" value="${text}" placeholder="List item">
                <button type="button" class="PlannerChecklistRowDelete" data-checklist-row-delete="${checklistItem.id}" data-checklist-row-id="${row.id}" aria-label="Delete checklist item">❌</button>
            </div>
        `;
    }).join('');
    return `
        <article class="PlannerPlaceCard PlannerChecklistCard${isSelected ? ' is-selected' : ''}" draggable="true" data-item-id="${checklistItem.id}" data-checklist-id="${checklistItem.id}" data-source-type="${type}" data-source-id="${id}">
            <div class="PlannerPlaceCard__row">
                <input type="checkbox" class="PlannerSelectCheckbox PlannerChecklistCheckbox" data-select-item-id="${checklistItem.id}" ${isSelected ? 'checked' : ''} aria-label="Select item">
                <div class="PlannerPlaceCard__marker PlannerChecklistCard__marker">✔</div>
                <div class="PlannerPlaceCard__body">
                    <div class="PlannerPlaceCard__content PlannerChecklistCard__content">
                        <div class="PlannerPlaceCard__text">
                            <input type="text" class="PlannerChecklistTitle" data-checklist-title="${checklistItem.id}" value="${title}" placeholder="Add title">
                            <div class="PlannerChecklistRows">
                                ${rowsMarkup}
                            </div>
                            <button type="button" class="PlannerChecklistAdd" data-checklist-add="${checklistItem.id}">Add some items</button>
                            <button type="button" class="PlannerChecklistPreset" data-ui-action="true">Pre-made lists</button>
                        </div>
                        <div class="PlannerPlaceCard__actions">
                            <button type="button" class="PlannerDeleteButton" data-delete-id="${checklistItem.id}">🗑</button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderDropzone(items, type, id) {
    const connections = type === 'day' ? getConnectionsMap(id) : new Map();
    const selectedItems = new Set(uiState.selectedItems || []);
    const highlightActive = Date.now() < (Number(uiState.optimizationHighlightUntil) || 0);
    const highlightIds = uiState.optimizationHighlightIds instanceof Set ? uiState.optimizationHighlightIds : new Set();
    const shiftActive = Date.now() < (Number(uiState.optimizationShiftUntil) || 0);
    const shiftById = uiState.optimizationShiftById instanceof Map ? uiState.optimizationShiftById : new Map();
    const cards = [];
    cards.push(`<div class="PlannerDropSlot" data-drop-type="${type}" data-drop-id="${id}" data-drop-index="0"></div>`);
    let placeOrdinal = 0;
    items.forEach((item, index) => {
        if (isNoteItem(item)) {
            cards.push(renderNoteCard(item, type, id, selectedItems.has(item.id)));
        } else if (isChecklistItem(item)) {
            cards.push(renderChecklistCard(item, type, id, selectedItems.has(item.id)));
        } else {
            placeOrdinal += 1;
            const connection = type === 'day' ? connections.get(item.id) : null;
            const selected = selectedItems.has(item.id);
            const highlighted = highlightActive && highlightIds.has(item.id);
            const shift = shiftActive ? shiftById.get(String(item.id)) : null;
            const shiftBadge = shift && Number.isFinite(shift.from) && Number.isFinite(shift.to)
                ? `<span class="OptimizationShiftBadge">${Number(shift.from) + 1} → ${Number(shift.to) + 1}</span>`
                : '';
            const isActive = uiState.activePlaceId === item.id;
            const isTimeEditing = uiState.timeEditor.placeId === item.id;
            const startValue = typeof item.startTime === 'string' && /^\d{2}:\d{2}$/.test(item.startTime) ? item.startTime : '';
            const endValue = typeof item.endTime === 'string' && /^\d{2}:\d{2}$/.test(item.endTime) ? item.endTime : '';
            const placeExpenses = (trip.expenses || []).filter((expense) => expense.placeId === item.id);
            const expenseTotal = placeExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
            const markerLabel = type === 'day' ? placeOrdinal : index + 1;
            cards.push(`
                <article class="PlannerPlaceCard${selected ? ' is-selected' : ''}${highlighted ? ' is-optimized-highlight' : ''}" draggable="true" data-item-id="${item.id}" data-place-id="${item.id}" data-source-type="${type}" data-source-id="${id}">
                    ${connection ? `<div class="PlannerConnectionRow${connection.optimized ? ' is-optimized' : ''}">${formatDurationMinutes(connection.minutes)} · ${connection.distanceLabel || connection.distance} · Directions from ${connection.from}</div>` : ''}
                    <div class="PlannerPlaceCard__row">
                        <input type="checkbox" class="PlannerSelectCheckbox" data-select-item-id="${item.id}" ${selected ? 'checked' : ''} aria-label="Select item">
                        <div class="PlannerPlaceCard__marker" style="background:${item.color}">${markerLabel}</div>
                        <div class="PlannerPlaceCard__body">
                            <div class="PlannerPlaceCard__content">
                                <div class="PlannerPlaceCard__text">
                                    <h4>${item.title}${shiftBadge}</h4>
                                    <p>${item.note}</p>
                                    ${(item.startTime || item.endTime || expenseTotal > 0) ? `
                                        <div class="PlaceMetaRow">
                                            ${item.startTime || item.endTime ? `<div class="PlaceTime">${formatTime12h(item.startTime)}${item.startTime && item.endTime ? ' - ' : ''}${formatTime12h(item.endTime)}</div>` : ''}
                                            ${expenseTotal > 0 ? `<div class="PlaceCost">💰 ${formatCurrency(expenseTotal)}</div>` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="PlannerPlaceCard__actions">
                                    <button type="button" class="PlannerDeleteButton" data-delete-id="${item.id}">🗑</button>
                                    <select class="PlannerMoveSelect" data-move-select="${item.id}" data-source-type="${type}" data-source-id="${id}">
                                        <option value="">Move to…</option>
                                        <option value="pool|pool">Places to visit</option>
                                        ${trip.customLists.map((list) => `<option value="custom|${list.id}">${list.name}</option>`).join('')}
                                        ${trip.days.map((day) => `<option value="day|${day.id}">${formatDayLabel(day.date) || day.shortLabel}</option>`).join('')}
                                    </select>
                                    <button type="button" class="PlannerMiniButton" data-open-map="${item.id}">Map</button>
                                </div>
                                <img src="${item.image}" alt="${item.title}">
                            </div>
                            ${isActive ? `
                            <div class="PlaceActions" data-place-actions="${item.id}">
                                ${item.visited ? `
                                <button type="button" class="PlaceActionLink" data-open-journal="${item.id}">See in journal</button>
                                <button type="button" class="PlaceActionLink" data-mark-not-visited="${item.id}">Mark as not visited</button>
                                ` : `
                                <button type="button" data-open-visit="${item.id}">✔ Mark as visited</button>
                                `}
                                <button type="button" data-open-time="${item.id}">⏰ Add time</button>
                                <button type="button" data-ui-action="true">📎 Attach</button>
                                <button type="button" data-open-expense="${item.id}">💲 Add cost</button>
                                ${isTimeEditing ? `
                                <div class="TimePopup" data-time-popup="${item.id}">
                                    <div class="TimeRow">
                                        <div class="TimeField">
                                            <div class="TimeLabel">Start time</div>
                                            <input type="time" data-time-start="${item.id}" value="${startValue}">
                                        </div>
                                        <div class="TimeSeparator">-</div>
                                        <div class="TimeField">
                                            <div class="TimeLabel">End time</div>
                                            <input type="time" data-time-end="${item.id}" value="${endValue}">
                                        </div>
                                    </div>
                                    <div class="TimePopup__actions">
                                        <button type="button" data-time-cancel="${item.id}">Cancel</button>
                                        <button type="button" data-time-save="${item.id}">Save</button>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </article>
            `);
        }
        const dropIndex = index + 1;
        const insertMarkup = (type === 'day' || type === 'pool') && dropIndex < items.length
            ? renderInsertZoneForContainer(type, id, dropIndex)
            : '';
        cards.push(`<div class="PlannerDropSlot" data-drop-type="${type}" data-drop-id="${id}" data-drop-index="${dropIndex}">${insertMarkup}</div>`);
    });
    return `
        <div class="PlannerDropzone" data-container-type="${type}" data-container-id="${id}">
            ${cards.join('')}
            ${items.length === 0 ? '<div class="PlannerEmptyState">Drop a place here or add one with the input above.</div>' : ''}
        </div>
    `;
}

function renderPoolSection() {
    const titleKey = 'pool';
    const defaultTitle = 'Places to visit';
    const sectionId = 'section-pool';
    const collapsed = isSectionCollapsed(sectionId);
    const editing = uiState.editingTitleKey === titleKey;
    const currentTitle = getSectionTitle(titleKey, defaultTitle);
    return `
        <section class="PlannerSection${collapsed ? ' is-collapsed' : ''}" id="${sectionId}">
            <div class="PlannerSection__header">
                <div class="PlannerSectionTitleRow">
                    <button type="button" class="PlannerCollapseToggle" data-collapse-toggle="${sectionId}" aria-label="${collapsed ? 'Expand section' : 'Collapse section'}">${collapsed ? '▶' : '▼'}</button>
                    <div class="PlannerTitleWrap" data-title-key="${titleKey}">
                        ${editing
        ? `<input type="text" class="PlannerTitleInput" data-title-input="${titleKey}" value="${currentTitle}">`
        : `<h2 class="PlannerTitleText" data-title-start="${titleKey}">${currentTitle}</h2><button type="button" class="PlannerTitleEdit" data-title-start="${titleKey}" aria-label="Rename">✎</button>`
    }
                    </div>
                    <p>Places added here stay in the pool until you move them into a day.</p>
                </div>
                ${renderSectionMenu('pool', sectionId)}
            </div>
            ${collapsed ? '' : `
            <div class="PlannerSection__body">
                <form class="PlannerAddRow" data-add-form="pool">
                    <input type="text" name="placeName" placeholder="Add a place">
                    <button type="submit" class="PlannerIconCircle">+</button>
                </form>
                ${renderDropzone(trip.placesPool, 'pool', 'pool')}
            </div>
            `}
            <button type="button" class="PlannerPillButton PlannerPillButton--light" data-new-list="true">+ New list</button>
        </section>
    `;
}

function renderCustomLists() {
    return trip.customLists.map((list) => {
        const sectionId = `section-custom-${list.id}`;
        const collapsed = isSectionCollapsed(sectionId);
        const editingKey = `custom:${list.id}`;
        const editing = uiState.editingTitleKey === editingKey;
        return `
        <section class="PlannerSection${collapsed ? ' is-collapsed' : ''}" id="${sectionId}">
            <div class="PlannerSection__header">
                <div class="PlannerSectionTitleRow">
                    <button type="button" class="PlannerCollapseToggle" data-collapse-toggle="${sectionId}" aria-label="${collapsed ? 'Expand section' : 'Collapse section'}">${collapsed ? '▶' : '▼'}</button>
                    <div class="PlannerTitleWrap" data-title-key="${editingKey}">
                        ${editing
        ? `<input type="text" class="PlannerTitleInput" data-list-title-input="${list.id}" value="${list.name}">`
        : `<h2 class="PlannerTitleText" data-list-title-start="${list.id}">${list.name}</h2><button type="button" class="PlannerTitleEdit" data-list-title-start="${list.id}" aria-label="Rename">✎</button>`
    }
                    </div>
                    <p>Custom lists are separate containers that do not auto-enter the itinerary.</p>
                </div>
                ${renderSectionMenu('custom', sectionId)}
            </div>
            ${collapsed ? '' : `
            <div class="PlannerSection__body">
                <form class="PlannerAddRow" data-add-form="custom" data-custom-id="${list.id}">
                    <input type="text" name="placeName" placeholder="Add a place">
                    <button type="submit" class="PlannerIconCircle">+</button>
                </form>
                ${renderDropzone(list.items, 'custom', list.id)}
            </div>
            `}
        </section>
        `;
    }).join('');
}

function renderDaySection(day) {
    const sectionId = `section-${day.id}`;
    const collapsed = isSectionCollapsed(sectionId);
    const dayLabel = formatDayLabel(day.date) || day.label;
    const optimizedInfo = getActiveDayOptimization(day);
    const optimizedChip = optimizedInfo
        ? `
            <span class="PlannerOptimizedChip" title="This day was optimized">
                Optimized
                <span class="PlannerOptimizedChip__delta">${Number(optimizedInfo?.summary?.distance_saved_km ?? optimizedInfo.deltaKm ?? 0).toFixed(1)} km</span>
            </span>
        `
        : '';
    const summary = optimizedInfo?.summary || null;
    const optimizedSummary = summary
        ? `
            <div class="OptimizationInlineSummary">
                <span class="OptimizationFlag ${summary.backend_used ? 'is-yes' : 'is-no'}">Backend: ${summary.backend_used ? 'YES' : 'NO'}</span>
                <span class="OptimizationFlag ${summary.fallback_used ? 'is-yes' : 'is-no'}">Fallback: ${summary.fallback_used ? 'YES' : 'NO'}</span>
                ${summary.fallback_used && summary.fallback_reason ? `<span class="OptimizationFlag">Reason: ${escapeHtmlText(summary.fallback_reason)}</span>` : ''}
                <span class="OptimizationFlag">Saved: ${Number(summary.distance_saved_km || 0).toFixed(1)} km</span>
                <span class="OptimizationFlag">Saved: ${Math.round(Number(summary.time_saved_min) || 0)} min</span>
                <span class="OptimizationFlag">Cost: ${formatCurrency(Number(summary.estimated_cost) || 0)}</span>
                <span class="OptimizationFlag">Score: ${Math.round(Number(summary.satisfaction_score) || 0)}</span>
                <span class="OptimizationFlag">Constraint: ${escapeHtmlText(summary.constraint_status || 'passed')}</span>
            </div>
        `
        : '';
    return `
        <section class="PlannerSection PlannerDaySection${collapsed ? ' is-collapsed' : ''}${allDaysCollapsed ? ' collapsed' : ''}" id="${sectionId}">
            <div class="PlannerSection__header">
                <div class="PlannerSectionTitleRow">
                    <button type="button" class="PlannerCollapseToggle" data-collapse-toggle="${sectionId}" aria-label="${collapsed ? 'Expand section' : 'Collapse section'}">${collapsed ? '▶' : '▼'}</button>
                    <div>
                    <h3>${dayLabel}</h3>
                    <p>Add subheading</p>
                    </div>
                </div>
                <div class="PlannerDaySection__tools">
                    <span>Auto-fill day</span>
                    <span data-optimize-day="${day.id}" role="button" tabindex="0">Optimize route</span>
                    ${optimizedChip}
                    <span class="PlannerProBadge">PRO</span>
                    ${renderDayMenu(day)}
                </div>
            </div>
            <div class="PlannerSection__body">
                ${optimizedSummary}
                <form class="PlannerAddRow" data-add-form="day" data-day-id="${day.id}">
                    <input type="text" name="placeName" placeholder="Add a place">
                    <button type="submit" class="PlannerIconCircle">+</button>
                </form>
                ${renderDropzone(day.items, 'day', day.id)}
                <div class="PlannerRecommendations">
                    <div class="PlannerRecommendations__label">Recommended places</div>
                    <div class="PlannerRecommendations__items">
                        ${suggestionOrder.map((placeId) => {
                            const place = placeCatalog[placeId];
                            return `
                                <button type="button" class="PlannerRecommendationChip" data-add-from-day-suggestion="${place.id}" data-target-day="${day.id}">
                                    <img src="${place.image}" alt="${place.title}">
                                    <span>${place.title}</span>
                                    <strong>+</strong>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderMain() {
    if (appMode === 'home') {
        plannerMain.innerHTML = renderHomeScreen();
        return;
    }
    const budgetTotal = calculateBudgetTotal();
    const budgetSpent = calculateTotalSpent();
    const budgetLimit = getBudgetValue();
    const budgetPercent = getBudgetProgress();
    const notesTitleKey = 'notes';
    const notesDefaultTitle = 'Notes';
    const notesSectionId = 'section-notes';
    const notesCollapsed = isSectionCollapsed(notesSectionId);
    const notesEditing = uiState.editingTitleKey === notesTitleKey;
    const notesTitle = getSectionTitle(notesTitleKey, notesDefaultTitle);
    plannerMain.innerHTML = `
        ${renderBulkActionBar()}
        <section class="PlannerSection PlannerSection--hero" id="section-overview">
            <div class="PlannerTripCard">
                <div class="PlannerTripCard__banner"></div>
                <div class="PlannerTripCard__content">
                    <div>
                        <h1>${trip.title}</h1>
                        <div class="PlannerTripCard__meta">${trip.dates}</div>
                        <button type="button" class="PlannerTextButton PlannerTripCard__prefs" data-trip-prefs-open="true">Trip preferences & questionnaire</button>
                    </div>
                    <div class="PlannerTripCard__avatars">
                        <img src="assets/images/profile-arslan.jpg" alt="Arslan Tahir">
                        <button type="button" class="PlannerIconCircle">+</button>
                    </div>
                </div>
            </div>
        </section>
        <section class="PlannerSection" id="section-explore">
            <div class="PlannerSection__header">
                <div>
                    <h2>Explore</h2>
                    <p>Add suggestions to the places pool first, then move them into a day.</p>
                </div>
                <div class="PlannerExploreActions">
                    <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-action="browse-all">Browse all</button>
                    <button type="button" class="PlannerPillButton PlannerPillButton--dark" data-engine-fetch="true">Get engine suggestions</button>
                    <button type="button" class="PlannerTextButton" data-trip-prefs-open="true">Trip preferences</button>
                </div>
            </div>
            <div class="PlannerExploreGrid">${renderExploreCards()}</div>
        </section>
        <section class="PlannerSection" id="section-reservations">
            <div class="PlannerReservations">
                <div class="PlannerReservationCard">
                    <h2>Reservations and attachments</h2>
                    <div class="PlannerReservationTabs">
                        <span>Flight</span>
                        <span>Lodging</span>
                        <span>Rental car</span>
                        <span>Restaurant</span>
                        <span>Attachment</span>
                        <span>Other</span>
                    </div>
                </div>
                <div class="PlannerBudgetCard">
                    <h3>Budgeting</h3>
                    <div class="PlannerBudgetCard__value">${formatCurrency(budgetTotal)}</div>
                    <button type="button" class="PlannerTextButton" data-scroll-target="section-budget">View details</button>
                </div>
            </div>
        </section>
        <section class="PlannerSection${notesCollapsed ? ' is-collapsed' : ''}" id="${notesSectionId}">
            <div class="PlannerSection__header">
                <div class="PlannerSectionTitleRow">
                    <button type="button" class="PlannerCollapseToggle" data-collapse-toggle="${notesSectionId}" aria-label="${notesCollapsed ? 'Expand section' : 'Collapse section'}">${notesCollapsed ? '▶' : '▼'}</button>
                    <div class="PlannerTitleWrap" data-title-key="${notesTitleKey}">
                        ${notesEditing
        ? `<input type="text" class="PlannerTitleInput" data-title-input="${notesTitleKey}" value="${notesTitle}">`
        : `<h2 class="PlannerTitleText" data-title-start="${notesTitleKey}">${notesTitle}</h2><button type="button" class="PlannerTitleEdit" data-title-start="${notesTitleKey}" aria-label="Rename">✎</button>`
    }
                    </div>
                    <p>Write or paste anything here: how to get around, tips and tricks.</p>
                </div>
                ${renderSectionMenu('notes', notesSectionId)}
            </div>
            ${notesCollapsed ? '' : `
            <div class="PlannerSection__body">
                <textarea class="PlannerNotesInput" id="plannerNotesInput" placeholder="Write or paste anything here">${trip.notes}</textarea>
            </div>
            `}
        </section>
        ${renderPoolSection()}
        ${renderCustomLists()}
        <section class="PlannerSection" id="section-itinerary">
            <div class="PlannerSection__header">
                <div>
                    <h2>Itinerary</h2>
                    <p>Days are ordered containers. Connections and markers update when their contents change.</p>
                </div>
                <div class="PlannerDatePill">${trip.dates}</div>
            </div>
            <div class="PlannerDayStack">
                        ${trip.days.map(renderDaySection).join('')}
            </div>
        </section>
        <section class="PlannerSection" id="section-budget">
            <div class="PlannerSection__header">
                <div>
                    <h2>Budget</h2>
                    <p>Separate from routing but synced with itinerary items.</p>
                </div>
            </div>
            <div class="PlannerBudgetPanel">
                <div class="PlannerBudgetPanel__total">${formatCurrency(budgetTotal)}</div>
                <div class="budget-bar">
                    <div class="budget-bar-fill" style="width: ${budgetPercent}%"></div>
                </div>
                <div class="budget-meta">
                    <span>${formatCurrency(budgetSpent)}</span>
                    <span>Budget: ${formatCurrency(budgetLimit)}</span>
                </div>
                <button type="button" class="PlannerTextButton" data-open-budget-modal="true">${budgetLimit > 0 ? 'Edit budget' : 'Set budget'}</button>
                <div class="PlannerBudgetPanel__sort">
                    <div class="PlannerBudgetPanel__sortLabel">Expenses</div>
                    <div class="PlannerBudgetPanel__sortControls">
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-add-expense="true">+ Add expense</button>
                    <select class="PlannerMoveSelect" data-expense-sort="true" aria-label="Sort expenses">
                        <option value="date_desc"${(uiState.expenseSort || 'date_desc') === 'date_desc' ? ' selected' : ''}>Date (newest first)</option>
                        <option value="date_asc"${uiState.expenseSort === 'date_asc' ? ' selected' : ''}>Date (oldest first)</option>
                        <option value="amount_desc"${uiState.expenseSort === 'amount_desc' ? ' selected' : ''}>Amount (highest first)</option>
                        <option value="amount_asc"${uiState.expenseSort === 'amount_asc' ? ' selected' : ''}>Amount (lowest first)</option>
                        <option value="category_asc"${uiState.expenseSort === 'category_asc' ? ' selected' : ''}>Category</option>
                    </select>
                    </div>
                </div>
                <div class="PlannerBudgetPanel__rows">
                    ${getSortedExpenses().map((expense) => {
                        const description = escapeHtmlText(expense.description || 'Expense');
                        const category = escapeHtmlText(expense.category || 'Other');
                        const dateLabel = escapeHtmlText(formatShortDayLabelValue(expense.date) || '');
                        const meta = [category, dateLabel].filter(Boolean).join(' · ');
                        const amount = formatCurrency(Number(expense.amount) || 0);
                        return `
                            <div class="PlannerBudgetPanel__row" data-expense-row="${expense.id}">
                                <button type="button" class="PlannerTextButton PlannerBudgetRowButton" data-expense-edit="${expense.id}">
                                    <span class="PlannerBudgetRowTitle">${description}</span>
                                    ${meta ? `<span class="PlannerBudgetRowMeta">${meta}</span>` : ''}
                                </button>
                                <span class="PlannerBudgetRowRight">
                                    <strong class="PlannerBudgetRowAmount">${amount}</strong>
                                    <button type="button" class="PlannerDeleteButton" data-expense-delete="${expense.id}" aria-label="Delete expense">🗑</button>
                                </span>
                            </div>
                        `;
                    }).join('') || '<div class="PlannerEmptyState">No expenses yet.</div>'}
                </div>
            </div>
        </section>
        ${renderArrangementModal()}
        ${renderExpenseModal()}
        ${renderBudgetModal()}
        ${renderVisitModal()}
        ${renderOptimizationPreviewModal()}
        ${renderChooseLocationModal()}
        ${renderJournalModal()}
        ${renderTripSettingsModal()}
        ${renderTripJournalOverviewModal()}
        ${renderTripPreferencesModal()}
        ${renderEngineSuggestionsModal()}
    `;
}

function renderHomeScreen() {
    return `
        <div class="HomeWrapper">
            <div class="HomeCard">
                <div class="HomeScreen">
                    <h2 class="HomeTitle">Plan your trip</h2>
                    <p class="HomeQuote">"Your journey begins here."</p>
                    <input type="text" id="trip-name" placeholder="Where to?" />
                    <div>
                        <input type="date" id="start-date" />
                        <input type="date" id="end-date" />
                    </div>
                    <button id="start-planning">Start Planning</button>
                    ${renderSavedTrips()}
                </div>
            </div>
        </div>
    `;
}

function renderHome() {
    plannerApp.classList.add('is-home');
    plannerSidebar.innerHTML = '';
    plannerMapPanel.innerHTML = '';
    plannerMain.innerHTML = renderHomeScreen();
}

let leafletMap = null;
let mapMarkers = new Map();
let mapTempMarker = null;
let mapInfoHost = null;
let mapSearchInput = null;
let mapSearchResults = null;
let mapPanelEventsBound = false;
let mapSearchDebounceTimer = null;
let tempMarkers = [];
let routeLines = [];
let markerMeta = new Map();
let roadLegsByDay = new Map();
let roadLegSignatureByDay = new Map();

const mapLayerState = {
    visibility: new Map()
};

const mapUi = {
    activePlace: null,
    activeTab: 'about',
    query: '',
    results: [],
    resultsOpen: false,
    hasUserInteracted: false,
    isExploreOpen: false,
    explorePhase: 'landing',
    exploreQuery: '',
    controls: {
        searchOpen: false,
        layersOpen: false
    },
    routesOn: false,
    selectedMarkerId: null,
    selectedMarkerKind: null,
    browse: {
        categoryKey: null,
        categoryLabel: '',
        results: [],
        selectedId: null
    }
};

function renderMapInfoPanel(place) {
    const title = escapeHtmlText(place?.title || 'Untitled place');
    const description = escapeHtmlText(place?.description || place?.note || '');
    const lat = Number(place?.lat);
    const lon = Number(place?.lon);
    const coordText = Number.isFinite(lat) && Number.isFinite(lon)
        ? `${lat.toFixed(6)}, ${lon.toFixed(6)}`
        : '';
    const tab = mapUi.activeTab;
    const aboutActive = tab === 'about' ? ' is-active' : '';
    const photosActive = tab === 'photos' ? ' is-active' : '';
    const reviewsActive = tab === 'reviews' ? ' is-active' : '';
    return `
        <div class="PlannerMapInfoPanel" role="dialog" aria-label="Place details">
            <div class="PlannerMapInfoPanel__tabs">
                <button type="button" class="${aboutActive.trim()}" data-map-tab="about">About</button>
                <button type="button" class="${photosActive.trim()}" data-map-tab="photos">Photos</button>
                <button type="button" class="${reviewsActive.trim()}" data-map-tab="reviews">Reviews</button>
            </div>
            <div class="PlannerMapInfoPanel__body">
                <div class="PlannerMapInfoPanel__header">
                    <div>
                        <h3>${title}</h3>
                        ${coordText ? `<div class="PlannerMapInfoPanel__meta">${coordText}</div>` : ''}
                    </div>
                    <button type="button" class="PlannerMapInfoPanel__close" data-map-close="true" aria-label="Close">✕</button>
                </div>
                ${tab === 'about'
        ? `
                    ${description ? `<div class="PlannerMapInfoPanel__desc">${description}</div>` : ''}
                    <div class="PlannerMapCard__actions">
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent" data-map-add-to-trip="true">Add to trip</button>
                    </div>
                `
        : `
                    <div class="PlannerEmptyState">UI only for now.</div>
                `}
            </div>
        </div>
    `;
}

function createCategoryMarkerIcon(isSelected) {
    if (typeof window.L === 'undefined') {
        return null;
    }
    return window.L.divIcon({
        className: `PlannerLeafletCategoryMarker${isSelected ? ' is-selected' : ''}`,
        html: '<div>•</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function renderExplorePanel() {
    const host = document.body;
    let drawer = document.getElementById('exploreDrawer');

    if (!mapUi.isExploreOpen) {
        if (drawer) {
            drawer.classList.add('hidden');
        }
        return;
    }

    if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'exploreDrawer';
        drawer.className = 'explore-drawer hidden';
        host.appendChild(drawer);
    }
    drawer.classList.remove('hidden');

    const phase = mapUi.explorePhase === 'results' ? 'results' : 'landing';
    const query = String(drawer.dataset.query || '').trim().toLowerCase();
    const allResults = Array.isArray(mapUi.browse?.results) ? mapUi.browse.results : [];
    const visibleResults = query
        ? allResults.filter((r) => String(r.title || '').toLowerCase().includes(query))
        : allResults;
    const placeTitle = escapeHtmlText((trip?.name || '').trim() || 'Explore');
    const multiCityStops = [
        { title: 'Islamabad', meta: 'Capital city' },
        { title: 'Murree', meta: 'Hill station' },
        { title: 'Taxila', meta: 'Historic ruins' },
        { title: 'Rawal Lake', meta: 'Scenic views' },
        { title: 'Khanpur Dam', meta: 'Day trip' }
    ];
    const topPlaces = (Array.isArray(mapUi.browse?.results) ? mapUi.browse.results : []).slice(0, 6);

    if (phase === 'landing') {
        drawer.innerHTML = `
            <div class="ExploreSidebar" role="dialog" aria-label="Explore panel">
                <button type="button" class="PlannerTextButton" data-explore-close="true">✕ Close</button>
                <div class="ExploreLandingHeader">
                    <h2>${placeTitle}</h2>
                    <div class="ExploreLandingDesc">Browse nearby places and guides.</div>
                </div>
                <div class="ExploreLandingQuick">
                    <button type="button" class="PlannerPillButton" data-explore-jump="categories">What to do</button>
                    <button type="button" class="PlannerPillButton" data-explore-jump="categories">Where to eat</button>
                    <button type="button" class="PlannerPillButton" data-explore-jump="hotels">Where to stay</button>
                </div>
                <div class="ExploreLandingSection">
                    <div class="ExploreLandingSectionTitle" id="exploreLandingCategories">Categories</div>
                    <div class="ExploreCategories ExploreLandingCategories">
                        <button type="button" data-explore-category="food">Restaurants</button>
                        <button type="button" data-explore-category="attractions">Attractions</button>
                        <button type="button" data-explore-category="food">Cafes</button>
                        <button type="button" data-explore-category="food">Cheap eats</button>
                        <button type="button" data-explore-category="food">Breakfast</button>
                        <button type="button" data-explore-category="food">Bakeries</button>
                        <button type="button" data-explore-category="attractions">Romantic places</button>
                        <button type="button" data-explore-category="food">Family restaurants</button>
                        <button type="button" data-explore-category="shopping">Shopping</button>
                    </div>
                </div>
                <div class="ExploreLandingSection" id="exploreLandingHotels">
                    <div class="ExploreLandingSectionTitle">Need a place to stay?</div>
                    <div class="ExploreLandingHotelBox">
                        <input type="text" placeholder="Where" value="">
                        <input type="text" placeholder="When" value="">
                        <button type="button" class="PlannerPillButton PlannerPillButton--accent">Search</button>
                    </div>
                </div>
                <div class="ExploreLandingSection">
                    <div class="ExploreLandingSectionTitle">Featured guides</div>
                    <div class="ExploreLandingGuides">
                        <div class="ExploreLandingGuideCard">
                            <div class="ExploreLandingGuideThumb"></div>
                            <div class="ExploreLandingGuideTitle">Best attractions</div>
                            <div class="ExploreLandingGuideMeta">Guide</div>
                        </div>
                        <div class="ExploreLandingGuideCard">
                            <div class="ExploreLandingGuideThumb"></div>
                            <div class="ExploreLandingGuideTitle">Popular food</div>
                            <div class="ExploreLandingGuideMeta">Guide</div>
                        </div>
                        <div class="ExploreLandingGuideCard">
                            <div class="ExploreLandingGuideThumb"></div>
                            <div class="ExploreLandingGuideTitle">Hidden gems</div>
                            <div class="ExploreLandingGuideMeta">Guide</div>
                        </div>
                    </div>
                </div>
                <div class="ExploreLandingSection">
                    <div class="ExploreLandingSectionTitle">Multi-city stops</div>
                    <div class="ExploreLandingStops">
                        ${multiCityStops.map((stop) => `
                            <div class="ExploreLandingStopCard" role="button" tabindex="0">
                                <div class="ExploreLandingStopThumb"></div>
                                <div class="ExploreLandingStopTitle">${escapeHtmlText(stop.title)}</div>
                                <div class="ExploreLandingStopMeta">${escapeHtmlText(stop.meta)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="ExploreLandingSection">
                    <div class="ExploreLandingSectionTitle">Top places to visit</div>
                    <div class="ExploreLandingTopPlaces">
                        ${topPlaces.length === 0
                            ? `<div class="PlannerEmptyState">Pick a category above to populate top places.</div>`
                            : topPlaces.map((place) => {
                                const title = escapeHtmlText(place.title || 'Place');
                                const desc = escapeHtmlText(place.description || '');
                                const distanceKm = Number.isFinite(place.distanceMeters) ? (place.distanceMeters / 1000) : null;
                                const distanceText = distanceKm === null ? '' : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
                                return `
                                    <div class="ExploreLandingTopPlace">
                                        <div class="ExploreLandingTopPlace__header">
                                            <div class="ExploreLandingTopPlace__title">${title}</div>
                                            <button type="button" class="PlannerPillButton PlannerPillButton--accent">Add to trip</button>
                                        </div>
                                        <div class="ExploreLandingTopPlace__meta">
                                            <span class="ExploreLandingTopPlace__stars">★★★★★</span>
                                            <span class="ExploreLandingTopPlace__dot">·</span>
                                            <span>${distanceText || 'Nearby'}</span>
                                        </div>
                                        ${desc ? `<div class="ExploreLandingTopPlace__desc">${desc}</div>` : ''}
                                    </div>
                                `;
                            }).join('')}
                    </div>
                </div>
            </div>
        `;
        return;
    }

    drawer.innerHTML = `
            <div class="ExploreSidebar" role="dialog" aria-label="Explore panel">
                <div class="ExploreResultsHeader">
                    <button type="button" class="PlannerTextButton" data-explore-phase="landing">← Back</button>
                    <button type="button" class="PlannerTextButton" data-explore-close="true">✕ Close</button>
                </div>
                <h2>${placeTitle}</h2>
                <input type="text" placeholder="Search results" value="${escapeHtmlAttr(drawer.dataset.query || '')}" data-explore-search="true">
                <div class="ExploreCategories">
                    <button type="button" data-explore-category="food">Food</button>
                    <button type="button" data-explore-category="attractions">Attractions</button>
                    <button type="button" data-explore-category="shopping">Shopping</button>
                </div>
                <div class="PlannerExploreDrawer__results">
                    ${visibleResults.length === 0
                        ? `<div class="PlannerEmptyState">No results yet. Choose a category.</div>`
                        : visibleResults.map((result) => {
                            const selected = mapUi.browse.selectedId === result.id ? ' is-selected' : '';
                            const title = escapeHtmlText(result.title || 'Place');
                            const desc = escapeHtmlText(result.description || '');
                            const distanceKm = Number.isFinite(result.distanceMeters) ? (result.distanceMeters / 1000) : null;
                            const distanceText = distanceKm === null ? '' : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
                            return `
                                <button type="button" class="PlannerMapBrowseItem${selected}" data-explore-item="${escapeHtmlAttr(result.id)}">
                                    <div class="PlannerMapBrowseItem__row">
                                        <strong>${title}</strong>
                                        ${distanceText ? `<span>${distanceText}</span>` : ''}
                                    </div>
                                    ${desc ? `<div class="PlannerMapBrowseItem__desc">${desc}</div>` : ''}
                                </button>
                            `;
                        }).join('')}
                </div>
            </div>
        `;
}

function openExplorePanel() {
    mapUi.isExploreOpen = true;
    mapUi.explorePhase = 'landing';
    const drawer = document.getElementById('exploreDrawer');
    if (drawer) {
        drawer.dataset.query = '';
    }
    renderExplorePanel();
}

function selectBrowseResult(resultId) {
    if (!leafletMap) {
        return;
    }
    const result = (mapUi.browse?.results || []).find((entry) => entry.id === resultId);
    if (!result) {
        return;
    }
    mapUi.browse.selectedId = resultId;
    mapUi.selectedMarkerId = resultId;
    mapUi.selectedMarkerKind = 'temp';
    tempMarkers.forEach((marker) => {
        const selected = marker._browseId === resultId;
        const icon = createCategoryMarkerIcon(selected);
        if (icon) {
            marker.setIcon(icon);
        }
    });
    leafletMap.setView([result.lat, result.lon], 14, { animate: true });
    mapUi.activeTab = 'about';
    mapUi.activePlace = {
        id: result.id,
        title: result.title,
        description: result.description || '',
        lat: result.lat,
        lon: result.lon
    };
    mapInfoHost && (mapInfoHost.innerHTML = renderMapInfoPanel(mapUi.activePlace));
    initMapControls();
    if (mapUi.isExploreOpen) {
        renderExplorePanel();
    }
}

function selectExploreResult(resultId) {
    selectBrowseResult(resultId);
    if (mapUi.isExploreOpen) {
        renderExplorePanel();
    }
}

function initMapControls() {
    const mapCanvas = plannerMapPanel.querySelector('.PlannerMapCanvas--leaflet');
    if (!mapCanvas) {
        return;
    }

    const shell = document.querySelector('.PlannerShell');
    if (shell && typeof uiState.mapPanelWidth !== 'number') {
        const stored = Number(window.localStorage.getItem('mapPanelWidth'));
        if (Number.isFinite(stored)) {
            uiState.mapPanelWidth = stored;
        }
    }
    if (shell && Number.isFinite(uiState.mapPanelWidth)) {
        const width = Math.max(320, Math.min(760, uiState.mapPanelWidth));
        shell.style.gridTemplateColumns = `112px minmax(520px, 1fr) ${width}px`;
    }

    if (shell && !shell.querySelector('[data-map-divider]')) {
        const divider = document.createElement('div');
        divider.className = 'PlannerPanelDivider';
        divider.dataset.mapDivider = 'true';
        shell.appendChild(divider);

        const syncDividerPosition = () => {
            const panel = plannerMapPanel;
            if (!panel) return;
            const rect = panel.getBoundingClientRect();
            const shellRect = shell.getBoundingClientRect();
            divider.style.left = `${Math.max(0, rect.left - shellRect.left - 3)}px`;
        };
        syncDividerPosition();
        window.addEventListener('resize', syncDividerPosition);

        let startX = 0;
        let startWidth = 0;
        const onMove = (event) => {
            const delta = event.clientX - startX;
            const next = Math.max(320, Math.min(760, startWidth - delta));
            uiState.mapPanelWidth = next;
            window.localStorage.setItem('mapPanelWidth', String(next));
            shell.style.gridTemplateColumns = `112px minmax(520px, 1fr) ${next}px`;
            syncDividerPosition();
            leafletMap?.invalidateSize?.();
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            divider.classList.remove('is-dragging');
        };
        divider.addEventListener('mousedown', (event) => {
            event.preventDefault();
            startX = event.clientX;
            startWidth = plannerMapPanel.getBoundingClientRect().width;
            divider.classList.add('is-dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    let controls = mapCanvas.querySelector('[data-map-controls]');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'PlannerMapControls';
        controls.dataset.mapControls = 'true';
        controls.innerHTML = `
            <button type="button" class="PlannerMapControlBtn" data-map-control="search" aria-label="Search">🔍</button>
            <button type="button" class="PlannerMapControlBtn" data-map-control="layers" aria-label="Layers">📊</button>
        `;
        mapCanvas.appendChild(controls);
    }

    const searchWrap = mapCanvas.querySelector('.PlannerMapSearch');
    if (searchWrap && !searchWrap.querySelector('[data-map-categories]')) {
        const categories = document.createElement('div');
        categories.className = 'PlannerMapCategories';
        categories.dataset.mapCategories = 'true';
        categories.innerHTML = `
            <div class="PlannerMapCategories__row">
                <button type="button" class="PlannerMapCategoryBtn" data-map-category="food">Food</button>
                <button type="button" class="PlannerMapCategoryBtn" data-map-category="attractions">Attractions</button>
                <button type="button" class="PlannerMapCategoryBtn" data-map-category="shopping">Shopping</button>
                <button type="button" class="PlannerMapCategoryBtn" data-map-category="gas">Gas stations</button>
                <button type="button" class="PlannerMapCategoryBtn" data-map-category="rest">Rest stops</button>
            </div>
            <div class="PlannerMapCategories__actions">
                <button type="button" class="PlannerMapTinyBtn" data-map-clear-temp="true">✕ Clear results</button>
            </div>
        `;
        searchWrap.appendChild(categories);
    }
    if (searchWrap) {
        searchWrap.classList.toggle('is-open', mapUi.controls.searchOpen);
    }

    let layersPanel = mapCanvas.querySelector('[data-map-layers-panel]');
    if (!layersPanel) {
        layersPanel = document.createElement('div');
        layersPanel.className = 'PlannerMapLayersPanel';
        layersPanel.dataset.mapLayersPanel = 'true';
        mapCanvas.appendChild(layersPanel);
    }
    layersPanel.classList.toggle('is-open', mapUi.controls.layersOpen);
    layersPanel.innerHTML = `
        <div class="PlannerMapFloatingPanel">
            <div class="PlannerMapFloatingPanel__title">Overview</div>
            <label class="PlannerMapToggle">
                <input type="checkbox" data-map-layer="pool" ${mapLayerState.visibility.get('pool') === false ? '' : 'checked'}>
                <span>Places to visit</span>
            </label>
            <div class="PlannerMapFloatingPanel__title">Itinerary Days</div>
            <label class="PlannerMapToggle route-toggle">
                <input type="checkbox" id="routeToggleCheckbox" ${mapUi.routesOn ? 'checked' : ''}>
                <span>Always show route lines</span>
            </label>
            ${trip.days.map((day, index) => {
        const key = day.id;
        const checked = mapLayerState.visibility.get(key) === false ? '' : 'checked';
        return `
                    <label class="PlannerMapToggle">
                        <input type="checkbox" data-map-layer="${escapeHtmlAttr(key)}" ${checked}>
                        <span>Day ${index + 1}</span>
                    </label>
                `;
    }).join('')}
        </div>
    `;

    let browsePanel = mapCanvas.querySelector('[data-map-browse-panel]');
    if (!browsePanel) {
        browsePanel = document.createElement('div');
        browsePanel.className = 'PlannerMapBrowsePanel';
        browsePanel.dataset.mapBrowsePanel = 'true';
        mapCanvas.appendChild(browsePanel);
    }
    const browseResults = Array.isArray(mapUi.browse?.results) ? mapUi.browse.results : [];
    const browseOpen = !mapUi.isExploreOpen && browseResults.length > 0;
    browsePanel.classList.toggle('is-open', browseOpen);
    if (browseOpen) {
        const label = escapeHtmlText(mapUi.browse.categoryLabel || 'Results');
        browsePanel.innerHTML = `
            <div class="PlannerMapFloatingPanel">
                <div class="PlannerMapBrowseHeader">
                    <div>
                        <div class="PlannerMapBrowseHeader__title">${label}</div>
                        <div class="PlannerMapBrowseHeader__meta">${browseResults.length} places</div>
                    </div>
                    <button type="button" class="PlannerMapTinyBtn" data-browse-clear="true">Clear</button>
                </div>
                <div class="PlannerMapBrowseList">
                    ${browseResults.map((result) => {
            const selected = mapUi.browse.selectedId === result.id ? ' is-selected' : '';
            const title = escapeHtmlText(result.title || 'Place');
            const desc = escapeHtmlText(result.description || '');
            const distanceKm = Number.isFinite(result.distanceMeters) ? (result.distanceMeters / 1000) : null;
            const distanceText = distanceKm === null ? '' : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
            return `
                            <button type="button" class="PlannerMapBrowseItem${selected}" data-browse-id="${escapeHtmlAttr(result.id)}">
                                <div class="PlannerMapBrowseItem__row">
                                    <strong>${title}</strong>
                                    ${distanceText ? `<span>${distanceText}</span>` : ''}
                                </div>
                                ${desc ? `<div class="PlannerMapBrowseItem__desc">${desc}</div>` : ''}
                            </button>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    } else {
        browsePanel.innerHTML = '';
    }

    const applyButtonsActive = () => {
        const searchBtn = controls.querySelector('[data-map-control="search"]');
        const layersBtn = controls.querySelector('[data-map-control="layers"]');
        searchBtn?.classList.toggle('is-active', mapUi.controls.searchOpen);
        layersBtn?.classList.toggle('is-active', mapUi.controls.layersOpen);
    };
    applyButtonsActive();

    const routeToggle = document.getElementById('routeToggleCheckbox');
    if (routeToggle && routeToggle.dataset.bound !== 'true') {
        routeToggle.dataset.bound = 'true';
        routeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                toggleRoutes(true);
            } else {
                clearAllRoutes();
            }
        });
    }

    if (!mapCanvas.dataset.mapControlsBound) {
        mapCanvas.dataset.mapControlsBound = 'true';
        mapCanvas.addEventListener('click', (event) => {
            const control = event.target.closest('[data-map-control]');
            if (control) {
                const key = control.dataset.mapControl;
                if (key === 'search') {
                    mapUi.controls.searchOpen = !mapUi.controls.searchOpen;
                    mapUi.controls.layersOpen = false;
                    initMapControls();
                    return;
                }
                if (key === 'layers') {
                    mapUi.controls.layersOpen = !mapUi.controls.layersOpen;
                    mapUi.controls.searchOpen = false;
                    initMapControls();
                    return;
                }
            }

            const category = event.target.closest('[data-map-category]');
            if (category) {
                handleCategorySearch(category.dataset.mapCategory);
                return;
            }

            const clearTemp = event.target.closest('[data-map-clear-temp]');
            if (clearTemp) {
                tempMarkers.forEach((marker) => marker.remove());
                tempMarkers = [];
                mapUi.browse = { categoryKey: null, categoryLabel: '', results: [], selectedId: null };
                showToast('Cleared results');
                initMapControls();
                return;
            }

            const browseClear = event.target.closest('[data-browse-clear]');
            if (browseClear) {
                tempMarkers.forEach((marker) => marker.remove());
                tempMarkers = [];
                mapUi.browse = { categoryKey: null, categoryLabel: '', results: [], selectedId: null };
                initMapControls();
                return;
            }

            const browseItem = event.target.closest('[data-browse-id]');
            if (browseItem && leafletMap) {
                const id = browseItem.dataset.browseId;
                const result = (mapUi.browse?.results || []).find((entry) => entry.id === id);
                if (!result) {
                    return;
                }
                mapUi.browse.selectedId = id;
                mapUi.selectedMarkerId = id;
                mapUi.selectedMarkerKind = 'temp';
                tempMarkers.forEach((marker) => {
                    const selected = marker._browseId === id;
                    const icon = createCategoryMarkerIcon(selected);
                    if (icon) {
                        marker.setIcon(icon);
                    }
                });
                leafletMap.setView([result.lat, result.lon], 14, { animate: true });
                mapUi.activeTab = 'about';
                mapUi.activePlace = {
                    id: result.id,
                    title: result.title,
                    description: result.description || '',
                    lat: result.lat,
                    lon: result.lon
                };
                mapInfoHost && (mapInfoHost.innerHTML = renderMapInfoPanel(mapUi.activePlace));
                initMapControls();
                return;
            }
        });
        mapCanvas.addEventListener('change', (event) => {
            const toggle = event.target.closest('[data-map-layer]');
            if (toggle) {
                mapLayerState.visibility.set(toggle.dataset.mapLayer, toggle.checked);
                toggleMapLayers();
                return;
            }
        });
    }
}

async function handleCategorySearch(categoryKey) {
    if (!leafletMap) {
        return;
    }
    const center = leafletMap.getCenter();
    const lat = center.lat;
    const lon = center.lng;

    const radius = 5000;
    const queryByCategory = {
        attractions: `[out:json];node["tourism"~"attraction|museum|viewpoint"](around:${radius}, ${lat}, ${lon});out;`,
        food: `[out:json];node["amenity"~"restaurant|cafe"](around:${radius}, ${lat}, ${lon});out;`,
        shopping: `[out:json];node["shop"~"mall|supermarket|department_store"](around:${radius}, ${lat}, ${lon});out;`,
        gas: `[out:json];node["amenity"="fuel"](around:${radius}, ${lat}, ${lon});out;`,
        rest: `[out:json];node["highway"="rest_area"](around:${radius}, ${lat}, ${lon});out;`
    };
    const query = queryByCategory[categoryKey] || queryByCategory.attractions;

    tempMarkers.forEach((marker) => marker.remove());
    tempMarkers = [];
    mapUi.browse = { categoryKey: null, categoryLabel: '', results: [], selectedId: null };
    initMapControls();

    try {
        if (handleCategorySearch._abortController) {
            try {
                handleCategorySearch._abortController.abort();
            } catch {
            }
        }
        handleCategorySearch._abortController = new AbortController();
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'Accept': 'application/json'
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: handleCategorySearch._abortController.signal
        });
        if (!response.ok) {
            throw new Error('overpass');
        }
        const contentType = String(response.headers.get('content-type') || '');
        const data = contentType.includes('application/json')
            ? await response.json()
            : JSON.parse(await response.text());
        const elements = Array.isArray(data?.elements) ? data.elements : [];

        const categoryLabels = {
            food: 'Food',
            attractions: 'Attractions',
            shopping: 'Shopping',
            gas: 'Gas stations',
            rest: 'Rest stops'
        };

        const distanceMeters = (aLat, aLon, bLat, bLon) => {
            const toRad = (deg) => (deg * Math.PI) / 180;
            const R = 6371000;
            const dLat = toRad(bLat - aLat);
            const dLon = toRad(bLon - aLon);
            const sLat = toRad(aLat);
            const eLat = toRad(bLat);
            const h = Math.sin(dLat / 2) ** 2 + Math.cos(sLat) * Math.cos(eLat) * Math.sin(dLon / 2) ** 2;
            return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
        };

        const describe = (tags) => {
            if (!tags) return '';
            if (categoryKey === 'food') return tags.amenity || '';
            if (categoryKey === 'attractions') return tags.tourism || '';
            if (categoryKey === 'shopping') return tags.shop || '';
            if (categoryKey === 'gas') return tags.amenity || '';
            if (categoryKey === 'rest') return tags.highway || '';
            return tags.amenity || tags.tourism || tags.shop || tags.highway || '';
        };

        const seenCoords = new Set();
        const candidates = [];
        elements.forEach((el) => {
            const elLat = Number(el.lat);
            const elLon = Number(el.lon);
            if (!Number.isFinite(elLat) || !Number.isFinite(elLon)) {
                return;
            }
            const name = String(el.tags?.name || '').trim();
            if (!name) {
                return;
            }
            const coordKey = `${elLat.toFixed(6)},${elLon.toFixed(6)}`;
            if (seenCoords.has(coordKey)) {
                return;
            }
            seenCoords.add(coordKey);
            candidates.push({
                id: `overpass-${el.id}`,
                title: name,
                description: describe(el.tags),
                lat: elLat,
                lon: elLon,
                distanceMeters: distanceMeters(lat, lon, elLat, elLon)
            });
        });

        candidates.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
        const results = candidates.slice(0, 30);

        const bounds = [];
        results.forEach((result) => {
            const markerIcon = createCategoryMarkerIcon(false);
            const marker = markerIcon
                ? window.L.marker([result.lat, result.lon], { icon: markerIcon }).addTo(leafletMap)
                : window.L.marker([result.lat, result.lon]).addTo(leafletMap);
            marker._browseId = result.id;
            marker.on('click', () => {
                mapUi.browse.selectedId = result.id;
                mapUi.selectedMarkerId = result.id;
                mapUi.selectedMarkerKind = 'temp';
                tempMarkers.forEach((m) => {
                    const selected = m._browseId === mapUi.selectedMarkerId;
                    const icon = createCategoryMarkerIcon(selected);
                    if (icon) {
                        m.setIcon(icon);
                    }
                });
                mapUi.activeTab = 'about';
                const place = {
                    id: result.id,
                    title: result.title,
                    description: result.description || '',
                    lat: result.lat,
                    lon: result.lon
                };
                mapUi.activePlace = place;
                mapInfoHost && (mapInfoHost.innerHTML = renderMapInfoPanel(place));
                initMapControls();
            });
            tempMarkers.push(marker);
            bounds.push([result.lat, result.lon]);
        });

        mapUi.browse = {
            categoryKey,
            categoryLabel: categoryLabels[categoryKey] || 'Results',
            results,
            selectedId: null
        };
        initMapControls();

        showToast(`Found ${results.length} places`);
        if (bounds.length > 1) {
            leafletMap.fitBounds(bounds, { padding: [24, 24] });
        } else if (bounds.length === 1) {
            leafletMap.setView(bounds[0], 14, { animate: true });
        }
    } catch (error) {
        if (String(error?.name || '') !== 'AbortError') {
            showToast('Unable to fetch places');
        }
    }
}

function toggleMapLayers() {
    if (!leafletMap) {
        return;
    }
    mapMarkers.forEach((marker, placeId) => {
        const meta = markerMeta.get(placeId);
        const groupKey = meta?.groupKey || 'day';
        const visible = mapLayerState.visibility.get(groupKey) !== false;
        const onMap = Boolean(marker._map);
        if (visible && !onMap) {
            marker.addTo(leafletMap);
        }
        if (!visible && onMap) {
            marker.remove();
        }
    });
    if (mapUi.routesOn) {
        toggleRoutes();
    }
}

async function toggleRoutes() {
    if (typeof arguments[0] === 'boolean') {
        mapUi.routesOn = arguments[0];
    }
    if (!leafletMap) {
        return;
    }
    if (!toggleRoutes._state) {
        toggleRoutes._state = { timer: null, abort: null, running: false, pending: false };
    }
    const state = toggleRoutes._state;

    const removeLine = (line) => {
        try {
            line?.remove?.();
        } catch {
        }
    };
    if (Array.isArray(routeLines)) {
        routeLines.forEach(removeLine);
        routeLines = {};
    }

    if (!mapUi.routesOn) {
        if (state.timer) {
            window.clearTimeout(state.timer);
            state.timer = null;
        }
        if (state.abort) {
            try {
                state.abort.abort();
            } catch {
            }
            state.abort = null;
        }
        if (routeLines && typeof routeLines === 'object' && !Array.isArray(routeLines)) {
            Object.values(routeLines).forEach(removeLine);
        }
        routeLines = {};
        return;
    }

    if (!routeLines || typeof routeLines !== 'object' || Array.isArray(routeLines)) {
        routeLines = {};
    }

    state.pending = true;
    if (state.running) {
        return;
    }
    if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = null;
    }

    state.timer = window.setTimeout(async () => {
        state.timer = null;
        if (!mapUi.routesOn || !leafletMap) {
            state.pending = false;
            return;
        }
        if (state.running) {
            state.pending = true;
            return;
        }
        state.running = true;
        state.pending = false;

        if (state.abort) {
            try {
                state.abort.abort();
            } catch {
            }
        }
        state.abort = new AbortController();
        const signal = state.abort.signal;
        let didUpdateRoadLegs = false;

        const palette = ['#2563eb', '#7c3aed', '#16a34a', '#f97316', '#dc2626'];
        const baseLat = 33.6844;
        const baseLon = 73.0479;

        const liveDayIds = new Set(trip.days.map((d) => d.id));
        Object.keys(routeLines).forEach((dayId) => {
            if (!liveDayIds.has(dayId)) {
                removeLine(routeLines[dayId]);
                delete routeLines[dayId];
            }
        });

        for (let dayIndex = 0; dayIndex < trip.days.length; dayIndex += 1) {
            if (!mapUi.routesOn) {
                break;
            }
            const day = trip.days[dayIndex];
            const dayId = day.id;
            const dayVisible = mapLayerState.visibility.get(dayId) !== false;
            if (!dayVisible) {
                if (routeLines[dayId]) {
                    removeLine(routeLines[dayId]);
                    delete routeLines[dayId];
                }
                continue;
            }

            const places = (day.items || []).filter((item) => !isNoteItem(item) && !isChecklistItem(item));
            if (places.length < 2) {
                if (routeLines[dayId]) {
                    removeLine(routeLines[dayId]);
                    delete routeLines[dayId];
                }
                continue;
            }

            const color = palette[dayIndex % palette.length];
            const points = places.map((item) => getPlaceLatLon(item));
            const coords = points.map((p) => `${p.lon},${p.lat}`).join(';');
            const routeKey = coords;

            const existing = routeLines[dayId];
            if (existing && existing._routeKey === routeKey && existing.options?.color === color) {
                continue;
            }

            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
                const response = await fetch(url, { signal });
                if (!response.ok) {
                    throw new Error('osrm');
                }
                const data = await response.json();
                const roadLegs = data?.routes?.[0]?.legs;
                const orderIds = places.map((item) => String(item.id));
                const signature = getOrderSignature(orderIds);
                if (Array.isArray(roadLegs) && roadLegs.length === places.length - 1 && signature) {
                    const legsByTo = new Map();
                    for (let i = 1; i < places.length; i += 1) {
                        const leg = roadLegs[i - 1];
                        const distanceKm = Number(leg?.distance) > 0 ? Number(leg.distance) / 1000 : 0;
                        const durationMin = Number(leg?.duration) > 0 ? Math.max(1, Math.round(Number(leg.duration) / 60)) : 0;
                        legsByTo.set(orderIds[i], {
                            from_name: places[i - 1].title,
                            to_name: places[i].title,
                            distance_km: Number(distanceKm.toFixed(3)),
                            time_min: durationMin
                        });
                    }
                    roadLegsByDay.set(dayId, legsByTo);
                    roadLegSignatureByDay.set(dayId, signature);
                    didUpdateRoadLegs = true;
                } else {
                    roadLegsByDay.delete(dayId);
                    roadLegSignatureByDay.delete(dayId);
                }
                const line = data?.routes?.[0]?.geometry?.coordinates;
                if (!Array.isArray(line) || line.length === 0) {
                    if (routeLines[dayId]) {
                        removeLine(routeLines[dayId]);
                        delete routeLines[dayId];
                    }
                    continue;
                }
                const latlngs = line.map(([lon, lat]) => [lat, lon]);
                const polyline = window.L.polyline(latlngs, { color, weight: 4, opacity: 0.85 }).addTo(leafletMap);
                polyline._routeKey = routeKey;
                if (routeLines[dayId]) {
                    removeLine(routeLines[dayId]);
                    delete routeLines[dayId];
                }
                routeLines[dayId] = polyline;
            } catch (error) {
                if (String(error?.name || '') !== 'AbortError') {
                    if (routeLines[dayId]) {
                        removeLine(routeLines[dayId]);
                        delete routeLines[dayId];
                    }
                }
            }
        }

        state.running = false;
        if (didUpdateRoadLegs && appMode === 'planner') {
            renderPlanner();
        }
        if (state.pending) {
            toggleRoutes();
        }
    }, 250);
}

function clearAllRoutes() {
    mapUi.routesOn = false;
    toggleRoutes(false);
}

function initMap() {
    const mapEl = document.getElementById('leafletMap');
    if (!mapEl || typeof window.L === 'undefined') {
        return;
    }
    if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
    }
    mapMarkers.forEach((marker) => marker.remove());
    mapMarkers.clear();
    if (mapTempMarker) {
        mapTempMarker.remove();
        mapTempMarker = null;
    }

    mapInfoHost = plannerMapPanel.querySelector('[data-map-info-host]');
    mapSearchInput = plannerMapPanel.querySelector('[data-map-search-input]');
    mapSearchResults = plannerMapPanel.querySelector('[data-map-search-results]');

    mapUi.hasUserInteracted = false;
    const center = [33.6844, 73.0479];
    leafletMap = window.L.map(mapEl, { zoomControl: true }).setView(center, 13);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO'
    }).addTo(leafletMap);
    leafletMap.on('dragstart', () => {
        mapUi.hasUserInteracted = true;
    });
    leafletMap.on('zoomstart', () => {
        mapUi.hasUserInteracted = true;
    });

    if (mapSearchInput) {
        mapSearchInput.value = mapUi.query || '';
        mapSearchInput.addEventListener('input', () => {
            mapUi.query = mapSearchInput.value;
            if (mapSearchDebounceTimer) {
                window.clearTimeout(mapSearchDebounceTimer);
            }
            mapSearchDebounceTimer = window.setTimeout(async () => {
                const query = String(mapUi.query || '').trim();
                if (!query) {
                    mapUi.results = [];
                    mapUi.resultsOpen = false;
                    if (mapSearchResults) {
                        mapSearchResults.innerHTML = '';
                        mapSearchResults.classList.remove('is-open');
                    }
                    return;
                }
                try {
                    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    mapUi.results = Array.isArray(data) ? data.slice(0, 8) : [];
                    mapUi.resultsOpen = mapUi.results.length > 0;
                    if (mapSearchResults) {
                        mapSearchResults.classList.toggle('is-open', mapUi.resultsOpen);
                        mapSearchResults.innerHTML = mapUi.results.map((result, index) => {
                            const label = escapeHtmlText(result.display_name || '');
                            const primary = escapeHtmlText((result.display_name || '').split(',')[0] || 'Result');
                            return `
                                <button type="button" class="PlannerMapSearchResult" data-map-search-index="${index}">
                                    <strong>${primary}</strong>
                                    <span>${label}</span>
                                </button>
                            `;
                        }).join('');
                    }
                } catch {
                    mapUi.results = [];
                    mapUi.resultsOpen = false;
                    if (mapSearchResults) {
                        mapSearchResults.innerHTML = '';
                        mapSearchResults.classList.remove('is-open');
                    }
                }
            }, 300);
        });
        mapSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                mapUi.resultsOpen = false;
                mapUi.results = [];
                if (mapSearchResults) {
                    mapSearchResults.innerHTML = '';
                    mapSearchResults.classList.remove('is-open');
                }
            }
        });
    }

    if (!mapPanelEventsBound) {
        mapPanelEventsBound = true;
        plannerMapPanel.addEventListener('click', (event) => {
            const searchResult = event.target.closest('[data-map-search-index]');
            if (searchResult && leafletMap) {
                const index = Number(searchResult.dataset.mapSearchIndex);
                const raw = mapUi.results[index];
                if (!raw) {
                    return;
                }
                const lat = Number(raw.lat);
                const lon = Number(raw.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                    return;
                }
                const title = (raw.display_name || '').split(',')[0] || 'Place';
                const place = {
                    id: `nominatim-${raw.place_id}`,
                    title,
                    description: raw.display_name || '',
                    lat,
                    lon
                };
                if (mapTempMarker) {
                    mapTempMarker.remove();
                    mapTempMarker = null;
                }
                const icon = window.L.divIcon({
                    className: 'PlannerLeafletTempMarker',
                    html: '<div>+</div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                mapTempMarker = window.L.marker([lat, lon], { icon }).addTo(leafletMap);
                leafletMap.setView([lat, lon], 14, { animate: true });
                mapUi.activeTab = 'about';
                mapUi.activePlace = place;
                if (mapInfoHost) {
                    mapInfoHost.innerHTML = renderMapInfoPanel(place);
                }
                mapUi.resultsOpen = false;
                if (mapSearchResults) {
                    mapSearchResults.classList.remove('is-open');
                }
                return;
            }

            const close = event.target.closest('[data-map-close]');
            if (close) {
                mapUi.activePlace = null;
                if (mapInfoHost) {
                    mapInfoHost.innerHTML = '';
                }
                return;
            }

            const tab = event.target.closest('[data-map-tab]');
            if (tab && mapUi.activePlace) {
                mapUi.activeTab = tab.dataset.mapTab;
                if (mapInfoHost) {
                    mapInfoHost.innerHTML = renderMapInfoPanel(mapUi.activePlace);
                }
                return;
            }

            const add = event.target.closest('[data-map-add-to-trip]');
            if (add && mapUi.activePlace) {
                addPlaceToTrip(mapUi.activePlace);
            }
        });
    }

    initMapControls();

    const mapCanvas = plannerMapPanel.querySelector('.PlannerMapCanvas--leaflet');
    if (mapCanvas && mapCanvas.dataset.mapLayerLabelsBound !== 'true') {
        mapCanvas.dataset.mapLayerLabelsBound = 'true';
        const formatShortDayLabel = (dateStr) => {
            const date = new Date(dateStr);
            if (!Number.isFinite(date.getTime())) return '';
            const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${weekday} ${month}/${day}`;
        };
        const applyLayerLabels = () => {
            const layersPanel = mapCanvas.querySelector('[data-map-layers-panel]');
            if (!layersPanel) return;
            layersPanel.querySelectorAll('input[data-map-layer]').forEach((input) => {
                const key = input.getAttribute('data-map-layer');
                if (!key || key === 'pool') return;
                const day = trip.days.find((d) => d.id === key);
                if (!day) return;
                const label = formatShortDayLabel(day.date) || day.shortLabel || day.label || '';
                const span = input.closest('label')?.querySelector('span');
                if (span && label) {
                    span.textContent = label;
                }
            });
        };
        applyLayerLabels();
        const layersPanel = mapCanvas.querySelector('[data-map-layers-panel]');
        if (layersPanel) {
            let raf = 0;
            const schedule = () => {
                if (raf) {
                    return;
                }
                raf = window.requestAnimationFrame(() => {
                    raf = 0;
                    applyLayerLabels();
                });
            };
            schedule();
            if (mapCanvas._mapLayerLabelObserver) {
                try {
                    mapCanvas._mapLayerLabelObserver.disconnect();
                } catch {
                }
            }
            const observer = new MutationObserver(() => {
                schedule();
            });
            mapCanvas._mapLayerLabelObserver = observer;
            observer.observe(layersPanel, { subtree: true, childList: true });
        }
    }

    updateMarkers();
    window.setTimeout(() => {
        leafletMap?.invalidateSize?.();
    }, 0);
}

function updateMarkers() {
    if (!leafletMap || typeof window.L === 'undefined') {
        return;
    }
    const baseLat = 33.6844;
    const baseLon = 73.0479;
    const desiredIds = new Set();
    const bounds = [];

    const createItineraryIcon = (label, color, isSelected) => window.L.divIcon({
        className: `PlannerLeafletMarker${isSelected ? ' is-selected' : ''}`,
        html: `<div style="background:${escapeHtmlAttr(color)}">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const createPoolIcon = (label, isSelected) => window.L.divIcon({
        className: `PlannerLeafletPoolMarker${isSelected ? ' is-selected' : ''}`,
        html: `<div>${label}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });

    markerMeta.clear();

    const ordered = flattenItineraryPlaces();
    ordered.forEach(({ item, dayId }, index) => {
        desiredIds.add(item.id);
        const coords = getPlaceLatLon(item);
        const lat = coords.lat;
        const lon = coords.lon;
        bounds.push([lat, lon]);

        const isSelected = mapUi.selectedMarkerKind === 'itinerary' && mapUi.selectedMarkerId === item.id;
        const label = index + 1;
        const color = typeof item.color === 'string' ? item.color : '#111827';
        const icon = createItineraryIcon(label, color, isSelected);

        markerMeta.set(item.id, { groupKey: dayId, lat, lon, kind: 'itinerary' });

        const existing = mapMarkers.get(item.id);
        const shouldShow = mapLayerState.visibility.get(dayId) !== false;
        if (existing) {
            existing.setLatLng([lat, lon]);
            existing.setIcon(icon);
            const onMap = Boolean(existing._map);
            if (shouldShow && !onMap) {
                existing.addTo(leafletMap);
            }
            if (!shouldShow && onMap) {
                existing.remove();
            }
            return;
        }
        const marker = window.L.marker([lat, lon], { icon });
        if (shouldShow) {
            marker.addTo(leafletMap);
        }
        marker.on('click', () => {
            mapUi.selectedMarkerId = item.id;
            mapUi.selectedMarkerKind = 'itinerary';
            mapUi.activeTab = 'about';
            mapUi.activePlace = {
                id: item.id,
                title: item.title,
                description: item.note || '',
                lat,
                lon,
                catalogId: item.catalogId || null
            };
            mapInfoHost && (mapInfoHost.innerHTML = renderMapInfoPanel(mapUi.activePlace));
            updateMarkers();
        });
        mapMarkers.set(item.id, marker);
    });

    const poolPlaces = (trip.placesPool || []).filter((item) => !isNoteItem(item) && !isChecklistItem(item));
    poolPlaces.forEach((item, index) => {
        desiredIds.add(item.id);
        const coords = getPlaceLatLon(item);
        const lat = coords.lat;
        const lon = coords.lon;
        bounds.push([lat, lon]);

        const isSelected = mapUi.selectedMarkerKind === 'pool' && mapUi.selectedMarkerId === item.id;
        const icon = createPoolIcon(index + 1, isSelected);
        markerMeta.set(item.id, { groupKey: 'pool', lat, lon, kind: 'pool' });

        const existing = mapMarkers.get(item.id);
        const shouldShow = mapLayerState.visibility.get('pool') !== false;
        if (existing) {
            existing.setLatLng([lat, lon]);
            existing.setIcon(icon);
            const onMap = Boolean(existing._map);
            if (shouldShow && !onMap) {
                existing.addTo(leafletMap);
            }
            if (!shouldShow && onMap) {
                existing.remove();
            }
            return;
        }
        const marker = window.L.marker([lat, lon], { icon });
        if (shouldShow) {
            marker.addTo(leafletMap);
        }
        marker.on('click', () => {
            mapUi.selectedMarkerId = item.id;
            mapUi.selectedMarkerKind = 'pool';
            mapUi.activeTab = 'about';
            mapUi.activePlace = {
                id: item.id,
                title: item.title,
                description: item.note || '',
                lat,
                lon,
                catalogId: item.catalogId || null
            };
            mapInfoHost && (mapInfoHost.innerHTML = renderMapInfoPanel(mapUi.activePlace));
            updateMarkers();
        });
        mapMarkers.set(item.id, marker);
    });

    Array.from(mapMarkers.keys()).forEach((id) => {
        if (!desiredIds.has(id)) {
            mapMarkers.get(id)?.remove();
            mapMarkers.delete(id);
        }
    });

    if (mapUi.activePlace && mapUi.activePlace.catalogId === null && String(mapUi.activePlace.id || '').startsWith('nominatim-')) {
        return;
    }
    if (mapUi.activePlace && mapUi.activePlace.id && !desiredIds.has(mapUi.activePlace.id)) {
        mapUi.activePlace = null;
        if (mapInfoHost) {
            mapInfoHost.innerHTML = '';
        }
    }

    if (bounds.length > 1 && !mapUi.hasUserInteracted) {
        leafletMap.fitBounds(bounds, { padding: [24, 24] });
    } else if (bounds.length === 1 && !mapUi.hasUserInteracted) {
        leafletMap.setView(bounds[0], 13);
    }

    if (mapUi.routesOn) {
        toggleRoutes();
    }
}

function renderMapPanel() {
    const existingMap = plannerMapPanel.querySelector('#leafletMap');
    const renderResultsMarkup = () => mapUi.results.map((result, index) => {
        const label = escapeHtmlText(result.display_name || '');
        const primary = escapeHtmlText((result.display_name || '').split(',')[0] || 'Result');
        return `
                                <button type="button" class="PlannerMapSearchResult" data-map-search-index="${index}">
                                    <strong>${primary}</strong>
                                    <span>${label}</span>
                                </button>
                            `;
    }).join('');

    if (existingMap) {
        const infoHost = plannerMapPanel.querySelector('[data-map-info-host]');
        if (infoHost) {
            infoHost.innerHTML = mapUi.activePlace ? renderMapInfoPanel(mapUi.activePlace) : '';
        }
        const input = plannerMapPanel.querySelector('[data-map-search-input]');
        if (input && input.value !== (mapUi.query || '')) {
            input.value = mapUi.query || '';
        }
        const resultsHost = plannerMapPanel.querySelector('[data-map-search-results]');
        if (resultsHost) {
            resultsHost.classList.toggle('is-open', Boolean(mapUi.resultsOpen));
            resultsHost.innerHTML = renderResultsMarkup();
        }
        return;
    }

    plannerMapPanel.innerHTML = `
        <div class="PlannerMapPanel__sticky">
            <div class="PlannerMapPanel__toolbar">
                <button type="button" class="PlannerMapButton">Export</button>
                <span class="PlannerProBadge">PRO</span>
            </div>
            <div class="PlannerMapCanvas PlannerMapCanvas--leaflet">
                <div class="PlannerMapSearch">
                    <input type="text" placeholder="Search places" data-map-search-input="true" value="${escapeHtmlAttr(mapUi.query)}">
                    <div class="PlannerMapSearchResults${mapUi.resultsOpen ? ' is-open' : ''}" data-map-search-results="true">
                        ${renderResultsMarkup()}
                    </div>
                </div>
                <div class="PlannerLeafletMap" id="leafletMap"></div>
                <div class="PlannerMapInfoPanelHost" data-map-info-host="true">
                    ${mapUi.activePlace ? renderMapInfoPanel(mapUi.activePlace) : ''}
                </div>
            </div>
        </div>
    `;
}

function clearBrowseMarkers() {
    if (Array.isArray(tempMarkers)) {
        tempMarkers.forEach((marker) => {
            try {
                marker?.remove?.();
            } catch {
            }
        });
    }
    tempMarkers = [];
    mapUi.browse = { categoryKey: null, categoryLabel: '', results: [], selectedId: null };
    if (mapUi.selectedMarkerKind === 'temp') {
        mapUi.selectedMarkerKind = null;
        mapUi.selectedMarkerId = null;
    }
    initMapControls();
    if (mapUi.isExploreOpen) {
        renderExplorePanel();
    }
}

function renderPlannerLayout() {
    plannerApp.classList.remove('is-home');
    renderSidebar();
    renderMain();
    renderMapPanel();
    bindPlannerEvents();
    bindTripModalEvents();
    bindTripPreferencesModal();
    bindTopbarEngineButtons();
    bindMapPanelEvents();
    updateActiveSidebar();
    persistActiveWorkspace();
}

function renderApp() {
    if (appMode === 'home') {
        renderHome();
        return;
    }
    renderPlannerLayout();
}

function renderPlanner() {
    renderApp();
}

function moveExistingPlaceByIdentity(identity, toType, toId) {
    const existingLocation = findPlaceLocationByIdentity(identity);
    if (!existingLocation) {
        return false;
    }
    movePlace({
        placeId: existingLocation.place.id,
        fromType: existingLocation.type,
        fromId: existingLocation.id,
        toType,
        toId,
        targetIndex: getContainer(toType, toId).length
    });
    return true;
}

function addPlaceToTrip(place) {
    const title = String(place?.title ?? '').trim();
    if (!title) {
        return;
    }
    const catalogId = typeof place?.catalogId === 'string' ? place.catalogId : null;
    if (catalogId && placeCatalog[catalogId]) {
        sendSuggestionToPool(catalogId);
        return;
    }
    addPlaceToContainer(title, 'pool', 'pool');
}

function addPlaceToContainer(title, type, id) {
    const normalized = title.trim();
    if (!normalized) {
        return;
    }
    const known = Object.values(placeCatalog).find((place) => place.title.toLowerCase() === normalized.toLowerCase());
    const identity = known ? known.id : normalized.toLowerCase();
    if (moveExistingPlaceByIdentity(identity, type, id)) {
        return;
    }
    saveState();
    const place = known ? clonePlace(known.id) : clonePlace(null, normalized);
    const container = getContainer(type, id);
    container.push(place);
    trip.map.selectedPlaceId = place.id;
    renderPlanner();
    showToast(type === 'pool' ? 'Added 1 place' : 'Added directly to day', getSectionTargetForContainer(type, id));
}

function sendSuggestionToPool(placeId) {
    if (moveExistingPlaceByIdentity(placeId, 'pool', 'pool')) {
        return;
    }
    saveState();
    const place = clonePlace(placeId);
    trip.placesPool.push(place);
    trip.map.selectedPlaceId = place.id;
    renderPlanner();
    showToast('Added 1 place', 'section-pool');
}

function sendSuggestionToDay(placeId, dayId) {
    if (moveExistingPlaceByIdentity(placeId, 'day', dayId)) {
        return;
    }
    saveState();
    const place = clonePlace(placeId);
    getContainer('day', dayId).push(place);
    trip.map.selectedPlaceId = place.id;
    renderPlanner();
    showToast('Added directly to day', `section-${dayId}`);
}

function handleMoveSelect(select) {
    const [toType, toId] = (select.value || '').split('|');
    if (!toType) {
        return;
    }
    const placeId = select.dataset.moveSelect;
    const fromType = select.dataset.sourceType;
    const fromId = select.dataset.sourceId;
    movePlace({
        placeId,
        fromType,
        fromId,
        toType,
        toId,
        targetIndex: getContainer(toType, toId).length
    });
}

function handleDrop(slot) {
    return;
}

function bindPlannerEvents() {
    plannerSidebar.querySelectorAll('[data-scroll-target]').forEach((button) => {
        button.addEventListener('click', () => scrollToSection(button.dataset.scrollTarget));
    });
    const collapseAllButton = plannerSidebar.querySelector('[data-collapse-all]');
    if (collapseAllButton) {
        collapseAllButton.addEventListener('click', () => collapseAllSections());
    }

    plannerMain.querySelectorAll('[data-scroll-target]').forEach((button) => {
        button.addEventListener('click', () => scrollToSection(button.dataset.scrollTarget));
    });

    plannerMain.querySelectorAll('[data-add-form]').forEach((form) => {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const input = form.querySelector('input[name="placeName"]');
            const type = form.dataset.addForm;
            const id = type === 'day' ? form.dataset.dayId : type === 'custom' ? form.dataset.customId : 'pool';
            addPlaceToContainer(input.value, type === 'custom' ? 'custom' : type, id);
            input.value = '';
        });
    });

    plannerMain.querySelectorAll('[data-add-suggestion]').forEach((button) => {
        button.addEventListener('click', () => sendSuggestionToPool(button.dataset.addSuggestion));
    });

    plannerMain.querySelectorAll('[data-add-from-day-suggestion]').forEach((button) => {
        button.addEventListener('click', () => sendSuggestionToDay(button.dataset.addFromDaySuggestion, button.dataset.targetDay));
    });

    const newListButton = plannerMain.querySelector('[data-new-list]');
    if (newListButton) {
        newListButton.addEventListener('click', () => {
            saveState();
            trip.customLists.push(createCustomList('Untitled'));
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }

    plannerMain.querySelectorAll('[data-section-menu-button]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const wrap = button.closest('.PlannerSectionMenu');
            if (!wrap) {
                return;
            }
            const menu = wrap.querySelector('[data-section-menu-items]');
            if (!menu) {
                return;
            }
            const isOpen = menu.classList.contains('show');
            plannerMain.querySelectorAll('[data-section-menu-items].show').forEach((open) => open.classList.remove('show'));
            menu.classList.toggle('show', !isOpen);
            button.setAttribute('aria-expanded', String(!isOpen));
        });
    });

    plannerMain.querySelectorAll('[data-menu-item]').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.stopPropagation();
            const label = item.dataset.menuItem || item.textContent.trim();
            plannerMain.querySelectorAll('[data-section-menu-items].show').forEach((open) => open.classList.remove('show'));
            plannerMain.querySelectorAll('[data-section-menu-button]').forEach((button) => button.setAttribute('aria-expanded', 'false'));

            if (item.dataset.toggleAllDays === 'true' || label === 'Collapse all days' || label === 'Expand all days') {
                toggleAllDaysCollapsed();
                return;
            }

            if (item.dataset.insertDayAfter || label === 'Insert day after') {
                const dayId = item.dataset.insertDayAfter
                    || (item.closest('.PlannerDaySection')?.id?.startsWith('section-')
                        ? item.closest('.PlannerDaySection').id.slice('section-'.length)
                        : '');
                if (dayId) {
                    insertDayAfter(dayId);
                }
                return;
            }

            if (item.dataset.deleteDay || label === 'Delete day') {
                const dayId = item.dataset.deleteDay
                    || (item.closest('.PlannerDaySection')?.id?.startsWith('section-')
                        ? item.closest('.PlannerDaySection').id.slice('section-'.length)
                        : '');
                if (dayId) {
                    deleteDay(dayId);
                }
                return;
            }

            if (label === 'Delete section') {
                const section = item.closest('.PlannerSection');
                deleteSection(section?.id);
                return;
            }

            if (label === 'Select all' || label === 'Deselect all') {
                const section = item.closest('.PlannerSection');
                selectAllInSection(section?.id);
                return;
            }

            if (item.dataset.collapseAll === 'true' || item.dataset.menuAction === 'collapse-all' || label === 'Collapse all sections') {
                collapseAllSections();
                return;
            }

            if (item.dataset.expandAll === 'true' || item.dataset.menuAction === 'expand-all' || label === 'Expand all sections') {
                expandAllSections();
                return;
            }

            if (label !== 'Rearrange sections' && label !== 'Change color or icon') {
                return;
            }
            const section = item.closest('.PlannerSection');
            const sectionId = section?.id;
            if (!sectionId || sectionId === 'section-notes') {
                return;
            }
            openArrangementModal(sectionId);
        });
    });

    const modalOverlay = plannerMain.querySelector('[data-arrangement-overlay]');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                closeArrangementModal();
            }
        });
    }
    const modalClose = plannerMain.querySelector('[data-arrangement-close]');
    if (modalClose) {
        modalClose.addEventListener('click', () => closeArrangementModal());
    }
    const modalDone = plannerMain.querySelector('[data-arrangement-done]');
    if (modalDone) {
        modalDone.addEventListener('click', () => closeArrangementModal());
    }
    plannerMain.querySelectorAll('[data-arrangement-select]').forEach((row) => {
        row.draggable = true;
        row.addEventListener('click', () => {
            uiState.arrangementModal.activeSectionId = row.dataset.arrangementSelect;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });
    plannerMain.querySelectorAll('[data-arrangement-edit]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const sectionId = button.dataset.arrangementEdit;
            if (!sectionId) {
                return;
            }
            if (uiState.arrangementModal.editingSectionId === sectionId) {
                uiState.arrangementModal.editingSectionId = null;
            } else {
                uiState.arrangementModal.editingSectionId = sectionId;
                uiState.arrangementModal.activeSectionId = sectionId;
            }
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });
    plannerMain.querySelectorAll('[data-arrangement-color]').forEach((button) => {
        button.addEventListener('click', () => {
            const sectionId = uiState.arrangementModal.editingSectionId;
            if (!sectionId) {
                return;
            }
            setSectionColor(sectionId, button.dataset.arrangementColor);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });
    plannerMain.querySelectorAll('[data-arrangement-icon]').forEach((button) => {
        button.addEventListener('click', () => {
            const sectionId = uiState.arrangementModal.editingSectionId;
            if (!sectionId) {
                return;
            }
            setSectionIcon(sectionId, button.dataset.arrangementIcon);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-list-title-start]').forEach((element) => {
        element.addEventListener('click', () => {
            uiState.editingTitleKey = `custom:${element.dataset.listTitleStart}`;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    const listTitleInput = plannerMain.querySelector('[data-list-title-input]');
    if (listTitleInput) {
        window.setTimeout(() => {
            listTitleInput.focus();
            listTitleInput.select();
        }, 0);
        listTitleInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitCustomListTitle(listTitleInput.dataset.listTitleInput, listTitleInput.value);
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
            if (event.key === 'Escape') {
                uiState.editingTitleKey = null;
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
        });
        listTitleInput.addEventListener('blur', () => {
            commitCustomListTitle(listTitleInput.dataset.listTitleInput, listTitleInput.value);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }

    plannerMain.querySelectorAll('[data-collapse-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const sectionId = button.dataset.collapseToggle;
            toggleSectionCollapsed(sectionId);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-title-start]').forEach((element) => {
        element.addEventListener('click', () => {
            startEditingTitle(element.dataset.titleStart);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    const titleInput = plannerMain.querySelector('[data-title-input]');
    if (titleInput) {
        window.setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 0);
        titleInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const key = titleInput.dataset.titleInput;
                const fallback = key === 'pool' ? 'Places to visit' : 'Notes';
                commitEditingTitle(key, titleInput.value, fallback);
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
            if (event.key === 'Escape') {
                uiState.editingTitleKey = null;
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
        });
        titleInput.addEventListener('blur', () => {
            const key = titleInput.dataset.titleInput;
            const fallback = key === 'pool' ? 'Places to visit' : 'Notes';
            commitEditingTitle(key, titleInput.value, fallback);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }

    plannerMain.querySelectorAll('[data-select-item-id]').forEach((checkbox) => {
        checkbox.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });
        checkbox.addEventListener('click', (event) => {
            event.stopPropagation();
            togglePlaceSelection(checkbox.dataset.selectItemId, checkbox.checked);
        });
    });

    plannerMain.querySelectorAll('[data-move-select]').forEach((select) => {
        select.addEventListener('change', () => handleMoveSelect(select));
    });

    plannerMain.querySelectorAll('[data-delete-id]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.deleteId;
            deletePlace(placeId);
        });
    });

    plannerMain.querySelectorAll('[data-note-input]').forEach((textarea) => {
        textarea.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                textarea.blur();
            }
        });
        textarea.addEventListener('blur', () => {
            commitNoteContent(textarea.dataset.noteInput, textarea.value);
        });
    });

    plannerMain.querySelectorAll('[data-checklist-title]').forEach((input) => {
        input.addEventListener('blur', () => {
            commitChecklistTitle(input.dataset.checklistTitle, input.value);
        });
    });

    plannerMain.querySelectorAll('[data-checklist-add]').forEach((button) => {
        button.addEventListener('click', () => {
            const checklistId = button.dataset.checklistAdd;
            const row = addChecklistRow(checklistId);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
            if (row) {
                window.setTimeout(() => {
                    const nextInput = plannerMain.querySelector(`[data-checklist-row-input="${checklistId}"][data-checklist-row-id="${row.id}"]`);
                    if (nextInput) {
                        nextInput.focus();
                        nextInput.select?.();
                    }
                }, 0);
            }
        });
    });

    plannerMain.querySelectorAll('[data-checklist-row-delete]').forEach((button) => {
        button.addEventListener('click', () => {
            const checklistId = button.dataset.checklistRowDelete;
            const rowId = button.dataset.checklistRowId;
            if (!checklistId || !rowId) {
                return;
            }
            removeChecklistRow(checklistId, rowId);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-checklist-row-toggle]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            toggleChecklistRow(checkbox.dataset.checklistRowToggle, checkbox.dataset.checklistRowId, checkbox.checked);
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-checklist-row-input]').forEach((input) => {
        input.addEventListener('input', () => {
            setChecklistRowText(input.dataset.checklistRowInput, input.dataset.checklistRowId, input.value);
        });
        input.addEventListener('keydown', (event) => {
            if (event.isComposing) {
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                const checklistId = input.dataset.checklistRowInput;
                const rowId = input.dataset.checklistRowId;
                setChecklistRowText(checklistId, rowId, input.value);
                const row = addChecklistRow(checklistId, rowId);
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
                if (row) {
                    window.setTimeout(() => {
                        const nextInput = plannerMain.querySelector(`[data-checklist-row-input="${checklistId}"][data-checklist-row-id="${row.id}"]`);
                        if (nextInput) {
                            nextInput.focus();
                            nextInput.select?.();
                        }
                    }, 0);
                }
            }
        });
        input.addEventListener('blur', () => {
            commitChecklistRowText(input.dataset.checklistRowInput, input.dataset.checklistRowId, input.value);
        });
    });

    plannerMain.querySelectorAll('[data-open-time]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.openTime;
            if (!placeId) {
                return;
            }
            uiState.timeEditor.placeId = placeId;
            uiState.activePlaceId = placeId;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-time-cancel]').forEach((button) => {
        button.addEventListener('click', () => {
            uiState.timeEditor.placeId = null;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-time-save]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.timeSave;
            const place = getPlaceById(placeId);
            if (!place) {
                uiState.timeEditor.placeId = null;
                return;
            }
            const start = plannerMain.querySelector(`[data-time-start="${placeId}"]`)?.value || '';
            const end = plannerMain.querySelector(`[data-time-end="${placeId}"]`)?.value || '';
            saveState();
            place.startTime = start || null;
            place.endTime = end || null;
            uiState.timeEditor.placeId = null;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-open-visit]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.openVisit;
            const place = getPlaceById(placeId);
            if (!place) {
                return;
            }
            saveState();
            place.visited = true;
            uiState.activeNotePlaceId = placeId;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-mark-not-visited]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.markNotVisited;
            const place = getPlaceById(placeId);
            if (!place) {
                return;
            }
            saveState();
            place.visited = false;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-open-journal]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.openJournal;
            const place = getPlaceById(placeId);
            if (!place) {
                return;
            }
            uiState.activeJournalPlaceId = placeId;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-open-expense]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.openExpense;
            openExpenseModal({ placeId });
        });
    });

    plannerMain.querySelectorAll('[data-expense-edit]').forEach((button) => {
        button.addEventListener('click', () => {
            const expenseId = button.dataset.expenseEdit;
            if (!expenseId) {
                return;
            }
            const expense = getExpenseById(expenseId);
            openExpenseModal({ expenseId, placeId: expense?.placeId || null });
        });
    });

    plannerMain.querySelectorAll('[data-expense-delete]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const expenseId = button.dataset.expenseDelete;
            const shouldDelete = window.confirm('Are you sure you want to delete this expense?');
            if (!shouldDelete) {
                return;
            }
            deleteExpenseById(expenseId);
        });
    });

    const addExpenseButton = plannerMain.querySelector('[data-add-expense="true"]');
    if (addExpenseButton) {
        addExpenseButton.addEventListener('click', () => {
            openExpenseModal({ placeId: null, expenseId: null });
        });
    }

    const openBudgetButton = plannerMain.querySelector('[data-open-budget-modal="true"]');
    if (openBudgetButton) {
        openBudgetButton.addEventListener('click', () => openBudgetModal());
    }

    const expenseSortSelect = plannerMain.querySelector('[data-expense-sort="true"]');
    if (expenseSortSelect) {
        expenseSortSelect.addEventListener('change', () => {
            uiState.expenseSort = expenseSortSelect.value || 'date_desc';
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }

    const expenseOverlay = plannerMain.querySelector('[data-expense-overlay]');
    if (expenseOverlay) {
        expenseOverlay.addEventListener('click', (event) => {
            if (event.target === expenseOverlay) {
                closeExpenseModal();
            }
        });
    }
    const expenseClose = plannerMain.querySelector('[data-expense-close]');
    if (expenseClose) {
        expenseClose.addEventListener('click', () => closeExpenseModal());
    }
    const expenseSave = plannerMain.querySelector('[data-expense-save]');
    if (expenseSave) {
        expenseSave.addEventListener('click', () => saveExpenseFromModal());
    }
    const expenseDelete = plannerMain.querySelector('[data-expense-delete-modal="true"]');
    if (expenseDelete) {
        expenseDelete.addEventListener('click', () => {
            const shouldDelete = window.confirm('Are you sure you want to delete this expense?');
            if (!shouldDelete) {
                return;
            }
            deleteExpenseFromModal();
        });
    }

    const budgetOverlay = plannerMain.querySelector('[data-budget-overlay]');
    if (budgetOverlay) {
        budgetOverlay.addEventListener('click', (event) => {
            if (event.target === budgetOverlay) {
                closeBudgetModal();
            }
        });
    }
    const budgetClose = plannerMain.querySelector('[data-budget-close]');
    if (budgetClose) {
        budgetClose.addEventListener('click', () => closeBudgetModal());
    }
    const budgetSave = plannerMain.querySelector('[data-budget-save]');
    if (budgetSave) {
        budgetSave.addEventListener('click', () => saveBudgetFromModal());
    }

    const expenseModal = plannerMain.querySelector('[data-expense-modal]');
    const expenseDateField = plannerMain.querySelector('[data-expense-date-field]');
    const expenseDateTrigger = plannerMain.querySelector('[data-expense-date-trigger]');
    const expenseDatePicker = plannerMain.querySelector('[data-expense-date-picker]');
    const expenseDateInput = plannerMain.querySelector('[data-expense-date]');
    if (expenseModal && expenseDateField && expenseDateTrigger && expenseDatePicker && expenseDateInput) {
        const closePicker = () => {
            expenseDatePicker.classList.remove('is-open');
            expenseDateTrigger.setAttribute('aria-expanded', 'false');
        };
        expenseDateTrigger.addEventListener('click', (event) => {
            event.preventDefault();
            const nextOpen = !expenseDatePicker.classList.contains('is-open');
            expenseDatePicker.classList.toggle('is-open', nextOpen);
            expenseDateTrigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        });
        expenseModal.addEventListener('click', (event) => {
            if (!expenseDatePicker.classList.contains('is-open')) {
                return;
            }
            const target = event.target;
            if (target instanceof Element && (expenseDateField.contains(target))) {
                return;
            }
            closePicker();
        });
        expenseDatePicker.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const allowedRaw = expenseDatePicker.dataset.allowed || '[]';
            let allowedDays = [];
            try {
                allowedDays = JSON.parse(allowedRaw);
            } catch {
                allowedDays = [];
            }
            if (target.matches('[data-expense-cal-prev]')) {
                const currentMonthIso = expenseDatePicker.dataset.monthIso || '';
                const next = shiftMonthIso(currentMonthIso, -1);
                if (next) {
                    expenseDatePicker.dataset.monthIso = next;
                    expenseDatePicker.innerHTML = buildExpenseCalendarMarkup(next, expenseDatePicker.dataset.selectedIso || '', allowedDays);
                }
                return;
            }
            if (target.matches('[data-expense-cal-next]')) {
                const currentMonthIso = expenseDatePicker.dataset.monthIso || '';
                const next = shiftMonthIso(currentMonthIso, 1);
                if (next) {
                    expenseDatePicker.dataset.monthIso = next;
                    expenseDatePicker.innerHTML = buildExpenseCalendarMarkup(next, expenseDatePicker.dataset.selectedIso || '', allowedDays);
                }
                return;
            }
            if (target.matches('[data-expense-cal-day]')) {
                const tripDate = target.getAttribute('data-trip-date') || '';
                const iso = target.getAttribute('data-iso') || '';
                if (!tripDate || !iso) {
                    return;
                }
                expenseDateInput.value = tripDate;
                expenseDatePicker.dataset.selectedIso = iso;
                const label = formatExpenseDateLabel(tripDate) || '';
                const labelEl = expenseDateTrigger.querySelector('.ExpenseDateValue');
                if (labelEl) {
                    labelEl.textContent = label;
                } else {
                    expenseDateTrigger.textContent = label;
                }
                const monthIso = monthIsoFromDateStr(tripDate);
                if (monthIso) {
                    expenseDatePicker.dataset.monthIso = monthIso;
                    expenseDatePicker.innerHTML = buildExpenseCalendarMarkup(monthIso, iso, allowedDays);
                } else {
                    expenseDatePicker.innerHTML = buildExpenseCalendarMarkup(expenseDatePicker.dataset.monthIso || '', iso, allowedDays);
                }
                closePicker();
            }
        });
    }

    const visitOverlay = plannerMain.querySelector('[data-visit-overlay]');
    if (visitOverlay) {
        visitOverlay.addEventListener('click', (event) => {
            if (event.target === visitOverlay) {
                uiState.activeNotePlaceId = null;
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
        });
    }
    const visitClose = plannerMain.querySelector('[data-visit-close]');
    if (visitClose) {
        visitClose.addEventListener('click', () => {
            uiState.activeNotePlaceId = null;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }

    const visitModal = plannerMain.querySelector('[data-visit-modal="true"]');
    const visitDateField = plannerMain.querySelector('[data-visit-date-field="true"]');
    const visitDateTrigger = plannerMain.querySelector('[data-visit-date-trigger="true"]');
    const visitDatePicker = plannerMain.querySelector('[data-visit-date-picker="true"]');
    const visitDateInput = plannerMain.querySelector('[data-visit-date="true"]');
    if (visitModal && visitDateField && visitDateTrigger && visitDatePicker && visitDateInput) {
        const closePicker = () => {
            visitDatePicker.classList.remove('is-open');
            visitDateTrigger.setAttribute('aria-expanded', 'false');
        };
        visitDateTrigger.addEventListener('click', (event) => {
            event.preventDefault();
            const nextOpen = !visitDatePicker.classList.contains('is-open');
            visitDatePicker.classList.toggle('is-open', nextOpen);
            visitDateTrigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        });
        visitModal.addEventListener('click', (event) => {
            if (!visitDatePicker.classList.contains('is-open')) {
                return;
            }
            const target = event.target;
            if (target instanceof Element && visitDateField.contains(target)) {
                return;
            }
            closePicker();
        });
        visitDatePicker.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            const allowedRaw = visitDatePicker.dataset.allowed || '[]';
            let allowedDays = [];
            try {
                allowedDays = JSON.parse(allowedRaw);
            } catch {
                allowedDays = [];
            }
            if (target.matches('[data-visit-cal-prev]')) {
                const currentMonthIso = visitDatePicker.dataset.monthIso || '';
                const next = shiftMonthIso(currentMonthIso, -1);
                if (next) {
                    visitDatePicker.dataset.monthIso = next;
                    visitDatePicker.innerHTML = buildVisitCalendarMarkup(next, visitDatePicker.dataset.selectedIso || '', allowedDays);
                }
                return;
            }
            if (target.matches('[data-visit-cal-next]')) {
                const currentMonthIso = visitDatePicker.dataset.monthIso || '';
                const next = shiftMonthIso(currentMonthIso, 1);
                if (next) {
                    visitDatePicker.dataset.monthIso = next;
                    visitDatePicker.innerHTML = buildVisitCalendarMarkup(next, visitDatePicker.dataset.selectedIso || '', allowedDays);
                }
                return;
            }
            if (target.matches('[data-visit-cal-day]')) {
                const tripDate = target.getAttribute('data-trip-date') || '';
                const iso = target.getAttribute('data-iso') || '';
                if (!tripDate || !iso) {
                    return;
                }
                visitDateInput.value = tripDate;
                visitDatePicker.dataset.selectedIso = iso;
                const label = formatExpenseDateLabel(tripDate) || '';
                const labelEl = visitDateTrigger.querySelector('.ExpenseDateValue');
                if (labelEl) {
                    labelEl.textContent = label;
                } else {
                    visitDateTrigger.textContent = label;
                }
                const monthIso = monthIsoFromDateStr(tripDate);
                if (monthIso) {
                    visitDatePicker.dataset.monthIso = monthIso;
                    visitDatePicker.innerHTML = buildVisitCalendarMarkup(monthIso, iso, allowedDays);
                } else {
                    visitDatePicker.innerHTML = buildVisitCalendarMarkup(visitDatePicker.dataset.monthIso || '', iso, allowedDays);
                }
                const activePlaceId = uiState.activeNotePlaceId;
                if (activePlaceId) {
                    saveState();
                    captureVisitModalDraft(activePlaceId);
                }
                closePicker();
            }
        });
    }

    const visitTimeField = plannerMain.querySelector('[data-visit-time-field="true"]');
    const visitTimeTrigger = plannerMain.querySelector('[data-visit-time-trigger="true"]');
    const visitTimePicker = plannerMain.querySelector('[data-visit-time-picker="true"]');
    const visitTimeInput = plannerMain.querySelector('[data-visit-time="true"]');
    if (visitModal && visitTimeField && visitTimeTrigger && visitTimePicker && visitTimeInput) {
        const closePicker = () => {
            visitTimePicker.classList.remove('is-open');
            visitTimeTrigger.setAttribute('aria-expanded', 'false');
        };
        visitTimeTrigger.addEventListener('click', (event) => {
            event.preventDefault();
            const nextOpen = !visitTimePicker.classList.contains('is-open');
            visitTimePicker.classList.toggle('is-open', nextOpen);
            visitTimeTrigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        });
        visitModal.addEventListener('click', (event) => {
            if (!visitTimePicker.classList.contains('is-open')) {
                return;
            }
            const target = event.target;
            if (target instanceof Element && visitTimeField.contains(target)) {
                return;
            }
            closePicker();
        });
        visitTimePicker.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }
            if (target.matches('[data-visit-time-option]')) {
                const nextValue = target.getAttribute('data-visit-time-option') || '';
                visitTimeInput.value = nextValue;
                const labelEl = visitTimeTrigger.querySelector('.VisitTimeValue');
                if (labelEl) {
                    labelEl.textContent = nextValue || 'Select time';
                } else {
                    visitTimeTrigger.textContent = nextValue || 'Select time';
                }
                visitTimePicker.querySelectorAll('[data-visit-time-option]').forEach((button) => {
                    button.classList.toggle('is-selected', button.getAttribute('data-visit-time-option') === nextValue);
                });
                const activePlaceId = uiState.activeNotePlaceId;
                if (activePlaceId) {
                    saveState();
                    captureVisitModalDraft(activePlaceId);
                }
                closePicker();
            }
        });
    }

    const visitMediaInput = plannerMain.querySelector('[data-visit-media-input="true"]');
    const visitMediaAdd = plannerMain.querySelector('[data-visit-media-add="true"]');
    const visitMediaTrigger = plannerMain.querySelector('[data-visit-media-trigger="true"]');
    if (visitMediaInput && visitMediaAdd) {
        if (visitMediaTrigger) {
            visitMediaTrigger.addEventListener('click', (event) => {
                const target = event.target;
                if (target instanceof Element && (target.closest('[data-visit-media-remove]') || target.closest('[data-visit-media-add]'))) {
                    return;
                }
                visitMediaInput.click();
            });
        }
        visitMediaAdd.addEventListener('click', (event) => {
            event.preventDefault();
            visitMediaInput.click();
        });
        visitMediaInput.addEventListener('change', () => {
            const placeId = uiState.activeNotePlaceId;
            const files = Array.from(visitMediaInput.files || []);
            visitMediaInput.value = '';
            if (!placeId || files.length === 0) {
                return;
            }
            files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const place = getPlaceById(placeId);
                    if (!place) {
                        return;
                    }
                    saveState();
                    captureVisitModalDraft(placeId);
                    const details = ensureVisitDetails(place);
                    if (!details) {
                        return;
                    }
                    details.media.push(String(reader.result || ''));
                    const scrollTop = plannerMain.scrollTop;
                    renderPlanner();
                    plannerMain.scrollTop = scrollTop;
                };
                reader.readAsDataURL(file);
            });
        });
        plannerMain.querySelectorAll('[data-visit-media-remove]').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const placeId = uiState.activeNotePlaceId;
                const index = Number(button.dataset.visitMediaRemove);
                if (!placeId || !Number.isFinite(index)) {
                    return;
                }
                const place = getPlaceById(placeId);
                if (!place) {
                    return;
                }
                saveState();
                captureVisitModalDraft(placeId);
                const details = ensureVisitDetails(place);
                if (!details) {
                    return;
                }
                details.media.splice(index, 1);
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            });
        });
    }
    plannerMain.querySelectorAll('[data-visit-save]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.visitSave;
            const place = getPlaceById(placeId);
            if (!place) {
                uiState.activeNotePlaceId = null;
                return;
            }
            const value = plannerMain.querySelector(`[data-visit-textarea="${placeId}"]`)?.value || '';
            const visitedDate = plannerMain.querySelector('[data-visit-date="true"]')?.value || '';
            const visitedTime = plannerMain.querySelector('[data-visit-time="true"]')?.value || '';
            saveState();
            place.visitNote = value.trim();
            const existing = ensureVisitDetails(place) || {};
            const media = Array.isArray(existing.media) ? existing.media : [];
            place.visitDetails = {
                ...existing,
                visited: true,
                notes: value.trim() || existing.notes || '',
                media,
                visitedDate: String(visitedDate).trim() || existing.visitedDate || null,
                visitedTime: String(visitedTime).trim() || existing.visitedTime || null
            };
            uiState.activeNotePlaceId = null;
            uiState.chooseLocationPlaceId = placeId;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    const chooseOverlay = plannerMain.querySelector('[data-choose-location-overlay]');
    if (chooseOverlay) {
        chooseOverlay.addEventListener('click', (event) => {
            if (event.target === chooseOverlay) {
                uiState.chooseLocationPlaceId = null;
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
        });
    }
    const chooseClose = plannerMain.querySelector('[data-choose-location-close]');
    if (chooseClose) {
        chooseClose.addEventListener('click', () => {
            uiState.chooseLocationPlaceId = null;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }
    const chooseSelect = plannerMain.querySelector('[data-choose-location-select]');
    if (chooseSelect) {
        chooseSelect.addEventListener('click', () => {
            const placeId = uiState.chooseLocationPlaceId;
            const place = placeId ? getPlaceById(placeId) : null;
            const locationValue = plannerMain.querySelector('[data-choose-location-input="true"]')?.value || '';
            if (place) {
                saveState();
                place.visitLocation = locationValue.trim();
            }
            uiState.chooseLocationPlaceId = null;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }

    const journalOverlay = plannerMain.querySelector('[data-journal-overlay]');
    if (journalOverlay) {
        journalOverlay.addEventListener('click', (event) => {
            if (event.target === journalOverlay) {
                uiState.activeJournalPlaceId = null;
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
        });
    }
    plannerMain.querySelectorAll('[data-journal-close]').forEach((button) => {
        button.addEventListener('click', () => {
            uiState.activeJournalPlaceId = null;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    const bulkDeleteButton = plannerMain.querySelector('[data-bulk-delete]');
    if (bulkDeleteButton) {
        bulkDeleteButton.addEventListener('click', () => bulkDeleteSelectedPlaces());
    }
    const bulkMoveSelect = plannerMain.querySelector('[data-bulk-move]');
    if (bulkMoveSelect) {
        bulkMoveSelect.addEventListener('change', () => {
            const destination = bulkMoveSelect.value;
            bulkMoveSelect.value = '';
            if (destination) {
                bulkMoveSelectedPlaces(destination);
            }
        });
    }
    const bulkCopySelect = plannerMain.querySelector('[data-bulk-copy]');
    if (bulkCopySelect) {
        bulkCopySelect.addEventListener('change', () => {
            const destination = bulkCopySelect.value;
            bulkCopySelect.value = '';
            if (destination) {
                bulkCopySelectedPlaces(destination);
            }
        });
    }
    const bulkClearButton = plannerMain.querySelector('[data-bulk-clear]');
    if (bulkClearButton) {
        bulkClearButton.addEventListener('click', () => {
            clearSelection();
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    }

    plannerMain.querySelectorAll('[data-open-map], [data-scroll-place]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.openMap || button.dataset.scrollPlace;
            trip.map.selectedPlaceId = placeId;
            renderMapPanel();
            bindMapPanelEvents();
            const card = plannerMain.querySelector(`[data-place-id="${placeId}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('PlannerPlaceCard--focus');
                window.setTimeout(() => card.classList.remove('PlannerPlaceCard--focus'), 1000);
            }
        });
    });

    plannerMain.querySelectorAll('[data-place-id]').forEach((card) => {
        card.addEventListener('click', (event) => {
            const ignored = event.target.closest('button, select, input, textarea, a, .PlannerPlaceCard__actions, .PlaceActions');
            if (ignored || card.classList.contains('is-dragging')) {
                return;
            }
            const placeId = card.dataset.placeId;
            uiState.activePlaceId = uiState.activePlaceId === placeId ? null : placeId;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });

    plannerMain.querySelectorAll('[data-item-id]').forEach((card) => {
        card.addEventListener('dragstart', (event) => {
            const ignored = event.target?.closest?.('button, select, input, textarea, a');
            if (ignored) {
                event.preventDefault();
                return;
            }
            const itemId = card.dataset.itemId;
            uiState.dragContext = {
                itemId,
                sourceType: card.dataset.sourceType,
                sourceId: card.dataset.sourceId
            };
            if (event?.dataTransfer && itemId) {
                event.dataTransfer.setData('id', itemId);
                event.dataTransfer.setData('text/plain', itemId);
                event.dataTransfer.effectAllowed = 'move';
            }
            card.classList.add('is-dragging');
        });
        card.addEventListener('dragover', (event) => {
            event.preventDefault();
        });
        card.addEventListener('drop', (event) => {
            event.preventDefault();

            const draggedId = uiState.dragContext?.itemId
                || event.dataTransfer?.getData?.('id')
                || event.dataTransfer?.getData?.('text/plain');
            if (!draggedId) {
                uiState.dragContext = null;
                return;
            }
            if (draggedId === card.dataset.itemId) {
                uiState.dragContext = null;
                return;
            }

            const toType = card.dataset.sourceType;
            const toId = card.dataset.sourceId;
            const rect = card.getBoundingClientRect();
            const halfway = rect.top + rect.height / 2;
            const insertionOffset = event.clientY > halfway ? 1 : 0;
            const targetIndex = getContainer(toType, toId).findIndex((item) => item.id === card.dataset.itemId) + insertionOffset;

            moveItem({
                itemId: draggedId,
                toType,
                toId,
                targetIndex
            });

            plannerMain.querySelectorAll('.PlannerDropSlot.is-active, .PlannerDropSlot.drag-over').forEach((slot) => {
                slot.classList.remove('is-active');
                slot.classList.remove('drag-over');
            });
            uiState.dragContext = null;
        });
        card.addEventListener('dragend', () => {
            uiState.dragContext = null;
            card.classList.remove('is-dragging');
            plannerMain.querySelectorAll('.PlannerDropSlot.is-active, .PlannerDropSlot.drag-over').forEach((slot) => {
                slot.classList.remove('is-active');
                slot.classList.remove('drag-over');
            });
        });
    });

    plannerMain.querySelectorAll('.PlannerDropSlot').forEach((slot) => {
        slot.addEventListener('dragover', (event) => {
            event.preventDefault();
            plannerMain.querySelectorAll('.PlannerDropSlot.is-active').forEach((active) => active.classList.remove('is-active'));
            slot.classList.add('is-active');
            slot.classList.add('drag-over');
        });
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('is-active');
            slot.classList.remove('drag-over');
        });
        slot.addEventListener('drop', (event) => {
            event.preventDefault();
            slot.classList.remove('is-active');
            slot.classList.remove('drag-over');

            const itemId = uiState.dragContext?.itemId
                || event.dataTransfer?.getData?.('id')
                || event.dataTransfer?.getData?.('text/plain');
            if (!itemId) {
                uiState.dragContext = null;
                return;
            }

            const toType = slot.dataset.dropType;
            const toId = slot.dataset.dropId;
            const targetIndex = Number(slot.dataset.dropIndex);

            moveItem({
                itemId,
                toType,
                toId,
                targetIndex
            });
            uiState.dragContext = null;
        });
    });

    const notesInput = document.getElementById('plannerNotesInput');
    if (notesInput) {
        notesInput.addEventListener('input', () => {
            saveState();
            trip.notes = notesInput.value;
        });
    }

}

function bindMapPanelEvents() {
    plannerMapPanel.querySelectorAll('[data-open-map], [data-send-to-pool], [data-scroll-place]').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.sendToPool) {
                sendSuggestionToPool(button.dataset.sendToPool);
                return;
            }
            if (button.dataset.scrollPlace) {
                trip.map.selectedPlaceId = button.dataset.scrollPlace;
                renderMapPanel();
                bindMapPanelEvents();
                const card = plannerMain.querySelector(`[data-place-id="${button.dataset.scrollPlace}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            trip.map.selectedPlaceId = button.dataset.openMap;
            renderMapPanel();
            bindMapPanelEvents();
        });
    });
    const mapEl = document.getElementById('leafletMap');
    const mapMatches = Boolean(leafletMap && mapEl && leafletMap._container === mapEl);
    if (!mapMatches) {
        initMap();
        return;
    }
    initMapControls();
    updateMarkers();
    window.setTimeout(() => {
        leafletMap?.invalidateSize?.();
    }, 0);
}

function bindTopbarMenuEvents() {
    const menuBtn = document.getElementById('topbar-menu-btn');
    const menuItems = document.getElementById('topbar-menu-items');
    if (!menuBtn || !menuItems) {
        return;
    }
    menuBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = menuItems.classList.contains('show');
        menuItems.classList.toggle('show', !isOpen);
        menuBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
    menuItems.querySelectorAll('[data-topbar-menu]').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.stopPropagation();
            menuItems.classList.remove('show');
            menuBtn.setAttribute('aria-expanded', 'false');
            const action = item.dataset.topbarMenu;
            if (action === 'trip-settings') {
                openTripSettings();
                return;
            }
            if (action === 'trip-journal') {
                openTripJournalOverview();
                return;
            }
            if (action === 'print-trip') {
                openPrintTripPage();
                return;
            }
            if (action === 'trip-preferences') {
                openTripPreferencesModal();
                return;
            }
            if (action === 'engine-suggestions') {
                openEngineSuggestionsFlow();
            }
        });
    });
    document.addEventListener('click', () => {
        menuItems.classList.remove('show');
        menuBtn.setAttribute('aria-expanded', 'false');
    });
}

let topbarEngineButtonsBound = false;
function bindTopbarEngineButtons() {
    if (topbarEngineButtonsBound) {
        return;
    }
    topbarEngineButtonsBound = true;
    document.getElementById('trip-prefs-btn')?.addEventListener('click', () => openTripPreferencesModal());
    document.getElementById('engine-suggestions-btn')?.addEventListener('click', () => openEngineSuggestionsFlow());
}

function bindTripModalEvents() {
    const settingsOverlay = plannerMain.querySelector('[data-trip-settings-overlay]');
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', (event) => {
            if (event.target === settingsOverlay) {
                closeTripModals();
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
        });
    }
    plannerMain.querySelectorAll('[data-trip-settings-close]').forEach((button) => {
        button.addEventListener('click', () => {
            closeTripModals();
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });
    const settingsSave = plannerMain.querySelector('[data-trip-settings-save]');
    if (settingsSave) {
        settingsSave.addEventListener('click', saveTripSettingsFromModal);
    }

    const journalOverlay = plannerMain.querySelector('[data-trip-journal-overlay]');
    if (journalOverlay) {
        journalOverlay.addEventListener('click', (event) => {
            if (event.target === journalOverlay) {
                closeTripModals();
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
            }
        });
    }
    plannerMain.querySelectorAll('[data-trip-journal-close]').forEach((button) => {
        button.addEventListener('click', () => {
            closeTripModals();
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });
    plannerMain.querySelectorAll('[data-open-journal-from-overview]').forEach((button) => {
        button.addEventListener('click', () => {
            const placeId = button.dataset.openJournalFromOverview;
            closeTripModals();
            uiState.activeJournalPlaceId = placeId;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        });
    });
}

// ==================== AUTHENTICATION ====================
document.addEventListener('DOMContentLoaded', () => {
    bindTopbarMenuEvents();
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await session.logout();
            session.redirectToLogin();
        });
    }
});

function updateActiveSidebar() {
    const sections = getSidebarItems().flatMap((item) => [item, ...(item.children || [])]);
    let activeId = sections[0]?.id || 'section-overview';
    const mainRect = plannerMain.getBoundingClientRect();
    sections.forEach((section) => {
        const element = document.getElementById(section.id);
        if (!element) {
            return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.top - mainRect.top <= 120) {
            activeId = section.id;
        }
    });
    uiState.activeSidebarId = activeId;
    plannerSidebar.querySelectorAll('.is-active').forEach((item) => item.classList.remove('is-active'));
    const active = plannerSidebar.querySelector(`[data-scroll-target="${activeId}"]`);
    if (active) {
        active.classList.add('is-active');
    }
}

function bindGlobalEvents() {
    plannerMain.addEventListener('scroll', updateActiveSidebar);
    plannerToast.addEventListener('click', (event) => {
        const button = event.target.closest('[data-toast-go]');
        if (!button || !uiState.pendingToastTarget) {
            return;
        }
        scrollToSection(uiState.pendingToastTarget);
        hideToast();
    });

    document.addEventListener('click', (event) => {
        const previewApply = event.target?.closest?.('[data-opt-preview-apply]');
        if (previewApply) {
            applyOptimizationPreview();
            return;
        }
        const previewCancel = event.target?.closest?.('[data-opt-preview-cancel]');
        if (previewCancel) {
            closeOptimizationPreview();
            return;
        }
        const previewOverlay = event.target?.closest?.('[data-opt-preview-overlay]');
        if (previewOverlay && event.target === previewOverlay) {
            closeOptimizationPreview();
            return;
        }
        const optimizeDay = event.target?.closest?.('[data-optimize-day]');
        if (optimizeDay) {
            optimizeRouteForDay(optimizeDay.dataset.optimizeDay);
            return;
        }
        const tripPrefsOpen = event.target?.closest?.('[data-trip-prefs-open]');
        if (tripPrefsOpen) {
            openTripPreferencesModal();
            return;
        }
        const engineFetch = event.target?.closest?.('[data-engine-fetch]');
        if (engineFetch) {
            openEngineSuggestionsFlow();
            return;
        }
        const browseAll = event.target?.closest?.('[data-action="browse-all"]');
        if (browseAll) {
            openExplorePanel();
            return;
        }
        const exploreClose = event.target?.closest?.('[data-explore-close]');
        if (exploreClose) {
            mapUi.isExploreOpen = false;
            mapUi.explorePhase = 'landing';
            renderExplorePanel();
            return;
        }
        const explorePhase = event.target?.closest?.('[data-explore-phase]');
        if (explorePhase) {
            mapUi.explorePhase = explorePhase.dataset.explorePhase === 'results' ? 'results' : 'landing';
            if (mapUi.explorePhase === 'landing') {
                const drawer = document.getElementById('exploreDrawer');
                if (drawer) {
                    drawer.dataset.query = '';
                }
            }
            renderExplorePanel();
            return;
        }
        const exploreJump = event.target?.closest?.('[data-explore-jump]');
        if (exploreJump) {
            const target = exploreJump.dataset.exploreJump;
            const drawer = document.getElementById('exploreDrawer');
            if (drawer && target === 'categories') {
                drawer.querySelector('#exploreLandingCategories')?.scrollIntoView?.({ block: 'start' });
            }
            if (drawer && target === 'hotels') {
                drawer.querySelector('#exploreLandingHotels')?.scrollIntoView?.({ block: 'start' });
            }
            return;
        }
        const exploreCategory = event.target?.closest?.('[data-explore-category]');
        if (exploreCategory) {
            const key = exploreCategory.dataset.exploreCategory;
            mapUi.explorePhase = 'results';
            Promise.resolve(handleCategorySearch(key)).then(() => {
                renderExplorePanel();
            });
            return;
        }
        const exploreItem = event.target?.closest?.('[data-explore-item]');
        if (exploreItem) {
            selectExploreResult(exploreItem.dataset.exploreItem);
            return;
        }
        if (event.target?.dataset?.action) {
            const action = event.target.dataset.action;
            const activeMenu = uiState.activeInsertMenu;
            uiState.activeInsertMenu = null;
            const containerType = activeMenu?.containerType || (activeMenu?.dayId ? 'day' : null);
            const containerId = activeMenu?.containerId || activeMenu?.dayId || null;
            const externalContainerType = containerType === 'pool' ? 'places' : 'itinerary';
            const externalContainerId = containerType === 'pool' ? 'placesToVisit' : containerId;

            if (action === 'add-place' && containerId) {
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
                insertItem(externalContainerType, externalContainerId, activeMenu?.index ?? null, 'place');
                return;
            }

            if (action === 'add-note' && containerId) {
                const noteItem = insertItem(externalContainerType, externalContainerId, activeMenu?.index ?? null, 'note');
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
                if (noteItem) {
                    window.setTimeout(() => {
                        const input = plannerMain.querySelector(`[data-note-input="${noteItem.id}"]`);
                        if (input) {
                            input.focus();
                            input.select?.();
                        }
                    }, 0);
                }
                return;
            }

            if (action === 'add-checklist' && containerId) {
                const checklistItem = insertItem(externalContainerType, externalContainerId, activeMenu?.index ?? null, 'checklist');
                const scrollTop = plannerMain.scrollTop;
                renderPlanner();
                plannerMain.scrollTop = scrollTop;
                if (checklistItem) {
                    window.setTimeout(() => {
                        const input = plannerMain.querySelector(`[data-checklist-title="${checklistItem.id}"]`);
                        if (input) {
                            input.focus();
                            input.select?.();
                        }
                    }, 0);
                }
                return;
            }

            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
            showToast('This action is UI-only for now.');
            return;
        }

        if (event.target?.classList?.contains('InsertBtn')) {
            const zone = event.target.closest('.InsertZone');
            if (!zone) {
                return;
            }
            const containerType = zone.dataset.containerType || (zone.dataset.dayId ? 'day' : null);
            const containerId = zone.dataset.containerId || zone.dataset.dayId || null;
            const index = Number(zone.dataset.index);
            const current = uiState.activeInsertMenu;
            const currentMatches = Boolean(
                current
                && (
                    (current.containerType && current.containerId)
                        ? (current.containerType === containerType && current.containerId === containerId)
                        : (current.dayId === containerId)
                )
                && current.index === index
            );
            if (currentMatches) {
                uiState.activeInsertMenu = null;
            } else {
                uiState.activeInsertMenu = containerType === 'day'
                    ? {
                        containerType,
                        containerId,
                        dayId: containerId,
                        index
                    }
                    : {
                        containerType,
                        containerId,
                        index
                    };
            }
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
            return;
        }

        if (uiState.activeInsertMenu && !event.target.closest('.InsertMenu')) {
            uiState.activeInsertMenu = null;
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
        }

        if (event.target?.id === 'save-trip-btn') {
            saveCurrentTrip();
            return;
        }

        const card = event.target.closest('.TripCard');
        if (card) {
            const id = Number(card.dataset.tripId);
            loadTrip(id);
            return;
        }

        if (event.target?.id === 'start-planning') {
            const tripName = document.getElementById('trip-name')?.value || '';
            const startInput = document.getElementById('start-date')?.value || '';
            const endInput = document.getElementById('end-date')?.value || '';
            if (!startInput || !endInput) {
                return;
            }
            const start = new Date(startInput);
            const end = new Date(endInput);
            if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
                return;
            }
            const days = [];
            let current = new Date(start);
            let index = 1;
            while (current <= end) {
                days.push({
                    id: `day-${index}`,
                    label: `Day ${index}`,
                    shortLabel: `Day ${index}`,
                    date: current.toDateString(),
                    items: []
                });
                current.setDate(current.getDate() + 1);
                index += 1;
            }
            saveState();
            trip.name = tripName.trim() || trip.name || 'My Trip';
            trip.title = tripName.trim() ? `Trip to ${tripName.trim()}` : (trip.title || 'My Trip');
            trip.dates = formatTripDateRange(startInput, endInput);
            trip.startDate = startInput;
            trip.endDate = endInput;
            trip.days = days;
            trip.expenses = [];
            appMode = 'planner';
            renderPlanner();
            return;
        }

        const button = event.target.closest('[data-ui-action]');
        if (!button) {
            return;
        }
        const action = button.dataset.uiAction;
        if (action === 'undo') {
            undo();
            return;
        }
        if (action === 'redo') {
            redo();
            return;
        }
        showToast('This frontend keeps the planner UI active without backend actions.');
    });

    document.addEventListener('input', (event) => {
        const input = event.target?.closest?.('[data-explore-search]');
        const drawer = document.getElementById('exploreDrawer');
        if (!input || !drawer) {
            return;
        }
        drawer.dataset.query = input.value || '';
        renderExplorePanel();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        if (uiState.tripSettingsOpen || uiState.tripJournalOverviewOpen) {
            closeTripModals();
            const scrollTop = plannerMain.scrollTop;
            renderPlanner();
            plannerMain.scrollTop = scrollTop;
            return;
        }
        if (!(uiState.selectedItems || []).length) {
            return;
        }
        clearSelection();
        const scrollTop = plannerMain.scrollTop;
        renderPlanner();
        plannerMain.scrollTop = scrollTop;
    });

    document.addEventListener('click', () => {
        plannerMain.querySelectorAll('[data-section-menu-items].show').forEach((open) => open.classList.remove('show'));
        plannerMain.querySelectorAll('[data-section-menu-button]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    });

    document.addEventListener('dragstart', (event) => {
        const row = event.target?.closest?.('[data-arrangement-select]');
        if (!row) {
            return;
        }
        if (!row.closest('[data-arrangement-overlay]')) {
            return;
        }
        arrangementDraggedSectionId = row.dataset.arrangementSelect || null;
        if (event.dataTransfer && arrangementDraggedSectionId) {
            event.dataTransfer.setData('text/plain', arrangementDraggedSectionId);
            event.dataTransfer.effectAllowed = 'move';
        }
    });

    document.addEventListener('dragover', (event) => {
        const row = event.target?.closest?.('[data-arrangement-select]');
        if (!row) {
            return;
        }
        if (!row.closest('[data-arrangement-overlay]')) {
            return;
        }
        event.preventDefault();
    });

    document.addEventListener('drop', (event) => {
        const row = event.target?.closest?.('[data-arrangement-select]');
        if (!row) {
            return;
        }
        if (!row.closest('[data-arrangement-overlay]')) {
            return;
        }
        event.preventDefault();

        const targetSectionId = row.dataset.arrangementSelect;
        const draggedSectionId = arrangementDraggedSectionId || event.dataTransfer?.getData?.('text/plain') || null;
        if (!draggedSectionId || !targetSectionId || draggedSectionId === targetSectionId) {
            return;
        }

        const draggedIsCustom = draggedSectionId.startsWith('section-custom-');
        const targetIsCustom = targetSectionId.startsWith('section-custom-');
        const draggedIsDay = draggedSectionId.startsWith('section-') && trip.days.some((day) => `section-${day.id}` === draggedSectionId);
        const targetIsDay = targetSectionId.startsWith('section-') && trip.days.some((day) => `section-${day.id}` === targetSectionId);

        if (draggedIsCustom && targetIsCustom) {
            const draggedListId = draggedSectionId.slice('section-custom-'.length);
            const targetListId = targetSectionId.slice('section-custom-'.length);
            const draggedIndex = trip.customLists.findIndex((list) => list.id === draggedListId);
            const targetIndex = trip.customLists.findIndex((list) => list.id === targetListId);
            if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
                return;
            }
            saveState();
            const [moved] = trip.customLists.splice(draggedIndex, 1);
            const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
            trip.customLists.splice(insertIndex, 0, moved);
        } else if (draggedIsDay && targetIsDay) {
            const draggedDayId = draggedSectionId.slice('section-'.length);
            const targetDayId = targetSectionId.slice('section-'.length);
            const draggedIndex = trip.days.findIndex((day) => day.id === draggedDayId);
            const targetIndex = trip.days.findIndex((day) => day.id === targetDayId);
            if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
                return;
            }
            saveState();
            const [moved] = trip.days.splice(draggedIndex, 1);
            const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
            trip.days.splice(insertIndex, 0, moved);
        } else {
            return;
        }

        arrangementDraggedSectionId = null;
        const scrollTop = plannerMain.scrollTop;
        renderPlanner();
        plannerMain.scrollTop = scrollTop;
    });

    document.addEventListener('dragend', (event) => {
        const row = event.target?.closest?.('[data-arrangement-select]');
        if (!row) {
            return;
        }
        if (!row.closest('[data-arrangement-overlay]')) {
            return;
        }
        arrangementDraggedSectionId = null;
    });
}

ensureDragStyles();
bindGlobalEvents();
initPlannerApp();
