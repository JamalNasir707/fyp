"""
TripNest Content-Based & Context-Aware Recommendation Engine.

Architecture:
- Content-Based Match: Evaluates POI attributes (category, rating, popularity, importance)
  against the user's explicit questionnaire profile (travel style, environment, preferred categories).
- Context-Aware Match: Evaluates physical and financial constraints (proximity to starting
  location, affordability relative to user budget, and crowd avoidance preference).
- Multi-Criteria Scoring: Combines 6 normalized sub-scores with documented weights summing to 1.00.
- Evidence-Based Explanations: Generates human-readable `why_selected` reasoning tags
  strictly backed by the sub-scores.

Responsibility Boundary:
- Recommendation Engine: "How desirable is this place for this user?" (desirability scoring).
- Constraint Solver (constraints.py): "Can this place fit the user's time/budget limits?" (feasibility).
- Route Optimizer (optimizer.py): "What is the optimal travel sequence?" (TSP efficiency).
"""

from typing import Any, Dict, List, Optional, Tuple
from app.optimizer import haversine


# =====================================================================
# DOCUMENTED NORMALIZED WEIGHTS (Total = 1.00)
# =====================================================================
WEIGHT_PREFERENCE = 0.25      # Category, environment & travel-style similarity
WEIGHT_RATING = 0.20          # Verified tourist rating (0 to 5 scale)
WEIGHT_POPULARITY = 0.15      # Footfall / popularity score (0 to 10 scale)
WEIGHT_IMPORTANCE = 0.10      # Landmark / cultural importance level (1 to 3 scale)
WEIGHT_AFFORDABILITY = 0.15   # Budget compatibility / financial feasibility
WEIGHT_PROXIMITY = 0.15       # Spatial proximity to user start location (0 to 50 km)

TOTAL_WEIGHT = (
    WEIGHT_PREFERENCE
    + WEIGHT_RATING
    + WEIGHT_POPULARITY
    + WEIGHT_IMPORTANCE
    + WEIGHT_AFFORDABILITY
    + WEIGHT_PROXIMITY
)
assert abs(TOTAL_WEIGHT - 1.0) < 1e-6, "Weights must sum exactly to 1.00"

# Category keywords associated with travel styles
STYLE_CATEGORY_MAP = {
    "adventure": ["scenic", "mountain", "valley", "lake", "waterfall", "national park", "glacier", "hiking", "trek"],
    "cultural": ["historical", "mosque", "fort", "museum", "tomb", "temple", "monument", "ruins", "heritage", "shrine"],
    "relaxation": ["park", "lake", "resort", "hill station", "scenic", "garden", "beach"],
    "mixed": [],
}

# Category keywords associated with environment preferences
ENVIRONMENT_CATEGORY_MAP = {
    "mountains": ["mountain", "scenic", "valley", "pass", "glacier", "peak", "hill station"],
    "nature": ["park", "lake", "waterfall", "national park", "forest", "scenic", "valley"],
    "city": ["urban", "mall", "market", "museum", "monument", "food", "attraction"],
    "historical": ["historical", "fort", "mosque", "tomb", "temple", "ruins", "monument", "museum"],
}

CROWDED_KEYWORDS = ["market", "bazaar", "mall", "stadium", "food street"]


def is_crowded_place(loc_name: str, category: str) -> bool:
    """Detect whether a POI represents a high-density, crowded venue."""
    n = (loc_name or "").lower()
    c = (category or "").lower()
    if any(k in n for k in CROWDED_KEYWORDS):
        return True
    if "urban" in c and any(k in n for k in CROWDED_KEYWORDS):
        return True
    return False


def compute_preference_similarity(
    category_str: str,
    preferred_categories: Optional[List[str]] = None,
    travel_style: Optional[str] = None,
    environment: Optional[str] = None,
) -> float:
    """
    Computes normalized preference match in [0.0, 1.0].
    Considers preferred categories, travel style, and environment preferences.
    """
    category_lower = (category_str or "").strip().lower()
    if not category_lower:
        return 0.0

    normalized_prefs = [
        p.strip().lower() for p in (preferred_categories or []) if p and p.strip()
    ]
    style_clean = (travel_style or "").strip().lower()
    env_clean = (environment or "").strip().lower()

    has_any_pref = bool(normalized_prefs or style_clean or env_clean)
    if not has_any_pref:
        # Neutral baseline when user provided no category/style/env constraints
        return 0.5

    score = 0.0
    matches = 0
    total_criteria = 0

    # 1. Direct preferred categories match
    if normalized_prefs:
        total_criteria += 1
        if any(pref in category_lower or category_lower in pref for pref in normalized_prefs):
            score += 1.0
            matches += 1

    # 2. Environment preference match
    if env_clean:
        total_criteria += 1
        target_keywords = ENVIRONMENT_CATEGORY_MAP.get(env_clean, [env_clean])
        if any(kw in category_lower for kw in target_keywords):
            score += 1.0
            matches += 1

    # 3. Travel style match
    if style_clean and style_clean != "mixed":
        total_criteria += 1
        target_keywords = STYLE_CATEGORY_MAP.get(style_clean, [])
        if any(kw in category_lower for kw in target_keywords):
            score += 1.0
            matches += 1

    if total_criteria == 0:
        return 0.5

    return min(1.0, score / float(total_criteria))


def compute_recommendation_score(
    loc: Dict[str, Any],
    start_lat: float,
    start_lon: float,
    max_budget: float,
    max_distance_km: float = 50.0,
    preferred_categories: Optional[List[str]] = None,
    travel_style: Optional[str] = None,
    environment: Optional[str] = None,
    crowd_preference: Optional[str] = None,
) -> Tuple[float, float, Dict[str, Any], List[str]]:
    """
    Evaluates a single POI against user questionnaire and trip context.

    Returns:
        score_100: Scaled recommendation score in [0.0, 100.0]
        score_norm: Normalized score in [0.0, 1.0]
        breakdown: Component scores dictionary for transparency & debugging
        why_selected: Evidence-based explanation strings supported by scores
    """
    cat_val = (loc.get("category") or "").strip().lower()
    loc_name = loc.get("name") or "Unknown place"

    # --- Sub-score 1: Preference & Category Similarity (0 to 1) ---
    s_pref = compute_preference_similarity(
        category_str=cat_val,
        preferred_categories=preferred_categories,
        travel_style=travel_style,
        environment=environment,
    )

    # --- Sub-score 2: Rating (0 to 1) ---
    raw_rating = float(loc.get("rating") or 0.0)
    s_rating = min(1.0, max(0.0, raw_rating / 5.0))

    # --- Sub-score 3: Popularity (0 to 1) ---
    raw_popularity = float(loc.get("popularity_score") or 0.0)
    s_pop = min(1.0, max(0.0, raw_popularity / 10.0))

    # --- Sub-score 4: Cultural Importance (0 to 1) ---
    raw_importance = float(loc.get("importance_level") or 1.0)
    # Scale from [1, 3] to [0.0, 1.0]
    s_imp = min(1.0, max(0.0, (raw_importance - 1.0) / 2.0))

    # --- Sub-score 5: Affordability & Budget Fit (0 to 1) ---
    cost_val = float(loc.get("cost") or loc.get("average_cost") or 0.0)
    safe_budget = max(1.0, float(max_budget))
    if cost_val <= 0:
        s_cost = 1.0  # Free attractions are fully affordable
    elif cost_val <= safe_budget:
        s_cost = max(0.0, 1.0 - (cost_val / safe_budget))
    else:
        s_cost = 0.0

    # --- Sub-score 6: Spatial Proximity (0 to 1) ---
    distance_km = haversine(start_lat, start_lon, float(loc["lat"]), float(loc["lon"]))
    safe_max_dist = max(1.0, float(max_distance_km))
    s_prox = max(0.0, 1.0 - (distance_km / safe_max_dist))

    # --- Weighted Combination ---
    score_norm = (
        WEIGHT_PREFERENCE * s_pref
        + WEIGHT_RATING * s_rating
        + WEIGHT_POPULARITY * s_pop
        + WEIGHT_IMPORTANCE * s_imp
        + WEIGHT_AFFORDABILITY * s_cost
        + WEIGHT_PROXIMITY * s_prox
    )
    score_norm = min(1.0, max(0.0, score_norm))
    score_100 = round(score_norm * 100.0, 2)

    # --- Evidence-Based Explanations (only when backed by sub-scores) ---
    why_selected = []

    if s_pref >= 0.70:
        if environment and (environment.lower() in cat_val):
            why_selected.append(f"Matches your {environment} environment preference")
        elif travel_style and any(k in cat_val for k in STYLE_CATEGORY_MAP.get(travel_style.lower(), [])):
            why_selected.append(f"Selected for your {travel_style.lower()} travel style")
        else:
            why_selected.append(f"Matches your preference for {cat_val}")

    if s_rating >= 0.88 and raw_rating >= 4.4:
        why_selected.append(f"Highly rated by travelers ({raw_rating:.1f}/5)")

    if s_prox >= 0.80 and distance_km <= 10.0:
        why_selected.append(f"Close to starting point ({distance_km:.1f} km)")

    if s_pop >= 0.85 and raw_popularity >= 8.5:
        why_selected.append("Popular destination")

    if cost_val == 0:
        why_selected.append("Free admission / fits your budget")
    elif s_cost >= 0.85 and cost_val <= 500:
        why_selected.append(f"Budget-friendly (PKR {int(cost_val)})")

    if crowd_preference == "Avoid crowds" and not is_crowded_place(loc_name, cat_val):
        why_selected.append("Quiet location matching your crowd preference")

    if s_imp >= 0.90:
        why_selected.append("Major landmark / cultural heritage")

    breakdown = {
        "preference_similarity": round(s_pref, 3),
        "rating_score": round(s_rating, 3),
        "popularity_score_norm": round(s_pop, 3),
        "importance_score": round(s_imp, 3),
        "affordability_score": round(s_cost, 3),
        "proximity_score": round(s_prox, 3),
        # Raw metrics for debugging and compatibility
        "preference_match": 1 if s_pref >= 0.5 else 0,
        "rating": raw_rating,
        "popularity_score": raw_popularity,
        "importance_level": raw_importance,
        "distance_km": round(distance_km, 2),
        "cost": cost_val,
    }

    return score_100, score_norm, breakdown, why_selected[:2]


def score_and_rank_candidates(
    locations: List[Dict[str, Any]],
    start_lat: float,
    start_lon: float,
    max_budget: float,
    max_distance_km: float = 50.0,
    preferred_categories: Optional[List[str]] = None,
    travel_style: Optional[str] = None,
    environment: Optional[str] = None,
    crowd_preference: Optional[str] = None,
    avoid_crowds: bool = False,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """
    Applies distance filtering, crowd filtering, and recommendation scoring to candidates.

    Returns:
        scored_locations: List of POIs with attached recommendation score metadata,
                          sorted descending by recommendation score.
        diagnostics: Counts of candidates processed, filtered, and scored.
    """
    scored = []
    removed_distance = 0
    removed_crowd = 0

    for loc in locations:
        loc_name = loc.get("name") or ""
        cat_val = loc.get("category") or ""
        lat = float(loc.get("lat", 0.0))
        lon = float(loc.get("lon", 0.0))

        # Spatial filter (max distance radius from start)
        distance_km = haversine(start_lat, start_lon, lat, lon)
        if distance_km > max_distance_km:
            removed_distance += 1
            continue

        # Contextual crowd filter
        if avoid_crowds and is_crowded_place(loc_name, cat_val):
            removed_crowd += 1
            continue

        # Compute formal multi-criteria recommendation score
        score_100, score_norm, breakdown, why_selected = compute_recommendation_score(
            loc=loc,
            start_lat=start_lat,
            start_lon=start_lon,
            max_budget=max_budget,
            max_distance_km=max_distance_km,
            preferred_categories=preferred_categories,
            travel_style=travel_style,
            environment=environment,
            crowd_preference=crowd_preference,
        )

        loc_copy = dict(loc)
        loc_copy["score"] = score_100
        loc_copy["original_score"] = score_100
        loc_copy["boosted_score"] = score_100
        loc_copy["normalized_score"] = score_norm
        loc_copy["score_components"] = breakdown
        loc_copy["why_selected"] = why_selected
        scored.append(loc_copy)

    # Sort candidates by recommendation score descending
    scored.sort(key=lambda x: x.get("score", 0.0), reverse=True)

    diagnostics = {
        "total_input": len(locations),
        "removed_due_to_distance": removed_distance,
        "removed_due_to_crowd": removed_crowd,
        "scored_count": len(scored),
    }

    return scored, diagnostics
