"""Admin overview service entry points."""

from typing import Any, Dict

from app.auth_db import get_admin_overview


async def get_admin_overview_summary() -> Dict[str, Any]:
    """Return the existing admin overview payload without changing behavior."""
    # TODO: Move overview aggregation logic here incrementally in later admin phases.
    return await get_admin_overview()
