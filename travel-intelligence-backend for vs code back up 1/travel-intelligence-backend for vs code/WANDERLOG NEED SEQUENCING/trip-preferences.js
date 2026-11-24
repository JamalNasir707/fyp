/**
 * Trip engine preferences — questionnaire mapping + flexible /optimize payload.
 * Stored on trip.enginePreferences (per trip, not global).
 */
const ENGINE_API_BASE = 'http://127.0.0.1:8000';

const PROVINCE_COORDS = {
    Punjab: { lat: 31.5204, lon: 74.3587 },
    Sindh: { lat: 24.8607, lon: 67.0011 },
    'Khyber Pakhtunkhwa': { lat: 34.0151, lon: 71.5249 },
    Balochistan: { lat: 30.1798, lon: 66.9750 },
    'Gilgit-Baltistan': { lat: 35.9208, lon: 74.3144 },
    'Azad Kashmir': { lat: 34.3700, lon: 73.4700 }
};

function defaultEnginePreferences() {
    return {
        province: 'Punjab',
        startLat: 31.5204,
        startLon: 74.3587,
        useBudget: true,
        maxBudget: 5000,
        useTimeLimit: true,
        maxTravelHours: 12,
        useCategories: true,
        preferredCategories: ['park', 'scenic'],
        useCrowdFilter: false,
        scoreWeight: 1,
        timeWeight: 0.5,
        costWeight: 0.01,
        questionnaire: {
            budgetLevel: 'Medium',
            tripDuration: '2–3 Days',
            travelCompanions: 'Friends',
            travelStyle: 'Mixed',
            personality: 'Extrovert',
            environment: 'Nature',
            crowdPreference: 'Neutral',
            physicalCondition: 'No issues'
        }
    };
}

function ensureEnginePreferences(trip) {
    if (!trip.enginePreferences || typeof trip.enginePreferences !== 'object') {
        trip.enginePreferences = defaultEnginePreferences();
    }
    const p = trip.enginePreferences;
    if (trip.name && !p.provinceFromTrip) {
        const guess = guessProvinceFromTripName(trip.name);
        if (guess) {
            p.province = guess;
            const c = PROVINCE_COORDS[guess];
            if (c) {
                p.startLat = c.lat;
                p.startLon = c.lon;
            }
        }
    }
    return p;
}

function guessProvinceFromTripName(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('karachi') || n.includes('sindh')) return 'Sindh';
    if (n.includes('islamabad') || n.includes('lahore') || n.includes('punjab')) return 'Punjab';
    if (n.includes('peshawar') || n.includes('swat')) return 'Khyber Pakhtunkhwa';
    if (n.includes('gilgit') || n.includes('hunza')) return 'Gilgit-Baltistan';
    if (n.includes('muzaffarabad') || n.includes('kashmir')) return 'Azad Kashmir';
    if (n.includes('quetta') || n.includes('baloch')) return 'Balochistan';
    if (n.includes('pakistan')) return 'Punjab';
    return null;
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

function generateCategoriesFromQuestionnaire(q) {
    const categories = new Set();
    if (q.travelStyle === 'Adventure') categories.add('mountain');
    if (q.travelStyle === 'Cultural') categories.add('historical');
    if (q.environment === 'Nature') categories.add('park');
    if (q.environment === 'City') categories.add('urban');
    if (q.environment === 'Historical') categories.add('historical');
    if (q.environment === 'Mountains') categories.add('scenic');
    if (q.personality === 'Introvert') categories.add('quiet');
    if (q.personality === 'Extrovert') categories.add('urban');
    if (q.travelStyle === 'Relaxation') categories.add('park');
    return Array.from(categories).filter(Boolean);
}

function applyQuestionnaireToPreferences(prefs, q) {
    prefs.questionnaire = { ...prefs.questionnaire, ...q };
    prefs.maxBudget = mapBudgetToMaxBudget(q.budgetLevel);
    prefs.maxTravelHours = mapDurationToMaxHours(q.tripDuration);
    prefs.preferredCategories = generateCategoriesFromQuestionnaire(q);
    prefs.useCrowdFilter = String(q.crowdPreference || '').toLowerCase().includes('avoid');
    const coords = PROVINCE_COORDS[prefs.province];
    if (coords) {
        prefs.startLat = coords.lat;
        prefs.startLon = coords.lon;
    }
}

function buildOptimizeRequest(trip) {
    const prefs = ensureEnginePreferences(trip);
    const q = prefs.questionnaire || {};
    const payload = {
        province: prefs.province || 'Punjab',
        start_lat: Number(prefs.startLat) || 31.5204,
        start_lon: Number(prefs.startLon) || 74.3587,
        max_budget: prefs.useBudget ? Number(prefs.maxBudget) || 5000 : 999999,
        max_travel_hours: prefs.useTimeLimit ? Number(prefs.maxTravelHours) || 12 : 999,
        preferred_categories: prefs.useCategories ? (prefs.preferredCategories || []) : [],
        score_weight: Number(prefs.scoreWeight) || 1,
        time_weight: Number(prefs.timeWeight) || 0.5,
        cost_weight: Number(prefs.costWeight) || 0.01,
        use_live_data: false,
        avoid_crowds: Boolean(prefs.useCrowdFilter),
        budget_level: q.budgetLevel,
        trip_duration_level: q.tripDuration,
        companions: q.travelCompanions,
        travel_style: q.travelStyle,
        personality: q.personality,
        environment: q.environment,
        crowd_preference: q.crowdPreference
    };
    return { payload, prefs };
}

function readQuestionnaireFromModal(root) {
    const get = (id) => root.querySelector(`#${id}`)?.value?.trim() || '';
    return {
        budgetLevel: get('pref-q-budget') || 'Medium',
        tripDuration: get('pref-q-duration') || '2–3 Days',
        travelCompanions: get('pref-q-companions') || 'Friends',
        travelStyle: get('pref-q-style') || 'Mixed',
        personality: get('pref-q-personality') || 'Extrovert',
        environment: get('pref-q-environment') || 'Nature',
        crowdPreference: get('pref-q-crowd') || 'Neutral',
        physicalCondition: get('pref-q-condition') || 'No issues'
    };
}

function writeQuestionnaireToModal(root, q) {
    const set = (id, val) => {
        const el = root.querySelector(`#${id}`);
        if (el && val != null) el.value = val;
    };
    set('pref-q-budget', q.budgetLevel);
    set('pref-q-duration', q.tripDuration);
    set('pref-q-companions', q.travelCompanions);
    set('pref-q-style', q.travelStyle);
    set('pref-q-personality', q.personality);
    set('pref-q-environment', q.environment);
    set('pref-q-crowd', q.crowdPreference);
    set('pref-q-condition', q.physicalCondition);
}

function renderQuestionnaireFields() {
    const q = defaultEnginePreferences().questionnaire;
    return `
        <div class="TripPrefGrid">
            <label class="TripPrefField"><span>Budget level</span>
                <select id="pref-q-budget">
                    <option value="Low">Low</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="High">High</option>
                </select>
            </label>
            <label class="TripPrefField"><span>Trip duration</span>
                <select id="pref-q-duration">
                    <option value="1 Day">1 Day</option>
                    <option value="2–3 Days" selected>2–3 Days</option>
                    <option value="4–7 Days">4–7 Days</option>
                </select>
            </label>
            <label class="TripPrefField"><span>Companions</span>
                <select id="pref-q-companions">
                    <option value="Solo">Solo</option>
                    <option value="Friends" selected>Friends</option>
                    <option value="Family">Family</option>
                </select>
            </label>
            <label class="TripPrefField"><span>Travel style</span>
                <select id="pref-q-style">
                    <option value="Relaxation">Relaxation</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Mixed" selected>Mixed</option>
                </select>
            </label>
            <label class="TripPrefField"><span>Personality</span>
                <select id="pref-q-personality">
                    <option value="Introvert">Introvert</option>
                    <option value="Extrovert" selected>Extrovert</option>
                </select>
            </label>
            <label class="TripPrefField"><span>Environment</span>
                <select id="pref-q-environment">
                    <option value="Mountains">Mountains</option>
                    <option value="City">City</option>
                    <option value="Historical">Historical</option>
                    <option value="Nature" selected>Nature</option>
                </select>
            </label>
            <label class="TripPrefField"><span>Crowds</span>
                <select id="pref-q-crowd">
                    <option value="Avoid crowds">Avoid crowds</option>
                    <option value="Neutral" selected>Neutral</option>
                    <option value="Enjoy crowds">Enjoy crowds</option>
                </select>
            </label>
        </div>
    `;
}
