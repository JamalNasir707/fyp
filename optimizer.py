import math


def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in KM

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _stable_location_key(location):
    name = str(location.get("name") or "").strip().lower()
    loc_id = str(location.get("id") or "").strip().lower()
    return (name, loc_id)


def _route_total_distance(route, dist, start_distances, return_to_start):
    if not route:
        return 0.0

    total_distance = start_distances[route[0]]
    for idx in range(1, len(route)):
        total_distance += dist[route[idx - 1]][route[idx]]

    if return_to_start:
        total_distance += start_distances[route[-1]]

    return total_distance


def _improve_route_2opt(route, dist, start_distances, return_to_start, max_passes=6):
    if len(route) < 4:
        return route, _route_total_distance(route, dist, start_distances, return_to_start)

    best = route[:]
    best_distance = _route_total_distance(best, dist, start_distances, return_to_start)

    for _ in range(max_passes):
        improved = False
        for i in range(1, len(best) - 1):
            for k in range(i + 1, len(best)):
                candidate = best[:i] + list(reversed(best[i : k + 1])) + best[k + 1 :]
                candidate_distance = _route_total_distance(candidate, dist, start_distances, return_to_start)
                if candidate_distance + 1e-9 < best_distance:
                    best = candidate
                    best_distance = candidate_distance
                    improved = True
        if not improved:
            break

    return best, best_distance


def solve_tsp(locations, start_lat, start_lon, return_to_start=True, speed_kmh=40.0):
    """
    Clean TSP:
    - No fake START node added
    - Indices always match locations list
    """

    n = len(locations)

    if n == 0:
        return [], 0, 0

    # Precompute distances from start to each location
    start_distances = [
        haversine(start_lat, start_lon, loc["lat"], loc["lon"])
        for loc in locations
    ]

    # Build distance matrix between locations
    dist = [[0] * n for _ in range(n)]

    for i in range(n):
        for j in range(n):
            if i != j:
                dist[i][j] = haversine(
                    locations[i]["lat"],
                    locations[i]["lon"],
                    locations[j]["lat"],
                    locations[j]["lon"],
                )

    # Start from nearest location to user start
    current = min(range(n), key=lambda i: (start_distances[i], _stable_location_key(locations[i])))

    visited = [False] * n
    visited[current] = True

    route = [current]

    # Nearest neighbor
    for _ in range(n - 1):
        nearest = None
        nearest_dist = float("inf")

        for i in range(n):
            if visited[i]:
                continue
            candidate_dist = dist[current][i]
            if (
                candidate_dist < nearest_dist - 1e-9
                or (
                    abs(candidate_dist - nearest_dist) <= 1e-9
                    and (
                        nearest is None
                        or _stable_location_key(locations[i]) < _stable_location_key(locations[nearest])
                    )
                )
            ):
                nearest = i
                nearest_dist = candidate_dist

        route.append(nearest)
        visited[nearest] = True
        current = nearest

    route, total_distance = _improve_route_2opt(route, dist, start_distances, return_to_start)

    safe_speed_kmh = float(speed_kmh) if float(speed_kmh) > 0 else 40.0
    estimated_time_hours = total_distance / safe_speed_kmh

    return route, total_distance, estimated_time_hours
