# Debug Session: login-net-failed

- Status: OPEN
- Symptom: React frontend shows `net::ERR_FAILED http://127.0.0.1:8000/auth/login` during login from the local Vite app.
- Expected: Login request should reach backend and return either success or a normal auth error response.
- Current frontend URL: `http://127.0.0.1:5174/`
- Backend URL: `http://127.0.0.1:8000`

## Hypotheses

1. Backend is not actually reachable on `127.0.0.1:8000` when the browser sends the login request.
2. Backend CORS allows `5173` but does not allow the currently active Vite origin `5174`, so the browser blocks the request.
3. The backend process serving `8000` is an older instance that does not include the latest CORS configuration.
4. The login endpoint itself is throwing an exception or returning an invalid low-level response that the browser reports as `ERR_FAILED`.

## Evidence Log

- Backend root on `127.0.0.1:8000` responded normally with `{"message":"Travel Intelligence Backend Running"}`.
- `OPTIONS /auth/login` for origin `http://127.0.0.1:5173` returned `access-control-allow-origin: http://127.0.0.1:5173`.
- `OPTIONS /auth/login` for origin `http://127.0.0.1:5174` initially returned no `access-control-allow-origin`, matching the browser `net::ERR_FAILED` symptom.
- Database inspection confirmed the seeded `demo` user still exists in `data/users.db`.
- Direct backend login with `demo / demo123` succeeded, proving password hashing and auth flow remained valid server-side.
- Port `8000` was initially occupied by an older backend process, so the browser was hitting stale CORS settings until that process was stopped and the updated backend was restarted.
- After restart, `OPTIONS /auth/login` for `http://127.0.0.1:5174` returned `access-control-allow-origin: http://127.0.0.1:5174`.

## Confirmed Root Cause

- The React app was running on `http://127.0.0.1:5174`, but the active backend process only allowed `5173`, causing the browser to block login requests before they reached normal auth handling.

## Fix Applied

- Added local React dev origins `5174` and a localhost/127.0.0.1 port regex to backend CORS configuration in `app/main.py`.
- Stopped the stale backend listener on port `8000` and restarted the updated backend process.

## Next Step

- Await user confirmation that login now works normally from the React frontend.
