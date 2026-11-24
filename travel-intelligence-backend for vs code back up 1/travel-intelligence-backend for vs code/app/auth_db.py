"""
MongoDB Atlas-backed auth, session, and trip persistence helpers.
Falls back to local demo storage when Atlas is unreachable.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from app.env_loader import load_env_file

load_env_file()

MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "travelIntelligence")
DEMO_FALLBACK_PATH = Path(__file__).resolve().parent.parent / "data" / "demo_fallback_store.json"

mongo_client: Optional[AsyncIOMotorClient] = None
mongo_db = None
users_collection = None
sessions_collection = None
trips_collection = None
activity_history_collection = None
follows_collection = None
notifications_collection = None
use_demo_fallback = False
fallback_store: Dict[str, Any] = {"users": [], "sessions": [], "trips": [], "activity_history": [], "follows": [], "notifications": []}
logger = logging.getLogger("uvicorn.error")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, str) and value:
        return value
    return None


def _to_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _clone_json(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def _load_fallback_store() -> None:
    global fallback_store
    data = {}
    if DEMO_FALLBACK_PATH.exists():
        try:
            data = json.loads(DEMO_FALLBACK_PATH.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    fallback_store.clear()
    fallback_store.update(data)
    fallback_store.setdefault("users", [])
    fallback_store.setdefault("sessions", [])
    fallback_store.setdefault("trips", [])
    fallback_store.setdefault("activity_history", [])
    fallback_store.setdefault("follows", [])
    fallback_store.setdefault("notifications", [])
    fallback_store.setdefault("trip_members", [])
    fallback_store.setdefault("shared_budget_expenses", [])
    fallback_store.setdefault("shared_budget_settlements", [])


def _save_fallback_store() -> None:
    DEMO_FALLBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEMO_FALLBACK_PATH.write_text(json.dumps(fallback_store, indent=2), encoding="utf-8")


def _normalize_privacy(raw_privacy: Any) -> str:
    val = str(raw_privacy or "").strip().lower()
    if val in ("public", "friends", "private"):
        return val
    return "private"


def _make_demo_trip(
    trip_id: int,
    user_id: str,
    destination: str,
    start_date: str,
    end_date: str,
    place_title: str,
    lat: float,
    lon: float,
) -> Dict[str, Any]:
    payload = {
        "id": trip_id,
        "tripId": trip_id,
        "title": f"Trip to {destination}",
        "name": destination,
        "destination": destination,
        "startDate": start_date,
        "endDate": end_date,
        "dates": f"{start_date} - {end_date}",
        "privacy": "private",
        "notes": "",
        "placesPool": [
            {
                "id": f"{destination.lower()}-pool-1",
                "title": place_title,
                "subtitle": destination,
                "category": "attraction",
                "lat": lat,
                "lon": lon,
                "note": "",
                "startTime": "",
                "endTime": "",
                "visitDetails": {
                    "visited": False,
                    "visitedDate": None,
                    "visitedTime": None,
                    "notes": "",
                },
            }
        ],
        "customLists": [],
        "days": [
            {
                "id": "day-1",
                "label": "Day 1",
                "shortLabel": "Day 1",
                "date": start_date,
                "items": [
                    {
                        "id": f"{destination.lower()}-day-1-place-1",
                        "title": place_title,
                        "subtitle": destination,
                        "category": "attraction",
                        "lat": lat,
                        "lon": lon,
                        "note": "",
                        "startTime": "09:00",
                        "endTime": "11:00",
                        "visitDetails": {
                            "visited": False,
                            "visitedDate": None,
                            "visitedTime": None,
                            "notes": "",
                        },
                    }
                ],
            }
        ],
        "expenses": [],
        "budget": {"currency": "PKR", "amount": 0},
        "map": {"selectedPlaceId": None},
        "enginePreferences": {"province": "Punjab"},
        "itinerary": [
            {
                "id": "day-1",
                "label": "Day 1",
                "shortLabel": "Day 1",
                "date": start_date,
                "items": [
                    {
                        "id": f"{destination.lower()}-day-1-place-1",
                        "title": place_title,
                        "subtitle": destination,
                        "category": "attraction",
                        "lat": lat,
                        "lon": lon,
                    }
                ],
            }
        ],
        "preferences": {"province": "Punjab"},
    }
    now = _utc_now().isoformat()
    return {
        "tripId": trip_id,
        "userId": user_id,
        "destination": destination,
        "startDate": start_date,
        "endDate": end_date,
        "privacy": "private",
        "itinerary": _clone_json(payload["itinerary"]),
        "preferences": _clone_json(payload["preferences"]),
        "data": _clone_json(payload),
        "createdAt": now,
        "updatedAt": now,
    }


def _ensure_fallback_seed_data() -> None:
    seed_users = [
        {"id": "demo-user", "username": "demo", "email": "demo@example.com", "password": "demo123", "role": "user"},
        {"id": "admin-user", "username": "admin", "email": "admin@example.com", "password": "admin123", "role": "admin"},
    ]
    for entry in seed_users:
        existing = next((user for user in fallback_store["users"] if user.get("username") == entry["username"]), None)
        now = _utc_now().isoformat()
        if existing:
            existing.update({
                "email": entry["email"],
                "password_hash": hash_password(entry["password"]),
                "role": entry["role"],
            })
        else:
            fallback_store["users"].append({
                "id": entry["id"],
                "username": entry["username"],
                "email": entry["email"],
                "password_hash": hash_password(entry["password"]),
                "role": entry["role"],
                "createdAt": now,
                "lastLogin": None,
            })

    if not fallback_store["trips"]:
        fallback_store["trips"] = [
            _make_demo_trip(1001, "demo-user", "Islamabad", "2026-06-11", "2026-06-12", "Faisal Masjid", 33.7295, 73.0372),
            _make_demo_trip(1002, "demo-user", "Multan", "2026-06-25", "2026-06-26", "Multan Fort", 30.1981, 71.4687),
        ]
    _save_fallback_store()


def _get_fallback_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    return next((user for user in fallback_store["users"] if user.get("username") == username), None)


def _get_fallback_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    return next((user for user in fallback_store["users"] if str(user.get("id")) == str(user_id)), None)


def _get_fallback_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    lowered = (email or "").strip().lower()
    return next((user for user in fallback_store["users"] if str(user.get("email", "")).strip().lower() == lowered), None)


def _get_fallback_user_by_google_id(google_id: str) -> Optional[Dict[str, Any]]:
    return next((user for user in fallback_store["users"] if str(user.get("googleId") or "") == str(google_id)), None)


def _make_username_candidate(name: str, email: str) -> str:
    source = (name or "").strip() or (email or "").split("@")[0] or "traveler"
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", source).strip("_").lower()
    normalized = normalized[:24]
    return normalized or f"user_{secrets.token_hex(3)}"


def _make_unique_username_fallback(base_username: str, exclude_user_id: Optional[str] = None) -> str:
    candidate = base_username
    while any(
        user.get("username") == candidate and str(user.get("id")) != str(exclude_user_id)
        for user in fallback_store["users"]
    ):
        suffix = secrets.token_hex(2)
        trimmed = base_username[: max(6, 24 - len(suffix) - 1)]
        candidate = f"{trimmed}_{suffix}"
    return candidate


async def _make_unique_username_mongo(base_username: str, exclude_user_id: Optional[str] = None) -> str:
    candidate = base_username
    while True:
        query: Dict[str, Any] = {"username": candidate}
        existing = await users_collection.find_one(query, {"_id": 1})
        if not existing or str(existing.get("_id")) == str(exclude_user_id):
            return candidate
        suffix = secrets.token_hex(2)
        trimmed = base_username[: max(6, 24 - len(suffix) - 1)]
        candidate = f"{trimmed}_{suffix}"


def _serialize_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "id": str(doc.get("_id") or doc.get("id")),
        "username": doc["username"],
        "email": doc["email"],
        "role": doc.get("role", "user"),
        "status": doc.get("status") or "active",
    }
    if doc.get("name"):
        payload["name"] = doc.get("name")
    
    # Resolve provider dynamically if googleId is present
    provider = doc.get("provider")
    if not provider and doc.get("googleId"):
        provider = "google"
    if provider:
        payload["provider"] = provider

    if doc.get("profileImage"):
        payload["profileImage"] = doc.get("profileImage")
    if doc.get("googleId"):
        payload["googleId"] = doc.get("googleId")
    payload["bio"] = doc.get("bio") or ""
    return payload


def generate_share_token(permission: str = "view") -> str:
    prefix = "sh_edit" if str(permission).lower() == "edit" else "sh"
    return f"{prefix}_{secrets.token_urlsafe(24)}"


def _serialize_trip(doc: Dict[str, Any]) -> Dict[str, Any]:
    data = dict(doc.get("data") or {})
    if data.get("id") is None:
        data["id"] = doc.get("tripId")
    if not data.get("name"):
        data["name"] = doc.get("destination") or data.get("title") or "My Trip"
    if not data.get("title"):
        data["title"] = data.get("title") or f"Trip to {data['name']}" if data.get("name") and data.get("name") != "My Trip" else "My Trip"
    if not data.get("startDate"):
        data["startDate"] = doc.get("startDate") or ""
    if not data.get("endDate"):
        data["endDate"] = doc.get("endDate") or ""
    privacy = _normalize_privacy(doc.get("privacy") or data.get("privacy") or data.get("visibility"))
    data["privacy"] = privacy
    share_token = doc.get("shareToken") or data.get("shareToken")
    if share_token:
        data["shareToken"] = share_token
    edit_share_token = doc.get("editShareToken") or data.get("editShareToken")
    if edit_share_token:
        data["editShareToken"] = edit_share_token
    copied_from_edit_token = doc.get("copiedFromEditToken") or data.get("copiedFromEditToken")
    if copied_from_edit_token:
        data["copiedFromEditToken"] = copied_from_edit_token
    source_trip_id = doc.get("sourceTripId") if doc.get("sourceTripId") is not None else data.get("sourceTripId")
    if source_trip_id is not None:
        data["sourceTripId"] = source_trip_id

    serialized = {
        "id": doc.get("tripId"),
        "tripId": doc.get("tripId"),
        "userId": doc.get("userId"),
        "name": doc.get("destination") or data.get("name") or "My Trip",
        "startDate": doc.get("startDate") or data.get("startDate") or "",
        "endDate": doc.get("endDate") or data.get("endDate") or "",
        "privacy": privacy,
        "createdAt": _to_iso(doc.get("createdAt")),
        "updatedAt": _to_iso(doc.get("updatedAt")),
        "shareToken": share_token,
        "editShareToken": edit_share_token,
        "data": data,
    }
    if copied_from_edit_token:
        serialized["copiedFromEditToken"] = copied_from_edit_token
    if source_trip_id is not None:
        serialized["sourceTripId"] = source_trip_id
    return serialized


def _normalize_trip_payload(trip_payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(trip_payload or {})
    trip_id = payload.get("id")
    if trip_id is None:
        trip_id = payload.get("tripId")
    if trip_id is None:
        trip_id = int(datetime.now(timezone.utc).timestamp() * 1000)
    payload["id"] = trip_id
    destination = str(payload.get("name") or payload.get("destination") or payload.get("title") or "My Trip").strip() or "My Trip"
    preferences = payload.get("enginePreferences")
    if not isinstance(preferences, dict):
        preferences = payload.get("preferences") if isinstance(preferences, dict) else {}
    itinerary = payload.get("days")
    if not isinstance(itinerary, list):
        itinerary = payload.get("itinerary") if isinstance(payload.get("itinerary"), list) else []

    raw_privacy = payload.get("privacy")
    if raw_privacy is None and isinstance(payload.get("data"), dict):
        raw_privacy = payload["data"].get("privacy")
    if raw_privacy is None:
        raw_privacy = payload.get("visibility")
    if raw_privacy is None and isinstance(payload.get("data"), dict):
        raw_privacy = payload["data"].get("visibility")

    normalized_privacy = _normalize_privacy(raw_privacy)
    payload["privacy"] = normalized_privacy
    if isinstance(payload.get("data"), dict):
        payload["data"]["privacy"] = normalized_privacy

    raw_members = payload.get("members")
    if raw_members is None and isinstance(payload.get("data"), dict):
        raw_members = payload["data"].get("members")
    members = [dict(m) for m in raw_members] if isinstance(raw_members, list) else []
    payload["members"] = members

    return {
        "tripId": trip_id,
        "destination": destination,
        "startDate": payload.get("startDate") or "",
        "endDate": payload.get("endDate") or "",
        "privacy": normalized_privacy,
        "members": members,
        "itinerary": itinerary,
        "preferences": preferences,
        "data": payload,
    }


async def init_db() -> None:
    global mongo_client, mongo_db, users_collection, sessions_collection, trips_collection, activity_history_collection, follows_collection, notifications_collection, use_demo_fallback
    if mongo_client is not None or use_demo_fallback:
        return

    if not MONGODB_URI:
        use_demo_fallback = True
        _load_fallback_store()
        _ensure_fallback_seed_data()
        logger.warning("MONGODB_URI is not configured; using demo fallback storage.")
        return

    for attempt in range(2):
        try:
            mongo_client = AsyncIOMotorClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=20000,
                connectTimeoutMS=20000,
            )
            await mongo_client.admin.command("ping")
            active_db_name = os.getenv("MONGODB_DB_NAME", "").strip()
            if active_db_name:
                mongo_db = mongo_client[active_db_name]
            else:
                default_db = mongo_client.get_default_database()
                mongo_db = default_db if default_db is not None else mongo_client["travelIntelligence"]
            users_collection = mongo_db["users"]
            sessions_collection = mongo_db["sessions"]
            trips_collection = mongo_db["trips"]
            activity_history_collection = mongo_db["activity_history"]
            follows_collection = mongo_db["follows"]
            notifications_collection = mongo_db["notifications"]

            await users_collection.create_index("username", unique=True)
            await users_collection.create_index("email", unique=True)
            await sessions_collection.create_index("token", unique=True)
            await sessions_collection.create_index("expiresAt", expireAfterSeconds=0)
            await trips_collection.create_index([("userId", 1), ("tripId", 1)], unique=True)
            await trips_collection.create_index("userId")
            await trips_collection.create_index("shareToken", sparse=True)
            await trips_collection.create_index("editShareToken", sparse=True)
            await activity_history_collection.create_index([("actorUserId", 1), ("createdAt", -1)])
            await activity_history_collection.create_index([("tripId", 1), ("createdAt", -1)])
            await follows_collection.create_index([("followerId", 1), ("followingId", 1)], unique=True)
            await follows_collection.create_index("followerId")
            await follows_collection.create_index("followingId")
            await notifications_collection.create_index([("recipientId", 1), ("createdAt", -1)])
            await notifications_collection.create_index([("recipientId", 1), ("read", 1)])

            await ensure_seed_users()
            use_demo_fallback = False
            logger.info("MongoDB Atlas connected successfully to database: %s", mongo_db.name)
            return
        except Exception as exc:
            if mongo_client is not None:
                mongo_client.close()
            mongo_client = None
            mongo_db = None
            users_collection = None
            sessions_collection = None
            trips_collection = None
            activity_history_collection = None
            follows_collection = None
            notifications_collection = None
            if attempt == 0:
                logger.warning("MongoDB connection attempt 1 failed, retrying: %s", exc)
                await asyncio.sleep(1)
            else:
                use_demo_fallback = True
                _load_fallback_store()
                _ensure_fallback_seed_data()
                logger.warning("MongoDB unavailable, using demo fallback storage: %s", exc)


async def close_db() -> None:
    global mongo_client, mongo_db, users_collection, sessions_collection, trips_collection, activity_history_collection, follows_collection, notifications_collection
    if mongo_client is not None:
        mongo_client.close()
    if use_demo_fallback:
        _save_fallback_store()
    mongo_client = None
    mongo_db = None
    users_collection = None
    sessions_collection = None
    trips_collection = None
    activity_history_collection = None
    follows_collection = None
    notifications_collection = None


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
    return f"{salt}${pwd_hash.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, pwd_hash = password_hash.split("$")
        new_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000)
        return new_hash.hex() == pwd_hash
    except Exception:
        return False


async def create_user(username: str, email: str, password: str, role: str = "user") -> dict:
    try:
        if use_demo_fallback:
            existing = next(
                (user for user in fallback_store["users"] if user.get("username") == username or user.get("email") == email),
                None,
            )
            if existing:
                return {"success": False, "error": "Username or email already exists"}
            user_doc = {
                "id": f"user-{secrets.token_hex(8)}",
                "username": username,
                "email": email,
                "name": username,
                "password_hash": hash_password(password),
                "role": role,
                "createdAt": _utc_now().isoformat(),
                "lastLogin": None,
            }
            fallback_store["users"].append(user_doc)
            _save_fallback_store()
            return {"success": True, "user_id": str(user_doc["id"]), "username": username, "role": role}

        existing = await users_collection.find_one(
            {"$or": [{"username": username}, {"email": email}]},
            {"_id": 1},
        )
        if existing:
            return {"success": False, "error": "Username or email already exists"}

        user_doc = {
            "username": username,
            "email": email,
            "name": username,
            "password_hash": hash_password(password),
            "role": role,
            "createdAt": _utc_now(),
            "lastLogin": None,
        }
        result = await users_collection.insert_one(user_doc)
        return {"success": True, "user_id": str(result.inserted_id), "username": username, "role": role}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def ensure_seed_users() -> None:
    seed_users = [
        {"username": "demo", "email": "demo@example.com", "password": "demo123", "role": "user"},
        {"username": "admin", "email": "admin@example.com", "password": "admin123", "role": "admin"},
    ]
    for entry in seed_users:
        await users_collection.update_one(
            {"username": entry["username"]},
            {
                "$setOnInsert": {
                    "username": entry["username"],
                    "email": entry["email"],
                    "password_hash": hash_password(entry["password"]),
                    "role": entry["role"],
                    "createdAt": _utc_now(),
                },
            },
            upsert=True,
        )


async def authenticate_user(username: str, password: str) -> dict:
    try:
        identifier = (username or "").strip()
        lowered_identifier = identifier.lower()
        if use_demo_fallback:
            user = next(
                (
                    u for u in fallback_store["users"]
                    if str(u.get("username", "")).strip().lower() == lowered_identifier
                    or str(u.get("email", "")).strip().lower() == lowered_identifier
                ),
                None
            )
            if not user:
                return {"success": False, "error": "User not found"}
            if not verify_password(password, user.get("password_hash", "")):
                return {"success": False, "error": "Invalid password"}
            user["lastLogin"] = _utc_now().isoformat()
            _save_fallback_store()
            serialized = _serialize_user(user)
            return {
                "success": True,
                "user_id": serialized["id"],
                "name": serialized.get("name"),
                "username": serialized["username"],
                "email": serialized["email"],
                "role": serialized["role"],
                "provider": serialized.get("provider"),
                "profileImage": serialized.get("profileImage"),
                "googleId": serialized.get("googleId"),
            }

        user = await users_collection.find_one({
            "$or": [
                {"username": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}},
                {"email": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}},
            ]
        })
        if not user:
            return {"success": False, "error": "User not found"}
        if not verify_password(password, user.get("password_hash", "")):
            return {"success": False, "error": "Invalid password"}

        await users_collection.update_one({"_id": user["_id"]}, {"$set": {"lastLogin": _utc_now()}})
        serialized = _serialize_user(user)
        return {
            "success": True,
            "user_id": serialized["id"],
            "name": serialized.get("name"),
            "username": serialized["username"],
            "email": serialized["email"],
            "role": serialized["role"],
            "provider": serialized.get("provider"),
            "profileImage": serialized.get("profileImage"),
            "googleId": serialized.get("googleId"),
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def authenticate_or_create_google_user(email: str, name: str, google_id: str, profile_image: Optional[str] = None) -> dict:
    try:
        normalized_email = (email or "").strip().lower()
        normalized_name = (name or "").strip() or normalized_email.split("@")[0] or "Traveler"
        normalized_picture = (profile_image or "").strip() or None

        if use_demo_fallback:
            user = _get_fallback_user_by_email(normalized_email) or _get_fallback_user_by_google_id(google_id)
            if user:
                user["lastLogin"] = _utc_now().isoformat()
                if normalized_name:
                    user["name"] = normalized_name
                if google_id:
                    user["googleId"] = google_id
                if normalized_picture:
                    user["profileImage"] = normalized_picture
                if not user.get("provider") and not user.get("password_hash"):
                    user["provider"] = "google"
                _save_fallback_store()
                serialized = _serialize_user(user)
                return {
                    "success": True,
                    "user_id": serialized["id"],
                    "name": serialized.get("name"),
                    "username": serialized["username"],
                    "email": serialized["email"],
                    "role": serialized["role"],
                    "provider": serialized.get("provider"),
                    "profileImage": serialized.get("profileImage"),
                    "googleId": serialized.get("googleId"),
                }

            username = _make_unique_username_fallback(_make_username_candidate(normalized_name, normalized_email))
            user_doc = {
                "id": f"user-{secrets.token_hex(8)}",
                "username": username,
                "email": normalized_email,
                "name": normalized_name,
                "password_hash": None,
                "role": "user",
                "provider": "google",
                "googleId": google_id,
                "profileImage": normalized_picture,
                "createdAt": _utc_now().isoformat(),
                "lastLogin": _utc_now().isoformat(),
            }
            fallback_store["users"].append(user_doc)
            _save_fallback_store()
            serialized = _serialize_user(user_doc)
            return {
                "success": True,
                "user_id": serialized["id"],
                "name": serialized.get("name"),
                "username": serialized["username"],
                "email": serialized["email"],
                "role": serialized["role"],
                "provider": serialized.get("provider"),
                "profileImage": serialized.get("profileImage"),
                "googleId": serialized.get("googleId"),
            }

        user = await users_collection.find_one({"$or": [{"email": normalized_email}, {"googleId": google_id}]})
        if user:
            updates: Dict[str, Any] = {"lastLogin": _utc_now()}
            if normalized_name and user.get("name") != normalized_name:
                updates["name"] = normalized_name
            if google_id and user.get("googleId") != google_id:
                updates["googleId"] = google_id
            if normalized_picture and user.get("profileImage") != normalized_picture:
                updates["profileImage"] = normalized_picture
            if not user.get("provider") and not user.get("password_hash"):
                updates["provider"] = "google"

            if updates:
                await users_collection.update_one({"_id": user["_id"]}, {"$set": updates})
                user.update(updates)

            serialized = _serialize_user(user)
            return {
                "success": True,
                "user_id": serialized["id"],
                "name": serialized.get("name"),
                "username": serialized["username"],
                "email": serialized["email"],
                "role": serialized["role"],
                "provider": serialized.get("provider"),
                "profileImage": serialized.get("profileImage"),
                "googleId": serialized.get("googleId"),
            }

        username = await _make_unique_username_mongo(_make_username_candidate(normalized_name, normalized_email))
        user_doc = {
            "username": username,
            "email": normalized_email,
            "name": normalized_name,
            "password_hash": None,
            "role": "user",
            "provider": "google",
            "googleId": google_id,
            "profileImage": normalized_picture,
            "createdAt": _utc_now(),
            "lastLogin": _utc_now(),
        }
        result = await users_collection.insert_one(user_doc)
        serialized = _serialize_user({**user_doc, "_id": result.inserted_id})
        return {
            "success": True,
            "user_id": serialized["id"],
            "name": serialized.get("name"),
            "username": serialized["username"],
            "email": serialized["email"],
            "role": serialized["role"],
            "provider": serialized.get("provider"),
            "profileImage": serialized.get("profileImage"),
            "googleId": serialized.get("googleId"),
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def create_session(user_id: str) -> dict:
    try:
        token = secrets.token_urlsafe(32)
        expires_at = _utc_now() + timedelta(days=7)
        if use_demo_fallback:
            fallback_store["sessions"] = [session for session in fallback_store["sessions"] if session.get("token") != token]
            fallback_store["sessions"].append(
                {
                    "userId": str(user_id),
                    "token": token,
                    "createdAt": _utc_now().isoformat(),
                    "expiresAt": expires_at.isoformat(),
                }
            )
            _save_fallback_store()
            return {"success": True, "token": token, "expires_at": expires_at.isoformat()}

        await sessions_collection.insert_one(
            {
                "userId": ObjectId(user_id),
                "token": token,
                "createdAt": _utc_now(),
                "expiresAt": expires_at,
            }
        )
        return {"success": True, "token": token, "expires_at": expires_at.isoformat()}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def verify_session(token: str) -> dict:
    try:
        if use_demo_fallback:
            session = next((entry for entry in fallback_store["sessions"] if entry.get("token") == token), None)
            if not session:
                return {"success": False, "error": "Invalid token"}
            expires_at = _to_datetime(session.get("expiresAt"))
            if not isinstance(expires_at, datetime) or _utc_now() > expires_at:
                fallback_store["sessions"] = [entry for entry in fallback_store["sessions"] if entry.get("token") != token]
                _save_fallback_store()
                return {"success": False, "error": "Token expired"}
            user = _get_fallback_user_by_id(str(session.get("userId")))
            if not user:
                return {"success": False, "error": "User not found"}
            serialized = _serialize_user(user)
            return {
                "success": True,
                "user_id": serialized["id"],
                "username": serialized["username"],
                "email": serialized["email"],
                "role": serialized["role"],
            }

        session = await sessions_collection.find_one({"token": token})
        if not session:
            return {"success": False, "error": "Invalid token"}

        expires_at = session.get("expiresAt")
        if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if not isinstance(expires_at, datetime) or _utc_now() > expires_at:
            await sessions_collection.delete_one({"_id": session["_id"]})
            return {"success": False, "error": "Token expired"}

        user = await users_collection.find_one({"_id": session["userId"]})
        if not user:
            return {"success": False, "error": "User not found"}

        serialized = _serialize_user(user)
        return {
            "success": True,
            "user_id": serialized["id"],
            "name": serialized.get("name"),
            "username": serialized["username"],
            "email": serialized["email"],
            "role": serialized["role"],
            "provider": serialized.get("provider"),
            "profileImage": serialized.get("profileImage"),
            "googleId": serialized.get("googleId"),
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def logout_session(token: str) -> dict:
    try:
        if use_demo_fallback:
            fallback_store["sessions"] = [entry for entry in fallback_store["sessions"] if entry.get("token") != token]
            _save_fallback_store()
            return {"success": True}
        await sessions_collection.delete_one({"token": token})
        return {"success": True}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def _serialize_public_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc.get("_id") or doc.get("id")),
        "username": doc.get("username", ""),
        "name": doc.get("name") or doc.get("username", ""),
        "profileImage": doc.get("profileImage") or None,
        "bio": doc.get("bio") or "",
    }


async def search_public_users(query_text: str, limit: int = 8) -> List[Dict[str, Any]]:
    try:
        if users_collection is None and not use_demo_fallback:
            await init_db()

        clean = (query_text or "").strip()
        if clean.startswith("@"):
            clean = clean[1:].strip()
        if not clean:
            return []

        safe_limit = max(1, min(limit, 20))
        pattern = re.compile(re.escape(clean), re.IGNORECASE)

        if use_demo_fallback:
            matched = []
            for u in fallback_store.get("users", []):
                if u.get("status") == "suspended":
                    continue
                u_name = str(u.get("name") or "")
                u_username = str(u.get("username") or "")
                if pattern.search(u_username) or pattern.search(u_name):
                    matched.append(_serialize_public_user(u))
                    if len(matched) >= safe_limit:
                        break
            return matched

        if users_collection is None:
            return []

        query = {
            "status": {"$ne": "suspended"},
            "$or": [
                {"username": {"$regex": re.escape(clean), "$options": "i"}},
                {"name": {"$regex": re.escape(clean), "$options": "i"}},
            ],
        }
        cursor = users_collection.find(
            query,
            {"_id": 1, "username": 1, "name": 1, "profileImage": 1, "bio": 1},
        ).limit(safe_limit)
        docs = await cursor.to_list(length=safe_limit)
        return [_serialize_public_user(doc) for doc in docs]
    except Exception:
        return []


async def _get_user_doc_by_identifier(identifier: str) -> Optional[Dict[str, Any]]:
    """Finds active non-suspended user doc by ID or username."""
    if users_collection is None and not use_demo_fallback:
        await init_db()

    clean = urllib.parse.unquote(str(identifier or "")).strip()
    clean_username = clean.lstrip("@").strip()
    if not clean:
        return None

    if use_demo_fallback:
        for u in fallback_store.get("users", []):
            if u.get("status") == "suspended":
                continue
            if (
                str(u.get("id")) == clean
                or str(u.get("_id")) == clean
                or str(u.get("username", "")).lower() == clean_username.lower()
            ):
                return u
        return None

    if users_collection is None:
        return None

    query_conditions: List[Dict[str, Any]] = [
        {"username": {"$regex": f"^{re.escape(clean_username)}$", "$options": "i"}}
    ]
    if ObjectId.is_valid(clean):
        query_conditions.append({"_id": ObjectId(clean)})
    query_conditions.append({"_id": clean})
    query_conditions.append({"id": clean})

    return await users_collection.find_one({
        "$and": [
            {"$or": query_conditions},
            {"status": {"$ne": "suspended"}},
        ]
    })


async def get_user_follow_stats(target_identifier: str, viewer_user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    try:
        if users_collection is None and not use_demo_fallback:
            await init_db()

        target_user = await _get_user_doc_by_identifier(target_identifier)
        if not target_user:
            return None

        target_id_str = str(target_user.get("_id") or target_user.get("id"))

        if use_demo_fallback:
            follows = fallback_store.get("follows", [])
            follower_count = sum(1 for f in follows if str(f.get("followingId")) == target_id_str)
            following_count = sum(1 for f in follows if str(f.get("followerId")) == target_id_str)
            is_following = False
            if viewer_user_id:
                viewer_id_str = str(viewer_user_id)
                is_following = any(
                    str(f.get("followerId")) == viewer_id_str and str(f.get("followingId")) == target_id_str
                    for f in follows
                )
            return {
                "success": True,
                "followerCount": follower_count,
                "followingCount": following_count,
                "isFollowing": is_following,
            }

        if follows_collection is None:
            return {
                "success": True,
                "followerCount": 0,
                "followingCount": 0,
                "isFollowing": False,
            }

        follower_count = await follows_collection.count_documents({"followingId": target_id_str})
        following_count = await follows_collection.count_documents({"followerId": target_id_str})
        is_following = False
        if viewer_user_id:
            viewer_id_str = str(viewer_user_id)
            existing = await follows_collection.find_one({
                "followerId": viewer_id_str,
                "followingId": target_id_str,
            })
            is_following = existing is not None

        return {
            "success": True,
            "followerCount": follower_count,
            "followingCount": following_count,
            "isFollowing": is_following,
        }
    except Exception as exc:
        logger.error("Failed to get follow stats for %s: %s", target_identifier, exc)
        return None


async def follow_user(follower_user_id: str, target_username: str) -> Dict[str, Any]:
    try:
        if users_collection is None and not use_demo_fallback:
            await init_db()

        target_user = await _get_user_doc_by_identifier(target_username)
        if not target_user:
            return {"success": False, "error": "User not found", "status_code": 404}

        target_id_str = str(target_user.get("_id") or target_user.get("id"))
        follower_id_str = str(follower_user_id)

        if follower_id_str == target_id_str:
            return {"success": False, "error": "Cannot follow yourself", "status_code": 400}

        if use_demo_fallback:
            follows = fallback_store.setdefault("follows", [])
            already_following = any(
                str(f.get("followerId")) == follower_id_str and str(f.get("followingId")) == target_id_str
                for f in follows
            )
            if not already_following:
                follows.append({
                    "followerId": follower_id_str,
                    "followingId": target_id_str,
                    "createdAt": _utc_now().isoformat(),
                })
                _save_fallback_store()
                follower_doc = _get_fallback_user_by_id(follower_id_str)
                actor_name = follower_doc.get("name") or follower_doc.get("username") if follower_doc else "Someone"
                await create_notification(
                    recipient_id=target_id_str,
                    actor_id=follower_id_str,
                    notification_type="follow",
                    message=f"{actor_name} started following you.",
                    actor_user_doc=follower_doc,
                )
            stats = await get_user_follow_stats(target_id_str, viewer_user_id=follower_id_str)
            return {
                "success": True,
                "isFollowing": True,
                "followerCount": stats["followerCount"] if stats else 1,
                "followingCount": stats["followingCount"] if stats else 0,
            }

        if follows_collection is None:
            return {"success": False, "error": "Database unavailable", "status_code": 500}

        now = _utc_now()
        res = await follows_collection.update_one(
            {"followerId": follower_id_str, "followingId": target_id_str},
            {"$setOnInsert": {"followerId": follower_id_str, "followingId": target_id_str, "createdAt": now}},
            upsert=True,
        )
        if res.upserted_id is not None:
            follower_doc = await _get_user_doc_by_identifier(follower_id_str)
            actor_name = follower_doc.get("name") or follower_doc.get("username") if follower_doc else "Someone"
            await create_notification(
                recipient_id=target_id_str,
                actor_id=follower_id_str,
                notification_type="follow",
                message=f"{actor_name} started following you.",
                actor_user_doc=follower_doc,
            )
        stats = await get_user_follow_stats(target_id_str, viewer_user_id=follower_id_str)
        return {
            "success": True,
            "isFollowing": True,
            "followerCount": stats["followerCount"] if stats else 1,
            "followingCount": stats["followingCount"] if stats else 0,
        }
    except Exception as exc:
        logger.error("Failed to follow user %s: %s", target_username, exc)
        return {"success": False, "error": str(exc), "status_code": 500}


async def unfollow_user(follower_user_id: str, target_username: str) -> Dict[str, Any]:
    try:
        if users_collection is None and not use_demo_fallback:
            await init_db()

        target_user = await _get_user_doc_by_identifier(target_username)
        if not target_user:
            return {"success": False, "error": "User not found", "status_code": 404}

        target_id_str = str(target_user.get("_id") or target_user.get("id"))
        follower_id_str = str(follower_user_id)

        if use_demo_fallback:
            before_len = len(fallback_store.get("follows", []))
            fallback_store["follows"] = [
                f for f in fallback_store.get("follows", [])
                if not (str(f.get("followerId")) == follower_id_str and str(f.get("followingId")) == target_id_str)
            ]
            if len(fallback_store["follows"]) != before_len:
                _save_fallback_store()
            stats = await get_user_follow_stats(target_id_str, viewer_user_id=follower_id_str)
            return {
                "success": True,
                "isFollowing": False,
                "followerCount": stats["followerCount"] if stats else 0,
                "followingCount": stats["followingCount"] if stats else 0,
            }

        if follows_collection is None:
            return {"success": False, "error": "Database unavailable", "status_code": 500}

        await follows_collection.delete_one({"followerId": follower_id_str, "followingId": target_id_str})
        stats = await get_user_follow_stats(target_id_str, viewer_user_id=follower_id_str)
        return {
            "success": True,
            "isFollowing": False,
            "followerCount": stats["followerCount"] if stats else 0,
            "followingCount": stats["followingCount"] if stats else 0,
        }
    except Exception as exc:
        logger.error("Failed to unfollow user %s: %s", target_username, exc)
        return {"success": False, "error": str(exc), "status_code": 500}


def _serialize_notification(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc.get("_id") or doc.get("id")),
        "recipientId": str(doc.get("recipientId")),
        "actorId": str(doc.get("actorId")),
        "actor": doc.get("actor") or {},
        "type": doc.get("type", "follow"),
        "message": doc.get("message", ""),
        "read": bool(doc.get("read", False)),
        "createdAt": _to_iso(doc.get("createdAt")),
        "metadata": doc.get("metadata") or {},
    }


async def create_notification(
    recipient_id: str,
    actor_id: str,
    notification_type: str,
    message: str,
    actor_user_doc: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    try:
        if notifications_collection is None and not use_demo_fallback:
            await init_db()

        actor_info = {}
        if actor_user_doc:
            actor_info = {
                "id": str(actor_user_doc.get("_id") or actor_user_doc.get("id")),
                "username": actor_user_doc.get("username", ""),
                "name": actor_user_doc.get("name") or actor_user_doc.get("username", ""),
                "profileImage": actor_user_doc.get("profileImage") or None,
            }
        else:
            actor_user = await _get_user_doc_by_identifier(actor_id)
            if actor_user:
                actor_info = {
                    "id": str(actor_user.get("_id") or actor_user.get("id")),
                    "username": actor_user.get("username", ""),
                    "name": actor_user.get("name") or actor_user.get("username", ""),
                    "profileImage": actor_user.get("profileImage") or None,
                }

        now_dt = _utc_now()
        now_iso = now_dt.isoformat()

        if use_demo_fallback:
            notif_id = f"notif_{int(now_dt.timestamp() * 1000)}_{secrets.token_hex(4)}"
            doc = {
                "id": notif_id,
                "recipientId": str(recipient_id),
                "actorId": str(actor_id),
                "actor": actor_info,
                "type": str(notification_type),
                "message": str(message),
                "read": False,
                "createdAt": now_iso,
                "metadata": metadata or {},
            }
            fallback_store.setdefault("notifications", []).append(doc)
            _save_fallback_store()
            return _serialize_notification(doc)

        if notifications_collection is None:
            return None

        doc = {
            "recipientId": str(recipient_id),
            "actorId": str(actor_id),
            "actor": actor_info,
            "type": str(notification_type),
            "message": str(message),
            "read": False,
            "createdAt": now_dt,
            "metadata": metadata or {},
        }
        res = await notifications_collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return _serialize_notification(doc)
    except Exception as exc:
        logger.error("Failed to create notification: %s", exc)
        return None


async def list_notifications_for_user(user_id: str, limit: int = 30) -> Dict[str, Any]:
    try:
        if notifications_collection is None and not use_demo_fallback:
            await init_db()

        safe_limit = max(1, min(limit, 100))
        uid_str = str(user_id)

        if use_demo_fallback:
            all_notifs = [
                n for n in fallback_store.get("notifications", [])
                if str(n.get("recipientId")) == uid_str
            ]
            ordered = sorted(
                all_notifs,
                key=lambda n: _to_datetime(n.get("createdAt")) or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            unread_count = sum(1 for n in all_notifs if not n.get("read"))
            paginated = ordered[:safe_limit]
            return {
                "success": True,
                "notifications": [_serialize_notification(_clone_json(n)) for n in paginated],
                "unreadCount": unread_count,
            }

        if notifications_collection is None:
            return {"success": True, "notifications": [], "unreadCount": 0}

        unread_count = await notifications_collection.count_documents({
            "recipientId": uid_str,
            "read": False,
        })
        cursor = notifications_collection.find({"recipientId": uid_str}).sort("createdAt", -1).limit(safe_limit)
        docs = await cursor.to_list(length=safe_limit)
        return {
            "success": True,
            "notifications": [_serialize_notification(doc) for doc in docs],
            "unreadCount": unread_count,
        }
    except Exception as exc:
        logger.error("Failed to list notifications for %s: %s", user_id, exc)
        return {"success": False, "error": str(exc), "notifications": [], "unreadCount": 0}


async def mark_notification_as_read(user_id: str, notification_id: str) -> Dict[str, Any]:
    try:
        if notifications_collection is None and not use_demo_fallback:
            await init_db()

        uid_str = str(user_id)
        nid_str = str(notification_id)

        if use_demo_fallback:
            for n in fallback_store.get("notifications", []):
                if str(n.get("id")) == nid_str and str(n.get("recipientId")) == uid_str:
                    n["read"] = True
                    _save_fallback_store()
                    break
            unread_count = sum(1 for n in fallback_store.get("notifications", []) if str(n.get("recipientId")) == uid_str and not n.get("read"))
            return {"success": True, "unreadCount": unread_count}

        if notifications_collection is None:
            return {"success": False, "error": "Database unavailable"}

        query_conditions: List[Dict[str, Any]] = [{"_id": nid_str}]
        if ObjectId.is_valid(nid_str):
            query_conditions.append({"_id": ObjectId(nid_str)})
        query_conditions.append({"id": nid_str})

        await notifications_collection.update_one(
            {
                "recipientId": uid_str,
                "$or": query_conditions,
            },
            {"$set": {"read": True}},
        )
        unread_count = await notifications_collection.count_documents({
            "recipientId": uid_str,
            "read": False,
        })
        return {"success": True, "unreadCount": unread_count}
    except Exception as exc:
        logger.error("Failed to mark notification read: %s", exc)
        return {"success": False, "error": str(exc)}


async def mark_all_notifications_as_read(user_id: str) -> Dict[str, Any]:
    try:
        if notifications_collection is None and not use_demo_fallback:
            await init_db()

        uid_str = str(user_id)
        if use_demo_fallback:
            for n in fallback_store.get("notifications", []):
                if str(n.get("recipientId")) == uid_str:
                    n["read"] = True
            _save_fallback_store()
            return {"success": True, "unreadCount": 0}

        if notifications_collection is None:
            return {"success": False, "error": "Database unavailable"}

        await notifications_collection.update_many(
            {"recipientId": uid_str, "read": False},
            {"$set": {"read": True}},
        )
        return {"success": True, "unreadCount": 0}
    except Exception as exc:
        logger.error("Failed to mark all notifications read: %s", exc)
        return {"success": False, "error": str(exc)}


async def get_public_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    try:
        if users_collection is None and not use_demo_fallback:
            await init_db()

        clean = urllib.parse.unquote(str(username or "")).strip()
        clean = clean.lstrip("@").strip()
        if not clean:
            return None

        if use_demo_fallback:
            for u in fallback_store.get("users", []):
                if u.get("status") == "suspended":
                    continue
                if str(u.get("username", "")).lower() == clean.lower():
                    serialized = _serialize_public_user(u)
                    stats = await get_user_follow_stats(serialized["id"])
                    if stats:
                        serialized["followerCount"] = stats["followerCount"]
                        serialized["followingCount"] = stats["followingCount"]
                    else:
                        serialized["followerCount"] = 0
                        serialized["followingCount"] = 0
                    return serialized
            return None

        if users_collection is None:
            return None

        doc = await users_collection.find_one(
            {
                "username": {"$regex": f"^{re.escape(clean)}$", "$options": "i"},
                "status": {"$ne": "suspended"},
            },
            {"_id": 1, "username": 1, "name": 1, "profileImage": 1, "bio": 1},
        )
        if not doc:
            return None
        serialized = _serialize_public_user(doc)
        stats = await get_user_follow_stats(serialized["id"])
        if stats:
            serialized["followerCount"] = stats["followerCount"]
            serialized["followingCount"] = stats["followingCount"]
        else:
            serialized["followerCount"] = 0
            serialized["followingCount"] = 0
        return serialized
    except Exception:
        return None


def _count_trip_places(data: Dict[str, Any], doc: Dict[str, Any]) -> int:
    count = 0
    days = data.get("days") or doc.get("itinerary") or []
    if isinstance(days, list):
        for day in days:
            if isinstance(day, dict):
                items = day.get("items") or day.get("locations") or []
                if isinstance(items, list):
                    count += len(items)
    places_pool = data.get("placesPool") or []
    if isinstance(places_pool, list):
        count += len(places_pool)
    return count


def _calculate_days_count(data: Dict[str, Any], doc: Dict[str, Any]) -> Optional[int]:
    days = data.get("days") or doc.get("itinerary")
    if isinstance(days, list) and len(days) > 0:
        return len(days)
    start_str = doc.get("startDate") or data.get("startDate")
    end_str = doc.get("endDate") or data.get("endDate")
    if start_str and end_str:
        try:
            d1 = datetime.fromisoformat(str(start_str).split("T")[0])
            d2 = datetime.fromisoformat(str(end_str).split("T")[0])
            diff = (d2 - d1).days + 1
            if diff > 0:
                return diff
        except Exception:
            pass
    return None


def _serialize_public_trip_summary(doc: Dict[str, Any]) -> Dict[str, Any]:
    data = dict(doc.get("data") or {})
    trip_id = doc.get("tripId") if doc.get("tripId") is not None else data.get("id")
    destination = doc.get("destination") or data.get("name") or data.get("destination") or data.get("title") or "My Trip"
    title = data.get("title") or data.get("name") or destination
    start_date = doc.get("startDate") or data.get("startDate") or ""
    end_date = doc.get("endDate") or data.get("endDate") or ""

    return {
        "tripId": trip_id,
        "id": trip_id,
        "title": title,
        "name": destination,
        "destination": destination,
        "startDate": start_date,
        "endDate": end_date,
        "placeCount": _count_trip_places(data, doc),
        "dayCount": _calculate_days_count(data, doc),
        "privacy": "public",
        "createdAt": _to_iso(doc.get("createdAt")),
        "updatedAt": _to_iso(doc.get("updatedAt")),
    }


async def list_public_trips_by_username(username: str, limit: int = 50) -> Optional[Dict[str, Any]]:
    try:
        if users_collection is None and not use_demo_fallback:
            await init_db()

        public_user = await get_public_user_by_username(username)
        if not public_user:
            return None

        user_id = public_user["id"]
        safe_limit = max(1, min(limit, 50))

        if use_demo_fallback:
            trips = [
                t for t in fallback_store.get("trips", [])
                if str(t.get("userId")) == str(user_id)
                and _normalize_privacy(t.get("privacy") or (t.get("data") or {}).get("privacy")) == "public"
            ]
            ordered = sorted(
                trips,
                key=lambda t: (
                    str(t.get("startDate") or ""),
                    _to_datetime(t.get("updatedAt")) or datetime.min.replace(tzinfo=timezone.utc),
                    str(t.get("tripId") or ""),
                ),
                reverse=True,
            )
            paginated = ordered[:safe_limit]
            return {
                "user": public_user,
                "trips": [_serialize_public_trip_summary(_clone_json(t)) for t in paginated],
            }

        if trips_collection is None:
            return {"user": public_user, "trips": []}

        query_conditions = [
            {"userId": user_id, "privacy": "public"},
            {"userId": user_id, "data.privacy": "public"},
        ]
        if ObjectId.is_valid(user_id):
            query_conditions.extend([
                {"userId": ObjectId(user_id), "privacy": "public"},
                {"userId": ObjectId(user_id), "data.privacy": "public"},
            ])
        query: Dict[str, Any] = {"$or": query_conditions}

        cursor = trips_collection.find(query).sort([("startDate", -1), ("updatedAt", -1), ("tripId", -1)]).limit(safe_limit)
        docs = await cursor.to_list(length=safe_limit)
        return {
            "user": public_user,
            "trips": [_serialize_public_trip_summary(doc) for doc in docs],
        }
    except Exception as exc:
        logger.error("Failed to list public trips for username %s: %s", username, exc)
        return None


def _sanitize_public_place(place: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(place, dict):
        return {}

    lat = place.get("lat")
    lon = place.get("lon")
    try:
        lat = float(lat) if lat is not None else None
    except (ValueError, TypeError):
        lat = None
    try:
        lon = float(lon) if lon is not None else None
    except (ValueError, TypeError):
        lon = None

    title = str(place.get("title") or place.get("name") or "").strip()
    category = str(place.get("category") or "").strip()
    subtitle = str(place.get("subtitle") or place.get("address") or "").strip()
    address = str(place.get("address") or subtitle).strip()
    image = place.get("image") or None
    start_time = str(place.get("startTime") or "").strip()
    end_time = str(place.get("endTime") or "").strip()

    return {
        "id": place.get("id"),
        "title": title,
        "name": title,
        "category": category,
        "subtitle": subtitle,
        "address": address,
        "lat": lat,
        "lon": lon,
        "image": image,
        "startTime": start_time,
        "endTime": end_time,
    }


def _sanitize_public_day(day: Dict[str, Any], day_idx: int) -> Dict[str, Any]:
    if not isinstance(day, dict):
        return {"id": f"day-{day_idx + 1}", "label": f"Day {day_idx + 1}", "shortLabel": "", "date": "", "items": []}

    raw_items = day.get("items") or day.get("locations") or []
    items = [_sanitize_public_place(p) for p in raw_items if isinstance(p, dict)] if isinstance(raw_items, list) else []

    return {
        "id": day.get("id") or f"day-{day_idx + 1}",
        "label": day.get("label") or f"Day {day_idx + 1}",
        "shortLabel": day.get("shortLabel") or "",
        "date": day.get("date") or "",
        "items": items,
    }


def _serialize_public_trip_detail(doc: Dict[str, Any], owner_doc: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data = dict(doc.get("data") or {})
    trip_id = doc.get("tripId") if doc.get("tripId") is not None else data.get("id")
    destination = doc.get("destination") or data.get("name") or data.get("destination") or data.get("title") or "My Trip"
    title = data.get("title") or data.get("name") or destination
    start_date = doc.get("startDate") or data.get("startDate") or ""
    end_date = doc.get("endDate") or data.get("endDate") or ""

    raw_days = data.get("days") or doc.get("itinerary") or []
    days = [_sanitize_public_day(d, idx) for idx, d in enumerate(raw_days) if isinstance(d, dict)] if isinstance(raw_days, list) else []

    raw_pool = data.get("placesPool") or []
    places_pool = [_sanitize_public_place(p) for p in raw_pool if isinstance(p, dict)] if isinstance(raw_pool, list) else []

    owner_info = None
    if owner_doc:
        owner_info = {
            "username": owner_doc.get("username", ""),
            "name": owner_doc.get("name") or owner_doc.get("username", ""),
            "profileImage": owner_doc.get("profileImage") or None,
            "bio": owner_doc.get("bio") or "",
        }

    return {
        "id": trip_id,
        "tripId": trip_id,
        "title": title,
        "name": destination,
        "destination": destination,
        "startDate": start_date,
        "endDate": end_date,
        "privacy": "public",
        "placeCount": _count_trip_places(data, doc),
        "dayCount": _calculate_days_count(data, doc),
        "days": days,
        "placesPool": places_pool,
        "owner": owner_info,
        "createdAt": _to_iso(doc.get("createdAt")),
        "updatedAt": _to_iso(doc.get("updatedAt")),
    }


async def get_public_trip_by_id(trip_id: Any) -> Optional[Dict[str, Any]]:
    try:
        if users_collection is None and not use_demo_fallback:
            await init_db()

        clean_trip_id = str(trip_id or "").strip()
        if not clean_trip_id:
            return None

        trip_id_queries: List[Any] = [clean_trip_id]
        try:
            trip_id_queries.append(int(clean_trip_id))
        except (ValueError, TypeError):
            pass

        if use_demo_fallback:
            trip_doc = next(
                (
                    t for t in fallback_store.get("trips", [])
                    if (
                        str(t.get("tripId")) == clean_trip_id
                        or (t.get("tripId") in trip_id_queries)
                        or str((t.get("data") or {}).get("id")) == clean_trip_id
                        or ((t.get("data") or {}).get("id") in trip_id_queries)
                    )
                ),
                None,
            )
            if not trip_doc:
                return None

            raw_privacy = trip_doc.get("privacy") or (trip_doc.get("data") or {}).get("privacy") or (trip_doc.get("data") or {}).get("visibility")
            if _normalize_privacy(raw_privacy) != "public":
                return None

            owner_user = _get_fallback_user_by_id(str(trip_doc.get("userId")))
            if not owner_user or owner_user.get("status") == "suspended":
                return None

            return {
                "success": True,
                "trip": _serialize_public_trip_detail(_clone_json(trip_doc), owner_user),
            }

        if trips_collection is None or users_collection is None:
            return None

        query = {
            "$and": [
                {
                    "$or": [
                        {"tripId": {"$in": trip_id_queries}},
                        {"data.id": {"$in": trip_id_queries}},
                    ]
                },
                {
                    "$or": [
                        {"privacy": "public"},
                        {"data.privacy": "public"},
                    ]
                }
            ]
        }
        doc = await trips_collection.find_one(query)
        if not doc:
            return None

        raw_privacy = doc.get("privacy") or (doc.get("data") or {}).get("privacy") or (doc.get("data") or {}).get("visibility")
        if _normalize_privacy(raw_privacy) != "public":
            return None

        user_id = doc.get("userId")
        if not user_id:
            return None

        owner_query_conditions: List[Dict[str, Any]] = []
        if ObjectId.is_valid(str(user_id)):
            owner_query_conditions.append({"_id": ObjectId(str(user_id))})
        owner_query_conditions.extend([
            {"_id": str(user_id)},
            {"id": str(user_id)},
        ])
        owner_doc = await users_collection.find_one({
            "$and": [
                {"$or": owner_query_conditions},
                {"status": {"$ne": "suspended"}},
            ]
        })
        if not owner_doc:
            return None

        return {
            "success": True,
            "trip": _serialize_public_trip_detail(doc, owner_doc),
        }
    except Exception as exc:
        logger.error("Failed to retrieve public trip %s: %s", trip_id, exc)
        return None





async def update_user_profile(
    user_id: str,
    *,
    name: str,
    username: str,
    email: str,
    profile_image: Optional[str] = None,
    bio: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        normalized_name = (name or "").strip()
        normalized_username = (username or "").strip()
        normalized_email = (email or "").strip().lower()
        normalized_profile_image = (profile_image or "").strip() or None

        if not normalized_name or not normalized_username or not normalized_email:
            return {"success": False, "error": "Name, username, and email are required"}

        if bio is not None:
            clean_bio = str(bio).strip()
            if len(clean_bio) > 250:
                return {"success": False, "error": "Bio must be at most 250 characters"}
        else:
            clean_bio = None

        if use_demo_fallback:
            existing = _get_fallback_user_by_id(user_id)
            if not existing:
                return {"success": False, "error": "User not found"}

            duplicate = next(
                (
                    user for user in fallback_store["users"]
                    if str(user.get("id")) != str(user_id)
                    and (
                        user.get("username") == normalized_username
                        or str(user.get("email", "")).strip().lower() == normalized_email
                    )
                ),
                None,
            )
            if duplicate:
                return {"success": False, "error": "Username or email already exists"}

            existing["name"] = normalized_name
            existing["username"] = normalized_username
            existing["email"] = normalized_email
            existing["profileImage"] = normalized_profile_image
            if clean_bio is not None:
                existing["bio"] = clean_bio
            _save_fallback_store()
            return {"success": True, "user": _serialize_user(existing)}

        object_id = ObjectId(user_id)
        duplicate = await users_collection.find_one(
            {
                "_id": {"$ne": object_id},
                "$or": [{"username": normalized_username}, {"email": normalized_email}],
            },
            {"_id": 1},
        )
        if duplicate:
            return {"success": False, "error": "Username or email already exists"}

        update_fields: Dict[str, Any] = {
            "name": normalized_name,
            "username": normalized_username,
            "email": normalized_email,
            "profileImage": normalized_profile_image,
        }
        if clean_bio is not None:
            update_fields["bio"] = clean_bio

        await users_collection.update_one({"_id": object_id}, {"$set": update_fields})
        updated = await users_collection.find_one({"_id": object_id})
        if not updated:
            return {"success": False, "error": "User not found"}
        return {"success": True, "user": _serialize_user(updated)}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def delete_user_account(user_id: str) -> Dict[str, Any]:
    try:
        if use_demo_fallback:
            user = _get_fallback_user_by_id(user_id)
            if not user:
                return {"success": False, "error": "User not found"}
            fallback_store["users"] = [entry for entry in fallback_store["users"] if str(entry.get("id")) != str(user_id)]
            fallback_store["sessions"] = [entry for entry in fallback_store["sessions"] if str(entry.get("userId")) != str(user_id)]
            fallback_store["trips"] = [entry for entry in fallback_store["trips"] if str(entry.get("userId")) != str(user_id)]
            fallback_store["follows"] = [
                entry for entry in fallback_store.get("follows", [])
                if str(entry.get("followerId")) != str(user_id) and str(entry.get("followingId")) != str(user_id)
            ]
            fallback_store["notifications"] = [
                entry for entry in fallback_store.get("notifications", [])
                if str(entry.get("recipientId")) != str(user_id) and str(entry.get("actorId")) != str(user_id)
            ]
            _save_fallback_store()
            return {"success": True}

        object_id = ObjectId(user_id)
        user_delete = await users_collection.delete_one({"_id": object_id})
        if user_delete.deleted_count == 0:
            return {"success": False, "error": "User not found"}
        await sessions_collection.delete_many({"$or": [{"userId": object_id}, {"userId": user_id}]})
        await trips_collection.delete_many({"userId": user_id})
        if follows_collection is not None:
            await follows_collection.delete_many({"$or": [{"followerId": str(user_id)}, {"followingId": str(user_id)}]})
        if notifications_collection is not None:
            await notifications_collection.delete_many({"$or": [{"recipientId": str(user_id)}, {"actorId": str(user_id)}]})
        return {"success": True}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def save_trip_document(user_id: str, trip_payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        normalized = _normalize_trip_payload(trip_payload)
        previous_trip = None
        if use_demo_fallback:
            now = _utc_now().isoformat()
            existing = next((trip for trip in fallback_store["trips"] if str(trip.get("tripId")) == str(normalized["tripId"]) and str(trip.get("userId")) == str(user_id)), None)
            previous_trip = _serialize_trip(_clone_json(existing)) if existing is not None else None
            if existing is None:
                existing = {"createdAt": now, "userId": str(user_id)}
                fallback_store["trips"].append(existing)

            trip_privacy = normalized["privacy"]
            share_token = normalized.get("shareToken") or (normalized.get("data") or {}).get("shareToken")
            if not share_token and existing:
                share_token = existing.get("shareToken") or (existing.get("data") or {}).get("shareToken")
            edit_share_token = normalized.get("editShareToken") or (normalized.get("data") or {}).get("editShareToken")
            if not edit_share_token and existing:
                edit_share_token = existing.get("editShareToken") or (existing.get("data") or {}).get("editShareToken")

            copied_from_edit_token = existing.get("copiedFromEditToken") or (existing.get("data") or {}).get("copiedFromEditToken") if existing else None
            source_trip_id = existing.get("sourceTripId") if existing and existing.get("sourceTripId") is not None else (existing.get("data") or {}).get("sourceTripId") if existing else None

            # Prevent untrusted client from claiming provenance on a trip that wasn't an edit copy
            if not copied_from_edit_token and isinstance(normalized.get("data"), dict):
                normalized["data"].pop("copiedFromEditToken", None)
                normalized["data"].pop("sourceTripId", None)

            update_data = {
                "tripId": normalized["tripId"],
                "userId": str(user_id),
                "destination": normalized["destination"],
                "startDate": normalized["startDate"],
                "endDate": normalized["endDate"],
                "privacy": trip_privacy,
                "itinerary": _clone_json(normalized["itinerary"]),
                "preferences": _clone_json(normalized["preferences"]),
                "data": _clone_json(normalized["data"]),
                "updatedAt": now,
            }
            if share_token:
                update_data["shareToken"] = share_token
                update_data["data"]["shareToken"] = share_token
            if edit_share_token:
                update_data["editShareToken"] = edit_share_token
                update_data["data"]["editShareToken"] = edit_share_token
            if copied_from_edit_token:
                update_data["copiedFromEditToken"] = copied_from_edit_token
                update_data["data"]["copiedFromEditToken"] = copied_from_edit_token
            if source_trip_id is not None:
                update_data["sourceTripId"] = source_trip_id
                update_data["data"]["sourceTripId"] = source_trip_id

            existing.update(update_data)
            saved = _clone_json(existing)
            _save_fallback_store()
            serialized_trip = _serialize_trip(saved)
            try:
                from app.services.activity.activity_service import build_trip_activity_events, record_activity_batch

                activities = build_trip_activity_events(
                    actor_user_id=str(user_id),
                    previous_trip=previous_trip,
                    current_trip=serialized_trip,
                )
                if activities:
                    await record_activity_batch(activities)
            except Exception as exc:
                logger.warning("Activity history record failed after trip save: %s", exc)
            return {"success": True, "trip": serialized_trip}

        trip_id_val = normalized["tripId"]
        trip_id_queries: List[Any] = [trip_id_val, str(trip_id_val)]
        try:
            trip_id_queries.append(int(trip_id_val))
        except (ValueError, TypeError):
            pass

        user_id_queries: List[Any] = [user_id, str(user_id)]
        try:
            if ObjectId.is_valid(str(user_id)):
                user_id_queries.append(ObjectId(str(user_id)))
        except Exception:
            pass

        previous_doc = await trips_collection.find_one({
            "tripId": {"$in": trip_id_queries},
            "userId": {"$in": user_id_queries},
        })
        previous_trip = _serialize_trip(previous_doc) if previous_doc is not None else None

        trip_privacy = normalized["privacy"]
        share_token = normalized.get("shareToken") or (normalized.get("data") or {}).get("shareToken")
        if not share_token and previous_doc:
            share_token = previous_doc.get("shareToken") or (previous_doc.get("data") or {}).get("shareToken")
        edit_share_token = normalized.get("editShareToken") or (normalized.get("data") or {}).get("editShareToken")
        if not edit_share_token and previous_doc:
            edit_share_token = previous_doc.get("editShareToken") or (previous_doc.get("data") or {}).get("editShareToken")

        copied_from_edit_token = (
            previous_doc.get("copiedFromEditToken")
            or (previous_doc.get("data") or {}).get("copiedFromEditToken")
            if previous_doc else None
        )
        source_trip_id = (
            previous_doc.get("sourceTripId")
            if previous_doc and previous_doc.get("sourceTripId") is not None
            else (previous_doc.get("data") or {}).get("sourceTripId")
            if previous_doc else None
        )

        # Prevent untrusted client from claiming provenance on a trip that wasn't an edit copy
        if not copied_from_edit_token and isinstance(normalized.get("data"), dict):
            normalized["data"].pop("copiedFromEditToken", None)
            normalized["data"].pop("sourceTripId", None)

        stored_trip_id = previous_doc.get("tripId") if previous_doc else normalized["tripId"]
        document = {
            "tripId": stored_trip_id,
            "userId": str(user_id),
            "destination": normalized["destination"],
            "startDate": normalized["startDate"],
            "endDate": normalized["endDate"],
            "privacy": trip_privacy,
            "itinerary": normalized["itinerary"],
            "preferences": normalized["preferences"],
            "data": normalized["data"],
            "updatedAt": _utc_now(),
        }
        if share_token:
            document["shareToken"] = share_token
            document["data"]["shareToken"] = share_token
        if edit_share_token:
            document["editShareToken"] = edit_share_token
            document["data"]["editShareToken"] = edit_share_token
        if copied_from_edit_token:
            document["copiedFromEditToken"] = copied_from_edit_token
            document["data"]["copiedFromEditToken"] = copied_from_edit_token
        if source_trip_id is not None:
            document["sourceTripId"] = source_trip_id
            document["data"]["sourceTripId"] = source_trip_id

        if previous_doc:
            await trips_collection.update_one(
                {"_id": previous_doc["_id"]},
                {"$set": document},
            )
            saved = await trips_collection.find_one({"_id": previous_doc["_id"]})
        else:
            await trips_collection.update_one(
                {
                    "userId": {"$in": user_id_queries},
                    "tripId": {"$in": trip_id_queries},
                },
                {"$set": document, "$setOnInsert": {"createdAt": _utc_now()}},
                upsert=True,
            )
            saved = await trips_collection.find_one({
                "userId": {"$in": user_id_queries},
                "tripId": {"$in": trip_id_queries},
            })
        serialized_trip = _serialize_trip(saved)
        try:
            from app.services.activity.activity_service import build_trip_activity_events, record_activity_batch

            activities = build_trip_activity_events(
                actor_user_id=str(user_id),
                previous_trip=previous_trip,
                current_trip=serialized_trip,
            )
            if activities:
                await record_activity_batch(activities)
        except Exception as exc:
            logger.warning("Activity history record failed after trip save: %s", exc)
        return {"success": True, "trip": serialized_trip}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def list_trips_for_user(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    if use_demo_fallback:
        query = fallback_store["trips"] if user.get("role") == "admin" else [
            trip for trip in fallback_store["trips"]
            if str(trip.get("userId")) == str(user["user_id"])
        ]
        ordered = sorted(
            query,
            key=lambda trip: _to_datetime(trip.get("updatedAt")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        return [_serialize_trip(_clone_json(doc)) for doc in ordered]
    query = {} if user.get("role") == "admin" else {
        "$or": [
            {"userId": user["user_id"]},
            {"userId": str(user["user_id"])},
        ]
    }
    trips = await trips_collection.find(query).sort("updatedAt", -1).to_list(length=None)
    return [_serialize_trip(doc) for doc in trips]


async def delete_trip_for_user(user: Dict[str, Any], trip_id: Any) -> bool:
    if use_demo_fallback:
        deleted_trip = next(
            (
                _clone_json(trip)
                for trip in fallback_store["trips"]
                if str(trip.get("tripId")) == str(trip_id)
                and (user.get("role") == "admin" or str(trip.get("userId")) == str(user["user_id"]))
            ),
            None,
        )
        before = len(fallback_store["trips"])
        fallback_store["trips"] = [
            trip for trip in fallback_store["trips"]
            if not (
                str(trip.get("tripId")) == str(trip_id)
                and (user.get("role") == "admin" or str(trip.get("userId")) == str(user["user_id"]))
            )
        ]
        deleted = len(fallback_store["trips"]) < before
        if deleted:
            _save_fallback_store()
            if deleted_trip is not None:
                try:
                    from app.services.activity.activity_service import build_trip_deleted_activity, record_activity

                    await record_activity(**build_trip_deleted_activity(
                        actor_user_id=str(user["user_id"]),
                        previous_trip=_serialize_trip(deleted_trip),
                    ))
                except Exception as exc:
                    logger.warning("Activity history record failed after trip delete: %s", exc)
        return deleted
    trip_id_queries: List[Any] = [trip_id, str(trip_id)]
    try:
        trip_id_queries.append(int(trip_id))
    except (ValueError, TypeError):
        pass
    user_id = user.get("user_id")
    user_id_queries: List[Any] = [user_id, str(user_id)]
    try:
        if ObjectId.is_valid(str(user_id)):
            user_id_queries.append(ObjectId(str(user_id)))
    except Exception:
        pass

    query: Dict[str, Any] = {"tripId": {"$in": trip_id_queries}}
    if user.get("role") != "admin":
        query["userId"] = {"$in": user_id_queries}
    previous_doc = await trips_collection.find_one(query)
    result = await trips_collection.delete_one(query)
    if result.deleted_count > 0 and previous_doc is not None:
        try:
            from app.services.activity.activity_service import build_trip_deleted_activity, record_activity

            await record_activity(**build_trip_deleted_activity(
                actor_user_id=str(user["user_id"]),
                previous_trip=_serialize_trip(previous_doc),
            ))
        except Exception as exc:
            logger.warning("Activity history record failed after trip delete: %s", exc)
    return result.deleted_count > 0


async def get_admin_overview() -> Dict[str, Any]:
    if use_demo_fallback:
        users = [_clone_json(doc) for doc in fallback_store["users"]]
        trips = [_clone_json(doc) for doc in fallback_store["trips"]]
        ordered_users = sorted(
            users,
            key=lambda user: _to_datetime(user.get("createdAt")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        ordered_trips = sorted(
            trips,
            key=lambda trip: _to_datetime(trip.get("updatedAt")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        return {
            "users": [_serialize_user(doc) for doc in ordered_users],
            "trips": [_serialize_trip(doc) for doc in ordered_trips],
            "counts": {
                "users": len(ordered_users),
                "trips": len(ordered_trips),
                "adminAccounts": sum(1 for u in ordered_users if u.get("role") == "admin"),
            },
        }
    users = await users_collection.find({}, {"password_hash": 0}).sort("createdAt", -1).to_list(length=None)
    trips = await trips_collection.find({}).sort("updatedAt", -1).to_list(length=None)
    return {
        "users": [_serialize_user(doc) for doc in users],
        "trips": [_serialize_trip(doc) for doc in trips],
        "counts": {
            "users": len(users),
            "trips": len(trips),
            "adminAccounts": sum(1 for u in users if u.get("role") == "admin"),
        },
    }


async def generate_or_get_trip_share_token(user_id: str, trip_id: Any, permission: str = "view") -> Dict[str, Any]:
    try:
        normalized_trip_id = trip_id
        is_edit = str(permission).lower().strip() == "edit"
        token_field = "editShareToken" if is_edit else "shareToken"
        perm_name = "edit" if is_edit else "view"

        if use_demo_fallback:
            trip = next(
                (
                    t for t in fallback_store["trips"]
                    if str(t.get("userId")) == str(user_id)
                    and (str(t.get("tripId")) == str(normalized_trip_id) or str(t.get("id")) == str(normalized_trip_id))
                ),
                None,
            )
            if not trip:
                return {"success": False, "error": "Trip not found"}

            existing_token = trip.get(token_field) or (trip.get("data") or {}).get(token_field)
            if existing_token:
                return {
                    "success": True,
                    "shareToken": existing_token,
                    "editShareToken": existing_token if is_edit else None,
                    "permission": perm_name,
                }

            new_token = generate_share_token(permission=perm_name)
            trip[token_field] = new_token
            if isinstance(trip.get("data"), dict):
                trip["data"][token_field] = new_token
            _save_fallback_store()
            return {
                "success": True,
                "shareToken": new_token,
                "editShareToken": new_token if is_edit else None,
                "permission": perm_name,
            }

        # MongoDB lookup
        query: Dict[str, Any] = {
            "userId": user_id,
            "$or": [
                {"tripId": normalized_trip_id},
                {"tripId": str(normalized_trip_id)},
            ],
        }
        try:
            query["$or"].append({"tripId": int(normalized_trip_id)})
        except (ValueError, TypeError):
            pass

        doc = await trips_collection.find_one(query)
        if not doc:
            return {"success": False, "error": "Trip not found"}

        existing_token = doc.get(token_field) or (doc.get("data") or {}).get(token_field)
        if existing_token:
            return {
                "success": True,
                "shareToken": existing_token,
                "editShareToken": existing_token if is_edit else None,
                "permission": perm_name,
            }

        new_token = generate_share_token(permission=perm_name)
        await trips_collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {token_field: new_token, f"data.{token_field}": new_token}},
        )
        return {
            "success": True,
            "shareToken": new_token,
            "editShareToken": new_token if is_edit else None,
            "permission": perm_name,
        }
    except Exception as exc:
        logger.error("Failed to generate or get share token: %s", exc)
        return {"success": False, "error": str(exc)}


async def get_shared_trip_by_token(share_token: str) -> Dict[str, Any]:
    try:
        clean_token = (share_token or "").strip()
        if not clean_token or len(clean_token) < 8 or clean_token.startswith("sh_edit_"):
            return {"success": False, "error": "Invalid share token"}

        if use_demo_fallback:
            trip_doc = next(
                (
                    t for t in fallback_store["trips"]
                    if t.get("shareToken") == clean_token or (t.get("data") or {}).get("shareToken") == clean_token
                ),
                None,
            )
            if not trip_doc:
                return {"success": False, "error": "Shared trip not found"}

            serialized = _serialize_trip(_clone_json(trip_doc))
            user_doc = _get_fallback_user_by_id(trip_doc.get("userId"))
            owner_info = {
                "name": user_doc.get("name") if user_doc else None,
                "username": user_doc.get("username") if user_doc else None,
                "profileImage": user_doc.get("profileImage") if user_doc else None,
            } if user_doc else None
            return {
                "success": True,
                "trip": serialized,
                "owner": owner_info,
                "permission": "view",
            }

        # MongoDB lookup
        trip_doc = await trips_collection.find_one({
            "$or": [
                {"shareToken": clean_token},
                {"data.shareToken": clean_token},
            ]
        })
        if not trip_doc:
            return {"success": False, "error": "Shared trip not found"}

        serialized = _serialize_trip(trip_doc)
        owner_info = None
        user_id = trip_doc.get("userId")
        if user_id:
            try:
                user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
                user_doc = await users_collection.find_one({"_id": user_obj_id})
                if user_doc:
                    owner_info = {
                        "name": user_doc.get("name"),
                        "username": user_doc.get("username"),
                        "profileImage": user_doc.get("profileImage"),
                    }
            except Exception:
                pass

        return {
            "success": True,
            "trip": serialized,
            "owner": owner_info,
            "permission": "view",
        }
    except Exception as exc:
        logger.error("Failed to retrieve shared trip: %s", exc)
        return {"success": False, "error": str(exc)}


async def get_shared_edit_trip_by_token(edit_share_token: str) -> Dict[str, Any]:
    try:
        clean_token = (edit_share_token or "").strip()
        if not clean_token or not clean_token.startswith("sh_edit_") or len(clean_token) < 12:
            return {"success": False, "error": "Invalid edit share token"}

        if use_demo_fallback:
            trip_doc = next(
                (
                    t for t in fallback_store["trips"]
                    if t.get("editShareToken") == clean_token or (t.get("data") or {}).get("editShareToken") == clean_token
                ),
                None,
            )
            if not trip_doc:
                return {"success": False, "error": "Shared edit trip not found"}

            serialized = _serialize_trip(_clone_json(trip_doc))
            user_doc = _get_fallback_user_by_id(trip_doc.get("userId"))
            owner_info = {
                "name": user_doc.get("name") if user_doc else None,
                "username": user_doc.get("username") if user_doc else None,
                "profileImage": user_doc.get("profileImage") if user_doc else None,
            } if user_doc else None
            return {
                "success": True,
                "trip": serialized,
                "owner": owner_info,
                "permission": "edit",
            }

        # MongoDB lookup
        trip_doc = await trips_collection.find_one({
            "$or": [
                {"editShareToken": clean_token},
                {"data.editShareToken": clean_token},
            ]
        })
        if not trip_doc:
            return {"success": False, "error": "Shared edit trip not found"}

        serialized = _serialize_trip(trip_doc)
        owner_info = None
        user_id = trip_doc.get("userId")
        if user_id:
            try:
                user_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
                user_doc = await users_collection.find_one({"_id": user_obj_id})
                if user_doc:
                    owner_info = {
                        "name": user_doc.get("name"),
                        "username": user_doc.get("username"),
                        "profileImage": user_doc.get("profileImage"),
                    }
            except Exception:
                pass

        return {
            "success": True,
            "trip": serialized,
            "owner": owner_info,
            "permission": "edit",
        }
    except Exception as exc:
        logger.error("Failed to retrieve shared edit trip: %s", exc)
        return {"success": False, "error": str(exc)}


async def create_or_get_shared_edit_copy(user_id: str, edit_share_token: str) -> Dict[str, Any]:
    try:
        clean_token = (edit_share_token or "").strip()
        if not clean_token or not clean_token.startswith("sh_edit_") or len(clean_token) < 12:
            return {"success": False, "error": "Invalid edit share token", "status_code": 404}

        if use_demo_fallback:
            # Locate source trip by editShareToken
            source_doc = next(
                (
                    t for t in fallback_store["trips"]
                    if t.get("editShareToken") == clean_token or (t.get("data") or {}).get("editShareToken") == clean_token
                ),
                None,
            )
            if not source_doc:
                return {"success": False, "error": "Shared edit trip not found", "status_code": 404}

            # Check if this user already has an existing copy from this edit token
            existing_copy = next(
                (
                    t for t in fallback_store["trips"]
                    if str(t.get("userId")) == str(user_id)
                    and (
                        t.get("copiedFromEditToken") == clean_token
                        or (t.get("data") or {}).get("copiedFromEditToken") == clean_token
                    )
                ),
                None,
            )
            if existing_copy is not None:
                return {
                    "success": True,
                    "trip": _serialize_trip(_clone_json(existing_copy)),
                    "isExistingCopy": True,
                }

            # Generate unique trip ID for User B
            existing_user_trip_ids = {
                str(t.get("tripId")) for t in fallback_store["trips"]
                if str(t.get("userId")) == str(user_id)
            }
            new_trip_id = int(datetime.now(timezone.utc).timestamp() * 1000)
            while str(new_trip_id) in existing_user_trip_ids:
                new_trip_id += 1

            now = _utc_now().isoformat()
            source_data = dict(source_doc.get("data") or {})

            # Deep clone payload data and remove original share credentials
            copy_data = _clone_json(source_data)
            copy_data.pop("shareToken", None)
            copy_data.pop("editShareToken", None)
            copy_data["id"] = new_trip_id
            copy_data["copiedFromEditToken"] = clean_token
            copy_data["sourceTripId"] = source_doc.get("tripId")

            destination = source_doc.get("destination") or copy_data.get("name") or copy_data.get("destination") or "My Trip"
            start_date = source_doc.get("startDate") or copy_data.get("startDate") or ""
            end_date = source_doc.get("endDate") or copy_data.get("endDate") or ""
            itinerary = _clone_json(source_doc.get("itinerary") or copy_data.get("days") or copy_data.get("itinerary") or [])
            preferences = _clone_json(source_doc.get("preferences") or copy_data.get("enginePreferences") or copy_data.get("preferences") or {})

            copy_privacy = _normalize_privacy(copy_data.get("privacy") or source_doc.get("privacy") or "private")
            copy_data["privacy"] = copy_privacy
            new_doc = {
                "tripId": new_trip_id,
                "userId": str(user_id),
                "destination": destination,
                "startDate": start_date,
                "endDate": end_date,
                "privacy": copy_privacy,
                "itinerary": itinerary,
                "preferences": preferences,
                "data": copy_data,
                "copiedFromEditToken": clean_token,
                "sourceTripId": source_doc.get("tripId"),
                "createdAt": now,
                "updatedAt": now,
            }
            fallback_store["trips"].append(new_doc)
            _save_fallback_store()
            serialized_trip = _serialize_trip(_clone_json(new_doc))
            return {
                "success": True,
                "trip": serialized_trip,
                "isExistingCopy": False,
            }

        # MongoDB lookup
        source_doc = await trips_collection.find_one({
            "$or": [
                {"editShareToken": clean_token},
                {"data.editShareToken": clean_token},
            ]
        })
        if not source_doc:
            return {"success": False, "error": "Shared edit trip not found", "status_code": 404}

        user_id_queries: List[Any] = [user_id, str(user_id)]
        try:
            if ObjectId.is_valid(str(user_id)):
                user_id_queries.append(ObjectId(str(user_id)))
        except Exception:
            pass

        existing_copy = await trips_collection.find_one({
            "userId": {"$in": user_id_queries},
            "$or": [
                {"copiedFromEditToken": clean_token},
                {"data.copiedFromEditToken": clean_token},
            ],
        })
        if existing_copy is not None:
            return {
                "success": True,
                "trip": _serialize_trip(existing_copy),
                "isExistingCopy": True,
            }

        # Generate unique trip ID for User B
        new_trip_id = int(datetime.now(timezone.utc).timestamp() * 1000)
        existing_doc = await trips_collection.find_one({
            "userId": {"$in": user_id_queries},
            "tripId": {"$in": [new_trip_id, str(new_trip_id)]},
        })
        while existing_doc is not None:
            new_trip_id += 1
            existing_doc = await trips_collection.find_one({
                "userId": {"$in": user_id_queries},
                "tripId": {"$in": [new_trip_id, str(new_trip_id)]},
            })

        now = _utc_now()
        source_data = dict(source_doc.get("data") or {})
        copy_data = _clone_json(source_data)
        copy_data.pop("shareToken", None)
        copy_data.pop("editShareToken", None)
        copy_data["id"] = new_trip_id
        copy_data["copiedFromEditToken"] = clean_token
        copy_data["sourceTripId"] = source_doc.get("tripId")

        destination = source_doc.get("destination") or copy_data.get("name") or copy_data.get("destination") or "My Trip"
        start_date = source_doc.get("startDate") or copy_data.get("startDate") or ""
        end_date = source_doc.get("endDate") or copy_data.get("endDate") or ""
        itinerary = _clone_json(source_doc.get("itinerary") or copy_data.get("days") or copy_data.get("itinerary") or [])
        preferences = _clone_json(source_doc.get("preferences") or copy_data.get("enginePreferences") or copy_data.get("preferences") or {})

        copy_privacy = _normalize_privacy(copy_data.get("privacy") or source_doc.get("privacy") or "private")
        copy_data["privacy"] = copy_privacy
        new_doc = {
            "tripId": new_trip_id,
            "userId": user_id,
            "destination": destination,
            "startDate": start_date,
            "endDate": end_date,
            "privacy": copy_privacy,
            "itinerary": itinerary,
            "preferences": preferences,
            "data": copy_data,
            "copiedFromEditToken": clean_token,
            "sourceTripId": source_doc.get("tripId"),
            "createdAt": now,
            "updatedAt": now,
        }
        await trips_collection.insert_one(new_doc)
        serialized_trip = _serialize_trip(new_doc)
        return {
            "success": True,
            "trip": serialized_trip,
            "isExistingCopy": False,
        }
    except Exception as exc:
        logger.error("Failed to create or get shared edit copy: %s", exc)
        return {"success": False, "error": str(exc), "status_code": 500}


