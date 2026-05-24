from fastapi import FastAPI, HTTPException
from typing import List
from copy import deepcopy
from pydantic import BaseModel
from app.data_loader import load_locations_from_csv, load_master_dataset
from app.constraints import optimize_budget, select_locations_time_aware
from app.optimizer import solve_tsp, haversine
from app.models import OptimizeRequest, SequenceDayRequest, SequenceDayResponse
from app.itinerary import generate_itinerary
from app.clustering import cluster_locations
from app.external_api import update_dynamic_dataset
from app.auth_db import create_user, authenticate_user, create_session, verify_session, logout_session

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

locations_data = load_master_dataset()
FAR_THRESHOLD_KM = 50.0

ALPHA = 0.4
PREFERENCE_BOOST = 1.5


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


# ==================== AUTH ENDPOINTS ====================
@app.post("/auth/register")
def register(request: RegisterRequest):
    """Register a new user"""
    if not request.username or not request.email or not request.password:
        return {"success": False, "error": "Missing required fields"}
    
    result = create_user(request.username, request.email, request.password)
    
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
def login(request: LoginRequest):
    """Login user and return session token"""
    auth_result = authenticate_user(request.username, request.password)
    
    if not auth_result["success"]:
        raise HTTPException(status_code=401, detail=auth_result["error"])
    
    user_id = auth_result["user_id"]
    session_result = create_session(user_id)
    
    if session_result["success"]:
        return {
            "success": True,
            "message": "Login successful",
            "token": session_result["token"],
            "user": {
                "id": user_id,
                "username": auth_result["username"],
                "email": auth_result["email"]
            },
            "expires_at": session_result["expires_at"]
        }
    else:
        raise HTTPException(status_code=500, detail=session_result["error"])

@app.post("/auth/verify")
def verify_token(request: LogoutRequest):
    """Verify if session token is valid"""
    result = verify_session(request.token)
    
    if result["success"]:
        return {
            "success": True,
            "user": {
                "id": result["user_id"],
                "username": result["username"],
                "email": result["email"]
            }
        }
    else:
        raise HTTPException(status_code=401, detail=result["error"])

@app.post("/auth/logout")
def logout(request: LogoutRequest):
    """Logout user by invalidating session token"""
    result = logout_session(request.token)
    
    if result["success"]:
        return {"success": True, "message": "Logged out successfully"}
    else:
        raise HTTPException(status_code=500, detail=result["error"])



@app.get("/")
def root():
    return {"message": "Travel Intelligence Backend Running"}

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


@app.post("/v1/sequence/day")
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
            "source": "backend_sequencing",
            "distanceModel": "haversine_straight_line",
            "timeModel": "fixed_speed_estimate",
            "roadAware": False,
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

    print("\n--- OPTIMIZE DEBUG ---")
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

    def is_crowded(loc_name: str, category: str) -> bool:
        n = (loc_name or "").lower()
        c = (category or "").lower()
        crowded_keywords = ["market", "bazaar", "mall", "stadium", "food street"]
        if any(k in n for k in crowded_keywords):
            return True
        if "urban" in c:
            if any(k in n for k in crowded_keywords):
                return True
        return False

    scored = []
    removed_distance = 0
    removed_crowd = 0
    for loc in working_locations:
        category_value = (loc.get("category") or "").strip().lower()
        distance_km = haversine(start_lat, start_lon, loc["lat"], loc["lon"])
        if distance_km > FAR_THRESHOLD_KM:
            removed_distance += 1
            continue
        if avoid_crowds and is_crowded(loc.get("name"), loc.get("category")):
            removed_crowd += 1
            continue
        preference_match = 0
        if normalized_preferences:
            for pref in normalized_preferences:
                if pref and pref.lower() in category_value:
                    preference_match = 1
                    break
        importance_level = float(loc.get("importance_level", 1))
        rating = float(loc.get("rating", 0))
        popularity = float(loc.get("popularity_score", 0))
        cost_val = float(loc.get("cost", 0))
        distance_penalty = distance_km / 10.0
        cost_penalty = cost_val / 1000.0
        final_score = (preference_match * 5.0) + (importance_level * 3.0) + (rating * 2.0) + (popularity * 1.5) - distance_penalty - cost_penalty
        if normalized_preferences:
            if preference_match == 1:
                final_score *= 1.5
            else:
                final_score *= 0.5
        loc["original_score"] = final_score
        loc["boosted_score"] = final_score
        loc["score"] = final_score
        loc["score_components"] = {
            "preference_match": preference_match,
            "importance_level": importance_level,
            "rating": rating,
            "popularity_score": popularity,
            "distance_penalty": distance_penalty,
            "cost_penalty": cost_penalty,
            "distance_km": distance_km,
            "cost": cost_val
        }
        scored.append(loc)
    working_locations = scored
    print("After distance filter (<= 50 km):", len(working_locations), "| removed_due_to_distance=", removed_distance)
    if avoid_crowds:
        print("Removed due to crowd filter:", removed_crowd)

    category_matches = [
        loc for loc in working_locations
        if (loc.get("score_components", {}).get("preference_match") == 1)
    ]
    print("After preference-match filter (preference_match==1):", len(category_matches))

    labels, centroids = cluster_locations(working_locations, max_clusters=3)
    clusters_generated = len(centroids) if centroids else 0
    selected_cluster_index = None
    selected_cluster_size = None
    selected_cluster_centroid = None
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
