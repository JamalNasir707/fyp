"""
Shared Budget API Routes (SB-B2).
Provides dedicated CRUD endpoints for Shared Budget expenses under `/api/shared-budget/trips/{trip_id}/expenses`.

ISOLATED PERSISTENCE SAFETY:
- Accesses ONLY the `shared_budget_expenses` collection.
- Uses existing session authentication and Tripmates membership verification.
- Does NOT alter personal expenses, core trip documents, or itinerary data.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.auth_db import verify_session
from app.services.shared_budget import (
    create_shared_budget_expense,
    list_shared_budget_expenses,
    get_shared_budget_expense,
    update_shared_budget_expense,
    delete_shared_budget_expense,
    create_shared_budget_settlement,
    list_shared_budget_settlements,
    get_shared_budget_settlement,
    delete_shared_budget_settlement,
)

router = APIRouter(tags=["Shared Budget"])


# ==================== AUTH DEPENDENCY ====================

def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return authorization.strip() or None


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    result = await verify_session(token)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result.get("error", "Invalid or expired session"),
        )
    return result


# ==================== REQUEST SCHEMAS ====================

class PayerItemSchema(BaseModel):
    userId: Optional[str] = Field(default=None, description="Payer User ID")
    name: Optional[str] = Field(default=None, description="Payer display name")
    amount: Optional[float] = Field(default=0.0, description="Amount paid by this person")


class ParticipantItemSchema(BaseModel):
    userId: Optional[str] = Field(default=None, description="Participant User ID")
    name: Optional[str] = Field(default=None, description="Participant display name")
    share: Optional[float] = Field(default=0.0, description="Owed share for this person")


class CreateExpenseRequest(BaseModel):
    name: Optional[str] = Field(default="Untitled Expense", description="Expense title / description")
    amount: float = Field(..., description="Total monetary amount")
    currency: Optional[str] = Field(default="PKR", description="Currency code")
    category: Optional[str] = Field(default="Other", description="Category (Sleep, Transport, See & Do, Eat & Drink, Other)")
    date: Optional[str] = Field(default=None, description="Expense date (YYYY-MM-DD)")
    destinationReference: Optional[str] = Field(default="", description="Reference label for location/destination")
    status: Optional[str] = Field(default="paid", description="Status: 'paid' or 'pending'")
    payers: Optional[List[PayerItemSchema]] = Field(default=None, description="List of 1..N payer objects")
    participants: Optional[List[ParticipantItemSchema]] = Field(default=None, description="List of participant share objects")


class UpdateExpenseRequest(BaseModel):
    name: Optional[str] = Field(default=None)
    amount: Optional[float] = Field(default=None)
    currency: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    date: Optional[str] = Field(default=None)
    destinationReference: Optional[str] = Field(default=None)
    status: Optional[str] = Field(default=None)
    payers: Optional[List[PayerItemSchema]] = Field(default=None)
    participants: Optional[List[ParticipantItemSchema]] = Field(default=None)


class CreateSettlementRequest(BaseModel):
    payerId: Optional[str] = Field(default=None, description="Payer User ID")
    payerName: Optional[str] = Field(default="", description="Payer display name")
    receiverId: Optional[str] = Field(default=None, description="Receiver User ID")
    receiverName: Optional[str] = Field(default="", description="Receiver display name")
    amount: Optional[float] = Field(default=None, description="Settlement amount")
    currency: Optional[str] = Field(default="PKR", description="Currency code")
    date: Optional[str] = Field(default=None, description="Settlement date (YYYY-MM-DD)")
    note: Optional[str] = Field(default="", description="Settlement note / description")


# ==================== CRUD ENDPOINTS ====================

# 1. CREATE EXPENSE
@router.post("/api/shared-budget/trips/{trip_id}/expenses", status_code=status.HTTP_201_CREATED)
@router.post("/shared-budget/trips/{trip_id}/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense_endpoint(
    trip_id: str,
    payload: CreateExpenseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Creates a new Shared Budget expense for the specified trip_id.
    Authorized for trip owner and accepted Tripmates.
    """
    raw_payload = payload.dict(exclude_unset=True)

    # Convert nested PayerItemSchema / ParticipantItemSchema models to dicts
    if "payers" in raw_payload and raw_payload["payers"] is not None:
        raw_payload["payers"] = [p if isinstance(p, dict) else p.dict() for p in raw_payload["payers"]]
    if "participants" in raw_payload and raw_payload["participants"] is not None:
        raw_payload["participants"] = [p if isinstance(p, dict) else p.dict() for p in raw_payload["participants"]]

    result = await create_shared_budget_expense(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        payload=raw_payload,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 400)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Failed to create expense"))
    return result


# 2. LIST EXPENSES
@router.get("/api/shared-budget/trips/{trip_id}/expenses")
@router.get("/shared-budget/trips/{trip_id}/expenses")
async def list_expenses_endpoint(
    trip_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieves all Shared Budget expenses belonging to the specified trip_id.
    Authorized for trip owner and accepted Tripmates.
    """
    result = await list_shared_budget_expenses(
        user_id=current_user["user_id"],
        trip_id=trip_id,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 403)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Failed to retrieve expenses"))
    return result


# 3. GET SINGLE EXPENSE
@router.get("/api/shared-budget/trips/{trip_id}/expenses/{expense_id}")
@router.get("/shared-budget/trips/{trip_id}/expenses/{expense_id}")
async def get_single_expense_endpoint(
    trip_id: str,
    expense_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieves a single Shared Budget expense by expense_id.
    Authorized for trip owner and accepted Tripmates. Returns 404 if not found or cross-trip mismatch.
    """
    result = await get_shared_budget_expense(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        expense_id=expense_id,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 404)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Expense not found"))
    return result


# 4. UPDATE EXPENSE
@router.put("/api/shared-budget/trips/{trip_id}/expenses/{expense_id}")
@router.put("/shared-budget/trips/{trip_id}/expenses/{expense_id}")
@router.patch("/api/shared-budget/trips/{trip_id}/expenses/{expense_id}")
@router.patch("/shared-budget/trips/{trip_id}/expenses/{expense_id}")
async def update_expense_endpoint(
    trip_id: str,
    expense_id: str,
    payload: UpdateExpenseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Updates editable fields of an existing Shared Budget expense.
    Protected metadata (id, tripId, createdBy, createdAt) cannot be mutated.
    """
    raw_payload = payload.dict(exclude_unset=True)

    if "payers" in raw_payload and raw_payload["payers"] is not None:
        raw_payload["payers"] = [p if isinstance(p, dict) else p.dict() for p in raw_payload["payers"]]
    if "participants" in raw_payload and raw_payload["participants"] is not None:
        raw_payload["participants"] = [p if isinstance(p, dict) else p.dict() for p in raw_payload["participants"]]

    result = await update_shared_budget_expense(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        expense_id=expense_id,
        payload=raw_payload,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 400)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Failed to update expense"))
    return result


# 5. DELETE EXPENSE
@router.delete("/api/shared-budget/trips/{trip_id}/expenses/{expense_id}")
@router.delete("/shared-budget/trips/{trip_id}/expenses/{expense_id}")
async def delete_expense_endpoint(
    trip_id: str,
    expense_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Deletes ONLY the specified Shared Budget expense.
    Does NOT delete the trip, personal expenses, or member records.
    """
    result = await delete_shared_budget_expense(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        expense_id=expense_id,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 404)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Failed to delete expense"))
    return result


# ==================== SETTLEMENT ENDPOINTS ====================

# 1. CREATE SETTLEMENT
@router.post("/api/shared-budget/trips/{trip_id}/settlements", status_code=status.HTTP_201_CREATED)
@router.post("/shared-budget/trips/{trip_id}/settlements", status_code=status.HTTP_201_CREATED)
async def create_settlement_endpoint(
    trip_id: str,
    payload: CreateSettlementRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Creates a new Shared Budget settlement for the specified trip_id.
    Authorized for trip owner and accepted Tripmates.
    """
    raw_payload = payload.dict(exclude_unset=True)
    result = await create_shared_budget_settlement(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        payload=raw_payload,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 400)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Failed to create settlement"))
    return result


# 2. LIST SETTLEMENTS
@router.get("/api/shared-budget/trips/{trip_id}/settlements")
@router.get("/shared-budget/trips/{trip_id}/settlements")
async def list_settlements_endpoint(
    trip_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieves all Shared Budget settlements belonging to the specified trip_id.
    Authorized for trip owner and accepted Tripmates.
    """
    result = await list_shared_budget_settlements(
        user_id=current_user["user_id"],
        trip_id=trip_id,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 403)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Failed to retrieve settlements"))
    return result


# 3. GET SINGLE SETTLEMENT
@router.get("/api/shared-budget/trips/{trip_id}/settlements/{settlement_id}")
@router.get("/shared-budget/trips/{trip_id}/settlements/{settlement_id}")
async def get_single_settlement_endpoint(
    trip_id: str,
    settlement_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieves a single Shared Budget settlement by settlement_id.
    Authorized for trip owner and accepted Tripmates. Returns 404 if not found or cross-trip mismatch.
    """
    result = await get_shared_budget_settlement(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        settlement_id=settlement_id,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 404)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Settlement not found"))
    return result


# 4. DELETE SETTLEMENT
@router.delete("/api/shared-budget/trips/{trip_id}/settlements/{settlement_id}")
@router.delete("/shared-budget/trips/{trip_id}/settlements/{settlement_id}")
async def delete_settlement_endpoint(
    trip_id: str,
    settlement_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Deletes ONLY the specified Shared Budget settlement.
    Does NOT delete expenses, trip, or member records.
    """
    result = await delete_shared_budget_settlement(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        settlement_id=settlement_id,
    )
    if not result.get("success"):
        st_code = result.get("status_code", 404)
        raise HTTPException(status_code=st_code, detail=result.get("error", "Failed to delete settlement"))
    return result



