"""
Shared Budget Settlements Foundation Backend Service (SB-C3A).
Provides isolated data models, schema validation, and serialization
for Shared Budget settlement records.

ISOLATED PERSISTENCE SAFETY:
- Zero live MongoDB writes in SB-C3A.
- Does NOT alter shared_budget_expenses collection or documents.
- Does NOT alter core trips collection or activeTrip data.
- Does NOT touch existing personal Budget or Expenses.
- Does NOT modify Tripmates membership or auth.
- Does NOT alter existing balance calculations.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("uvicorn.error")

SETTLEMENTS_COLLECTION_NAME = "shared_budget_settlements"
DEFAULT_CURRENCY = "PKR"
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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


def validate_settlement_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates payload structure and fields for a settlement record:
    - settlementId (optional in payload; if provided, must be non-empty string)
    - tripId (required, non-empty string)
    - payerId (required, non-empty string)
    - receiverId (required, non-empty string)
    - payerId != receiverId (payer cannot be receiver)
    - amount (required, float > 0)
    - currency (required, non-empty string)
    - date (required, string in YYYY-MM-DD format)
    - createdBy (required, non-empty string)
    """
    errors: List[str] = []
    sanitized: Dict[str, Any] = {}

    if not isinstance(payload, dict):
        return {"valid": False, "errors": ["Payload must be a dictionary"], "sanitized": {}}

    # 1. tripId
    raw_trip_id = payload.get("tripId")
    if raw_trip_id is None or str(raw_trip_id).strip() == "":
        errors.append("tripId is required")
    else:
        sanitized["tripId"] = str(raw_trip_id).strip()

    # 2. payerId
    raw_payer_id = payload.get("payerId")
    if raw_payer_id is None or str(raw_payer_id).strip() == "":
        errors.append("payerId is required")
    else:
        sanitized["payerId"] = str(raw_payer_id).strip()

    # 3. receiverId
    raw_receiver_id = payload.get("receiverId")
    if raw_receiver_id is None or str(raw_receiver_id).strip() == "":
        errors.append("receiverId is required")
    else:
        sanitized["receiverId"] = str(raw_receiver_id).strip()

    # 4. payerId != receiverId
    if "payerId" in sanitized and "receiverId" in sanitized:
        if sanitized["payerId"] == sanitized["receiverId"]:
            errors.append("payerId and receiverId cannot be the same user")

    # 5. amount
    raw_amount = payload.get("amount")
    if raw_amount is None:
        errors.append("amount is required")
    else:
        try:
            amt_float = float(raw_amount)
            if amt_float <= 0:
                errors.append("amount must be greater than zero")
            else:
                sanitized["amount"] = round(amt_float, 2)
        except (ValueError, TypeError):
            errors.append("amount must be a valid numeric value")

    # 6. currency
    raw_currency = payload.get("currency", DEFAULT_CURRENCY)
    if not raw_currency or str(raw_currency).strip() == "":
        errors.append("currency is required")
    else:
        sanitized["currency"] = str(raw_currency).strip().upper()

    # 7. date (YYYY-MM-DD)
    raw_date = payload.get("date")
    if not raw_date or str(raw_date).strip() == "":
        errors.append("date is required")
    else:
        clean_date = str(raw_date).strip()
        if not DATE_PATTERN.match(clean_date):
            errors.append("date must be in YYYY-MM-DD format")
        else:
            try:
                datetime.strptime(clean_date, "%Y-%m-%d")
                sanitized["date"] = clean_date
            except ValueError:
                errors.append("date is not a valid calendar date")

    # 8. createdBy
    raw_created_by = payload.get("createdBy")
    if raw_created_by is None or str(raw_created_by).strip() == "":
        errors.append("createdBy is required")
    else:
        sanitized["createdBy"] = str(raw_created_by).strip()

    # Optional Metadata fields
    sanitized["payerName"] = str(payload.get("payerName") or "").strip()
    sanitized["receiverName"] = str(payload.get("receiverName") or "").strip()
    sanitized["note"] = str(payload.get("note") or "").strip()

    if "settlementId" in payload and payload["settlementId"]:
        sanitized["settlementId"] = str(payload["settlementId"]).strip()

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "sanitized": sanitized if len(errors) == 0 else {},
    }


def build_settlement_document(
    creator_id: str,
    trip_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Builds a structured settlement document model.
    Validates payload and throws ValueError if invalid.
    """
    merged_payload = dict(payload)
    if "createdBy" not in merged_payload or not merged_payload["createdBy"]:
        merged_payload["createdBy"] = creator_id
    if "tripId" not in merged_payload or not merged_payload["tripId"]:
        merged_payload["tripId"] = trip_id

    validation = validate_settlement_data(merged_payload)
    if not validation["valid"]:
        raise ValueError(f"Invalid settlement data: {', '.join(validation['errors'])}")

    data = validation["sanitized"]
    now = _utc_now()
    now_iso = _to_iso(now)

    settlement_id = data.get("settlementId") or f"settle_{uuid.uuid4()}"

    doc = {
        "id": settlement_id,
        "settlementId": settlement_id,
        "tripId": data["tripId"],
        "payerId": data["payerId"],
        "payerName": data.get("payerName") or "",
        "receiverId": data["receiverId"],
        "receiverName": data.get("receiverName") or "",
        "amount": data["amount"],
        "currency": data.get("currency", DEFAULT_CURRENCY),
        "date": data["date"],
        "note": data.get("note") or "",
        "createdBy": data["createdBy"],
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    return doc


def serialize_settlement_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Serializes a settlement document for API JSON responses.
    Converts MongoDB _id to string if present.
    """
    if not isinstance(doc, dict):
        return {}

    serialized = dict(doc)
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])

    settlement_id = serialized.get("settlementId") or serialized.get("id") or (serialized.get("_id") if "_id" in serialized else None)
    serialized["id"] = settlement_id
    serialized["settlementId"] = settlement_id

    return serialized


from bson import ObjectId


def get_shared_budget_settlements_collection(db_instance: Any = None):
    """
    Returns the dedicated `shared_budget_settlements` collection reference.
    Falls back to `app.auth_db.mongo_db["shared_budget_settlements"]` if db_instance is not provided.
    """
    if db_instance is not None:
        if hasattr(db_instance, "__getitem__"):
            return db_instance[SETTLEMENTS_COLLECTION_NAME]
        return getattr(db_instance, SETTLEMENTS_COLLECTION_NAME, None)
    
    try:
        from app import auth_db
        if auth_db.mongo_db is not None:
            return auth_db.mongo_db[SETTLEMENTS_COLLECTION_NAME]
    except Exception as err:
        logger.warning(f"Unable to access auth_db.mongo_db for {SETTLEMENTS_COLLECTION_NAME}: {err}")
    return None


async def ensure_shared_budget_settlement_indexes(db_instance: Any = None) -> bool:
    """
    Ensures safe index foundation on the dedicated `shared_budget_settlements` collection:
    - (tripId, 1), (settlementId, 1)
    - (tripId, 1), (createdAt, -1)
    DOES NOT modify indexes on any existing collection.
    """
    coll = get_shared_budget_settlements_collection(db_instance)
    if coll is None:
        logger.info("Shared Budget Settlements collection not available for index creation.")
        return False
    
    try:
        await coll.create_index([("tripId", 1), ("settlementId", 1)], background=True)
        await coll.create_index([("tripId", 1), ("createdAt", -1)], background=True)
        logger.info("Shared Budget Settlements collection indexes ensured successfully.")
        return True
    except Exception as err:
        logger.error(f"Error ensuring shared_budget_settlements indexes: {err}")
        return False


async def create_shared_budget_settlement(
    user_id: str,
    trip_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Creates a settlement record.
    1. Verifies caller has trip access.
    2. Validates & builds settlement document via C3A foundation.
    3. Verifies payerId & receiverId belong to the trip roster (owner or accepted member).
    4. Persists to shared_budget_settlements collection (or demo fallback store).
    """
    from app.services.shared_budget.shared_budget_service import (
        verify_shared_budget_access,
    )

    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    try:
        doc = build_settlement_document(
            creator_id=user_id,
            trip_id=trip_id,
            payload=payload,
        )
    except ValueError as ve:
        return {"success": False, "status_code": 400, "error": str(ve)}

    # Roster validation for payerId & receiverId
    payer_id = doc["payerId"]
    receiver_id = doc["receiverId"]

    payer_auth = await verify_shared_budget_access(payer_id, trip_id)
    if not payer_auth.get("success"):
        return {
            "success": False,
            "status_code": 400,
            "error": f"Payer '{payer_id}' is not an owner or accepted member of this trip",
        }

    receiver_auth = await verify_shared_budget_access(receiver_id, trip_id)
    if not receiver_auth.get("success"):
        return {
            "success": False,
            "status_code": 400,
            "error": f"Receiver '{receiver_id}' is not an owner or accepted member of this trip",
        }

    from app import auth_db
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        auth_db.fallback_store.setdefault(SETTLEMENTS_COLLECTION_NAME, [])
        auth_db.fallback_store[SETTLEMENTS_COLLECTION_NAME].append(doc)
        auth_db._save_fallback_store()
    else:
        col = get_shared_budget_settlements_collection()
        if col is not None:
            await col.insert_one(doc)

    return {"success": True, "settlement": serialize_settlement_document(doc)}


async def list_shared_budget_settlements(
    user_id: str,
    trip_id: str,
) -> Dict[str, Any]:
    """
    Retrieves all settlements for trip_id.
    """
    from app.services.shared_budget.shared_budget_service import (
        _trip_id_variants,
        verify_shared_budget_access,
    )

    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    clean_trip_id = str(trip_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)

    from app import auth_db
    results = []
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        settlements = auth_db.fallback_store.get(SETTLEMENTS_COLLECTION_NAME, [])
        for s in settlements:
            s_trip = str(s.get("tripId") or "")
            if s_trip in [str(v) for v in trip_variants] or clean_trip_id == s_trip:
                results.append(serialize_settlement_document(s))
    else:
        col = get_shared_budget_settlements_collection()
        if col is not None:
            cursor = col.find({"tripId": {"$in": trip_variants}}).sort("createdAt", -1)
            async for doc in cursor:
                results.append(serialize_settlement_document(doc))

    return {"success": True, "settlements": results}


async def get_shared_budget_settlement(
    user_id: str,
    trip_id: str,
    settlement_id: str,
) -> Dict[str, Any]:
    """
    Retrieves a single settlement by settlement_id for trip_id.
    """
    from app.services.shared_budget.shared_budget_service import (
        _trip_id_variants,
        verify_shared_budget_access,
    )

    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    clean_trip_id = str(trip_id).strip()
    clean_settle_id = str(settlement_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)

    from app import auth_db
    found_doc = None
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        settlements = auth_db.fallback_store.get(SETTLEMENTS_COLLECTION_NAME, [])
        for s in settlements:
            s_id = str(s.get("settlementId") or s.get("id") or s.get("_id"))
            s_trip = str(s.get("tripId") or "")
            if s_id == clean_settle_id and (s_trip in [str(v) for v in trip_variants] or clean_trip_id == s_trip):
                found_doc = s
                break
    else:
        col = get_shared_budget_settlements_collection()
        if col is not None:
            query = {
                "tripId": {"$in": trip_variants},
                "$or": [
                    {"settlementId": clean_settle_id},
                    {"id": clean_settle_id},
                    {"_id": clean_settle_id},
                ],
            }
            if ObjectId.is_valid(clean_settle_id):
                query["$or"].append({"_id": ObjectId(clean_settle_id)})
            found_doc = await col.find_one(query)

    if not found_doc:
        return {"success": False, "status_code": 404, "error": "Shared Budget settlement not found"}

    return {"success": True, "settlement": serialize_settlement_document(found_doc)}


async def delete_shared_budget_settlement(
    user_id: str,
    trip_id: str,
    settlement_id: str,
) -> Dict[str, Any]:
    """
    Deletes a single settlement by settlement_id for trip_id.
    """
    from app.services.shared_budget.shared_budget_service import (
        _trip_id_variants,
        verify_shared_budget_access,
    )

    auth_res = await verify_shared_budget_access(user_id, trip_id)
    if not auth_res.get("success"):
        return auth_res

    clean_trip_id = str(trip_id).strip()
    clean_settle_id = str(settlement_id).strip()
    trip_variants = _trip_id_variants(clean_trip_id)

    from app import auth_db
    deleted = False
    if auth_db.use_demo_fallback or auth_db.mongo_db is None:
        settlements = auth_db.fallback_store.get(SETTLEMENTS_COLLECTION_NAME, [])
        initial_len = len(settlements)
        auth_db.fallback_store[SETTLEMENTS_COLLECTION_NAME] = [
            s for s in settlements
            if not (
                str(s.get("settlementId") or s.get("id") or s.get("_id")) == clean_settle_id
                and (str(s.get("tripId")) in [str(v) for v in trip_variants] or clean_trip_id == str(s.get("tripId")))
            )
        ]
        if len(auth_db.fallback_store[SETTLEMENTS_COLLECTION_NAME]) < initial_len:
            deleted = True
            auth_db._save_fallback_store()
    else:
        col = get_shared_budget_settlements_collection()
        if col is not None:
            query = {
                "tripId": {"$in": trip_variants},
                "$or": [
                    {"settlementId": clean_settle_id},
                    {"id": clean_settle_id},
                    {"_id": clean_settle_id},
                ],
            }
            if ObjectId.is_valid(clean_settle_id):
                query["$or"].append({"_id": ObjectId(clean_settle_id)})
            res = await col.delete_one(query)
            if res.deleted_count > 0:
                deleted = True

    if not deleted:
        return {"success": False, "status_code": 404, "error": "Shared Budget settlement not found"}

    return {"success": True, "message": "Settlement deleted successfully"}

