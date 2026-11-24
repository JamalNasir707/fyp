from typing import List, Dict, Any, Tuple
import random
import math


def _euclidean(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _init_centroids(points: List[Tuple[float, float]], k: int) -> List[Tuple[float, float]]:
    if k >= len(points):
        return points[:]
    return random.sample(points, k)


def _assign(points: List[Tuple[float, float]], centroids: List[Tuple[float, float]]) -> List[int]:
    labels = []
    for p in points:
        dists = [_euclidean(p, c) for c in centroids]
        labels.append(dists.index(min(dists)))
    return labels


def _recompute(points: List[Tuple[float, float]], labels: List[int], k: int) -> List[Tuple[float, float]]:
    sums = [(0.0, 0.0, 0) for _ in range(k)]
    for (x, y), l in zip(points, labels):
        sx, sy, n = sums[l]
        sums[l] = (sx + x, sy + y, n + 1)
    centroids: List[Tuple[float, float]] = []
    for sx, sy, n in sums:
        if n == 0:
            centroids.append((0.0, 0.0))
        else:
            centroids.append((sx / n, sy / n))
    return centroids


def cluster_locations(locations: List[Dict[str, Any]], max_clusters: int = 3, iterations: int = 10) -> Tuple[List[int], List[Tuple[float, float]]]:
    if not locations:
        return [], []
    points = [(float(loc.get("lat")), float(loc.get("lon"))) for loc in locations]
    k = max(1, min(max_clusters, len(points)))
    centroids = _init_centroids(points, k)
    labels = [0] * len(points)
    for _ in range(iterations):
        labels = _assign(points, centroids)
        centroids = _recompute(points, labels, k)
    return labels, centroids
