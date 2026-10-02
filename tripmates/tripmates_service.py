"""
Tripmates Membership Backend Service.
Manages isolated trip membership and invitation state in the dedicated trip_members collection.
Does NOT modify or couple to the core trips collection.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId

logger = logging.getLogger("uvicorn.error")


def _auth_db():
    from app import auth_db
    return auth_db


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


def _trip_id_variants(raw_trip_id: Any) -> List[Any]:
    variants = [raw_trip_id, str(raw_trip_id)]
    try:
        variants.append(int(raw_trip_id))
    except (ValueError, TypeError):
        pass
    return list(dict.fromkeys(variants))


def _user_id_variants(raw_user_id: Any) -> List[Any]:
    clean = str(raw_user_id)
    variants = [clean]
    if ObjectId.is_valid(clean):
        try:
            variants.append(ObjectId(clean))
        except Exception:
            pass
    return variants


def _serialize_member(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc.get("_id") or doc.get("id")),
        "tripId": doc.get("tripId"),
        "ownerId": str(doc.get("ownerId")),
        "userId": str(doc.get("userId")),
        "userName": doc.get("userName") or "Traveler",
        "userEmail": doc.get("userEmail") or "",
        "userProfileImage": doc.get("userProfileImage"),
        "role": doc.get("role") or "member",
        "status": doc.get("status") or "pending",
        "invitedBy": str(doc.get("invitedBy") or doc.get("ownerId")),
        "invitedAt": _to_iso(doc.get("invitedAt")),
        "acceptedAt": _to_iso(doc.get("acceptedAt")),
        "createdAt": _to_iso(doc.get("createdAt")),
        "updatedAt": _to_iso(doc.get("updatedAt")),
        "tripTitle": doc.get("tripTitle") or "My Trip",
        "tripDestination": doc.get("tripDestination") or "My Trip",
    }


async def ensure_trip_members_indexes() -> None:
    """Ensures indexes on the trip_members collection in MongoDB."""
    db_mod = _auth_db()
    if db_mod.use_demo_fallback or db_mod.mongo_db is None:
        db_mod.fallback_store.setdefault("trip_members", [])
        return

    try:
        col = db_mod.mongo_db["trip_members"]
        await col.create_index([("tripId", 1), ("userId", 1)], unique=True)
        await col.create_index([("userId", 1), ("status", 1)])
        await col.create_index("tripId")
    except Exception as exc:
        logger.warning("Failed to create trip_members indexes: %s", exc)


async def _get_trip_doc(trip_id: Any) -> Optional[Dict[str, Any]]:
    """Look up trip document to verify existence and ownership without mutating it."""
    db_mod = _auth_db()
    variants = _trip_id_variants(trip_id)

    if db_mod.use_demo_fallback:
        for t in db_mod.fallback_store.get("trips", []):
            if t.get("tripId") in variants or str(t.get("tripId")) in [str(v) for v in variants]:
                return t
        return None

    if db_mod.trips_collection is None:
        return None

    return await db_mod.trips_collection.find_one({"tripId": {"$in": variants}})


async def _get_user_by_identifier(identifier: str) -> Optional[Dict[str, Any]]:
    """Look up a registered user by email or username."""
    clean = str(identifier or "").strip().lower()
    if not clean:
        return None

    db_mod = _auth_db()
    if db_mod.use_demo_fallback:
        return next(
            (
                u for u in db_mod.fallback_store.get("users", [])
                if str(u.get("username", "")).strip().lower() == clean
                or str(u.get("email", "")).strip().lower() == clean
            ),
            None,
        )

    if db_mod.users_collection is None:
        return None

    # Case-insensitive username or exact lowercase email match
    pattern = re.compile(f"^{re.escape(clean)}$", re.IGNORECASE)
    return await db_mod.users_collection.find_one({
        "$or": [
            {"username": pattern},
            {"email": clean},
        ]
    })


async def invite_member(owner_id: str, trip_id: Any, identifier: str) -> Dict[str, Any]:
    """
    1. Owner invites another registered user to collaborate on the trip.
    Validates ownership, self-invitation, existing memberships, and pending invites.
    """
    clean_identifier = str(identifier or "").strip()
    if not clean_identifier:
        return {"success": False, "status_code": 400, "error": "Username or email is required"}

    # Verify trip existence and ownership
    trip_doc = await _get_trip_doc(trip_id)
    if not trip_doc:
        return {"success": False, "status_code": 404, "error": "Trip not found"}

    if str(trip_doc.get("userId")) != str(owner_id):
        return {"success": False, "status_code": 403, "error": "Only the trip owner can invite members"}

    # Verify target user exists
    target_user = await _get_user_by_identifier(clean_identifier)
    if not target_user:
        return {"success": False, "status_code": 404, "error": "User with this username or email not found"}

    target_user_id = str(target_user.get("_id") or target_user.get("id"))
    if str(target_user_id) == str(owner_id):
        return {"success": False, "status_code": 400, "error": "You cannot invite yourself to your own trip"}

    db_mod = _auth_db()
    canonical_trip_id = trip_doc.get("tripId")
    trip_variants = _trip_id_variants(canonical_trip_id)
    target_user_variants = _user_id_variants(target_user_id)
    now = _utc_now()

    trip_data = trip_doc.get("data") if isinstance(trip_doc.get("data"), dict) else {}
    trip_title = (
        trip_doc.get("title")
        or trip_data.get("title")
        or trip_doc.get("destination")
        or trip_data.get("name")
        or "My Trip"
    )
    destination = trip_doc.get("destination") or trip_data.get("destination") or "My Trip"
    target_name = target_user.get("name") or target_user.get("username") or "Traveler"

    # Check for existing membership / invite
    if db_mod.use_demo_fallback:
        db_mod.fallback_store.setdefault("trip_members", [])
        existing = next(
            (
                m for m in db_mod.fallback_store["trip_members"]
                if (m.get("tripId") in trip_variants or str(m.get("tripId")) == str(canonical_trip_id))
                and str(m.get("userId")) == str(target_user_id)
            ),
            None,
        )
        if existing:
            if existing.get("status") == "accepted":
                return {"success": False, "status_code": 400, "error": "User is already an accepted member of this trip"}
            if existing.get("status") == "pending":
                return {"success": False, "status_code": 400, "error": "An invitation is already pending for this user"}
            # If declined, renew the invite
            existing["status"] = "pending"
            existing["invitedAt"] = _to_iso(now)
            existing["updatedAt"] = _to_iso(now)
            db_mod._save_fallback_store()
            saved_doc = existing
        else:
            new_doc = {
                "id": f"member-{int(now.timestamp() * 1000)}",
                "tripId": canonical_trip_id,
                "ownerId": str(owner_id),
                "userId": target_user_id,
                "userName": target_name,
                "userEmail": target_user.get("email", ""),
                "userProfileImage": target_user.get("profileImage"),
                "role": "member",
                "status": "pending",
                "invitedBy": str(owner_id),
                "invitedAt": _to_iso(now),
                "acceptedAt": None,
                "createdAt": _to_iso(now),
                "updatedAt": _to_iso(now),
                "tripTitle": trip_title,
                "tripDestination": destination,
            }
            db_mod.fallback_store["trip_members"].append(new_doc)
            db_mod._save_fallback_store()
            saved_doc = new_doc
    else:
        col = db_mod.mongo_db["trip_members"]
        existing = await col.find_one({
            "tripId": {"$in": trip_variants},
            "userId": {"$in": target_user_variants},
        })
        if existing:
            if existing.get("status") == "accepted":
                return {"success": False, "status_code": 400, "error": "User is already an accepted member of this trip"}
            if existing.get("status") == "pending":
                return {"success": False, "status_code": 400, "error": "An invitation is already pending for this user"}
            # Re-invite if previously declined
            await col.update_one(
                {"_id": existing["_id"]},
                {"$set": {"status": "pending", "invitedAt": now, "updatedAt": now}},
            )
            saved_doc = await col.find_one({"_id": existing["_id"]})
        else:
            new_doc = {
                "tripId": canonical_trip_id,
                "ownerId": str(owner_id),
                "userId": target_user_id,
                "userName": target_name,
                "userEmail": target_user.get("email", ""),
                "userProfileImage": target_user.get("profileImage"),
                "role": "member",
                "status": "pending",
                "invitedBy": str(owner_id),
                "invitedAt": now,
                "acceptedAt": None,
                "createdAt": now,
                "updatedAt": now,
                "tripTitle": trip_title,
                "tripDestination": destination,
            }
            res = await col.insert_one(new_doc)
            new_doc["_id"] = res.inserted_id
            saved_doc = new_doc

    # Log collaboration invitation activity
    try:
        from app.services.activity.activity_service import record_activity
        await record_activity(
            actor_user_id=str(owner_id),
            event_type="collaboration_invitation",
            subject_type="trip_member",
            subject_id=str(saved_doc.get("_id") or saved_doc.get("id")),
            trip_id=str(canonical_trip_id),
            title="Tripmate invitation sent",
            description=f'Invited {target_name} to trip "{trip_title}".',
            metadata={"inviteeUserId": target_user_id, "tripId": str(canonical_trip_id)},
        )
    except Exception as exc:
        logger.warning("Activity logging for tripmate invite skipped: %s", exc)

    # Trigger tripmate_invite notification
    try:
        owner_user_doc = await _get_user_by_identifier(owner_id)
        owner_name = owner_user_doc.get("name") or owner_user_doc.get("username") if owner_user_doc else "A traveler"
        await db_mod.create_notification(
            recipient_id=target_user_id,
            actor_id=str(owner_id),
            notification_type="tripmate_invite",
            message=f'{owner_name} invited you to join trip "{trip_title}".',
            actor_user_doc=owner_user_doc,
            metadata={
                "inviteId": str(saved_doc.get("_id") or saved_doc.get("id")),
                "tripId": str(canonical_trip_id),
                "tripTitle": trip_title,
            },
        )
    except Exception as exc:
        logger.warning("Notification creation for tripmate invite skipped: %s", exc)

    return {"success": True, "invitation": _serialize_member(saved_doc)}


async def get_trip_members(requester_user_id: str, trip_id: Any) -> Dict[str, Any]:
    """
    2. Owner or accepted member retrieves membership/invitation records for a trip.
    """
    trip_doc = await _get_trip_doc(trip_id)
    if not trip_doc:
        return {"success": False, "status_code": 404, "error": "Trip not found"}

    canonical_trip_id = trip_doc.get("tripId")
    trip_variants = _trip_id_variants(canonical_trip_id)
    owner_id = str(trip_doc.get("userId"))
    is_owner = owner_id == str(requester_user_id)

    db_mod = _auth_db()

    # Query members
    if db_mod.use_demo_fallback:
        db_mod.fallback_store.setdefault("trip_members", [])
        all_records = [
            m for m in db_mod.fallback_store["trip_members"]
            if m.get("tripId") in trip_variants or str(m.get("tripId")) == str(canonical_trip_id)
        ]
        owner_user = db_mod._get_fallback_user_by_id(owner_id)
    else:
        col = db_mod.mongo_db["trip_members"]
        all_records = await col.find({"tripId": {"$in": trip_variants}}).to_list(length=None)
        owner_obj_id = ObjectId(owner_id) if ObjectId.is_valid(owner_id) else owner_id
        owner_user = await db_mod.users_collection.find_one({"_id": owner_obj_id})

    # Authorization: Requester must be the owner OR an accepted member
    is_accepted_member = any(
        str(m.get("userId")) == str(requester_user_id) and m.get("status") == "accepted"
        for m in all_records
    )
    if not is_owner and not is_accepted_member:
        return {"success": False, "status_code": 403, "error": "You do not have permission to view members of this trip"}

    owner_info = {
        "id": owner_id,
        "name": owner_user.get("name") if owner_user else "Trip Owner",
        "username": owner_user.get("username") if owner_user else "owner",
        "email": owner_user.get("email") if owner_user else "",
        "profileImage": owner_user.get("profileImage") if owner_user else None,
        "role": "owner",
    }

    accepted_members = [_serialize_member(m) for m in all_records if m.get("status") == "accepted"]
    # Pending invites only visible to the owner
    pending_invites = [_serialize_member(m) for m in all_records if m.get("status") == "pending"] if is_owner else []

    return {
        "success": True,
        "tripId": canonical_trip_id,
        "owner": owner_info,
        "members": accepted_members,
        "pendingInvites": pending_invites,
    }


async def get_user_invitations(user_id: str) -> Dict[str, Any]:
    """
    3. Retrieve all pending Tripmates invitations for the currently authenticated user.
    """
    db_mod = _auth_db()
    user_variants = _user_id_variants(user_id)

    if db_mod.use_demo_fallback:
        db_mod.fallback_store.setdefault("trip_members", [])
        invitations = [
            m for m in db_mod.fallback_store["trip_members"]
            if str(m.get("userId")) == str(user_id) and m.get("status") == "pending"
        ]
    else:
        col = db_mod.mongo_db["trip_members"]
        invitations = await col.find({
            "userId": {"$in": user_variants},
            "status": "pending",
        }).sort("invitedAt", -1).to_list(length=None)

    return {
        "success": True,
        "invitations": [_serialize_member(inv) for inv in invitations],
    }


async def respond_to_invitation(user_id: str, invite_id: str, action: str) -> Dict[str, Any]:
    """
    4. Invited user accepts or declines an invitation.
    """
    clean_action = str(action or "").strip().lower()
    if clean_action not in ("accept", "decline"):
        return {"success": False, "status_code": 400, "error": "Action must be 'accept' or 'decline'"}

    db_mod = _auth_db()
    now = _utc_now()
    clean_id = str(invite_id or "").strip()

    if db_mod.use_demo_fallback:
        db_mod.fallback_store.setdefault("trip_members", [])
        invite = next(
            (m for m in db_mod.fallback_store["trip_members"] if str(m.get("id")) == clean_id),
            None,
        )
        if not invite:
            return {"success": False, "status_code": 404, "error": "Invitation not found"}

        if str(invite.get("userId")) != str(user_id):
            return {"success": False, "status_code": 403, "error": "You are not authorized to respond to this invitation"}

        if invite.get("status") != "pending":
            return {"success": False, "status_code": 400, "error": f"Invitation is already {invite.get('status')}"}

        new_status = "accepted" if clean_action == "accept" else "declined"
        invite["status"] = new_status
        invite["updatedAt"] = _to_iso(now)
        if clean_action == "accept":
            invite["acceptedAt"] = _to_iso(now)
        db_mod._save_fallback_store()
        saved = invite
    else:
        col = db_mod.mongo_db["trip_members"]
        query_conditions: List[Dict[str, Any]] = [{"id": clean_id}]
        if ObjectId.is_valid(clean_id):
            query_conditions.append({"_id": ObjectId(clean_id)})

        invite = await col.find_one({"$or": query_conditions})
        if not invite:
            return {"success": False, "status_code": 404, "error": "Invitation not found"}

        if str(invite.get("userId")) != str(user_id):
            return {"success": False, "status_code": 403, "error": "You are not authorized to respond to this invitation"}

        if invite.get("status") != "pending":
            return {"success": False, "status_code": 400, "error": f"Invitation is already {invite.get('status')}"}

        new_status = "accepted" if clean_action == "accept" else "declined"
        update_fields: Dict[str, Any] = {
            "status": new_status,
            "updatedAt": now,
        }
        if clean_action == "accept":
            update_fields["acceptedAt"] = now

        await col.update_one({"_id": invite["_id"]}, {"$set": update_fields})
        saved = await col.find_one({"_id": invite["_id"]})

    return {
        "success": True,
        "message": f"Invitation {new_status} successfully",
        "invitation": _serialize_member(saved),
    }


async def remove_trip_member(owner_id: str, trip_id: Any, member_user_id: str) -> Dict[str, Any]:
    """
    5. Owner revokes a pending invitation or removes an accepted member.
    """
    trip_doc = await _get_trip_doc(trip_id)
    if not trip_doc:
        return {"success": False, "status_code": 404, "error": "Trip not found"}

    if str(trip_doc.get("userId")) != str(owner_id):
        return {"success": False, "status_code": 403, "error": "Only the trip owner can remove members"}

    clean_target = str(member_user_id or "").strip()
    if clean_target == str(owner_id):
        return {"success": False, "status_code": 400, "error": "Cannot remove the trip owner"}

    canonical_trip_id = trip_doc.get("tripId")
    trip_variants = _trip_id_variants(canonical_trip_id)
    user_variants = _user_id_variants(clean_target)

    db_mod = _auth_db()
    if db_mod.use_demo_fallback:
        db_mod.fallback_store.setdefault("trip_members", [])
        initial_len = len(db_mod.fallback_store["trip_members"])
        db_mod.fallback_store["trip_members"] = [
            m for m in db_mod.fallback_store["trip_members"]
            if not (
                (m.get("tripId") in trip_variants or str(m.get("tripId")) == str(canonical_trip_id))
                and (str(m.get("userId")) == clean_target or str(m.get("id")) == clean_target)
            )
        ]
        deleted = len(db_mod.fallback_store["trip_members"]) < initial_len
        if not deleted:
            return {"success": False, "status_code": 404, "error": "Member or invitation not found"}
        db_mod._save_fallback_store()
    else:
        col = db_mod.mongo_db["trip_members"]
        query_conditions: List[Dict[str, Any]] = [
            {"userId": {"$in": user_variants}},
            {"id": clean_target},
        ]
        if ObjectId.is_valid(clean_target):
            query_conditions.append({"_id": ObjectId(clean_target)})

        res = await col.delete_one({
            "tripId": {"$in": trip_variants},
            "$or": query_conditions,
        })
        if res.deleted_count == 0:
            return {"success": False, "status_code": 404, "error": "Member or invitation not found"}

    return {"success": True, "message": "Member removed successfully"}


async def get_shared_tripmate_trip(requester_user_id: str, trip_id: Any) -> Dict[str, Any]:
    """
    Retrieves a shared trip document for an accepted Tripmate member.
    Strictly read-only; does not mutate database documents or alter ownership.
    """
    trip_variants = _trip_id_variants(trip_id)
    user_variants = _user_id_variants(requester_user_id)
    db_mod = _auth_db()

    # 1. Check membership in trip_members collection
    member_record: Optional[Dict[str, Any]] = None
    if db_mod.use_demo_fallback:
        for m in db_mod.fallback_store.get("trip_members", []):
            if (
                m.get("tripId") in trip_variants
                or str(m.get("tripId")) in [str(v) for v in trip_variants]
            ) and (
                m.get("userId") in user_variants
                or str(m.get("userId")) in [str(v) for v in user_variants]
            ):
                member_record = m
                break
    else:
        col = db_mod.mongo_db["trip_members"]
        member_record = await col.find_one({
            "tripId": {"$in": trip_variants},
            "userId": {"$in": user_variants},
        })

    if not member_record:
        return {
            "success": False,
            "status_code": 403,
            "error": "Access denied. You are not a Tripmate for this trip.",
        }

    status = member_record.get("status")
    if status != "accepted":
        if status == "pending":
            return {
                "success": False,
                "status_code": 403,
                "error": "Access denied. Tripmate invitation is still pending.",
            }
        return {
            "success": False,
            "status_code": 403,
            "error": f"Access denied. Tripmate invitation status is '{status}'.",
        }

    # 2. Retrieve original trip document
    trip_doc = await _get_trip_doc(trip_id)
    if not trip_doc:
        return {
            "success": False,
            "status_code": 404,
            "error": "Shared trip not found.",
        }

    serialized_trip = db_mod._serialize_trip(trip_doc)

    return {
        "success": True,
        "trip": serialized_trip,
        "access": "tripmate_readonly",
        "role": member_record.get("role", "member"),
    }


async def update_tripmate_itinerary(
    user_id: str,
    trip_id: Any,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Updates the itinerary fields of a canonical trip document for the owner or an accepted Tripmate.
    Strictly target-updates data.days, data.placesPool, data.customLists, itinerary, and updatedAt.
    Protects ownership, metadata, budget, expenses, and share tokens.
    Does NOT call save_trip_document or create_or_get_shared_edit_copy.
    """
    trip_doc = await _get_trip_doc(trip_id)
    if not trip_doc:
        return {
            "success": False,
            "status_code": 404,
            "error": "Trip not found.",
        }

    canonical_trip_id = trip_doc.get("tripId")
    owner_id = str(trip_doc.get("userId"))
    is_owner = owner_id == str(user_id)

    db_mod = _auth_db()

    # If not owner, verify accepted membership in trip_members
    if not is_owner:
        trip_variants = _trip_id_variants(canonical_trip_id)
        user_variants = _user_id_variants(user_id)
        member_record: Optional[Dict[str, Any]] = None

        if db_mod.use_demo_fallback:
            for m in db_mod.fallback_store.get("trip_members", []):
                if (
                    m.get("tripId") in trip_variants
                    or str(m.get("tripId")) in [str(v) for v in trip_variants]
                ) and (
                    m.get("userId") in user_variants
                    or str(m.get("userId")) in [str(v) for v in user_variants]
                ):
                    member_record = m
                    break
        else:
            col = db_mod.mongo_db["trip_members"]
            member_record = await col.find_one({
                "tripId": {"$in": trip_variants},
                "userId": {"$in": user_variants},
            })

        if not member_record or member_record.get("status") != "accepted":
            return {
                "success": False,
                "status_code": 403,
                "error": "Access denied. Only the trip owner or accepted Tripmates can update the itinerary.",
            }

    # Extract existing data block
    existing_data = trip_doc.get("data") if isinstance(trip_doc.get("data"), dict) else {}
    existing_days = (
        existing_data.get("days")
        if isinstance(existing_data.get("days"), list)
        else (trip_doc.get("itinerary") if isinstance(trip_doc.get("itinerary"), list) else [])
    )
    existing_places_pool = (
        existing_data.get("placesPool")
        if isinstance(existing_data.get("placesPool"), list)
        else []
    )
    existing_custom_lists = (
        existing_data.get("customLists")
        if isinstance(existing_data.get("customLists"), (list, dict))
        else []
    )

    # Determine new values with explicit whitelist
    if "days" in payload and isinstance(payload["days"], list):
        new_days = payload["days"]
    elif "itinerary" in payload and isinstance(payload["itinerary"], list):
        new_days = payload["itinerary"]
    else:
        new_days = existing_days

    if "placesPool" in payload and isinstance(payload["placesPool"], list):
        new_places_pool = payload["placesPool"]
    else:
        new_places_pool = existing_places_pool

    if "customLists" in payload and isinstance(payload["customLists"], (list, dict)):
        new_custom_lists = payload["customLists"]
    else:
        new_custom_lists = existing_custom_lists

    # Update canonical trip document
    if db_mod.use_demo_fallback:
        now_str = _to_iso(_utc_now())
        trip_doc["itinerary"] = db_mod._clone_json(new_days)
        if not isinstance(trip_doc.get("data"), dict):
            trip_doc["data"] = {}
        trip_doc["data"]["days"] = db_mod._clone_json(new_days)
        trip_doc["data"]["placesPool"] = db_mod._clone_json(new_places_pool)
        trip_doc["data"]["customLists"] = db_mod._clone_json(new_custom_lists)
        trip_doc["updatedAt"] = now_str
        db_mod._save_fallback_store()
        updated_doc = trip_doc
    else:
        now_dt = _utc_now()
        update_fields = {
            "itinerary": new_days,
            "data.days": new_days,
            "data.placesPool": new_places_pool,
            "data.customLists": new_custom_lists,
            "updatedAt": now_dt,
        }
        await db_mod.trips_collection.update_one(
            {"_id": trip_doc["_id"]},
            {"$set": update_fields},
        )
        updated_doc = await db_mod.trips_collection.find_one({"_id": trip_doc["_id"]})

    serialized = db_mod._serialize_trip(updated_doc)
    return {
        "success": True,
        "message": "Itinerary updated successfully",
        "trip": serialized,
    }


async def get_user_shared_tripmate_trips(user_id: str) -> Dict[str, Any]:
    """
    Retrieves canonical trip documents for all trips where user_id is an accepted Tripmate.
    Does NOT modify trips collection or list_trips_for_user.
    """
    db_mod = _auth_db()
    user_variants = _user_id_variants(user_id)

    # 1. Find accepted membership records in trip_members
    if db_mod.use_demo_fallback:
        accepted_memberships = [
            m for m in db_mod.fallback_store.get("trip_members", [])
            if (
                m.get("userId") in user_variants
                or str(m.get("userId")) in [str(v) for v in user_variants]
            ) and m.get("status") == "accepted"
        ]
    else:
        col = db_mod.mongo_db["trip_members"]
        cursor = col.find({
            "userId": {"$in": user_variants},
            "status": "accepted",
        })
        accepted_memberships = await cursor.to_list(length=None)

    if not accepted_memberships:
        return {"success": True, "trips": []}

    # 2. Extract unique canonical trip IDs
    trip_ids = []
    for m in accepted_memberships:
        t_id = m.get("tripId")
        if t_id:
            trip_ids.append(t_id)
            trip_ids.append(str(t_id))
            try:
                trip_ids.append(int(t_id))
            except (ValueError, TypeError):
                pass
    trip_ids = list(dict.fromkeys(trip_ids))

    # 3. Query canonical trips from trips collection
    if db_mod.use_demo_fallback:
        matched_trips = [
            t for t in db_mod.fallback_store.get("trips", [])
            if (
                t.get("tripId") in trip_ids
                or str(t.get("tripId")) in [str(v) for v in trip_ids]
            )
        ]
    else:
        obj_ids = [ObjectId(t) for t in trip_ids if ObjectId.is_valid(str(t))]
        query = {
            "$or": [
                {"tripId": {"$in": trip_ids}},
                {"_id": {"$in": obj_ids}},
            ]
        }
        matched_trips = await db_mod.trips_collection.find(query).sort("updatedAt", -1).to_list(length=None)

    # 4. Serialize with explicit isTripmate flag
    results = []
    for doc in matched_trips:
        serialized = db_mod._serialize_trip(doc)
        serialized["isTripmate"] = True
        serialized["tripmateRole"] = "member"
        results.append(serialized)

    return {"success": True, "trips": results}


