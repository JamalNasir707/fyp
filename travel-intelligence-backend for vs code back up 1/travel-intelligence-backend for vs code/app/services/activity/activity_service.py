"""Reusable activity history service for user and admin-facing timelines."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

USER_VISIBLE_EVENT_TYPES = {
    "trip_created",
    "trip_renamed",
    "trip_deleted",
    "trip_opened",
    "trip_shared",
    "journal_published",
    "guide_published",
    "announcement_received",
    "collaboration_invitation",
    "comment_received",
    "like_received",
}


def _auth_db_module():
    from app import auth_db

    return auth_db


def _coerce_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def _sanitize_activity_metadata(metadata: Any) -> Dict[str, Any]:
    auth_db = _auth_db_module()
    if not isinstance(metadata, dict):
        return {}
    return auth_db._clone_json(metadata)


def _is_user_visible_event_type(event_type: Any) -> bool:
    return str(event_type or "").strip() in USER_VISIBLE_EVENT_TYPES


def _serialize_activity(doc: Dict[str, Any]) -> Dict[str, Any]:
    auth_db = _auth_db_module()
    return {
        "id": _coerce_string(doc.get("_id") or doc.get("id")),
        "actorUserId": _coerce_string(doc.get("actorUserId")),
        "eventType": doc.get("eventType") or "",
        "subjectType": doc.get("subjectType") or "",
        "subjectId": _coerce_string(doc.get("subjectId")),
        "tripId": _coerce_string(doc.get("tripId")),
        "title": doc.get("title") or "",
        "description": doc.get("description") or "",
        "actionUrl": doc.get("actionUrl"),
        "metadata": _sanitize_activity_metadata(doc.get("metadata")),
        "createdAt": auth_db._to_iso(doc.get("createdAt")),
    }


async def record_activity(
    *,
    actor_user_id: str,
    event_type: str,
    subject_type: str,
    subject_id: Any,
    trip_id: Any = None,
    title: str,
    description: str,
    action_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    auth_db = _auth_db_module()
    now = auth_db._utc_now()
    document = {
        "actorUserId": str(actor_user_id),
        "eventType": event_type,
        "subjectType": subject_type,
        "subjectId": _coerce_string(subject_id),
        "tripId": _coerce_string(trip_id),
        "title": title,
        "description": description,
        "actionUrl": action_url,
        "metadata": _sanitize_activity_metadata(metadata),
        "createdAt": now,
    }

    if auth_db.use_demo_fallback:
        auth_db.fallback_store.setdefault("activity_history", [])
        fallback_doc = auth_db._clone_json(document)
        fallback_doc["id"] = f"activity-{int(now.timestamp() * 1000)}"
        fallback_doc["createdAt"] = auth_db._to_iso(now)
        auth_db.fallback_store["activity_history"].append(fallback_doc)
        auth_db._save_fallback_store()
        return _serialize_activity(fallback_doc)

    result = await auth_db.activity_history_collection.insert_one(document)
    document["_id"] = result.inserted_id
    return _serialize_activity(document)


async def record_activity_batch(activities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for activity in activities:
        results.append(await record_activity(**activity))
    return results


async def get_user_activity(actor_user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    auth_db = _auth_db_module()
    capped_limit = max(1, min(limit, 200))

    if auth_db.use_demo_fallback:
        records = [
            auth_db._clone_json(entry)
            for entry in auth_db.fallback_store.get("activity_history", [])
            if str(entry.get("actorUserId")) == str(actor_user_id)
        ]
        ordered = sorted(
            records,
            key=lambda entry: auth_db._to_datetime(entry.get("createdAt")) or auth_db.datetime.min.replace(tzinfo=auth_db.timezone.utc),
            reverse=True,
        )
        visible = [entry for entry in ordered if _is_user_visible_event_type(entry.get("eventType"))]
        return [_serialize_activity(entry) for entry in visible[:capped_limit]]

    records = (
        await auth_db.activity_history_collection
        .find({"actorUserId": str(actor_user_id), "eventType": {"$in": sorted(USER_VISIBLE_EVENT_TYPES)}})
        .sort("createdAt", -1)
        .limit(capped_limit)
        .to_list(length=capped_limit)
    )
    return [_serialize_activity(entry) for entry in records]


async def get_recent_activity(limit: int = 50, actor_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    auth_db = _auth_db_module()
    capped_limit = max(1, min(limit, 200))

    if auth_db.use_demo_fallback:
        records = [auth_db._clone_json(entry) for entry in auth_db.fallback_store.get("activity_history", [])]
        if actor_user_id is not None:
            records = [entry for entry in records if str(entry.get("actorUserId")) == str(actor_user_id)]
        ordered = sorted(
            records,
            key=lambda entry: auth_db._to_datetime(entry.get("createdAt")) or auth_db.datetime.min.replace(tzinfo=auth_db.timezone.utc),
            reverse=True,
        )
        return [_serialize_activity(entry) for entry in ordered[:capped_limit]]

    query = {"actorUserId": str(actor_user_id)} if actor_user_id is not None else {}
    records = await auth_db.activity_history_collection.find(query).sort("createdAt", -1).limit(capped_limit).to_list(length=capped_limit)
    return [_serialize_activity(entry) for entry in records]


def _trip_title_snapshot(trip: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(trip, dict):
        return {"visibleTitle": ""}
    return {"visibleTitle": _trip_title(trip)}


def _sanitize_trip_data(trip: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    auth_db = _auth_db_module()
    if not isinstance(trip, dict):
        return {}
    data = auth_db._clone_json(trip.get("data") if isinstance(trip.get("data"), dict) else {})
    for key in ("lastOpened", "updatedAt", "createdAt", "name", "title", "destination"):
        data.pop(key, None)
    return data


def _trip_content_snapshot(trip: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    auth_db = _auth_db_module()
    if not isinstance(trip, dict):
        return {"startDate": "", "endDate": "", "itinerary": [], "preferences": {}, "data": {}}
    data = trip.get("data") if isinstance(trip.get("data"), dict) else {}
    itinerary = trip.get("itinerary")
    if not isinstance(itinerary, list):
        itinerary = data.get("days") if isinstance(data.get("days"), list) else data.get("itinerary") if isinstance(data.get("itinerary"), list) else []
    preferences = trip.get("preferences")
    if not isinstance(preferences, dict):
        preferences = (
            data.get("enginePreferences") if isinstance(data.get("enginePreferences"), dict)
            else data.get("preferences") if isinstance(data.get("preferences"), dict)
            else {}
        )
    return {
        "startDate": trip.get("startDate") or data.get("startDate") or "",
        "endDate": trip.get("endDate") or data.get("endDate") or "",
        "itinerary": auth_db._clone_json(itinerary),
        "preferences": auth_db._clone_json(preferences),
        "data": _sanitize_trip_data(trip),
    }


def _trip_title(trip: Optional[Dict[str, Any]]) -> str:
    if not isinstance(trip, dict):
        return "My Trip"
    data = trip.get("data") if isinstance(trip.get("data"), dict) else {}
    return str(
        trip.get("title")
        or data.get("title")
        or data.get("name")
        or trip.get("name")
        or trip.get("destination")
        or "My Trip"
    ).strip() or "My Trip"


def _trip_last_opened(trip: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(trip, dict):
        return None
    data = trip.get("data") if isinstance(trip.get("data"), dict) else {}
    value = trip.get("lastOpened") or data.get("lastOpened")
    return _coerce_string(value)


def _trip_id(trip: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(trip, dict):
        return None
    value = trip.get("tripId")
    if value is None:
        value = trip.get("id")
    return _coerce_string(value)


def build_trip_activity_events(
    *,
    actor_user_id: str,
    previous_trip: Optional[Dict[str, Any]],
    current_trip: Dict[str, Any],
) -> List[Dict[str, Any]]:
    trip_id = _trip_id(current_trip)
    trip_title = _trip_title(current_trip)

    if previous_trip is None:
        return [{
            "actor_user_id": actor_user_id,
            "event_type": "trip_created",
            "subject_type": "trip",
            "subject_id": trip_id,
            "trip_id": trip_id,
            "title": "Trip created",
            "description": f'Created "{trip_title}".',
            "action_url": "/workspace",
            "metadata": {"tripTitle": trip_title},
        }]

    previous_title_state = _trip_title_snapshot(previous_trip)
    current_title_state = _trip_title_snapshot(current_trip)
    previous_last_opened = _trip_last_opened(previous_trip)
    current_last_opened = _trip_last_opened(current_trip)

    renamed = previous_title_state != current_title_state
    opened = (
        current_last_opened is not None
        and current_last_opened != previous_last_opened
        and not renamed
    )

    events: List[Dict[str, Any]] = []

    if renamed:
        previous_title = _trip_title(previous_trip)
        events.append({
            "actor_user_id": actor_user_id,
            "event_type": "trip_renamed",
            "subject_type": "trip",
            "subject_id": trip_id,
            "trip_id": trip_id,
            "title": "Trip renamed",
            "description": f'Renamed "{previous_title}" to "{trip_title}".',
            "action_url": "/workspace",
            "metadata": {"previousTitle": previous_title, "tripTitle": trip_title},
        })

    if opened:
        events.append({
            "actor_user_id": actor_user_id,
            "event_type": "trip_opened",
            "subject_type": "trip",
            "subject_id": trip_id,
            "trip_id": trip_id,
            "title": "Trip opened",
            "description": f'Opened "{trip_title}".',
            "action_url": "/workspace",
            "metadata": {"tripTitle": trip_title},
        })

    return events


def build_trip_deleted_activity(*, actor_user_id: str, previous_trip: Dict[str, Any]) -> Dict[str, Any]:
    trip_id = _trip_id(previous_trip)
    trip_title = _trip_title(previous_trip)
    return {
        "actor_user_id": actor_user_id,
        "event_type": "trip_deleted",
        "subject_type": "trip",
        "subject_id": trip_id,
        "trip_id": trip_id,
        "title": "Trip deleted",
        "description": f'Deleted "{trip_title}".',
        "action_url": None,
        "metadata": {"tripTitle": trip_title},
    }
