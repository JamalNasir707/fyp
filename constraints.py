import math
from app.optimizer import haversine, solve_tsp


def optimize_budget(
    locations,
    max_budget,
    start_lat,
    start_lon,
    score_weight=1,
    cost_weight=0.01,
    alpha=0.6,
    preferred_categories=None
):
    """
    Spatially cohesive iterative selection.

    Constraints:
        - Budget
        - Visit time (handled in main)
        - Spatial cohesion (nearest-selected penalty)

    Replaces DP knapsack with realistic greedy heuristic.
    """

    if not locations:
        return []

    remaining_budget = max_budget
    selected = []

    # Precompute max distance for normalization
    all_distances = []
    for loc in locations:
        d = haversine(start_lat, start_lon, loc["lat"], loc["lon"])
        all_distances.append(d)

    max_distance = max(all_distances) if max(all_distances) > 0 else 1

    # ----- STEP 1: Choose Anchor Location -----
    best_anchor = None
    best_value = -float("inf")

    for loc in locations:
        cost = loc.get("cost", 0)

        if cost > remaining_budget:
            continue

        pref_bonus = 0.0
        if preferred_categories:
            cat = (loc.get("category") or "").strip().lower()
            for p in preferred_categories:
                if p and p.lower() in cat:
                    pref_bonus = 0.5
                    break

        base_value = (
            score_weight * (loc.get("score", 0) + pref_bonus)
            - cost_weight * cost
        )

        if base_value > best_value:
            best_value = base_value
            best_anchor = loc

    if not best_anchor:
        return []

    selected.append(best_anchor)
    remaining_budget -= best_anchor.get("cost", 0)

    # ----- STEP 2: Iterative Cohesive Expansion -----
    while True:
        best_candidate = None
        best_marginal_utility = -float("inf")

        for candidate in locations:
            if candidate in selected:
                continue

            cost = candidate.get("cost", 0)

            if cost > remaining_budget:
                continue

            # Compute nearest distance to already selected cluster
            nearest_distance = min(
                haversine(
                    candidate["lat"],
                    candidate["lon"],
                    sel["lat"],
                    sel["lon"]
                )
                for sel in selected
            )

            normalized_distance = nearest_distance / max_distance

            spatial_penalty = alpha * normalized_distance
            selected_categories = { (s.get("category") or "").strip().lower() for s in selected }
            diversity_bonus = 0.0
            ccat = (candidate.get("category") or "").strip().lower()
            if ccat and ccat not in selected_categories:
                diversity_bonus = 1.0
            pref_bonus = 0.0
            if preferred_categories:
                for p in preferred_categories:
                    if p and p.lower() in ccat:
                        pref_bonus = 0.5
                        break

            marginal_utility = (
                score_weight * (candidate.get("score", 0) + diversity_bonus + pref_bonus)
                - cost_weight * cost
                - spatial_penalty
            )

            if marginal_utility > best_marginal_utility:
                best_marginal_utility = marginal_utility
                best_candidate = candidate

        if best_candidate is None:
            break

        selected.append(best_candidate)
        remaining_budget -= best_candidate.get("cost", 0)

    return selected


def select_locations_time_aware(
    locations,
    max_budget,
    start_lat,
    start_lon,
    max_travel_hours,
    max_locations,
    preferred_categories=None,
    fallback_limit=2,
):
    if not locations:
        return [], []

    candidates = sorted(locations, key=lambda x: x.get("score", 0), reverse=True)
    selected = []
    remaining_budget = max_budget
    debug_lines = []
    nonmatch_count = 0

    for cand in candidates:
        if len(selected) >= max_locations:
            debug_lines.append(f"STOP: reached max_locations={max_locations}")
            break

        cost = float(cand.get("cost", 0) or 0)
        if cost > remaining_budget:
            debug_lines.append(f"SKIP (budget): {cand.get('name')} cost={cost} remaining_budget={remaining_budget}")
            continue

        cat = (cand.get("category") or "").strip().lower()
        matches_pref = False
        if preferred_categories:
            for p in preferred_categories:
                if p and p.lower() in cat:
                    matches_pref = True
                    break
        if preferred_categories and not matches_pref and nonmatch_count >= max(0, int(fallback_limit)):
            debug_lines.append(f"SKIP (strict-category): {cand.get('name')} nonmatch_count={nonmatch_count} limit={fallback_limit}")
            continue

        tentative = selected + [cand]
        _, _, travel_time_hours = solve_tsp(
            tentative,
            start_lat=start_lat,
            start_lon=start_lon,
            return_to_start=True,
        )
        visit_time_hours = sum(float(l.get("visit_duration", 1.5) or 1.5) for l in tentative)
        total_time_hours = travel_time_hours + visit_time_hours

        if total_time_hours > max_travel_hours:
            debug_lines.append(
                f"SKIP (time): {cand.get('name')} would_total={total_time_hours:.2f}h "
                f"(travel={travel_time_hours:.2f}h + visit={visit_time_hours:.2f}h) > max={max_travel_hours}h"
            )
            continue

        selected.append(cand)
        remaining_budget -= cost
        if preferred_categories and not matches_pref:
            nonmatch_count += 1
        debug_lines.append(
            f"ADD: {cand.get('name')} score={float(cand.get('score', 0) or 0):.2f} cost={cost} "
            f"remaining_budget={remaining_budget} est_total={total_time_hours:.2f}h"
        )

    return selected, debug_lines
