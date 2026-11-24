"""
Tripmates Membership API Routes.
Provides isolated endpoints for Tripmates invitations and roster management.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.auth_db import verify_session
from app.services.tripmates.tripmates_service import (
    get_trip_members,
    get_user_invitations,
    invite_member,
    remove_trip_member,
    get_shared_tripmate_trip,
    get_user_shared_tripmate_trips,
    respond_to_invitation,
    update_tripmate_itinerary,
)

router = APIRouter(tags=["Tripmates"])


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

class InviteMemberRequest(BaseModel):
    identifier: str = Field(..., description="Username or email of the user to invite")


class RespondInviteRequest(BaseModel):
    action: str = Field(..., description="'accept' or 'decline'")


class UpdateTripmateItineraryRequest(BaseModel):
    days: Optional[List[Any]] = Field(default=None, description="Array of day objects")
    itinerary: Optional[List[Any]] = Field(default=None, description="Fallback array of day objects")
    placesPool: Optional[List[Any]] = Field(default=None, description="Array of places pool items")
    customLists: Optional[Any] = Field(default=None, description="Custom lists array or object")


# ==================== ENDPOINTS ====================

@router.post("/trips/{trip_id}/members/invite")
@router.post("/api/trips/{trip_id}/members/invite")
async def invite_member_endpoint(
    trip_id: str,
    payload: InviteMemberRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    1. Owner invites a registered user by username or email.
    """
    result = await invite_member(
        owner_id=current_user["user_id"],
        trip_id=trip_id,
        identifier=payload.identifier,
    )
    if not result.get("success"):
        status_code = result.get("status_code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error", "Invitation failed"))
    return result


@router.get("/trips/{trip_id}/members")
@router.get("/api/trips/{trip_id}/members")
async def get_trip_members_endpoint(
    trip_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    2. Retrieve all membership and invitation records for a trip.
    Accessible to the owner and accepted members.
    """
    result = await get_trip_members(
        requester_user_id=current_user["user_id"],
        trip_id=trip_id,
    )
    if not result.get("success"):
        status_code = result.get("status_code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error", "Failed to retrieve members"))
    return result


@router.get("/trips/invitations")
@router.get("/api/trips/invitations")
async def get_user_invitations_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    3. Retrieve all pending Tripmates invitations for the authenticated user.
    """
    result = await get_user_invitations(user_id=current_user["user_id"])
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to retrieve invitations"))
    return result


@router.post("/trips/invitations/{invite_id}/respond")
@router.post("/api/trips/invitations/{invite_id}/respond")
async def respond_to_invitation_endpoint(
    invite_id: str,
    payload: RespondInviteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    4. Invited user accepts or declines an invitation.
    """
    result = await respond_to_invitation(
        user_id=current_user["user_id"],
        invite_id=invite_id,
        action=payload.action,
    )
    if not result.get("success"):
        status_code = result.get("status_code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error", "Failed to respond to invitation"))
    return result


@router.delete("/trips/{trip_id}/members/{user_id}")
@router.delete("/api/trips/{trip_id}/members/{user_id}")
async def remove_member_endpoint(
    trip_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    5. Owner revokes an invitation or removes an accepted member.
    """
    result = await remove_trip_member(
        owner_id=current_user["user_id"],
        trip_id=trip_id,
        member_user_id=user_id,
    )
    if not result.get("success"):
        status_code = result.get("status_code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error", "Failed to remove member"))
    return result


@router.get("/api/tripmates/trips/{trip_id}")
async def get_shared_tripmate_trip_endpoint(
    trip_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    6. Retrieve a shared trip document for an accepted Tripmate.
    """
    result = await get_shared_tripmate_trip(
        requester_user_id=current_user["user_id"],
        trip_id=trip_id,
    )
    if not result.get("success"):
        status_code = result.get("status_code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error", "Failed to retrieve shared trip"))
    return result


@router.put("/api/tripmates/trips/{trip_id}/itinerary")
async def update_tripmate_itinerary_endpoint(
    trip_id: str,
    payload: UpdateTripmateItineraryRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    7. Owner or accepted Tripmate updates the trip itinerary fields.
    """
    payload_dict = payload.dict(exclude_unset=True)
    result = await update_tripmate_itinerary(
        user_id=current_user["user_id"],
        trip_id=trip_id,
        payload=payload_dict,
    )
    if not result.get("success"):
        status_code = result.get("status_code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error", "Failed to update itinerary"))
    return result


@router.get("/api/tripmates/shared-trips")
async def get_user_shared_tripmate_trips_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    8. Retrieve all canonical trips where the authenticated user is an accepted Tripmate.
    """
    result = await get_user_shared_tripmate_trips(user_id=current_user["user_id"])
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to retrieve shared trips"))
    return result

