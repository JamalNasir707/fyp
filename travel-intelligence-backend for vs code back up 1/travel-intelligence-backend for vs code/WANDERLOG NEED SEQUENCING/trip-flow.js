/**
 * Shared trip list + navigation between login, home, plan-trip, and workspace.
 */
const TRIPS_STORAGE_KEY = 'trips';
const BOOTSTRAP_NEW_KEY = 'tripnest_new_trip';
const BOOTSTRAP_LOAD_KEY = 'tripnest_load_trip_id';
const PRINT_SNAPSHOT_KEY = 'tripnest_print_snapshot';
const ACTIVE_WORKSPACE_KEY = 'tripnest_active_workspace';

function getSavedTrips() {
    try {
        return JSON.parse(localStorage.getItem(TRIPS_STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function setSavedTrips(trips) {
    localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
}

function deleteSavedTrip(tripId) {
    const id = Number(tripId);
    const trips = getSavedTrips().filter((t) => Number(t.id) !== id);
    setSavedTrips(trips);
    return trips;
}

function formatTripDateRange(startDate, endDate) {
    if (!startDate && !endDate) return '';
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    return startDate || endDate || '';
}

function countTripPlaces(tripData) {
    if (!tripData || !Array.isArray(tripData.days)) return 0;
    return tripData.days.reduce((sum, day) => {
        const items = Array.isArray(day.items) ? day.items : [];
        return sum + items.filter((item) => item && !item.isNote && !item.isChecklist).length;
    }, 0);
}

function buildDaysFromDateRange(startInput, endInput) {
    const start = new Date(startInput);
    const end = new Date(endInput);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
        return null;
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
    return days;
}

function queueNewTrip(payload) {
    sessionStorage.setItem(BOOTSTRAP_NEW_KEY, JSON.stringify(payload));
    sessionStorage.removeItem(BOOTSTRAP_LOAD_KEY);
}

function queueLoadTrip(tripId) {
    sessionStorage.setItem(BOOTSTRAP_LOAD_KEY, String(tripId));
    sessionStorage.removeItem(BOOTSTRAP_NEW_KEY);
}

function clearTripBootstrap() {
    sessionStorage.removeItem(BOOTSTRAP_NEW_KEY);
    sessionStorage.removeItem(BOOTSTRAP_LOAD_KEY);
}

function getTripCoverImage(tripData) {
    const days = tripData?.days || [];
    for (const day of days) {
        for (const item of day.items || []) {
            if (item?.image) return item.image;
        }
    }
    return 'assets/images/trip-pakistan.jpg';
}

function saveActiveWorkspace(tripData) {
    try {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(tripData));
    } catch (error) {
        console.error('Failed to save active workspace', error);
    }
}

function readActiveWorkspace() {
    try {
        const raw = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function queuePrintSnapshot(tripData) {
    try {
        const serialized = JSON.stringify(tripData);
        localStorage.setItem(PRINT_SNAPSHOT_KEY, serialized);
        try {
            sessionStorage.setItem(PRINT_SNAPSHOT_KEY, serialized);
        } catch {
            // sessionStorage may be unavailable in some contexts
        }
        saveActiveWorkspace(tripData);
    } catch (error) {
        console.error('Failed to queue print snapshot', error);
    }
}

function readPrintSnapshot() {
    const stores = [localStorage, sessionStorage];
    for (const store of stores) {
        try {
            const raw = store.getItem(PRINT_SNAPSHOT_KEY);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch {
            // try next store
        }
    }
    return readActiveWorkspace();
}

function createEmptyTripTemplate() {
    return {
        title: 'My Trip',
        name: 'My Trip',
        dates: '',
        notes: '',
        placesPool: [],
        customLists: [],
        days: [],
        expenses: [],
        budget: { currency: 'PKR', amount: 0 },
        map: { selectedPlaceId: null }
    };
}
