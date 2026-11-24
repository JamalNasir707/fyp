export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'
export const TRIPS_STORAGE_KEY = 'trips'
export const BOOTSTRAP_NEW_KEY = 'tripnest_new_trip'
export const BOOTSTRAP_LOAD_KEY = 'tripnest_load_trip_id'
export const PRINT_SNAPSHOT_KEY = 'tripnest_print_snapshot'
export const ACTIVE_WORKSPACE_KEY = 'tripnest_active_workspace'

export const PROVINCE_COORDS = {
  Punjab: { lat: 31.5204, lon: 74.3587 },
  Sindh: { lat: 24.8607, lon: 67.0011 },
  'Khyber Pakhtunkhwa': { lat: 34.0151, lon: 71.5249 },
  Balochistan: { lat: 30.1798, lon: 66.975 },
  'Gilgit-Baltistan': { lat: 35.9208, lon: 74.3144 },
  'Azad Kashmir': { lat: 34.37, lon: 73.47 },
}
