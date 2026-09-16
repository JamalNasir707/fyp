from typing import Any, Dict, List, Optional
from app import auth_db

async def get_admin_trips_raw(search: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves all user trips from the database, resolves their owner usernames,
    and filters by destination or owner username if search query is provided.
    """
    if auth_db.use_demo_fallback:
        users = auth_db.fallback_store.get("users", [])
        trips = auth_db.fallback_store.get("trips", [])
        user_map = {str(u.get("id")): u.get("username") for u in users}
        
        formatted = []
        for trip in trips:
            serialized = auth_db._serialize_trip(trip)
            user_id = str(trip.get("userId"))
            serialized["owner"] = user_map.get(user_id) or "unknown"
            formatted.append(serialized)
    else:
        # MongoDB Atlas Mode
        users = await auth_db.users_collection.find({}, {"_id": 1, "username": 1}).to_list(length=None)
        user_map = {str(u["_id"]): u["username"] for u in users}

        trips = await auth_db.trips_collection.find({}).sort("updatedAt", -1).to_list(length=None)

        formatted = []
        for trip in trips:
            serialized = auth_db._serialize_trip(trip)
            user_id = str(trip.get("userId"))
            serialized["owner"] = user_map.get(user_id) or "unknown"
            formatted.append(serialized)

    if search:
        search_query = search.strip().lower()
        formatted = [
            t for t in formatted
            if search_query in (t.get("name") or "").lower() or search_query in (t.get("owner") or "").lower()
        ]

    return formatted
