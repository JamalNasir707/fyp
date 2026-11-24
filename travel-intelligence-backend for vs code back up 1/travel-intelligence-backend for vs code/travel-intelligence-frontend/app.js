// --- Configuration ---
const API_BASE_URL = 'http://127.0.0.1:8000';

// --- State Management ---
let map;
let routeLayer;
let markersLayer;
let markersByName = new Map();

const liked_categories = [];
const disliked_categories = [];

const state = {
    likedCategories: new Set(),
    dislikedCategories: new Set(),
    removedNames: new Set(),
    feedbackByName: new Map(),
    liked: [],
    disliked: [],
    removed: [],
    avoidCrowds: false,
    lastPayload: null,
    lastResponse: null,
};

// --- DOM Elements ---
const form = document.getElementById('optimize-form');
const submitBtn = document.getElementById('submit-btn');
const resultsContainer = document.getElementById('results-container');
const errorDiv = document.getElementById('error-message');
const itineraryBody = document.querySelector('#itinerary-table tbody');
const updateBtn = document.getElementById('update-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const feedbackPanel = document.getElementById('feedback-panel');
const likedCatsEl = document.getElementById('liked-categories');
const dislikedCatsEl = document.getElementById('disliked-categories');
const removedPlacesEl = document.getElementById('removed-places');

const qBudget = document.getElementById('q_budget');
const qDuration = document.getElementById('q_duration');
const qCompanions = document.getElementById('q_companions');
const qStyle = document.getElementById('q_style');
const qPersonality = document.getElementById('q_personality');
const qEnvironment = document.getElementById('q_environment');
const qCrowd = document.getElementById('q_crowd');
const qCondition = document.getElementById('q_condition');
const smartGenerateBtn = document.getElementById('smart-generate-btn');
const smartPreview = document.getElementById('smart-preview');

// --- Initialization ---
function initMap() {
    // Initial view: Pakistan coordinates
    map = L.map('map').setView([30.3753, 69.3451], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    routeLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);
}

// --- API Calls ---
async function fetchOptimization(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Backend failed to process request');
        }

        return result;
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}

function normalizeText(v) {
    return (v ?? '').toString().trim();
}

function normalizeCategory(v) {
    return normalizeText(v).toLowerCase();
}

function escapeHtml(v) {
    return normalizeText(v)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function syncFeedbackArrays() {
    liked_categories.length = 0;
    disliked_categories.length = 0;
    Array.from(state.likedCategories).sort().forEach(c => liked_categories.push(c));
    Array.from(state.dislikedCategories).sort().forEach(c => disliked_categories.push(c));
    state.liked = Array.from(state.likedCategories).sort();
    state.disliked = Array.from(state.dislikedCategories).sort();
    state.removed = Array.from(state.removedNames).sort();
}

function setFeedbackForLocation(name, category, status) {
    const n = normalizeText(name);
    const c = normalizeCategory(category);

    if (!n) return;

    const current = state.feedbackByName.get(n) || 'neutral';

    if (status === 'like') {
        if (current === 'like') {
            // Toggle OFF -> neutral
            if (c) {
                state.likedCategories.delete(c);
            }
            state.feedbackByName.set(n, 'neutral');
        } else {
            // Set like and clear dislike
            if (c) {
                state.likedCategories.add(c);
                state.dislikedCategories.delete(c);
            }
            state.feedbackByName.set(n, 'like');
        }
    } else if (status === 'dislike') {
        if (current === 'dislike') {
            // Toggle OFF -> neutral
            if (c) {
                state.dislikedCategories.delete(c);
            }
            state.feedbackByName.set(n, 'neutral');
        } else {
            // Set dislike and clear like
            if (c) {
                state.dislikedCategories.add(c);
                state.likedCategories.delete(c);
            }
            state.feedbackByName.set(n, 'dislike');
        }
    } else if (status === 'neutral') {
        if (c) {
            state.likedCategories.delete(c);
            state.dislikedCategories.delete(c);
        }
        state.feedbackByName.set(n, 'neutral');
    }

    syncFeedbackArrays();
    renderFeedbackPanel();
    applyRowStyles(n);
    applyMarkerStyles(n);
    if (updateBtn) updateBtn.disabled = false;
}

function toggleRemoveLocation(name) {
    const n = normalizeText(name);
    if (!n) return;
    if (state.removedNames.has(n)) {
        state.removedNames.delete(n);
    } else {
        state.removedNames.add(n);
    }
    syncFeedbackArrays();
    renderFeedbackPanel();
    applyRowStyles(n);
    applyMarkerStyles(n);
    if (updateBtn) updateBtn.disabled = false;
}

function renderFeedbackPanel() {
    if (!feedbackPanel) return;

    const renderPills = (items, type) => {
        if (!items.length) return '-';
        return items
            .map(v => `<span class="pill ${type}">${escapeHtml(v)}</span>`)
            .join('');
    };

    const liked = Array.from(state.likedCategories).sort();
    const disliked = Array.from(state.dislikedCategories).sort();
    const removed = Array.from(state.removedNames).sort();

    likedCatsEl.innerHTML = renderPills(liked, 'like');
    dislikedCatsEl.innerHTML = renderPills(disliked, 'dislike');
    removedPlacesEl.innerHTML = renderPills(removed, 'removed');

    if (liked.length || disliked.length || removed.length) {
        feedbackPanel.classList.remove('hidden');
    } else {
        feedbackPanel.classList.add('hidden');
    }
}

// --- UI Updates ---
function clearResults() {
    resultsContainer.classList.add('hidden');
    errorDiv.classList.add('hidden');
    routeLayer.clearLayers();
    markersLayer.clearLayers();
    markersByName = new Map();
    itineraryBody.innerHTML = '';
    if (updateBtn) updateBtn.disabled = true;
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
}

function updateSummary(data) {
    document.getElementById('res-distance').textContent = data.total_distance_km.toFixed(2);
    document.getElementById('res-time').textContent = data.total_time_hours.toFixed(2);
    document.getElementById('res-utility').textContent = data.utility_score.toFixed(2);
}

function applyRowStyles(name) {
    const n = normalizeText(name);
    if (!n) return;
    const row = Array.from(itineraryBody.querySelectorAll('tr')).find(r => r.dataset?.name === n);
    if (!row) return;

    row.classList.remove('liked-row', 'disliked-row', 'removed-row');
    if (state.removedNames.has(n)) {
        row.classList.add('removed-row');
        return;
    }

    const status = state.feedbackByName.get(n);
    if (status === 'like') row.classList.add('liked-row');
    if (status === 'dislike') row.classList.add('disliked-row');
}

function applyMarkerStyles(name) {
    const n = normalizeText(name);
    const marker = markersByName.get(n);
    if (!marker) return;
    marker.setOpacity(state.removedNames.has(n) ? 0.3 : 1.0);
}

function updateItinerary(itinerary, routeStops) {
    const categoryByName = new Map(
        (routeStops || []).map(s => [normalizeText(s.name), normalizeText(s.category)])
    );

    itinerary.forEach(item => {
        const name = normalizeText(item.name);
        const category = categoryByName.get(name) || '';

        const row = document.createElement('tr');
        row.dataset.name = name;
        row.dataset.category = category;

        const tdOrder = document.createElement('td');
        tdOrder.textContent = String(item.order);

        const tdName = document.createElement('td');
        const strong = document.createElement('strong');
        strong.textContent = name;
        tdName.appendChild(strong);

        const tdCategory = document.createElement('td');
        tdCategory.textContent = category;

        const tdArrival = document.createElement('td');
        tdArrival.textContent = normalizeText(item.arrival_time);

        const tdDuration = document.createElement('td');
        tdDuration.textContent = `${item.visit_duration_hours}h`;

        const tdDeparture = document.createElement('td');
        tdDeparture.textContent = normalizeText(item.departure_time);

        const tdFeedback = document.createElement('td');
        const feedbackWrap = document.createElement('div');
        feedbackWrap.className = 'feedback-actions';

        const likeBtn = document.createElement('button');
        likeBtn.type = 'button';
        likeBtn.className = 'btn-like';
        likeBtn.dataset.action = 'like';
        likeBtn.dataset.name = name;
        likeBtn.dataset.category = category;
        likeBtn.textContent = '👍 Like';

        const dislikeBtn = document.createElement('button');
        dislikeBtn.type = 'button';
        dislikeBtn.className = 'btn-dislike';
        dislikeBtn.dataset.action = 'dislike';
        dislikeBtn.dataset.name = name;
        dislikeBtn.dataset.category = category;
        dislikeBtn.textContent = '👎 Dislike';

        feedbackWrap.appendChild(likeBtn);
        feedbackWrap.appendChild(dislikeBtn);
        tdFeedback.appendChild(feedbackWrap);

        const tdRemove = document.createElement('td');
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove';
        removeBtn.dataset.action = 'remove';
        removeBtn.dataset.name = name;
        removeBtn.textContent = 'Remove';
        tdRemove.appendChild(removeBtn);

        row.appendChild(tdOrder);
        row.appendChild(tdName);
        row.appendChild(tdCategory);
        row.appendChild(tdArrival);
        row.appendChild(tdDuration);
        row.appendChild(tdDeparture);
        row.appendChild(tdFeedback);
        row.appendChild(tdRemove);

        itineraryBody.appendChild(row);
        applyRowStyles(name);
    });
}

function updateMap(routeCoords, routeStops) {
    // 1. Draw Polyline
    const polyline = L.polyline(routeCoords, {
        color: '#e67e22',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10'
    }).addTo(routeLayer);

    // 2. Add Markers
    routeStops.forEach((stop, index) => {
        const name = normalizeText(stop.name);

        const marker = L.marker([stop.lat, stop.lon])
            .bindPopup(`<strong>${index + 1}. ${escapeHtml(stop.name)}</strong><br>${escapeHtml(stop.category)}`)
            .addTo(markersLayer);

        markersByName.set(name, marker);
        applyMarkerStyles(name);

        if (index === 0) marker.openPopup();
    });

    // 3. Adjust View
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
}

function parsePreferredCategories(input) {
    const raw = normalizeText(input);
    if (!raw) return [];
    return raw
        .split(',')
        .map(s => normalizeCategory(s))
        .filter(Boolean);
}

function setFormValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
}

function generateSmartPreferences(answers) {
    const categories = new Set();

    if (answers.travelStyle === 'Adventure') categories.add('mountain');
    if (answers.travelStyle === 'Cultural') categories.add('historical');
    if (answers.environment === 'Nature') categories.add('park');
    if (answers.environment === 'City') categories.add('urban');

    if (answers.personality === 'Introvert') categories.add('quiet');
    if (answers.personality === 'Extrovert') categories.add('urban');

    if (answers.crowdPreference === 'Avoid crowds') categories.delete('urban');

    return Array.from(categories).filter(Boolean);
}

function mapBudgetToMaxBudget(level) {
    if (level === 'Low') return 3000;
    if (level === 'High') return 10000;
    return 5000;
}

function mapDurationToMaxHours(duration) {
    if (duration === '1 Day') return 8;
    if (duration === '4–7 Days') return 20;
    return 12;
}

function renderSmartPreview(categories) {
    if (!smartPreview) return;
    const text = categories.length ? categories.join(', ') : '-';
    smartPreview.innerHTML = `<strong>Generated Preferences:</strong> ${escapeHtml(text)}`;
    smartPreview.classList.remove('hidden');
}

function buildPayloadFromForm() {
    const formData = new FormData(form);

    return {
        province: normalizeText(formData.get('province')),
        max_budget: parseFloat(formData.get('max_budget')),
        max_travel_hours: parseFloat(formData.get('max_travel_hours')),
        start_lat: parseFloat(formData.get('start_lat')),
        start_lon: parseFloat(formData.get('start_lon')),
        preferred_categories: parsePreferredCategories(formData.get('preferred_categories')),
        score_weight: 1.0,
        time_weight: 0.5,
        cost_weight: 0.01,
        use_live_data: formData.get('use_live_data') === 'on',
        avoid_crowds: !!state.avoidCrowds,
    };
}

function buildAdaptivePayload(basePayload) {
    const base = { ...basePayload };

    const liked = Array.from(state.likedCategories);
    const disliked = Array.from(state.dislikedCategories);

    const mergedPreferred = new Set((base.preferred_categories || []).map(normalizeCategory));
    liked.forEach(c => mergedPreferred.add(c));
    disliked.forEach(c => mergedPreferred.delete(c));

    const scoreMultiplier = Math.max(0.2, Math.min(3.0, 1 + (0.15 * liked.length) - (0.10 * disliked.length)));
    base.preferred_categories = Array.from(mergedPreferred).filter(Boolean);
    base.score_weight = Math.max(0.1, Math.min(5.0, (base.score_weight || 1.0) * scoreMultiplier));
    base.avoid_crowds = !!state.avoidCrowds;
    base.feedback = {
        liked: state.liked.slice(),
        disliked: state.disliked.slice(),
        removed: state.removed.slice(),
    };

    return base;
}

function responseContainsRemoved(response) {
    if (!response || !state.removedNames.size) return false;
    const names = (response.optimized_route || []).map(s => normalizeText(s.name));
    return names.some(n => state.removedNames.has(n));
}

async function optimizeWithExclusions(payload, maxAttempts = 5) {
    return await fetchOptimization(payload);
}

function renderFromResponse(data) {
    state.lastResponse = data;

    if (state.removedNames.size) {
        const removed = state.removedNames;
        const beforeCount = (data.optimized_route || []).length;
        data.optimized_route = (data.optimized_route || []).filter(s => !removed.has(normalizeText(s.name)));
        data.itinerary = (data.itinerary || []).filter(i => !removed.has(normalizeText(i.name)));
        data.route_coordinates = [
            [state.lastPayload?.start_lat ?? data?.start_location?.lat, state.lastPayload?.start_lon ?? data?.start_location?.lon],
            ...(data.optimized_route || []).map(s => [s.lat, s.lon]),
        ];
        const afterCount = (data.optimized_route || []).length;
        console.log('[LOCK REMOVED] filtered optimized_route:', { beforeCount, afterCount });
    }

    updateSummary(data);
    updateItinerary(data.itinerary, data.optimized_route);
    updateMap(data.route_coordinates, data.optimized_route);
    resultsContainer.classList.remove('hidden');
    if (updateBtn) updateBtn.disabled = false;
    renderFeedbackPanel();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearResults();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Optimizing...';

    state.lastPayload = buildPayloadFromForm();

    try {
        const data = await optimizeWithExclusions(state.lastPayload);
        renderFromResponse(data);
    } catch (err) {
        showError(err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Optimize Route';
    }
});

itineraryBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;

    const name = normalizeText(btn.dataset.name);
    const row = btn.closest('tr');
    const category = normalizeText(btn.dataset.category || row?.dataset.category || '');

    if (action === 'like') {
        setFeedbackForLocation(name, category, 'like');
    } else if (action === 'dislike') {
        setFeedbackForLocation(name, category, 'dislike');
    } else if (action === 'remove') {
        toggleRemoveLocation(name);
    }
});

if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
        if (!state.lastPayload) return;

        const totalRowsBefore = itineraryBody.querySelectorAll('tr').length;
        const activeRowsBefore = Array.from(itineraryBody.querySelectorAll('tr'))
            .filter(tr => !state.removedNames.has(normalizeText(tr.dataset.name))).length;

        const adaptivePayload = buildAdaptivePayload(state.lastPayload);
        setFormValue('preferred_categories', (adaptivePayload.preferred_categories || []).join(', '));

        console.log('[PARTIAL UPDATE] before:', { totalRowsBefore, activeRowsBefore });
        console.log('[PARTIAL UPDATE] No backend regeneration performed. No auto-refill. Removed places remain locked.');

        const totalRowsAfter = itineraryBody.querySelectorAll('tr').length;
        const activeRowsAfter = Array.from(itineraryBody.querySelectorAll('tr'))
            .filter(tr => !state.removedNames.has(normalizeText(tr.dataset.name))).length;
        console.log('[PARTIAL UPDATE] after:', { totalRowsAfter, activeRowsAfter });

        updateBtn.disabled = true;
        renderFeedbackPanel();
    });
}

if (regenerateBtn) {
    regenerateBtn.addEventListener('click', async () => {
        if (!state.lastPayload) return;

        clearResults();
        updateBtn.disabled = true;
        regenerateBtn.disabled = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Regenerating...';

        const adaptivePayload = buildAdaptivePayload(state.lastPayload);

        try {
            state.feedbackByName = new Map();
            const data = await optimizeWithExclusions(adaptivePayload);

            if (state.removedNames.size) {
                const removedList = Array.from(state.removedNames);
                data.optimized_route = (data.optimized_route || []).filter(s => !state.removedNames.has(normalizeText(s.name)));
                data.itinerary = (data.itinerary || []).filter(i => !state.removedNames.has(normalizeText(i.name)));
                data.route_coordinates = [
                    [adaptivePayload.start_lat, adaptivePayload.start_lon],
                    ...(data.optimized_route || []).map(s => [s.lat, s.lon]),
                ];
                console.log('[REGENERATE] Locked removed places (not re-added):', removedList);
            }

            renderFromResponse(data);
            console.log('[REGENERATE] Completed. No auto-refill on user removals; this is an explicit full regeneration.');
        } catch (err) {
            showError(err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Optimize Route';
            regenerateBtn.disabled = false;
            updateBtn.disabled = false;
        }
    });
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', initMap);

if (smartGenerateBtn) {
    smartGenerateBtn.addEventListener('click', () => {
        const answers = {
            budgetLevel: normalizeText(qBudget?.value),
            tripDuration: normalizeText(qDuration?.value),
            travelCompanions: normalizeText(qCompanions?.value),
            travelStyle: normalizeText(qStyle?.value),
            personality: normalizeText(qPersonality?.value),
            environment: normalizeText(qEnvironment?.value),
            crowdPreference: normalizeText(qCrowd?.value),
            physicalCondition: normalizeText(qCondition?.value),
        };

        const maxBudget = mapBudgetToMaxBudget(answers.budgetLevel);
        const maxHours = mapDurationToMaxHours(answers.tripDuration);
        const categories = generateSmartPreferences(answers);

        setFormValue('province', 'Punjab');
        setFormValue('max_budget', String(maxBudget));
        setFormValue('max_travel_hours', String(maxHours));
        setFormValue('preferred_categories', categories.join(', '));

        state.avoidCrowds = (answers.crowdPreference || '').toLowerCase().includes('avoid');
        renderSmartPreview(categories);
    });
}
