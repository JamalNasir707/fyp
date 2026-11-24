import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.data_loader import load_master_dataset
from app.clustering import cluster_locations
from app.constraints import select_locations_time_aware
from app.optimizer import haversine, solve_tsp


def main():
    province = "Punjab"
    max_budget = 5000
    max_travel_hours = 12
    preferred_categories = ["historical"]

    start_lat = 31.5204
    start_lon = 74.3587

    score_weight = 1.0
    cost_weight = 0.01
    far_threshold_km = 500.0
    far_threshold_km = 50.0

    locations = load_master_dataset()
    print("1) Loaded locations (master dataset):", len(locations))

    prov_filtered = [
        loc for loc in locations
        if (loc.get("province", "").strip().lower() == province.strip().lower())
    ]
    print("2a) After province filter:", len(prov_filtered))

    strict_category_filtered = [
        loc for loc in prov_filtered
        if (loc.get("category", "").strip().lower() == "historical")
    ]
    print("2b) After strict category filter (category == historical):", len(strict_category_filtered))

    normalized_prefs = [c.strip().lower() for c in preferred_categories if c and c.strip()]
    if max_travel_hours <= 6:
        max_locations = 3
    elif max_travel_hours <= 12:
        max_locations = 5
    elif max_travel_hours <= 24:
        max_locations = 8
    else:
        max_locations = 8

    def compute_score(loc):
        category_value = (loc.get("category") or "").strip().lower()
        distance_km = haversine(start_lat, start_lon, loc["lat"], loc["lon"])
        preference_match = 0
        for pref in normalized_prefs:
            if pref in category_value:
                preference_match = 1
                break
        importance_level = float(loc.get("importance_level", 1) or 1)
        rating = float(loc.get("rating", 0) or 0)
        popularity = float(loc.get("popularity_score", 0) or 0)
        cost_val = float(loc.get("cost", 0) or 0)
        distance_penalty = distance_km / 10.0
        cost_penalty = cost_val / 1000.0
        score = (
            (preference_match * 5.0)
            + (importance_level * 3.0)
            + (rating * 2.0)
            + (popularity * 1.5)
            - distance_penalty
            - cost_penalty
        )
        return score, distance_km, preference_match

    scored_pool = []
    for loc in prov_filtered:
        cost_val = float(loc.get("cost", 0) or 0)
        if cost_val > max_budget:
            continue
        score, distance_km, preference_match = compute_score(loc)
        if distance_km > far_threshold_km:
            continue
        loc2 = dict(loc)
        loc2["score"] = score
        loc2["distance_km"] = distance_km
        loc2["preference_match"] = preference_match
        scored_pool.append(loc2)

    pref_matched = [l for l in scored_pool if l.get("preference_match") == 1]
    print("2c) After preference-match filter (preference_match==1):", len(pref_matched))
    print("    After budget+distance filters (scored pool):", len(scored_pool))

    scored_sorted = sorted(scored_pool, key=lambda x: x.get("score", 0), reverse=True)
    print("\n3) TOP 10 locations AFTER scoring (post budget+distance filters):")
    for i, loc in enumerate(scored_sorted[:10], start=1):
        print(
            "{:2d}. {} | score={:.2f} | category={} | distance_km={:.2f}".format(
                i,
                loc.get("name"),
                float(loc.get("score", 0) or 0),
                loc.get("category"),
                float(loc.get("distance_km", 0) or 0),
            )
        )

    labels, centroids = cluster_locations(scored_pool, max_clusters=3)
    print("\nClustering:")
    print("  clusters_generated:", len(centroids) if centroids else 0)

    clustered_pool = scored_pool
    selected_cluster_index = None
    if centroids and labels:
        selected_cluster_index = min(
            range(len(centroids)),
            key=lambda j: haversine(start_lat, start_lon, centroids[j][0], centroids[j][1]),
        )
        clustered = [loc for loc, l in zip(scored_pool, labels) if l == selected_cluster_index]
        clustered_pool = clustered if clustered else scored_pool

    print("  selected_cluster_index:", selected_cluster_index)
    print("  locations_after_clustering:", len(clustered_pool))

    selected, selection_debug = select_locations_time_aware(
        locations=clustered_pool,
        max_budget=max_budget,
        start_lat=start_lat,
        start_lon=start_lon,
        max_travel_hours=max_travel_hours,
        max_locations=max_locations,
        preferred_categories=normalized_prefs,
    )
    print("Selection debug (first 30):")
    for line in selection_debug[:30]:
        print("-", line)
    if len(selection_debug) > 30:
        print(f"... ({len(selection_debug) - 30} more)")

    print("\n4) Locations selected BEFORE routing:", len(selected))

    total_cost = sum(float(l.get("cost", 0) or 0) for l in selected)
    print("   Total cost (selected):", round(total_cost, 2))

    if not selected:
        print("\nNo locations selected; cannot compute routing/time diagnostics.")
        return

    naive_distance = 0.0
    prev_lat, prev_lon = start_lat, start_lon
    for l in selected:
        naive_distance += haversine(prev_lat, prev_lon, l["lat"], l["lon"])
        prev_lat, prev_lon = l["lat"], l["lon"]
    naive_distance += haversine(prev_lat, prev_lon, start_lat, start_lon)
    naive_travel_time_hours = naive_distance / 40.0

    order, routed_distance_km, routed_travel_time_hours = solve_tsp(
        selected,
        start_lat=start_lat,
        start_lon=start_lon,
        return_to_start=True,
    )

    print("\n5) Travel time estimates")
    print(
        "   BEFORE routing (naive list order): distance_km={} travel_time_hours={}".format(
            round(naive_distance, 2),
            round(naive_travel_time_hours, 2),
        )
    )
    print(
        "   AFTER routing (TSP nearest-neighbor): distance_km={} travel_time_hours={}".format(
            round(routed_distance_km, 2),
            round(routed_travel_time_hours, 2),
        )
    )

    visit_time_hours = sum(float(l.get("visit_duration", 1.5) or 1.5) for l in selected)
    total_time_hours = routed_travel_time_hours + visit_time_hours

    print("\n6) EXACT reason for failure (time constraint)")
    print("   max_travel_hours:", max_travel_hours)
    print("   travel_time_hours_after_routing:", round(routed_travel_time_hours, 2))
    print("   visit_time_hours:", round(visit_time_hours, 2))
    print("   total_time_hours:", round(total_time_hours, 2))

    if total_time_hours > max_travel_hours:
        over = total_time_hours - max_travel_hours
        dominant = "visit_time" if visit_time_hours >= routed_travel_time_hours else "travel_time"
        print("   RESULT: FAIL -> Travel time exceeds maximum allowed hours after routing")
        print("   Over by hours:", round(over, 2))
        print("   Dominant contributor:", dominant)
    else:
        print("   RESULT: PASS -> does NOT exceed max_travel_hours")

    farthest = sorted(
        [(haversine(start_lat, start_lon, l["lat"], l["lon"]), l) for l in selected],
        key=lambda x: x[0],
        reverse=True,
    )

    print("\nSelected farthest-from-start (top 10):")
    for d, l in farthest[:10]:
        print(
            "- {} | category={} | dist_from_start_km={:.2f} | cost={} | score={:.2f}".format(
                l.get("name"),
                l.get("category"),
                d,
                l.get("cost"),
                float(l.get("score", 0) or 0),
            )
        )


if __name__ == "__main__":
    main()
