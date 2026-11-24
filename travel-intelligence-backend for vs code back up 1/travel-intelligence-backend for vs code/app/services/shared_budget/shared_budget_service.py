"""
Shared Budget Foundation Backend Service (SB-B1 & SB-B2).
Manages isolated shared budget expense models, authorization, and CRUD persistence
in the dedicated `shared_budget_expenses` MongoDB collection (or demo fallback store).

PROTECTED SYSTEMS SAFETY:
- Does NOT modify core `trips` collection or `activeTrip.expenses`.
- Does NOT touch existing personal Budget & Expenses.
- Does NOT modify Tripmates membership or auth.
- Destination is stored strictly as a reference label (no itinerary/map mutation).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from bson import ObjectId

logger = logging.getLogger("uvicorn.error")

VALID_STATUSES = {"paid", "pending"}
DEFAULT_CURRENCY = "PKR"
DEFAULT_CATEGORIES = {"Sleep", "Transport", "See & Do", "Eat & Drink", "Other"}


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
    clean = str(raw_trip_id).strip()
    variants = [clean]
    try:
        variants.append(int(clean))
    except (ValueError, TypeError):
        pass
    if ObjectId.is_valid(clean):
        try:
            variants.append(ObjectId(clean))
        except Exception:
            pass
    return list(dict.fromkeys(variants))


def _user_id_variants(raw_user_id: Any) -> List[Any]:
    clean = str(raw_user_id).strip()
    variants = [clean]
    if ObjectId.is_valid(clean):
        try:
            variants.append(ObjectId(clean))
        except Exception:
            pass
    return list(dict.fromkeys(variants))


def get_shared_budget_collection(db_instance: Any = None):
    """
    Returns the dedicated `shared_budget_expenses` collection reference.
    Falls back to `app.auth_db.mongo_db["shared_budget_expenses"]` if db_instance is not provided.
    """
    if db_instance is not None:
        if hasattr(db_instance, "__getitem__"):
            return db_instance["shared_budget_expenses"]
        return getattr(db_instance, "shared_budget_expenses", None)
    
    try:
        from app import auth_db
        if auth_db.mongo_db is not None:
            return auth_db.mongo_db["shared_budget_expenses"]
    except Exception as err:
        logger.warning(f"Unable to access auth_db.mongo_db for shared_budget_expenses: {err}")
    return None


async def ensure_shared_budget_indexes(db_instance: Any = None) -> bool:
    """
    Ensures safe index foundation on the dedicated `shared_budget_expenses` collection:
    - (tripId, date)
    - (tripId, createdAt)
    DOES NOT modify indexes on any existing collection (trips, users, tripmates, etc.).
    """
    coll = get_shared_budget_collection(db_instance)
    if coll is None:
        logger.info("Shared Budget collection not available for index creation (demo fallback active or uninitialized).")
        return False
    
    try:
        await coll.create_index([("tripId", 1), ("date", -1)], background=True)
        await coll.create_index([("tripId", 1), ("createdAt", -1)], background=True)
        logger.info("Shared Budget collection indexes ensured successfully.")
        return True
    except Exception as err:
        logger.error(f"Error ensuring shared_budget_expenses indexes: {err}")
        return False


def validate_expense_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates the structure of a Shared Budget expense document payload.
    Raises ValueError on validation failures.
    Returns cleaned/validated dictionary.
    """
    if not isinstance(data, dict):
        raise ValueError("Expense data must be a dictionary.")

    # 1. tripId check
    raw_trip_id = data.get("tripId")
    if not raw_trip_id or not str(raw_trip_id).strip():
        raise ValueError("Field 'tripId' is required and cannot be empty.")
    trip_id = str(raw_trip_id).strip()

    # 2. Expense name / description check
    name = str(data.get("name") or data.get("description") or "").strip()
    if not name:
        name = "Untitled Expense"

    # 3. Total Amount validation
    raw_amount = data.get("amount")
    try:
        amount = round(float(raw_amount), 2)
        if amount < 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("Field 'amount' must be a valid non-negative number.")

    # 4. Currency
    currency = str(data.get("currency") or DEFAULT_CURRENCY).strip().upper()

    # 5. Category
    category = str(data.get("category") or "Other").strip()

    # 6. Date
    date_str = str(data.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")).strip()

    # 7. Destination Reference (Reference label ONLY - zero location/itinerary side-effects)
    destination_ref = str(data.get("destinationReference") or data.get("destination") or "").strip()

    # 8. Status validation ('paid' | 'pending')
    status = str(data.get("status") or "paid").strip().lower()
    if status not in VALID_STATUSES:
        raise ValueError(f"Field 'status' must be one of {sorted(list(VALID_STATUSES))}, got '{status}'.")

    # 9. Payers validation (Must support 1..N payers)
    raw_payers = data.get("payers")
    if raw_payers is None or not isinstance(raw_payers, list):
        raise ValueError("Field 'payers' must be a list containing at least one payer.")

    payers: List[Dict[str, Any]] = []
    payer_total = 0.0
    for idx, p in enumerate(raw_payers):
        if not isinstance(p, dict):
            raise ValueError(f"Payer at index {idx} must be an object.")
        user_id = str(p.get("userId") or p.get("id") or f"payer_{idx}").strip()
        p_name = str(p.get("name") or f"Member {idx+1}").strip()
        try:
            p_amount = round(float(p.get("amount", 0.0)), 2)
            if p_amount < 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise ValueError(f"Payer '{p_name}' has an invalid non-negative amount.")
        
        payers.append({
            "userId": user_id,
            "name": p_name,
            "amount": p_amount,
        })
        payer_total += p_amount

    # If single payer provided without explicit amount, assign full expense amount to single payer
    if len(payers) == 1 and payers[0]["amount"] == 0.0 and amount > 0:
        payers[0]["amount"] = amount
        payer_total = amount

    # 10. Participants validation (Must support independent share list)
    raw_participants = data.get("participants")
    participants: List[Dict[str, Any]] = []
    if isinstance(raw_participants, list):
        for idx, part in enumerate(raw_participants):
            if not isinstance(part, dict):
                continue
            part_user_id = str(part.get("userId") or part.get("id") or f"part_{idx}").strip()
            part_name = str(part.get("name") or f"Participant {idx+1}").strip()
            try:
                part_share = round(float(part.get("share", 0.0)), 2)
            except (ValueError, TypeError):
                part_share = 0.0
            participants.append({
                "userId": part_user_id,
                "name": part_name,
                "share": max(0.0, part_share),
            })

    created_by = str(data.get("createdBy") or (payers[0]["userId"] if payers else "system")).strip()

    return {
        "tripId": trip_id,
        "name": name,
        "amount": amount,
        "currency": currency,
        "category": category,
        "date": date_str,
        "destinationReference": destination_ref,
        "status": status,
        "payers": payers,
        "participants": participants,
        "createdBy": created_by,
    }


def build_expense_document(
    trip_id: str,
    name: str,
    amount: float,
    currency: str = DEFAULT_CURRENCY,
    category: str = "Other",
    date: Optional[str] = None,
    destination_reference: str = "",
    status: str = "paid",
    payers: Optional[List[Dict[str, Any]]] = None,
    participants: Optional[List[Dict[str, Any]]] = None,
    created_by: str = "",
) -> Dict[str, Any]:
    """
    Constructs a clean, canonical BSON/dict document for storing in `shared_budget_expenses`.
    Supports 1..N payers and independent participant shares.
    """
    payload = {
        "tripId": trip_id,
        "name": name,
        "amount": amount,
        "currency": currency,
        "category": category,
        "date": date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "destinationReference": destination_reference,
        "status": status,
        "payers": payers or [],
        "participants": participants or [],
        "createdBy": created_by,
    }

    validated = validate_expense_data(payload)

    now = _utc_now()
    doc_id = str(uuid.uuid4())

    doc = {
        "_id": str(ObjectId()),
        "id": doc_id,
        "tripId": validated["tripId"],
        "name": validated["name"],
        "amount": validated["amount"],
        "currency": validated["currency"],
        "category": validated["category"],
        "date": validated["date"],
        "destinationReference": validated["destinationReference"],
        "status": validated["status"],
        "payers": validated["payers"],
        "participants": validated["participants"],
        "createdBy": validated["createdBy"],
        "createdAt": _to_iso(now),
        "updatedAt": _to_iso(now),
    }
    return doc


def serialize_expense_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Serializes a raw MongoDB BSON document from `shared_budget_expenses` into a clean JSON dict.
    """
    if not doc or not isinstance(doc, dict):
        return {}

    return {
        "id": str(doc.get("id") or doc.get("_id")),
        "tripId": str(doc.get("tripId")),
        "name": str(doc.get("name") or ""),
        "amount": round(float(doc.get("amount", 0.0)), 2),
        "currency": str(doc.get("currency") or DEFAULT_CURRENCY),
        "category": str(doc.get("category") or "Other"),
        "date": str(doc.get("date") or ""),
        "destinationReference": str(doc.get("destinationReference") or ""),
        "status": str(doc.get("status") or "paid"),
        "payers": [
            {
                "userId": str(p.get("userId") or ""),
                "name": str(p.get("name") or ""),
                "amount": round(float(p.get("amount", 0.0)), 2),
            }
            for p in doc.get("payers", [])
            if isinstance(p, dict)
        ],
        "participants": [
            {
                "userId": str(p.get("userId") or ""),
                "name": str(p.get("name") or ""),
                "share": round(float(p.get("share", 0.0)), 2),
            }
            for p in doc.get("participants", [])
            if isinstance(p, dict)
        ],
        "createdBy": str(doc.get("createdBy") or ""),
        "createdAt": _to_iso(doc.get("createdAt")),
        "updatedAt": _to_iso(doc.get("updatedAt")),
    }


# =========================================================================
# AUTHORIZATION & TRIP MEMBERSHIP CHECK HELPER (SB-B2)
# =========================================================================

async def verify_shared_budget_access(user_id: str, trip_id: str) -> Dict[str, Any]:
    """
    Verifies if a user is authorized to access the Shared Budget for trip_id.
    Authorized if:
    1. User is the trip owner (in trips collection / fallback_store).
    2. OR User is an accepted member (in trip_members collection / fallback_store).
    Pending, declined, removed, or non-members return access denied (403/404).
    """
    from app import auth_db
    clean_user_id = str(user_id).strip()
    clean_trip_id = str(trip_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)
    user_variants = _user_id_variants(clean_user_id)

    # 1. Check if user is trip owner
    is_owner = False
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        trips = auth_db.fallback_store.get("trips", [])
        for t in trips:
            t_id = str(t.get("tripId") or t.get("id") or t.get("_id"))
            t_user = str(t.get("userId") or "")
            if t_id in [str(v) for v in trip_variants] or clean_trip_id == t_id:
                if t_user in [str(v) for v in user_variants] or clean_user_id == t_user:
                    is_owner = True
                    break
    else:
        trips_col = auth_db.mongo_db["trips"]
        query = {
            "$or": [
                {"tripId": {"$in": trip_variants}},
                {"id": {"$in": [str(v) for v in trip_variants]}},
            ]
        }
        if ObjectId.is_valid(clean_trip_id):
            query["$or"].append({"_id": ObjectId(clean_trip_id)})

        trip_doc = await trips_col.find_one(query)
        if trip_doc:
            trip_owner = str(trip_doc.get("userId") or "")
            if trip_owner in [str(v) for v in user_variants] or clean_user_id == trip_owner:
                is_owner = True

    if is_owner:
        return {"success": True, "role": "owner"}

    # 2. Check if user is an accepted member in trip_members
    is_accepted_member = False
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        members = auth_db.fallback_store.get("trip_members", [])
        for m in members:
            m_trip = str(m.get("tripId") or "")
            m_user = str(m.get("userId") or "")
            if m_trip in [str(v) for v in trip_variants] or clean_trip_id == m_trip:
                if m_user in [str(v) for v in user_variants] or clean_user_id == m_user:
                    if m.get("status") == "accepted":
                        is_accepted_member = True
                    break
    else:
        members_col = auth_db.mongo_db["trip_members"]
        member_doc = await members_col.find_one({
            "tripId": {"$in": trip_variants},
            "userId": {"$in": user_variants},
        })
        if member_doc and member_doc.get("status") == "accepted":
            is_accepted_member = True

    if is_accepted_member:
        return {"success": True, "role": "member"}

    return {
        "success": False,
        "status_code": 403,
        "error": "Access denied. You are not the owner or an accepted member of this trip.",
    }


# =========================================================================
# CRUD PERSISTENCE OPERATIONS (SB-B2)
# =========================================================================

async def create_shared_budget_expense(
    user_id: str,
    trip_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    CREATE endpoint service handler.
    1. Verifies user access.
    2. Validates & builds expense document.
    3. Persists to `shared_budget_expenses` collection or fallback store.
    """
    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    try:
        payload["tripId"] = str(trip_id)
        if "createdBy" not in payload:
            payload["createdBy"] = str(user_id)

        doc = build_expense_document(
            trip_id=str(trip_id),
            name=payload.get("name") or payload.get("description") or "",
            amount=payload.get("amount", 0.0),
            currency=payload.get("currency", DEFAULT_CURRENCY),
            category=payload.get("category", "Other"),
            date=payload.get("date"),
            destination_reference=payload.get("destinationReference") or payload.get("destination") or "",
            status=payload.get("status", "paid"),
            payers=payload.get("payers"),
            participants=payload.get("participants"),
            created_by=str(user_id),
        )
    except ValueError as ve:
        return {"success": False, "status_code": 400, "error": str(ve)}

    from app import auth_db
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        auth_db.fallback_store.setdefault("shared_budget_expenses", [])
        auth_db.fallback_store["shared_budget_expenses"].append(doc)
        auth_db._save_fallback_store()
    else:
        col = get_shared_budget_collection()
        if col is not None:
            await col.insert_one(doc)

    return {"success": True, "expense": serialize_expense_document(doc)}


async def list_shared_budget_expenses(
    user_id: str,
    trip_id: str,
) -> Dict[str, Any]:
    """
    LIST endpoint service handler.
    Retrieves all Shared Budget expenses for the specified trip_id.
    """
    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    clean_trip_id = str(trip_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)

    from app import auth_db
    results = []
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        expenses = auth_db.fallback_store.get("shared_budget_expenses", [])
        for e in expenses:
            e_trip = str(e.get("tripId") or "")
            if e_trip in [str(v) for v in trip_variants] or clean_trip_id == e_trip:
                results.append(serialize_expense_document(e))
    else:
        col = get_shared_budget_collection()
        if col is not None:
            cursor = col.find({"tripId": {"$in": trip_variants}}).sort("date", -1)
            async for doc in cursor:
                results.append(serialize_expense_document(doc))

    return {"success": True, "expenses": results}


async def get_shared_budget_expense(
    user_id: str,
    trip_id: str,
    expense_id: str,
) -> Dict[str, Any]:
    """
    GET SINGLE endpoint service handler.
    Returns expense by id if user is authorized and expense belongs to trip_id.
    """
    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    clean_trip_id = str(trip_id).strip()
    clean_exp_id = str(expense_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)

    from app import auth_db
    found_doc = None
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        expenses = auth_db.fallback_store.get("shared_budget_expenses", [])
        for e in expenses:
            e_id = str(e.get("id") or e.get("_id"))
            e_trip = str(e.get("tripId") or "")
            if e_id == clean_exp_id and (e_trip in [str(v) for v in trip_variants] or clean_trip_id == e_trip):
                found_doc = e
                break
    else:
        col = get_shared_budget_collection()
        if col is not None:
            query = {
                "tripId": {"$in": trip_variants},
                "$or": [
                    {"id": clean_exp_id},
                    {"_id": clean_exp_id},
                ],
            }
            if ObjectId.is_valid(clean_exp_id):
                query["$or"].append({"_id": ObjectId(clean_exp_id)})
            found_doc = await col.find_one(query)

    if not found_doc:
        return {"success": False, "status_code": 404, "error": "Shared Budget expense not found"}

    return {"success": True, "expense": serialize_expense_document(found_doc)}


async def update_shared_budget_expense(
    user_id: str,
    trip_id: str,
    expense_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    UPDATE endpoint service handler.
    Modifies editable fields of an expense while preserving protected fields (id, tripId, createdBy, createdAt).
    """
    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    clean_trip_id = str(trip_id).strip()
    clean_exp_id = str(expense_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)

    from app import auth_db
    found_doc = None
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        expenses = auth_db.fallback_store.get("shared_budget_expenses", [])
        for e in expenses:
            e_id = str(e.get("id") or e.get("_id"))
            e_trip = str(e.get("tripId") or "")
            if e_id == clean_exp_id and (e_trip in [str(v) for v in trip_variants] or clean_trip_id == e_trip):
                found_doc = e
                break
    else:
        col = get_shared_budget_collection()
        if col is not None:
            query = {
                "tripId": {"$in": trip_variants},
                "$or": [
                    {"id": clean_exp_id},
                    {"_id": clean_exp_id},
                ],
            }
            if ObjectId.is_valid(clean_exp_id):
                query["$or"].append({"_id": ObjectId(clean_exp_id)})
            found_doc = await col.find_one(query)

    if not found_doc:
        return {"success": False, "status_code": 404, "error": "Shared Budget expense not found"}

    # Merge payload with existing doc for validation
    merge_data = {
        "tripId": clean_trip_id,
        "name": payload.get("name") if "name" in payload else found_doc.get("name"),
        "amount": payload.get("amount") if "amount" in payload else found_doc.get("amount"),
        "currency": payload.get("currency") if "currency" in payload else found_doc.get("currency"),
        "category": payload.get("category") if "category" in payload else found_doc.get("category"),
        "date": payload.get("date") if "date" in payload else found_doc.get("date"),
        "destinationReference": payload.get("destinationReference") if "destinationReference" in payload else (payload.get("destination") if "destination" in payload else found_doc.get("destinationReference")),
        "status": payload.get("status") if "status" in payload else found_doc.get("status"),
        "payers": payload.get("payers") if "payers" in payload else found_doc.get("payers"),
        "participants": payload.get("participants") if "participants" in payload else found_doc.get("participants"),
        "createdBy": found_doc.get("createdBy"),  # Protected field
    }

    try:
        validated = validate_expense_data(merge_data)
    except ValueError as ve:
        return {"success": False, "status_code": 400, "error": str(ve)}

    now = _utc_now()
    updates = {
        "name": validated["name"],
        "amount": validated["amount"],
        "currency": validated["currency"],
        "category": validated["category"],
        "date": validated["date"],
        "destinationReference": validated["destinationReference"],
        "status": validated["status"],
        "payers": validated["payers"],
        "participants": validated["participants"],
        "updatedAt": now,
    }

    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        found_doc.update(updates)
        found_doc["updatedAt"] = _to_iso(now)
        auth_db._save_fallback_store()
        updated_doc = found_doc
    else:
        col = get_shared_budget_collection()
        await col.update_one({"_id": found_doc["_id"]}, {"$set": updates})
        updated_doc = await col.find_one({"_id": found_doc["_id"]})

    return {"success": True, "expense": serialize_expense_document(updated_doc)}


async def delete_shared_budget_expense(
    user_id: str,
    trip_id: str,
    expense_id: str,
) -> Dict[str, Any]:
    """
    DELETE endpoint service handler.
    Removes ONLY the specified Shared Budget expense record.
    Does NOT delete the trip, personal budget, or member records.
    """
    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    clean_trip_id = str(trip_id).strip()
    clean_exp_id = str(expense_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)

    from app import auth_db
    deleted = False
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        expenses = auth_db.fallback_store.get("shared_budget_expenses", [])
        initial_len = len(expenses)
        auth_db.fallback_store["shared_budget_expenses"] = [
            e for e in expenses
            if not (
                str(e.get("id") or e.get("_id")) == clean_exp_id
                and (str(e.get("tripId")) in [str(v) for v in trip_variants] or clean_trip_id == str(e.get("tripId")))
            )
        ]
        if len(auth_db.fallback_store["shared_budget_expenses"]) < initial_len:
            deleted = True
            auth_db._save_fallback_store()
    else:
        col = get_shared_budget_collection()
        if col is not None:
            query = {
                "tripId": {"$in": trip_variants},
                "$or": [
                    {"id": clean_exp_id},
                    {"_id": clean_exp_id},
                ],
            }
            if ObjectId.is_valid(clean_exp_id):
                query["$or"].append({"_id": ObjectId(clean_exp_id)})
            res = await col.delete_one(query)
            if res.deleted_count > 0:
                deleted = True

    if not deleted:
        return {"success": False, "status_code": 404, "error": "Shared Budget expense not found"}

    return {"success": True, "message": "Shared Budget expense deleted successfully"}
