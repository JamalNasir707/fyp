from fastapi import Depends, FastAPI, Header, HTTPException, status
from typing import Any, Dict, List, Optional
from copy import deepcopy
from pydantic import BaseModel
import os
import requests
from app.data_loader import load_locations_from_csv, load_master_dataset, load_google_places_csv
from app.env_loader import load_env_file
from app.constraints import optimize_budget, select_locations_time_aware
from app.optimizer import solve_tsp, haversine
from app.models import OptimizeRequest, SequenceDayRequest, SequenceDayResponse
from app.itinerary import generate_itinerary
from app.clustering import cluster_locations
from app.recommendation import score_and_rank_candidates
from app.external_api import update_dynamic_dataset
from app.auth_db import (
    authenticate_user,
    authenticate_or_create_google_user,
    close_db,
    create_session,
    create_user,
    delete_user_account,
    delete_trip_for_user,
    init_db,
    list_trips_for_user,
    logout_session,
    save_trip_document,
    generate_or_get_trip_share_token,
    get_shared_trip_by_token,
    get_shared_edit_trip_by_token,
    create_or_get_shared_edit_copy,
    search_public_users,
    get_public_user_by_username,
    list_public_trips_by_username,
    get_public_trip_by_id,
    update_user_profile,
    verify_session,
    follow_user,
    unfollow_user,
    get_user_follow_stats,
    list_notifications_for_user,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)
from app.services.activity.activity_service import get_user_activity
from app.services.admin.overview_service import get_admin_overview_summary
from app.services.admin.users_service import get_admin_users, get_admin_user_details, update_user_status, update_user_role, delete_user_by_admin
from app.services.admin.trips_service import get_admin_trips_raw
from app.services.weather.weather_service import fetch_current_weather
from app.services.serpapi.serpapi_service import fetch_explore_places, fetch_place_details, fetch_place_photos
from app.services.locations_service import search_locations_nationwide, search_locations_in_bounds, search_locations_nearby


load_env_file()
app = FastAPI()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes.ai import router as ai_router
app.include_router(ai_router)

from app.routes.tripmates import router as tripmates_router
app.include_router(tripmates_router)

from app.routes.shared_budget import router as shared_budget_router
app.include_router(shared_budget_router)

locations_data = load_master_dataset()

FAR_THRESHOLD_KM = 50.0

ALPHA = 0.4
PREFERENCE_BOOST = 1.5


@app.on_event("startup")
async def startup_event():
    await init_db()
    from app.services.tripmates.tripmates_service import ensure_trip_members_indexes
    await ensure_trip_members_indexes()
    from app.services.shared_budget.shared_budget_service import ensure_shared_budget_indexes
    await ensure_shared_budget_indexes()


@app.on_event("shutdown")
async def shutdown_event():
    await close_db()


def _fetch_osrm_route(points, profile="driving", timeout_sec=8.0):
    coords = ";".join([f"{float(p['lon'])},{float(p['lat'])}" for p in points])
    url = f"https://router.project-osrm.org/route/v1/{profile}/{coords}"
    params = {"overview": "false", "steps": "false", "annotations": "false"}
    response = requests.get(url, params=params, timeout=timeout_sec)
    response.raise_for_status()
    data = response.json()
    route = (data.get("routes") or [None])[0] or {}
    legs = route.get("legs") or []
    distance_m = float(route.get("distance") or 0.0)
    duration_s = float(route.get("duration") or 0.0)
    return {
        "distance_km": distance_m / 1000.0,
        "duration_hours": duration_s / 3600.0,
        "legs": legs,
    }


# ==================== AUTH MODELS ====================
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LogoutRequest(BaseModel):
    token: str


class GoogleAuthRequest(BaseModel):
    access_token: Optional[str] = None
    id_token: Optional[str] = None


class TripUpsertRequest(BaseModel):
    trip: Dict[str, Any]


class ProfileUpdateRequest(BaseModel):
    name: str
    username: str
    email: str
    profileImage: Optional[str] = None
    bio: Optional[str] = None


class DeleteAccountRequest(BaseModel):
    reason: Optional[str] = None


class ShareTokenRequest(BaseModel):
    permission: Optional[str] = "view"


class UpdateStatusRequest(BaseModel):
    status: str


class UpdateRoleRequest(BaseModel):
    role: str



def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return authorization.strip() or None


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")
    result = await verify_session(token)
    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=result["error"])
    return result


async def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[Dict[str, Any]]:
    token = _extract_token(authorization)
    if not token:
        return None
    result = await verify_session(token)
    if result.get("success"):
        return result
    return None


async def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _build_auth_user_payload(auth_result: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    payload = {
        "id": user_id,
        "username": auth_result["username"],
        "email": auth_result["email"],
        "role": auth_result.get("role", "user"),
    }
    if auth_result.get("name"):
        payload["name"] = auth_result.get("name")
    if auth_result.get("provider"):
        payload["provider"] = auth_result.get("provider")
    if auth_result.get("profileImage"):
        payload["profileImage"] = auth_result.get("profileImage")
    if auth_result.get("googleId"):
        payload["googleId"] = auth_result.get("googleId")
    payload["bio"] = auth_result.get("bio") or ""
    return payload


def _resolve_google_id_token(id_token: str) -> Dict[str, Any]:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google login is not configured on the backend")

    try:
        token_info_response = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Unable to verify Google ID token: {exc}") from exc

    if not token_info_response.ok:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    token_info = token_info_response.json()
    audience = token_info.get("aud")
    allowed_audiences = {
        GOOGLE_CLIENT_ID,
        "936993641755-tmcle1vo27naa7a81odnt0pet4qv24kapps.googleusercontent.com",
    }
    if audience not in allowed_audiences:
        raise HTTPException(status_code=401, detail=f"Google ID token audience mismatch: {audience}")

    if not token_info.get("email") or not token_info.get("sub"):
        raise HTTPException(status_code=401, detail="Google ID token is missing required fields")

    email_verified = token_info.get("email_verified")
    if str(email_verified).lower() != "true" and email_verified is not True:
        raise HTTPException(status_code=401, detail="Google email is not verified")

    return {
        "google_id": token_info["sub"],
        "email": token_info["email"],
        "name": token_info.get("name") or token_info["email"].split("@")[0],
        "profile_image": token_info.get("picture"),
    }


def _resolve_google_profile(access_token: str) -> Dict[str, Any]:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google login is not configured on the backend")

    try:
        token_info_response = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": access_token},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Unable to verify Google token: {exc}") from exc

    if not token_info_response.ok:
        raise HTTPException(status_code=401, detail="Invalid Google access token")

    token_info = token_info_response.json()
    audience = token_info.get("aud") or token_info.get("issued_to")
    if audience != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")

    granted_scope = token_info.get("scope", "")
    if "userinfo.email" not in granted_scope or "userinfo.profile" not in granted_scope:
        raise HTTPException(status_code=401, detail="Google token is missing required scopes")

    try:
        user_info_response = requests.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Unable to load Google user profile: {exc}") from exc

    if not user_info_response.ok:
        raise HTTPException(status_code=401, detail="Unable to read Google profile")

    user_info = user_info_response.json()
    if not user_info.get("email") or not user_info.get("sub"):
        raise HTTPException(status_code=401, detail="Google profile is missing required fields")
    if str(user_info.get("email_verified", "false")).lower() != "true":
        raise HTTPException(status_code=401, detail="Google email is not verified")

    return {
        "google_id": user_info["sub"],
        "email": user_info["email"],
        "name": user_info.get("name") or user_info["email"].split("@")[0],
        "profile_image": user_info.get("picture"),
    }


# ==================== AUTH ENDPOINTS ====================
@app.post("/auth/register")
@app.post("/api/auth/register")
async def register(request: RegisterRequest):
    """Register a new user"""
    if not request.username or not request.email or not request.password:
        return {"success": False, "error": "Missing required fields"}
    
    result = await create_user(request.username, request.email, request.password)
    
    if result["success"]:
        return {
            "success": True,
            "message": "User registered successfully",
            "user_id": result["user_id"],
            "username": result["username"]
        }
    else:
        raise HTTPException(status_code=400, detail=result["error"])

@app.post("/auth/login")
@app.post("/api/auth/login")
async def login(request: LoginRequest):
    """Login user and return session token"""
    auth_result = await authenticate_user(request.username, request.password)
    
    if not auth_result["success"]:
        raise HTTPException(status_code=401, detail=auth_result["error"])
    
    user_id = auth_result["user_id"]
    
    # Check if user is suspended
    user_status = "active"
    from app import auth_db
    if auth_db.use_demo_fallback:
        user = auth_db._get_fallback_user_by_id(user_id)
        if user:
            user_status = user.get("status") or "active"
    else:
        from bson import ObjectId
        try:
            user = await auth_db.users_collection.find_one({"_id": ObjectId(user_id)})
            if user:
                user_status = user.get("status") or "active"
        except Exception:
            pass

    if user_status == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended.")

    session_result = await create_session(user_id)
    
    if session_result["success"]:
        return {
            "success": True,
            "message": "Login successful",
            "token": session_result["token"],
            "user": _build_auth_user_payload(auth_result, user_id),
            "expires_at": session_result["expires_at"]
        }
    else:
        raise HTTPException(status_code=500, detail=session_result["error"])


@app.post("/auth/google")
@app.post("/api/auth/google")
async def google_login(request: GoogleAuthRequest):
    """Authenticate a user with Google and return the existing session payload shape."""
    if not request.access_token and not request.id_token:
        raise HTTPException(status_code=400, detail="Missing Google access token")

    if request.id_token:
        google_profile = _resolve_google_id_token(request.id_token)
    else:
        google_profile = _resolve_google_profile(request.access_token)
    auth_result = await authenticate_or_create_google_user(
        email=google_profile["email"],
        name=google_profile["name"],
        google_id=google_profile["google_id"],
        profile_image=google_profile.get("profile_image"),
    )

    if not auth_result["success"]:
        raise HTTPException(status_code=400, detail=auth_result["error"])

    user_id = auth_result["user_id"]

    # Check if user is suspended
    user_status = "active"
    from app import auth_db
    if auth_db.use_demo_fallback:
        user = auth_db._get_fallback_user_by_id(user_id)
        if user:
            user_status = user.get("status") or "active"
    else:
        from bson import ObjectId
        try:
            user = await auth_db.users_collection.find_one({"_id": ObjectId(user_id)})
            if user:
                user_status = user.get("status") or "active"
        except Exception:
            pass

    if user_status == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended.")

    session_result = await create_session(user_id)

    if session_result["success"]:
        return {
            "success": True,
            "message": "Google login successful",
            "token": session_result["token"],
            "user": _build_auth_user_payload(auth_result, user_id),
            "expires_at": session_result["expires_at"],
        }

    raise HTTPException(status_code=500, detail=session_result["error"])

@app.post("/auth/verify")
@app.post("/api/auth/verify")
async def verify_token(request: LogoutRequest):
    """Verify if session token is valid"""
    result = await verify_session(request.token)
    
    if result["success"]:
        return {
            "success": True,
            "user": _build_auth_user_payload(result, result["user_id"])
        }
    else:
        raise HTTPException(status_code=401, detail=result["error"])

@app.post("/auth/logout")
@app.post("/api/auth/logout")
async def logout(request: LogoutRequest):
    """Logout user by invalidating session token"""
    result = await logout_session(request.token)
    
    if result["success"]:
        return {"success": True, "message": "Logged out successfully"}
    else:
        raise HTTPException(status_code=500, detail=result["error"])


@app.put("/account/profile")
async def update_profile(request: ProfileUpdateRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    result = await update_user_profile(
        current_user["user_id"],
        name=request.name,
        username=request.username,
        email=request.email,
        profile_image=request.profileImage,
        bio=request.bio,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "user": result["user"]}


@app.get("/api/users/search")
@app.get("/users/search")
async def search_users(q: str = ""):
    results = await search_public_users(q, limit=8)
    return {"success": True, "users": results}


@app.get("/api/users/by-username/{username}")
@app.get("/users/by-username/{username}")
async def get_user_by_username(username: str):
    user = await get_public_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user": user}


@app.get("/api/users/{username}/public-trips")
@app.get("/users/{username}/public-trips")
async def get_user_public_trips(username: str):
    result = await list_public_trips_by_username(username)
    if result is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "success": True,
        "username": result["user"]["username"],
        "user": result["user"],
        "trips": result["trips"],
    }


@app.get("/api/trips/public/{trip_id}")
@app.get("/trips/public/{trip_id}")
async def get_public_trip(trip_id: str):
    result = await get_public_trip_by_id(trip_id)
    if not result or not result.get("success"):
        raise HTTPException(status_code=404, detail="Public trip not found")
    return {
        "success": True,
        "trip": result["trip"],
    }


@app.post("/api/users/{username}/follow")
@app.post("/users/{username}/follow")
async def follow_user_endpoint(username: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    result = await follow_user(current_user["user_id"], username)
    if not result.get("success"):
        raise HTTPException(
            status_code=result.get("status_code", 400),
            detail=result.get("error", "Failed to follow user"),
        )
    return result


@app.delete("/api/users/{username}/follow")
@app.delete("/users/{username}/follow")
async def unfollow_user_endpoint(username: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    result = await unfollow_user(current_user["user_id"], username)
    if not result.get("success"):
        raise HTTPException(
            status_code=result.get("status_code", 400),
            detail=result.get("error", "Failed to unfollow user"),
        )
    return result


@app.get("/api/users/{username}/follow-status")
@app.get("/users/{username}/follow-status")
async def get_follow_status_endpoint(username: str, optional_user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    viewer_id = optional_user["user_id"] if optional_user else None
    stats = await get_user_follow_stats(username, viewer_user_id=viewer_id)
    if stats is None:
        raise HTTPException(status_code=404, detail="User not found")
    return stats


@app.get("/api/notifications")
@app.get("/notifications")
async def get_notifications_endpoint(
    limit: int = 30,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    result = await list_notifications_for_user(current_user["user_id"], limit=limit)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to retrieve notifications"))
    return result


@app.patch("/api/notifications/{notification_id}/read")
@app.patch("/notifications/{notification_id}/read")
async def mark_notification_read_endpoint(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    result = await mark_notification_as_read(current_user["user_id"], notification_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to mark notification as read"))
    return result


@app.post("/api/notifications/read-all")
@app.post("/notifications/read-all")
async def mark_all_notifications_read_endpoint(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    result = await mark_all_notifications_as_read(current_user["user_id"])
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to mark notifications as read"))
    return result




@app.delete("/account")
async def delete_account(request: Optional[DeleteAccountRequest] = None, current_user: Dict[str, Any] = Depends(get_current_user)):
    result = await delete_user_account(current_user["user_id"])
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "message": "Account deleted successfully"}


@app.get("/trips")
async def list_trips(current_user: Dict[str, Any] = Depends(get_current_user)):
    trips = await list_trips_for_user(current_user)
    return {"success": True, "trips": trips}


@app.post("/trips")
async def create_trip(request: TripUpsertRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    result = await save_trip_document(current_user["user_id"], request.trip)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return {"success": True, "trip": result["trip"]}


@app.put("/trips/{trip_id}")
async def update_trip(trip_id: str, request: TripUpsertRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    payload = dict(request.trip or {})
    payload["id"] = payload.get("id", trip_id)
    result = await save_trip_document(current_user["user_id"], payload)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return {"success": True, "trip": result["trip"]}


@app.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    deleted = await delete_trip_for_user(current_user, trip_id)
    if not deleted:
        try:
            deleted = await delete_trip_for_user(current_user, int(trip_id))
        except ValueError:
            deleted = False
    if not deleted:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"success": True}



@app.post("/trips/{trip_id}/share-token")
async def get_or_create_trip_share_token(
    trip_id: str,
    payload: Optional[ShareTokenRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    requested_perm = (payload.permission if payload and payload.permission else "view").lower().strip()
    permission = "edit" if requested_perm == "edit" else "view"
    result = await generate_or_get_trip_share_token(current_user["user_id"], trip_id, permission=permission)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Trip not found"))
    response: Dict[str, Any] = {
        "success": True,
        "shareToken": result["shareToken"],
        "permission": permission,
    }
    if permission == "edit":
        response["editShareToken"] = result["shareToken"]
    return response


@app.get("/trips/shared/{share_token}")
async def get_shared_trip(share_token: str):
    result = await get_shared_trip_by_token(share_token)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Shared trip not found"))
    return {
        "success": True,
        "trip": result["trip"],
        "owner": result.get("owner"),
        "permission": "view",
    }


@app.get("/trips/shared/edit/{edit_share_token}")
async def get_shared_edit_trip(edit_share_token: str):
    result = await get_shared_edit_trip_by_token(edit_share_token)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Shared edit trip not found"))
    return {
        "success": True,
        "trip": result["trip"],
        "owner": result.get("owner"),
        "permission": "edit",
    }


@app.post("/trips/shared/edit/{edit_share_token}/copy")
async def copy_shared_edit_trip(
    edit_share_token: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    result = await create_or_get_shared_edit_copy(current_user["user_id"], edit_share_token)
    if not result["success"]:
        status_code = result.get("status_code", 404)
        raise HTTPException(status_code=status_code, detail=result.get("error", "Failed to copy shared edit trip"))
    return {
        "success": True,
        "trip": result["trip"],
        "isExistingCopy": result.get("isExistingCopy", False),
    }


@app.get("/admin/trips")
async def admin_list_trips(search: Optional[str] = None, _: Dict[str, Any] = Depends(require_admin)):
    try:
        trips = await get_admin_trips_raw(search=search)
        return {"success": True, "trips": trips}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/trips/{trip_id}")
async def admin_delete_trip(trip_id: str, admin: Dict[str, Any] = Depends(require_admin)):
    try:
        deleted = await delete_trip_for_user(admin, trip_id)
        if not deleted:
            try:
                deleted = await delete_trip_for_user(admin, int(trip_id))
            except ValueError:
                deleted = False
        if not deleted:
            raise HTTPException(status_code=404, detail="Trip not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/overview")
async def admin_overview(_: Dict[str, Any] = Depends(require_admin)):
    # TODO: Expand this route through the admin service layer as future modules land.
    data = await get_admin_overview_summary()
    return {"success": True, **data}


@app.get("/admin/users")
async def admin_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    provider: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    _: Dict[str, Any] = Depends(require_admin),
):
    try:
        result = await get_admin_users(
            search=search,
            role=role,
            status=status,
            provider=provider,
            page=page,
            limit=limit,
        )
        return {"success": True, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/admin/users/{user_id}")
async def admin_user_details(
    user_id: str,
    _: Dict[str, Any] = Depends(require_admin),
):
    try:
        user_details = await get_admin_user_details(user_id)
        return {"success": True, "user": user_details}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.patch("/admin/users/{user_id}/status")
async def admin_update_user_status(
    user_id: str,
    payload: UpdateStatusRequest,
    admin_user: Dict[str, Any] = Depends(require_admin),
):
    try:
        updated = await update_user_status(user_id, payload.status, admin_user)
        return {"success": True, "user": updated}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.patch("/admin/users/{user_id}/role")
async def admin_update_user_role(
    user_id: str,
    payload: UpdateRoleRequest,
    admin_user: Dict[str, Any] = Depends(require_admin),
):
    try:
        updated = await update_user_role(user_id, payload.role, admin_user)
        return {"success": True, "user": updated}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin_user: Dict[str, Any] = Depends(require_admin),
):
    try:
        await delete_user_by_admin(user_id, admin_user)
        return {"success": True}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/history")
async def get_history(current_user: Dict[str, Any] = Depends(get_current_user), limit: int = 100):
    activities = await get_user_activity(current_user["user_id"], limit=limit)
    return {"success": True, "activities": activities}



@app.get("/")
def root():
    from app import auth_db
    return {
        "message": "Travel Intelligence Backend Running",
        "live_mode": not auth_db.use_demo_fallback,
        "database": auth_db.mongo_db.name if auth_db.mongo_db is not None else None,
        "fallback_active": auth_db.use_demo_fallback,
    }

@app.get("/refresh-data")
def refresh_data(lat: float, lon: float, province: str = "Unknown"):
    """
    Optional endpoint to manually trigger a data fetch from OpenTripMap
    and append to the local dynamic dataset.
    """
    print("\nEndpoint hit")
    print(f"Params: lat={lat}, lon={lon}, province={province}")
    
    try:
        new_count = update_dynamic_dataset(lat, lon, province)
        
        global locations_data
        locations_data = load_locations_from_csv(use_live_data=True)
        
        return {
            "status": "success",
            "places_fetched": new_count,
            "file_saved": True
        }
    except Exception as e:
        error_msg = str(e)
        print(f"Error: {error_msg}")
        
        return {
            "status": "error",
            "message": error_msg,
            "places_fetched": 0,
            "file_saved": False
        }

@app.get("/provinces")
def provinces():
    vals = sorted({(loc.get("province") or "").strip() for loc in locations_data if loc.get("province")})
    return {"provinces": vals}

@app.get("/cities")
def cities(province: str):
    p = province.strip().lower()
    items = [
        loc for loc in locations_data
        if (loc.get("province") or "").strip().lower() == p
    ]
    cities = sorted({
        (loc.get("city") or "").strip()
        for loc in items
        if loc.get("city")
    })
    return {"province": province, "cities": cities}

@app.get("/locations")
def locations(city: str):
    c = city.strip().lower()
    items = [
        loc for loc in locations_data
        if (loc.get("city") or "").strip().lower() == c
    ]
    names = sorted({
        (loc.get("name") or "").strip()
        for loc in items
        if loc.get("name")
    })
    return {"city": city, "locations": names}

@app.get("/api/locations/search")
@app.get("/locations/search")
async def search_locations_api(
    query: str = "",
    province: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 25,
):
    """
    Nationwide Pakistan Location Discovery & Search.
    Supported by MongoDB Atlas, in-memory 44,989 POIs, and OpenStreetMap Nominatim.
    """
    return await search_locations_nationwide(
        query=query,
        province=province,
        category=category,
        limit=limit,
        locations_fallback=locations_data,
    )


@app.get("/api/locations/bounds")
@app.get("/locations/bounds")
async def search_locations_bounds_api(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    category: Optional[str] = None,
    limit: int = 50,
):
    """
    Map Viewport Bounding-Box Location Discovery.
    Finds all attractions, hotels, viewpoints, and places inside the visible map area.
    """
    return await search_locations_in_bounds(
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        category=category,
        limit=limit,
        locations_fallback=locations_data,
    )


@app.get("/api/locations/nearby")
@app.get("/locations/nearby")
async def search_locations_nearby_api(
    lat: float,
    lon: float,
    radius_km: float = 30.0,
    category: Optional[str] = None,
    limit: int = 30,
):
    """
    Radial Nearby Location Discovery around user GPS or destination.
    Returns places sorted by distance in km from given coordinates.
    """
    return await search_locations_nearby(
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        category=category,
        limit=limit,
        locations_fallback=locations_data,
    )

@app.get("/api/hotels/search")
@app.get("/hotels/search")
def search_hotels(
    query: str = "",
    province: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: float = 50.0,
    limit: int = 25,
):
    """
    Search hotels, resorts, lodges, and guest houses across Pakistan.
    Filters from the 44,989 master database by keyword, province, or GPS coordinates.
    """
    clean_q = (query or "").strip().lower()
    prov_filter = (province or "").strip().lower() if province else None
    max_results = min(max(1, limit), 60)

    hotel_keywords = [
        "hotel", "resort", "motel", "lodge", "guest house", "guesthouse",
        "inn", "palace hotel", "serena", "marriott", "pc hotel", "pearl continental"
    ]

    results = []
    seen = set()

    for idx, loc in enumerate(locations_data):
        name = (loc.get("name") or "").strip()
        cat = (loc.get("category") or "").strip().lower()
        name_lower = name.lower()

        is_hotel = any(hk in name_lower for hk in hotel_keywords) or any(hk in cat for hk in ["hotel", "resort", "lodging"])
        if not is_hotel:
            continue

        p_val = (loc.get("province") or "").strip()
        if prov_filter and prov_filter != "all":
            if prov_filter not in p_val.lower():
                continue

        unique_key = f"{name_lower}::{p_val.lower()}"
        if unique_key in seen:
            continue

        loc_lat = loc.get("lat")
        loc_lon = loc.get("lon")

        if lat is not None and lon is not None and loc_lat is not None and loc_lon is not None:
            d_km = haversine(lat, lon, float(loc_lat), float(loc_lon))
            if d_km > radius_km:
                continue

        matched = False
        if not clean_q or clean_q in name_lower or clean_q in p_val.lower() or (loc.get("city") and clean_q in str(loc["city"]).lower()):
            matched = True

        if matched:
            seen.add(unique_key)
            results.append({
                "id": loc.get("poi_id") or f"hotel_{idx}",
                "name": name,
                "city": loc.get("city") or "",
                "province": p_val,
                "category": loc.get("category") or "Hotel",
                "lat": loc_lat,
                "lon": loc_lon,
                "rating": float(loc.get("rating") or 4.5),
                "popularity_score": float(loc.get("popularity_score") or 0.8),
            })
            if len(results) >= max_results:
                break

    return {
        "success": True,
        "query": query,
        "province": province,
        "total": len(results),
        "hotels": results,
    }


@app.get("/weather")
def get_weather(lat: float, lon: float, units: str = "metric"):
    return fetch_current_weather(lat=lat, lon=lon, units=units)


@app.get("/api/explore/places")
def explore_places(lat: float, lon: float, query: str = "tourist attractions"):
    return fetch_explore_places(lat=lat, lon=lon, query=query)


@app.get("/api/explore/place-details")
def explore_place_details(place_id: Optional[str] = None, data_id: Optional[str] = None):
    return fetch_place_details(place_id=place_id, data_id=data_id)


@app.get("/api/explore/place-photos")
def explore_place_photos(data_id: str):
    return fetch_place_photos(data_id=data_id)





@app.post("/v1/sequence/day")
@app.post("/sequence/day")
def sequence_day(request: SequenceDayRequest) -> SequenceDayResponse:
    def build_place_legs(ordered_locs, speed_kmh):
        safe_speed = float(speed_kmh) if float(speed_kmh) > 0 else 30.0
        legs = []
        total_distance = 0.0
        for idx in range(1, len(ordered_locs)):
            prev_loc = ordered_locs[idx - 1]
            next_loc = ordered_locs[idx]
            distance_km = haversine(
                float(prev_loc["lat"]),
                float(prev_loc["lon"]),
                float(next_loc["lat"]),
                float(next_loc["lon"]),
            )
            total_distance += distance_km
            travel_hours = distance_km / safe_speed
            legs.append(
                {
                    "fromPlaceId": str(prev_loc["id"]),
                    "toPlaceId": str(next_loc["id"]),
                    "fromName": prev_loc.get("name"),
                    "toName": next_loc.get("name"),
                    "distanceKm": float(round(distance_km, 4)),
                    "estimatedTravelTimeHours": float(round(travel_hours, 4)),
                    "estimatedTravelTimeMin": max(1, int(round(travel_hours * 60))),
                }
            )
        return legs, total_distance

    def same_point(lat_a, lon_a, lat_b, lon_b, tolerance=1e-9):
        return abs(float(lat_a) - float(lat_b)) <= tolerance and abs(float(lon_a) - float(lon_b)) <= tolerance

    day_id = request.dayId
    locations = request.locations or []
    if len(locations) < 2:
        return SequenceDayResponse(
            dayId=day_id,
            order=None,
            metrics=None,
            algorithm=None,
            warnings=["NOT_ENOUGH_POINTS"],
            errors=["Need at least 2 locations"],
        )

    options = request.options
    speed_kmh = float(getattr(options, "speedKmh", 30.0) or 30.0)
    if speed_kmh <= 0:
        speed_kmh = 30.0
    road_aware = bool(getattr(options, "roadAware", False)) if options is not None else False

    start_lat = None
    start_lon = None
    if request.start is not None:
        start_lat = float(request.start.lat)
        start_lon = float(request.start.lon)
    if start_lat is None or start_lon is None:
        start_lat = float(locations[0].lat)
        start_lon = float(locations[0].lon)

    locs = [{"id": l.id, "name": l.name, "lat": float(l.lat), "lon": float(l.lon)} for l in locations]
    return_to_start = bool(getattr(options, "returnToStart", False)) if options is not None else False
    before_legs, before_distance_places_km = build_place_legs(locs, speed_kmh)

    route_indices, total_distance_km, _ = solve_tsp(
        locs,
        start_lat=start_lat,
        start_lon=start_lon,
        return_to_start=return_to_start,
        speed_kmh=speed_kmh,
    )
    ordered_locs = [locs[i] for i in route_indices]
    order = [loc["id"] for loc in ordered_locs]
    after_legs, after_distance_places_km = build_place_legs(ordered_locs, speed_kmh)
    estimated_hours = float(after_distance_places_km) / float(speed_kmh)
    before_estimated_hours = float(before_distance_places_km) / float(speed_kmh)
    distance_saved_km = float(before_distance_places_km) - float(after_distance_places_km)
    time_saved_hours = float(before_estimated_hours) - float(estimated_hours)
    warnings = []
    first_stop = ordered_locs[0] if ordered_locs else None
    has_external_start_anchor = bool(
        first_stop
        and not same_point(start_lat, start_lon, first_stop["lat"], first_stop["lon"])
    )
    if has_external_start_anchor or return_to_start:
        warnings.append("METRICS_MATCH_PLACE_TO_PLACE_LEGS_ONLY")

    road_used = False
    if road_aware and len(ordered_locs) >= 2:
        try:
            road_before = _fetch_osrm_route(locs)
            road_after = _fetch_osrm_route(ordered_locs)
            if road_after.get("legs") and len(road_after["legs"]) == max(0, len(ordered_locs) - 1):
                road_used = True
                osrm_legs = road_after["legs"]
                after_legs = []
                for idx in range(1, len(ordered_locs)):
                    prev_loc = ordered_locs[idx - 1]
                    next_loc = ordered_locs[idx]
                    leg = osrm_legs[idx - 1] if idx - 1 < len(osrm_legs) else {}
                    distance_km = float(leg.get("distance") or 0.0) / 1000.0
                    duration_s = float(leg.get("duration") or 0.0)
                    travel_hours = duration_s / 3600.0
                    after_legs.append(
                        {
                            "fromPlaceId": str(prev_loc["id"]),
                            "toPlaceId": str(next_loc["id"]),
                            "fromName": prev_loc.get("name"),
                            "toName": next_loc.get("name"),
                            "distanceKm": float(round(distance_km, 4)),
                            "estimatedTravelTimeHours": float(round(travel_hours, 4)),
                            "estimatedTravelTimeMin": max(1, int(round(travel_hours * 60))),
                        }
                    )
                before_distance_places_km = float(road_before.get("distance_km") or before_distance_places_km)
                after_distance_places_km = float(road_after.get("distance_km") or after_distance_places_km)
                before_estimated_hours = float(road_before.get("duration_hours") or before_estimated_hours)
                estimated_hours = float(road_after.get("duration_hours") or estimated_hours)
                distance_saved_km = float(before_distance_places_km) - float(after_distance_places_km)
                time_saved_hours = float(before_estimated_hours) - float(estimated_hours)
                warnings.append("METRICS_FROM_OSRM_ROUTE")
        except Exception:
            warnings.append("OSRM_UNAVAILABLE")

    return SequenceDayResponse(
        dayId=day_id,
        order=order,
        metrics={
            "beforeDistanceKm": float(round(before_distance_places_km, 4)),
            "totalDistanceKm": float(round(after_distance_places_km, 4)),
            "distanceSavedKm": float(round(distance_saved_km, 4)),
            "beforeTravelTimeHours": float(round(before_estimated_hours, 4)),
            "estimatedTravelTimeHours": float(round(estimated_hours, 4)),
            "travelTimeSavedHours": float(round(time_saved_hours, 4)),
            "speedKmhUsed": float(speed_kmh),
        },
        legs=after_legs,
        algorithm={"name": "nearest_neighbor_2opt", "fallbackUsed": False},
        truth={
            "source": "backend_sequencing_osrm" if road_used else "backend_sequencing",
            "distanceModel": "osrm_road_distance" if road_used else "haversine_straight_line",
            "timeModel": "osrm_route_duration" if road_used else "fixed_speed_estimate",
            "roadAware": bool(road_used),
        },
        warnings=warnings,
        errors=[],
    )


@app.post("/optimize")
def optimize(request: OptimizeRequest):
    max_budget = request.max_budget
    province = request.province
    start_lat = request.start_lat
    start_lon = request.start_lon
    max_travel_hours = request.max_travel_hours
    preferred_categories = request.preferred_categories
    score_weight = request.score_weight
    time_weight = request.time_weight
    cost_weight = request.cost_weight
    use_live_data = request.use_live_data
    avoid_crowds = getattr(request, "avoid_crowds", False)
    
    # Questionnaire fields
    budget_level = request.budget_level
    travel_style = request.travel_style
    personality = request.personality
    environment = request.environment
    crowd_preference = request.crowd_preference

    print("\n--- OPTIMIZE DEBUG ---")
    print(f"Questionnaire: budget={budget_level}, style={travel_style}, env={environment}")
    print("Context: system previously worked with ~50-70 locations; now master dataset has ~500+.")
    print("Reason it broke with large dataset:")
    print("- More candidates within budget (many cost=0/low) -> greedy selection adds many places")
    print("- Selection stage historically ignored max_travel_hours -> visit_time accumulates linearly with count")
    print("- Routing happens after selection; if selection already too big, routing can't rescue time feasibility")
    print("- Dataset expansion increases spatial spread and number of low-cost items, amplifying the issue")

    # Always ensure we have the right dataset loaded based on the flag
    global locations_data
    locations_data = load_master_dataset()
    print("Loaded locations:", len(locations_data))

    # 1️⃣ Province filter
    filtered_locations = [
        loc for loc in locations_data
        if loc.get("province", "").strip().lower() == province.strip().lower()
    ]
    print("After province filter:", len(filtered_locations), "| province=", province)

    if not filtered_locations:
        return {"error": "No locations found in selected province"}

    working_locations = deepcopy([loc for loc in filtered_locations if (loc.get("cost", 0) <= max_budget)])
    print("After budget filter (cost <= max_budget):", len(working_locations), "| max_budget=", max_budget)

    normalized_preferences = [
        cat.strip().lower() for cat in preferred_categories
    ] if preferred_categories else []
    print("Preferred categories:", normalized_preferences)

    if max_travel_hours <= 6:
        max_locations = 3
    elif max_travel_hours <= 12:
        max_locations = 5
    elif max_travel_hours <= 24:
        max_locations = 8
    else:
        max_locations = 8
    print("Max locations cap based on max_travel_hours:", max_locations, "| max_travel_hours=", max_travel_hours)

    working_locations, score_diagnostics = score_and_rank_candidates(
        locations=working_locations,
        start_lat=start_lat,
        start_lon=start_lon,
        max_budget=max_budget,
        max_distance_km=FAR_THRESHOLD_KM,
        preferred_categories=normalized_preferences,
        travel_style=travel_style,
        environment=environment,
        crowd_preference=crowd_preference,
        avoid_crowds=avoid_crowds,
    )
    print("After distance filter (<= 50 km):", len(working_locations), "| removed_due_to_distance=", score_diagnostics["removed_due_to_distance"])
    if avoid_crowds:
        print("Removed due to crowd filter:", score_diagnostics["removed_due_to_crowd"])

    category_matches = [
        loc for loc in working_locations
        if (loc.get("score_components", {}).get("preference_match") == 1)
    ]
    print("After preference-match filter (preference_match==1):", len(category_matches))

    clusters_generated = 0
    selected_cluster_index = None
    selected_cluster_size = None
    selected_cluster_centroid = None
    if len(working_locations) >= 25:
        labels, centroids = cluster_locations(working_locations, max_clusters=3)
        clusters_generated = len(centroids) if centroids else 0
        if centroids and labels:
            try:
                selected_cluster_index = min(range(len(centroids)), key=lambda j: haversine(start_lat, start_lon, centroids[j][0], centroids[j][1]))
                clustered = [loc for loc, l in zip(working_locations, labels) if l == selected_cluster_index]
                if clustered:
                    working_locations = clustered
                    selected_cluster_size = len(clustered)
                    selected_cluster_centroid = [centroids[selected_cluster_index][0], centroids[selected_cluster_index][1]]
            except Exception:
                pass
    print("Clustering:", {"clusters_generated": clusters_generated, "selected_cluster_index": selected_cluster_index, "cluster_size": selected_cluster_size})

    # 3️⃣ Time-aware, distance-aware, budget-aware selection (score-desc)
    fallback_limit = min(2, max(1, int(round(max_locations * 0.2))))
    selected_locations, selection_debug = select_locations_time_aware(
        locations=working_locations,
        max_budget=max_budget,
        start_lat=start_lat,
        start_lon=start_lon,
        max_travel_hours=max_travel_hours,
        max_locations=max_locations,
        preferred_categories=normalized_preferences,
        fallback_limit=fallback_limit,
    )
    print("Selection debug (first 30):")
    for line in selection_debug[:30]:
        print("-", line)
    if len(selection_debug) > 30:
        print(f"... ({len(selection_debug) - 30} more)")
    print("Selected locations BEFORE routing:", len(selected_locations))
    if selected_locations:
        match_count = sum(1 for l in selected_locations if any((p in (l.get('category','').lower())) for p in normalized_preferences)) if normalized_preferences else len(selected_locations)
        print("Preference match count in selected:", match_count, "/", len(selected_locations))
        dist = {}
        for l in selected_locations:
            c = (l.get("category") or "").strip().lower()
            dist[c] = dist.get(c, 0) + 1
        print("Final category distribution:", dist)

    if len(selected_locations) < 1:
        return {"error": "Not enough locations within budget constraints"}

    # 4️⃣ Route optimization
    order, total_distance_km, travel_time_hours = solve_tsp(
        selected_locations,
        start_lat=start_lat,
        start_lon=start_lon,
        return_to_start=True
    )

    # 5️⃣ Visit time integration
    visit_time_hours = sum(
        loc.get("visit_duration", 1.5)
        for loc in selected_locations
    )

    total_time_hours = travel_time_hours + visit_time_hours
    print("Times AFTER routing:", {"travel_time_hours": round(travel_time_hours, 2), "visit_time_hours": round(visit_time_hours, 2), "total_time_hours": round(total_time_hours, 2)})

    # 6️⃣ Final hard time validation
    if total_time_hours > max_travel_hours:
        print("FAIL REASON: selected itinerary violates max_travel_hours after routing")
        print("Details:", {"selected_count": len(selected_locations), "travel_time_hours": round(travel_time_hours, 2), "visit_time_hours": round(visit_time_hours, 2), "total_time_hours": round(total_time_hours, 2), "max_allowed_hours": max_travel_hours})
        return {
            "error": "Travel time exceeds maximum allowed hours after routing",
            "travel_time_hours": round(travel_time_hours, 2),
            "visit_time_hours": round(visit_time_hours, 2),
            "total_time_hours": round(total_time_hours, 2),
            "max_allowed_hours": max_travel_hours
        }

    # 7️⃣ Explanation aligned with route
    explanation = []

    for idx in order:
        loc = selected_locations[idx]

        distance_from_start = haversine(
            start_lat,
            start_lon,
            loc["lat"],
            loc["lon"]
        )

        explanation.append({
            "name": loc["name"],
            "original_score": loc.get("original_score", 0),
            "boosted_score": loc.get("boosted_score", 0),
            "cost": loc.get("cost", 0),
            "visit_duration_hours": loc.get("visit_duration", 1.5),
            "distance_from_start_km": round(distance_from_start, 2)
        })
        comps = loc.get("score_components", {})
        print(f"{loc.get('name')}: score = "
              f"{comps.get('preference_match',0)*5:.2f} (preference) + "
              f"{comps.get('importance_level',0)*3:.2f} (importance) + "
              f"{comps.get('rating',0)*2:.2f} (rating) + "
              f"{comps.get('popularity_score',0)*1.5:.2f} (popularity) - "
              f"{comps.get('distance_penalty',0):.2f} (distance) - "
              f"{comps.get('cost_penalty',0):.2f} (cost) = "
              f"{loc.get('score',0):.2f}")

    optimized_route = [{
        "name": selected_locations[i].get("name"),
        "lat": selected_locations[i].get("lat"),
        "lon": selected_locations[i].get("lon"),
        "category": selected_locations[i].get("category"),
        "visit_duration": selected_locations[i].get("visit_duration", 1.5),
        "why_selected": selected_locations[i].get("why_selected", [])
    } for i in order]

    total_score = sum(loc.get("boosted_score", 0) for loc in selected_locations)
    total_cost = sum(loc.get("cost", 0) for loc in selected_locations)

    utility = (
        score_weight * total_score
        - time_weight * total_time_hours
        - cost_weight * total_cost
    )

    route_coordinates = [[start_lat, start_lon]] + [
        [stop.get("lat"), stop.get("lon")] for stop in optimized_route
    ]

    response = {
        "optimized_route": optimized_route,
        "route_coordinates": route_coordinates,
        "province": province,
        "start_location": {
            "lat": start_lat,
            "lon": start_lon
        },
        "preferred_categories": preferred_categories,
        "constraints_used": {
            "max_budget": max_budget,
            "max_travel_hours": max_travel_hours
        },
        "clustering_info": {
            "clusters_generated": clusters_generated,
            "selected_cluster_index": selected_cluster_index,
            "cluster_size": selected_cluster_size,
            "cluster_centroid": selected_cluster_centroid
        },
        "total_locations_selected": len(selected_locations),
        "budget_used": total_cost,
        "total_score": total_score,
        "total_distance_km": round(total_distance_km, 2),
        "travel_time_hours": round(travel_time_hours, 2),
        "visit_time_hours": round(visit_time_hours, 2),
        "total_time_hours": round(total_time_hours, 2),
        "utility_score": round(utility, 2),
        "selection_explanation": explanation
    }

    itinerary = generate_itinerary(optimized_route, start_lat=start_lat, start_lon=start_lon, start_time="09:00", avg_speed_kmh=40.0)
    response["itinerary"] = itinerary
    return response

