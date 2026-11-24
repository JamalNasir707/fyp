# [OPEN] Debug Session: backend-atlas-startup

## Symptom
- Frontend login page shows: `Backend not running. Start the server at http://127.0.0.1:8000`
- Frontend itself loads on `http://localhost:5173/`
- Backend does not finish startup on port `8000`

## Scope
- Diagnose why FastAPI backend is not becoming reachable
- Keep focus on startup/runtime only
- Do not change unrelated frontend or backend business logic during evidence collection

## Hypotheses
1. Backend is being launched with the wrong Python environment, and the working project `venv` is required.
2. MongoDB Atlas connectivity from the current Python runtime is failing during `init_db()` startup.
3. Atlas TLS/certificate handling differs between the system Python and the project `venv`, causing one to fail and the other to work.
4. A prior reverted change did not break app logic, but the backend process simply stopped and was never restarted successfully.
5. The frontend message is accurate, but the root cause is infrastructure/runtime startup rather than login code.

## Evidence Log
- Pending

## Next Step
- Try the project-local `venv` Python/uvicorn path and compare startup behavior against the failing runtime.
