[OPEN] Frontend fetch failure

## Session
- session_id: `frontend-fetch-failure`
- started_at: `2026-06-10`
- status: `OPEN`

## Symptom
- Frontend reports a fetch failure.

## Initial Hypotheses
1. Backend server is not reachable at the configured API base URL.
2. Frontend is requesting the wrong endpoint or wrong route path.
3. Backend CORS configuration is rejecting requests from the frontend origin.
4. Frontend request payload or HTTP method does not match backend expectations.
5. Frontend configuration points to an incorrect API base value.

## Evidence Plan
- Verify configured frontend API base and fetch call sites.
- Verify backend server status and reachable routes.
- Reproduce the failing request and inspect runtime output.
- Instrument only if static checks do not isolate the failing boundary.

## Evidence Collected
- Frontend API base is `http://127.0.0.1:8000` from `travel-intelligence-react/src/lib/constants.js`.
- Frontend backend fetch sites include:
  - `travel-intelligence-react/src/lib/session.js` for `/auth/*`
  - `travel-intelligence-react/src/pages/WorkspacePage.jsx` for `/optimize` and `/v1/sequence/day`
- Backend CORS allows `http://127.0.0.1:5173` and `http://localhost:5173`.
- Pre-fix runtime check:
  - `Invoke-WebRequest http://127.0.0.1:8000/` -> `Unable to connect to the remote server`
- Post-start runtime check:
  - `Invoke-WebRequest http://127.0.0.1:8000/` -> `{"message":"Travel Intelligence Backend Running"}`

## Hypothesis Status
1. Backend server is not reachable at the configured API base URL. `CONFIRMED`
2. Frontend is requesting the wrong endpoint or wrong route path. `NOT SUPPORTED`
3. Backend CORS configuration is rejecting requests from the frontend origin. `REJECTED`
4. Frontend request payload or HTTP method does not match backend expectations. `NOT NEEDED FOR ROOT CAUSE`
5. Frontend configuration points to an incorrect API base value. `REJECTED`

## Root Cause
- The frontend fetch failed because the backend at `http://127.0.0.1:8000` was not running or not reachable at the time of the request.

## Notes
- No business logic changes made yet.
