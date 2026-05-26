from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.optimizer import haversine


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def _normalize01(value: float, max_value: float) -> float:
    if max_value <= 0:
        return 0.0
    return max(0.0, min(1.0, value / max_value))


def _infer_budget_level(budget_pkr: float) -> str:
    if budget_pkr <= 3000:
        return "low"
    if budget_pkr <= 7000:
        return "medium"
    return "high"


def _cost_compatibility_score(avg_cost_pkr: float, user_budget_pkr: float) -> float:
    if user_budget_pkr <= 0:
        return 0.0
    if avg_cost_pkr <= 0:
        return 1.0

    level = _infer_budget_level(user_budget_pkr)
    if level == "low":
        if avg_cost_pkr <= 1500:
            return 1.0
        if avg_cost_pkr <= 3000:
            return 0.6
        return 0.2
    if level == "medium":
        if avg_cost_pkr <= 3000:
            return 1.0
        if avg_cost_pkr <= 5000:
            return 0.7
        return 0.3
    if avg_cost_pkr <= 6000:
        return 1.0
    if avg_cost_pkr <= user_budget_pkr:
        return 0.8
    return 0.6


def compute_place_score(
    place: Dict[str, Any],
    user_preferences: Dict[str, Any],
    user_location: Tuple[float, float],
    max_distance_km: float = 100.0,
) -> Tuple[float, Dict[str, float]]:
    # Weights (multi-criteria decision making inspired):
    # - Popularity Score (0.25): normalized popularity_score / 10
    # - User Preference Match (0.30): category match boost (0 or 1)
    # - Distance (0.15): closer is better (distance_score in [0..1])
    # - Rating (0.20): normalized rating / 5
    # - Cost Compatibility (0.10): match to user's budget level
    w_popularity = 0.25
    w_preference = 0.30
    w_distance = 0.15
    w_rating = 0.20
    w_cost = 0.10

    lat = _safe_float(place.get("lat") if "lat" in place else place.get("latitude"))
    lon = _safe_float(place.get("lon") if "lon" in place else place.get("longitude"))
    if lat is None or lon is None:
        return 0.0, {}

    popularity = _safe_float(place.get("popularity_score")) or 0.0
    rating = _safe_float(place.get("rating")) or 0.0
    avg_cost = _safe_float(place.get("cost")) or _safe_float(place.get("average_cost")) or 0.0

    popularity_norm = _normalize01(popularity, 10.0)
    rating_norm = _normalize01(rating, 5.0)

    start_lat, start_lon = user_location
    distance_km = haversine(start_lat, start_lon, float(lat), float(lon))
    if max_distance_km and max_distance_km > 0:
        distance_score = 1.0 - min(1.0, distance_km / max_distance_km)
    else:
        distance_score = 0.0

    preferred_categories: List[str] = [
        str(c).strip().lower()
        for c in (user_preferences.get("preferred_categories") or [])
        if str(c).strip()
    ]
    place_category = str(place.get("category") or "").strip().lower()
    preference_match = 1.0 if (preferred_categories and place_category in preferred_categories) else 0.0

    budget_pkr = float(user_preferences.get("budget") or 0)
    cost_score = _cost_compatibility_score(float(avg_cost), budget_pkr)

    final_score = (
        (w_popularity * popularity_norm)
        + (w_preference * preference_match)
        + (w_distance * distance_score)
        + (w_rating * rating_norm)
        + (w_cost * cost_score)
    )

    breakdown = {
        "popularity_norm": popularity_norm,
        "preference_match": preference_match,
        "distance_score": distance_score,
        "rating_norm": rating_norm,
        "cost_score": cost_score,
        "distance_km": float(distance_km),
    }
    return float(final_score), breakdown


def get_top_places(
    user_preferences: Dict[str, Any],
    dataset: List[Dict[str, Any]],
    user_location: Tuple[float, float],
    top_n: int = 20,
    max_distance_km: float = 100.0,
) -> List[Dict[str, Any]]:
    province = str(user_preferences.get("province") or "").strip().lower()
    preferred_categories = [
        str(c).strip().lower()
        for c in (user_preferences.get("preferred_categories") or [])
        if str(c).strip()
    ]

    before = len(dataset)
    filtered = []
    for p in dataset:
        try:
            prov = str(p.get("province") or "").strip().lower()
            if province and prov != province:
                continue
            lat = _safe_float(p.get("lat") if "lat" in p else p.get("latitude"))
            lon = _safe_float(p.get("lon") if "lon" in p else p.get("longitude"))
            if lat is None or lon is None:
                continue
            cat = str(p.get("category") or "").strip().lower()
            if preferred_categories and cat not in preferred_categories:
                pass
            dist = haversine(user_location[0], user_location[1], float(lat), float(lon))
            if max_distance_km and max_distance_km > 0 and dist > max_distance_km:
                continue
            filtered.append(p)
        except Exception:
            continue

    scored = []
    for p in filtered:
        score, breakdown = compute_place_score(
            p,
            user_preferences=user_preferences,
            user_location=user_location,
            max_distance_km=max_distance_km,
        )
        if breakdown:
            out = dict(p)
            out["smart_score"] = score
            out["distance_km"] = breakdown.get("distance_km", 0.0)
            scored.append(out)

    scored.sort(key=lambda x: x.get("smart_score", 0), reverse=True)
    return scored[: max(1, int(top_n))]
