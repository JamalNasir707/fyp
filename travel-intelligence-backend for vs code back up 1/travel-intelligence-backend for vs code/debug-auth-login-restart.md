# Debug Session: auth-login-restart [OPEN]

## Symptom
- After PC restart and re-running the app, logging in with `demo` / `demo123` fails from the React frontend with `failed to fetch`.
- Newly created accounts also fail with the same frontend symptom.

## Expected
- Backend stays up after restart.
- `demo` / `demo123` always works on a fresh backend start.
- Register/login works for newly created users as well.

## Hypotheses
1. Backend process crashes during startup, so the frontend gets a network failure.
2. Demo-user seeding is not executed on startup, so `demo` is missing or has the wrong password hash.
3. The backend is running, but the auth DB path differs after restart and the seeded user is written/read from a different file.
4. The React app is using an API base URL that is unavailable after restart.
5. The backend starts, but fails before or during auth route usage, making `/auth/login` unreachable.

## Planned Evidence
- Inspect current startup wiring for auth DB initialization.
- Start backend and collect live startup output.
- Hit `/` and `/auth/login` directly to distinguish backend-down vs auth failure.
- Confirm which SQLite DB file is used at runtime and whether `demo` exists there.
- Verify React API base configuration.

## Status
- Session opened.
- No business logic changed yet.

## Evidence Collected
- `auth_db.py` still calls `init_db()` and `ensure_demo_user()` on import.
- React `API_BASE` is still `http://127.0.0.1:8000`.
- Direct root probe to `http://127.0.0.1:8000/` returned `{"message":"Travel Intelligence Backend Running"}`.
- Direct API login with `demo` / `demo123` succeeded.
- Direct API register + login with a fresh runtime-generated user also succeeded.
- SQLite check confirmed `demo` exists in `data/users.db`.

## Hypothesis Status
1. Backend process crashes during startup, so the frontend gets a network failure. -> Not reproduced in current run; backend reachable on `8000`.
2. Demo-user seeding is not executed on startup, so `demo` is missing or has the wrong password hash. -> Rejected by direct login and DB inspection.
3. The backend is running, but the auth DB path differs after restart and the seeded user is written/read from a different file. -> Not supported by current evidence; runtime DB contains `demo`.
4. The React app is using an API base URL that is unavailable after restart. -> React config points to the expected backend URL.
5. The backend starts, but fails before or during auth route usage, making `/auth/login` unreachable. -> Rejected in current run; both login and register succeed.

## Current Conclusion
- The persistent demo-account fix is still present and working.
- The observed browser symptom `failed to fetch` corresponds to backend reachability at the time of the browser request, not to a broken demo password.
