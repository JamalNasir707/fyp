[OPEN] React login failure

## Session
- session_id: `react-login-failure`
- started_at: `2026-06-10`
- status: `OPEN`

## Scope
- Fix only the React login failure.
- Do not touch `WANDERLOG NEED SEQUENCING`.

## Symptoms
- React login with `demo` / `demo123` often shows `Failed to fetch`.
- Sometimes it works only after waiting 1-3 minutes.
- After restart, the same problem returns.

## Initial Hypotheses
1. The frontend backend URL is correct, but the backend is not reachable when login is attempted.
2. The demo user is not persisted/seeded reliably across restarts.
3. Frontend error handling maps different failures into the same generic `Failed to fetch` message.
4. Backend startup or database initialization delays make early login attempts fail.
5. The demo user, if created, may not use the same password hashing flow as normal users.

## Evidence Plan
- Verify configured frontend API base.
- Verify backend root availability on `http://127.0.0.1:8000/`.
- Verify login route behavior for `demo` / `demo123`.
- Inspect backend auth/database initialization and demo user persistence.
- Only after evidence, apply a minimal fix.

## Evidence Collected
- Frontend API base is `http://127.0.0.1:8000`.
- Backend root check failed when the backend was not running: `Unable to connect to the remote server`.
- Backend root check passed after Uvicorn startup: `{"message":"Travel Intelligence Backend Running"}`.
- Login route succeeded with `demo` / `demo123` after backend startup.
- Backend auth database already initializes tables and ensures the demo user on import without duplicating the username.

## Hypothesis Status
1. The frontend backend URL is correct, but the backend is not reachable when login is attempted. `CONFIRMED`
2. The demo user is not persisted/seeded reliably across restarts. `NOT SUPPORTED BY EVIDENCE`
3. Frontend error handling maps different failures into the same generic `Failed to fetch` message. `CONFIRMED`
4. Backend startup or database initialization delays make early login attempts fail. `PARTIALLY SUPPORTED`
5. The demo user, if created, may not use the same password hashing flow as normal users. `REJECTED`

## Applied Fix
- Updated React auth request handling to show specific messages for:
  - backend not running
  - invalid credentials
  - server error

## Scope Confirmation
- No files were changed in `WANDERLOG NEED SEQUENCING`.
