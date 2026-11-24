# [OPEN] Debug Session: atlas-restore

## Symptom
- Atlas IP has been updated, but the user believes the database may be gone.
- Project currently runs through demo fallback because Atlas connectivity previously failed.

## Scope
- Verify whether Atlas is reachable now.
- Verify whether the configured database, user, and collections still exist.
- Avoid any destructive changes while collecting evidence.

## Hypotheses
1. The Atlas cluster is reachable now, but the `travelIntelligence` database or its collections no longer exist.
2. The cluster exists, but the configured DB user or password no longer matches the URI in the app.
3. Atlas IP/network access is fixed, but the backend still fails due to TLS or auth issues.
4. The user is viewing the wrong Atlas project or cluster, so the expected database is not visible.
5. The database still exists, but prior startup failures caused the app to remain in local fallback mode.

## Evidence Log
- Pending

## Next Step
- Test live Atlas connectivity using the project's configured URI and inspect database/collection visibility.
