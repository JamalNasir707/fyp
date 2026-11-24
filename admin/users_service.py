import re
from typing import Any, Dict, List, Optional
from app import auth_db
from app.services.activity.activity_service import record_activity

def _serialize_admin_user(doc: Dict[str, Any], trip_count: int) -> Dict[str, Any]:
    """
    Serializes a user document for the Admin V2 interface,
    ensuring sensitive fields (passwords, tokens) are stripped.
    """
    user_id = str(doc.get("_id") or doc.get("id"))
    
    # Safely convert datetimes to ISO strings
    created_at = auth_db._to_iso(doc.get("createdAt"))
    last_login = auth_db._to_iso(doc.get("lastLogin"))

    return {
        "id": user_id,
        "username": doc.get("username") or "",
        "email": doc.get("email") or "",
        "name": doc.get("name") or doc.get("username") or "",
        "role": doc.get("role") or "user",
        "status": doc.get("status") or "active",
        "provider": doc.get("provider") or "credentials",
        "createdAt": created_at,
        "lastLogin": last_login,
        "tripCount": trip_count,
    }

async def get_admin_users(
    *,
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    provider: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Fetches and filters registered users from MongoDB or the demo fallback store.
    Returns a dict with user records, pagination details, and total count.
    """
    skip = (page - 1) * limit
    
    # ─── Demo Fallback Store path ──────────────────────────────
    if auth_db.use_demo_fallback:
        users = list(auth_db.fallback_store.get("users", []))
        trips = list(auth_db.fallback_store.get("trips", []))
        
        filtered = []
        for u in users:
            # 1. Search filter
            if search:
                s_lower = search.lower()
                username = (u.get("username") or "").lower()
                email = (u.get("email") or "").lower()
                u_provider = (u.get("provider") or "credentials").lower()
                if s_lower not in username and s_lower not in email and s_lower not in u_provider:
                    continue
            
            # 2. Role filter
            if role and u.get("role") != role:
                continue
                
            # 3. Status filter (treat missing as 'active')
            u_status = u.get("status") or "active"
            if status and u_status != status:
                continue
                
            # 4. Provider filter
            u_provider = u.get("provider") or "credentials"
            if provider:
                if provider == "credentials":
                    if u_provider != "credentials":
                        continue
                elif u_provider != provider:
                    continue
                    
            filtered.append(u)
            
        # Sort by createdAt descending
        def get_created_key(doc):
            val = doc.get("createdAt")
            if not val:
                return ""
            return val
            
        filtered.sort(key=get_created_key, reverse=True)
        total = len(filtered)
        
        # Paginate
        paginated_users = filtered[skip : skip + limit]
        
        # Build response with localized trip counts
        serialized_records = []
        for doc in paginated_users:
            user_id = str(doc.get("id") or doc.get("_id"))
            # Count trips
            t_count = sum(1 for t in trips if str(t.get("userId")) == user_id)
            serialized_records.append(_serialize_admin_user(doc, t_count))
            
        return {
            "users": serialized_records,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if total > 0 else 1,
        }

    # ─── MongoDB Atlas path ────────────────────────────────────
    query: Dict[str, Any] = {}
    
    # 1. Search query
    if search:
        regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"username": regex},
            {"email": regex},
            {"provider": regex},
        ]
        
    # 2. Role filter
    if role:
        query["role"] = role
        
    # 3. Status filter
    if status:
        if status == "active":
            query["$or"] = [
                {"status": "active"},
                {"status": {"$exists": False}},
                {"status": None},
            ]
        else:
            query["status"] = status
            
    # 4. Provider filter
    if provider:
        if provider == "credentials":
            query["$or"] = [
                {"provider": "credentials"},
                {"provider": {"$exists": False}},
                {"provider": None},
            ]
        else:
            query["provider"] = provider

    # Fetch total matching count
    total = await auth_db.users_collection.count_documents(query)
    
    # Query matching documents sorted by createdAt descending
    cursor = (
        auth_db.users_collection.find(query, {"password_hash": 0})
        .sort("createdAt", -1)
        .skip(skip)
        .limit(limit)
    )
    matching_users = await cursor.to_list(length=limit)
    
    # Serialize and count trips for each page record
    serialized_records = []
    for doc in matching_users:
        user_id = str(doc["_id"])
        # Query trips count using the indexed userId field on trips collection
        trip_count = await auth_db.trips_collection.count_documents({"userId": user_id})
        serialized_records.append(_serialize_admin_user(doc, trip_count))
        
    return {
        "users": serialized_records,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit if total > 0 else 1,
    }

async def get_admin_user_details(user_id: str) -> Dict[str, Any]:
    """
    Fetches details for a single user for the read-only inspection panel.
    Returns serialized user dict including tripCount, activeSessions count, and recentTrips list.
    """
    if auth_db.use_demo_fallback:
        user = auth_db._get_fallback_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        trips = list(auth_db.fallback_store.get("trips", []))
        user_trips = [t for t in trips if str(t.get("userId")) == str(user_id)]
        
        # Sort user_trips by startDate/createdAt/id descending, take top 5
        user_trips.sort(key=lambda t: t.get("startDate") or t.get("id") or "", reverse=True)
        recent_trips = user_trips[:5]
        
        # Count active sessions (where expiresAt is not in the past)
        sessions = list(auth_db.fallback_store.get("sessions", []))
        now_str = auth_db._utc_now().isoformat()
        active_sessions_count = sum(1 for s in sessions if str(s.get("userId")) == str(user_id) and (s.get("expiresAt") or "") > now_str)
        
        serialized = _serialize_admin_user(user, len(user_trips))
        # Add sessions and recent trips info
        serialized["activeSessions"] = active_sessions_count
        serialized["recentTrips"] = [
            {
                "id": str(t.get("id") or t.get("tripId")),
                "destination": t.get("destination") or "Custom Route",
                "startDate": t.get("startDate"),
                "endDate": t.get("endDate"),
                "itinerary": t.get("itinerary") or [],
            } for t in recent_trips
        ]
        return serialized

    # MongoDB Atlas path
    from bson import ObjectId
    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user ID format")
        
    doc = await auth_db.users_collection.find_one({"_id": object_id}, {"password_hash": 0})
    if not doc:
        raise ValueError("User not found")
        
    # Count trips
    trip_count = await auth_db.trips_collection.count_documents({"userId": user_id})
    
    # Fetch recent trips (top 5 sorted by startDate descending)
    cursor = auth_db.trips_collection.find({"userId": user_id}).sort("startDate", -1).limit(5)
    trips_docs = await cursor.to_list(length=5)
    recent_trips = [
        {
            "id": str(t.get("_id") or t.get("tripId")),
            "destination": t.get("destination") or "Custom Route",
            "startDate": auth_db._to_iso(t.get("startDate")),
            "endDate": auth_db._to_iso(t.get("endDate")),
            "itinerary": t.get("itinerary") or [],
        } for t in trips_docs
    ]
    
    # Count active sessions
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    active_sessions_count = await auth_db.sessions_collection.count_documents({
        "userId": {"$in": [object_id, user_id]},
        "expiresAt": {"$gt": now}
    })
    
    serialized = _serialize_admin_user(doc, trip_count)
    serialized["activeSessions"] = active_sessions_count
    serialized["recentTrips"] = recent_trips
    return serialized

async def update_user_status(user_id: str, status: str, admin_user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates the account status of a target user.
    Note: As per user constraint, session termination is NOT performed when suspending.
    """
    if user_id == admin_user.get("user_id"):
        raise ValueError("You cannot change the status of your own account.")

    if status not in ("active", "suspended"):
        raise ValueError("Invalid status value")

    if auth_db.use_demo_fallback:
        user = auth_db._get_fallback_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        user["status"] = status
        auth_db._save_fallback_store()
        
        try:
            await record_activity(
                actor_user_id=admin_user["user_id"],
                event_type="user_status_changed",
                subject_type="user",
                subject_id=user_id,
                title="User Status Modified",
                description=f"Status of user '{user.get('username')}' changed to '{status}' by admin '{admin_user['username']}'"
            )
        except Exception as e:
            print(f"Warning: failed to record activity: {e}")
            
        trips = list(auth_db.fallback_store.get("trips", []))
        t_count = sum(1 for t in trips if str(t.get("userId")) == str(user_id))
        return _serialize_admin_user(user, t_count)

    # MongoDB Atlas
    from bson import ObjectId
    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user ID format")
        
    doc = await auth_db.users_collection.find_one({"_id": object_id})
    if not doc:
        raise ValueError("User not found")
        
    await auth_db.users_collection.update_one({"_id": object_id}, {"$set": {"status": status}})
    updated_doc = await auth_db.users_collection.find_one({"_id": object_id})
    
    try:
        await record_activity(
            actor_user_id=admin_user["user_id"],
            event_type="user_status_changed",
            subject_type="user",
            subject_id=user_id,
            title="User Status Modified",
            description=f"Status of user '{doc.get('username')}' changed to '{status}' by admin '{admin_user['username']}'"
        )
    except Exception as e:
        print(f"Warning: failed to record activity: {e}")
        
    trip_count = await auth_db.trips_collection.count_documents({"userId": user_id})
    return _serialize_admin_user(updated_doc, trip_count)

async def update_user_role(user_id: str, role: str, admin_user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates the platform role of a target user.
    Includes guard preventing active administrators from demoting themselves.
    """
    if role not in ("admin", "user"):
        raise ValueError("Invalid role value")

    if str(user_id) == str(admin_user["user_id"]):
        raise ValueError("You cannot change or demote your own administrator role.")

    if auth_db.use_demo_fallback:
        user = auth_db._get_fallback_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        user["role"] = role
        auth_db._save_fallback_store()
        
        try:
            await record_activity(
                actor_user_id=admin_user["user_id"],
                event_type="user_role_changed",
                subject_type="user",
                subject_id=user_id,
                title="User Role Modified",
                description=f"Role of user '{user.get('username')}' changed to '{role}' by admin '{admin_user['username']}'"
            )
        except Exception as e:
            print(f"Warning: failed to record activity: {e}")
            
        trips = list(auth_db.fallback_store.get("trips", []))
        t_count = sum(1 for t in trips if str(t.get("userId")) == str(user_id))
        return _serialize_admin_user(user, t_count)

    # MongoDB Atlas
    from bson import ObjectId
    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user ID format")
        
    doc = await auth_db.users_collection.find_one({"_id": object_id})
    if not doc:
        raise ValueError("User not found")
        
    await auth_db.users_collection.update_one({"_id": object_id}, {"$set": {"role": role}})
    updated_doc = await auth_db.users_collection.find_one({"_id": object_id})
    
    try:
        await record_activity(
            actor_user_id=admin_user["user_id"],
            event_type="user_role_changed",
            subject_type="user",
            subject_id=user_id,
            title="User Role Modified",
            description=f"Role of user '{doc.get('username')}' changed to '{role}' by admin '{admin_user['username']}'"
        )
    except Exception as e:
        print(f"Warning: failed to record activity: {e}")
        
    trip_count = await auth_db.trips_collection.count_documents({"userId": user_id})
    return _serialize_admin_user(updated_doc, trip_count)

async def delete_user_by_admin(user_id: str, admin_user: Dict[str, Any]) -> None:
    """
    Deletes the target user account, including sessions and trips.
    Includes guard preventing self-deletion.
    """
    if str(user_id) == str(admin_user["user_id"]):
        raise ValueError("You cannot delete your own active administrator account.")

    # Retrieve username for activity history log prior to deletion
    username = "Unknown"
    if auth_db.use_demo_fallback:
        user = auth_db._get_fallback_user_by_id(user_id)
        if user:
            username = user.get("username") or "Unknown"
    else:
        from bson import ObjectId
        try:
            object_id = ObjectId(user_id)
            doc = await auth_db.users_collection.find_one({"_id": object_id})
            if doc:
                username = doc.get("username") or "Unknown"
        except Exception:
            pass

    res = await auth_db.delete_user_account(user_id)
    if not res.get("success", True):
        raise ValueError(res.get("error") or "Failed to delete account")

    try:
        await record_activity(
            actor_user_id=admin_user["user_id"],
            event_type="user_deleted",
            subject_type="user",
            subject_id=user_id,
            title="User Account Deleted",
            description=f"User account '{username}' was permanently deleted by admin '{admin_user['username']}'"
        )
    except Exception as e:
        print(f"Warning: failed to record activity: {e}")
