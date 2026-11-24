"""
TripNest Nationwide Pakistan Location & Geospatial Discovery Service
Integrated with MongoDB Atlas (2dsphere geospatial index) and OpenStreetMap Nominatim fallback.
Provides complete nationwide coverage for:
- Punjab, Sindh, KPK, Balochistan, Islamabad, Gilgit-Baltistan, Azad Kashmir
- Cities, towns, districts, tehsils, villages, valleys, mountains, lakes, historical sites, hotels & restaurants.
"""

import math
import os
import time
import requests
from typing import Any, Dict, List, Optional, Tuple
import app.auth_db as auth_db

# In-memory OSM Nominatim cache: query -> (timestamp, results)
_OSM_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 86400 # 24 hours caching to strictly respect OSM usage policies
_LAST_OSM_REQUEST_TIME: float = 0.0

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points on the Earth in kilometers."""
    try:
        r = 6371.0 # Earth radius in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(r * c, 2)
    except Exception:
        return 9999.0

def _query_osm_nominatim(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search OpenStreetMap Nominatim for remote Pakistani localities, villages, or tehsils.
    Strictly scoped to countrycodes='pk' with caching and User-Agent compliance.
    """
    global _LAST_OSM_REQUEST_TIME
    q_clean = (query or "").strip().lower()
    if not q_clean or len(q_clean) < 3:
        return []

    # Check cache
    now = time.time()
    if q_clean in _OSM_CACHE:
        cached_time, cached_data = _OSM_CACHE[q_clean]
        if now - cached_time < CACHE_TTL_SECONDS:
            return cached_data

    # Rate limiting: minimum 1 second between live OSM requests
    elapsed = now - _LAST_OSM_REQUEST_TIME
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)

    _LAST_OSM_REQUEST_TIME = time.time()

    headers = {
        "User-Agent": "TripNest-Pakistan-Travel-Platform/1.0 (contact@tripnest.pk)",
        "Accept": "application/json",
    }
    params = {
        "q": query,
        "countrycodes": "pk",
        "format": "json",
        "addressdetails": 1,
        "limit": min(limit, 10),
    }

    results = []
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params,
            headers=headers,
            timeout=4.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            for idx, item in enumerate(data):
                lat = float(item.get("lat") or 0.0)
                lon = float(item.get("lon") or 0.0)
                if not (23.0 <= lat <= 38.0 and 60.0 <= lon <= 78.6):
                    continue

                addr = item.get("address") or {}
                state = addr.get("state") or addr.get("region") or "Pakistan"
                name = item.get("name") or item.get("display_name", "").split(",")[0]
                category = item.get("type") or item.get("class") or "Locality"

                results.append({
                    "id": f"osm_{item.get('osm_id', idx)}",
                    "name": name,
                    "city": addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county") or name,
                    "province": state,
                    "category": category.capitalize(),
                    "lat": lat,
                    "lon": lon,
                    "rating": 4.6,
                    "popularity_score": 0.85,
                    "source": "OpenStreetMap",
                })
            _OSM_CACHE[q_clean] = (time.time(), results)
    except Exception:
        pass

    return results


async def search_locations_nationwide(
    query: str = "",
    province: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 25,
    locations_fallback: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Search locations nationwide across Pakistan with:
    1. Fast MongoDB Atlas text / regex query
    2. In-memory 44,989 master dataset
    3. OpenStreetMap Nominatim live geocoding fallback for remote villages/tehsils.
    """
    clean_q = (query or "").strip().lower()
    prov_filter = (province or "").strip().lower() if province else None
    cat_filter = (category or "").strip().lower() if category else None
    max_results = min(max(1, limit), 100)

    results = []
    seen = set()

    # Pass 1: Try MongoDB Atlas if available
    db = auth_db.mongo_db
    if db is not None:
        try:
            col = db["locations"]
            mongo_query: Dict[str, Any] = {}
            if prov_filter and prov_filter != "all":
                mongo_query["province"] = {"$regex": prov_filter, "$options": "i"}
            if cat_filter and cat_filter != "all":
                mongo_query["category"] = {"$regex": cat_filter, "$options": "i"}

            if clean_q and clean_q != "all":
                mongo_query["$or"] = [
                    {"name": {"$regex": clean_q, "$options": "i"}},
                    {"city": {"$regex": clean_q, "$options": "i"}},
                    {"province": {"$regex": clean_q, "$options": "i"}},
                    {"category": {"$regex": clean_q, "$options": "i"}},
                ]

            cursor = col.find(mongo_query).sort([("popularity_score", -1), ("rating", -1)]).limit(max_results * 2)
            async for doc in cursor:
                name = doc.get("name", "").strip()
                p_val = doc.get("province", "").strip()
                unique_key = f"{name.lower()}::{p_val.lower()}"
                if unique_key in seen:
                    continue
                seen.add(unique_key)

                results.append({
                    "id": doc.get("poi_id") or str(doc.get("_id")),
                    "name": name,
                    "city": doc.get("city") or "",
                    "province": p_val,
                    "category": doc.get("category") or "Attraction",
                    "lat": doc.get("lat"),
                    "lon": doc.get("lon"),
                    "rating": float(doc.get("rating") or 4.5),
                    "popularity_score": float(doc.get("popularity_score") or 0.8),
                    "source": "database",
                })
                if len(results) >= max_results:
                    break
        except Exception:
            pass

    # Pass 2: Fallback to in-memory master dataset if MongoDB produced too few results
    if len(results) < max_results and locations_fallback:
        for idx, loc in enumerate(locations_fallback):
            p_val = (loc.get("province") or "").strip()
            if prov_filter and prov_filter != "all" and prov_filter not in p_val.lower():
                continue
            c_val = (loc.get("category") or "").strip()
            if cat_filter and cat_filter != "all" and cat_filter not in c_val.lower():
                continue

            name = (loc.get("name") or "").strip()
            if not name:
                continue

            unique_key = f"{name.lower()}::{p_val.lower()}"
            if unique_key in seen:
                continue

            matched = False
            if not clean_q or clean_q == "all":
                matched = True
            else:
                city_str = str(loc.get("city") or "").lower()
                if (
                    clean_q in name.lower()
                    or clean_q in city_str
                    or clean_q in p_val.lower()
                    or clean_q in c_val.lower()
                ):
                    matched = True

            if matched:
                seen.add(unique_key)
                results.append({
                    "id": loc.get("poi_id") or f"loc_{idx}",
                    "name": name,
                    "city": loc.get("city") or "",
                    "province": p_val,
                    "category": c_val or "Attraction",
                    "lat": loc.get("lat"),
                    "lon": loc.get("lon"),
                    "rating": float(loc.get("rating") or 4.5),
                    "popularity_score": float(loc.get("popularity_score") or 0.8),
                    "source": "master_dataset",
                })
                if len(results) >= max_results:
                    break

    # Pass 3: If still < 2 results and query is specific, call OpenStreetMap Nominatim for Pakistan
    if len(results) < 2 and clean_q and clean_q != "all":
        osm_items = _query_osm_nominatim(clean_q, limit=5)
        for item in osm_items:
            uk = f"{item['name'].lower()}::{item['province'].lower()}"
            if uk not in seen:
                seen.add(uk)
                results.append(item)

    return {
        "success": True,
        "query": query,
        "province": province,
        "total": len(results),
        "locations": results[:max_results],
    }


async def search_locations_in_bounds(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    category: Optional[str] = None,
    limit: int = 50,
    locations_fallback: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Map viewport bounding-box query:
    Finds all places visible inside the current map boundaries using MongoDB $geoWithin $box.
    """
    max_results = min(max(1, limit), 150)
    cat_filter = (category or "").strip().lower() if category else None
    results = []
    seen = set()

    db = auth_db.mongo_db
    if db is not None:
        try:
            col = db["locations"]
            query: Dict[str, Any] = {
                "coordinates": {
                    "$geoWithin": {
                        "$box": [
                            [float(min_lon), float(min_lat)],
                            [float(max_lon), float(max_lat)]
                        ]
                    }
                }
            }
            if cat_filter and cat_filter != "all":
                query["category"] = {"$regex": cat_filter, "$options": "i"}

            cursor = col.find(query).sort([("popularity_score", -1), ("rating", -1)]).limit(max_results)
            async for doc in cursor:
                name = doc.get("name", "").strip()
                if not name or name.lower() in seen:
                    continue
                seen.add(name.lower())
                results.append({
                    "id": doc.get("poi_id") or str(doc.get("_id")),
                    "name": name,
                    "city": doc.get("city") or "",
                    "province": doc.get("province") or "Pakistan",
                    "category": doc.get("category") or "Attraction",
                    "lat": doc.get("lat"),
                    "lon": doc.get("lon"),
                    "rating": float(doc.get("rating") or 4.5),
                    "popularity_score": float(doc.get("popularity_score") or 0.8),
                    "cost": float(doc.get("cost") or 0.0),
                    "visit_duration": doc.get("visit_duration") or "1-2 hours",
                })
        except Exception:
            pass

    # In-memory fallback if needed
    if len(results) < 5 and locations_fallback:
        for loc in locations_fallback:
            loc_lat = loc.get("lat")
            loc_lon = loc.get("lon")
            if loc_lat is None or loc_lon is None:
                continue
            name = (loc.get("name") or "").strip()
            if not name or name.lower() in seen:
                continue

            lat_f = float(loc_lat)
            lon_f = float(loc_lon)
            if min_lat <= lat_f <= max_lat and min_lon <= lon_f <= max_lon:
                c_val = (loc.get("category") or "").strip()
                if cat_filter and cat_filter != "all" and cat_filter not in c_val.lower():
                    continue

                seen.add(name.lower())
                results.append({
                    "id": loc.get("poi_id") or name,
                    "name": name,
                    "city": loc.get("city") or "",
                    "province": loc.get("province") or "Pakistan",
                    "category": c_val or "Attraction",
                    "lat": lat_f,
                    "lon": lon_f,
                    "rating": float(loc.get("rating") or 4.5),
                    "popularity_score": float(loc.get("popularity_score") or 0.8),
                    "cost": float(loc.get("cost") or 0.0),
                    "visit_duration": loc.get("visit_duration") or "1-2 hours",
                })
                if len(results) >= max_results:
                    break

    return {
        "success": True,
        "bounds": {
            "min_lat": min_lat,
            "max_lat": max_lat,
            "min_lon": min_lon,
            "max_lon": max_lon,
        },
        "total": len(results),
        "locations": results,
    }


async def search_locations_nearby(
    lat: float,
    lon: float,
    radius_km: float = 30.0,
    category: Optional[str] = None,
    limit: int = 30,
    locations_fallback: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Radial nearby location discovery using MongoDB $near / 2dsphere index.
    Returns places sorted by distance in km from given GPS coordinates.
    """
    max_results = min(max(1, limit), 100)
    cat_filter = (category or "").strip().lower() if category else None
    radius_meters = min(radius_km, 250.0) * 1000.0

    results = []
    seen = set()

    db = auth_db.mongo_db
    if db is not None:
        try:
            col = db["locations"]
            query: Dict[str, Any] = {
                "coordinates": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [float(lon), float(lat)]
                        },
                        "$maxDistance": radius_meters
                    }
                }
            }
            if cat_filter and cat_filter != "all":
                query["category"] = {"$regex": cat_filter, "$options": "i"}

            cursor = col.find(query).limit(max_results)
            async for doc in cursor:
                name = doc.get("name", "").strip()
                if not name or name.lower() in seen:
                    continue
                seen.add(name.lower())
                loc_lat = float(doc.get("lat") or lat)
                loc_lon = float(doc.get("lon") or lon)
                d_km = haversine_km(lat, lon, loc_lat, loc_lon)

                results.append({
                    "id": doc.get("poi_id") or str(doc.get("_id")),
                    "name": name,
                    "city": doc.get("city") or "",
                    "province": doc.get("province") or "Pakistan",
                    "category": doc.get("category") or "Attraction",
                    "lat": loc_lat,
                    "lon": loc_lon,
                    "distance_km": d_km,
                    "rating": float(doc.get("rating") or 4.5),
                    "popularity_score": float(doc.get("popularity_score") or 0.8),
                    "cost": float(doc.get("cost") or 0.0),
                    "visit_duration": doc.get("visit_duration") or "1-2 hours",
                })
        except Exception:
            pass

    # In-memory fallback if needed
    if len(results) < 5 and locations_fallback:
        candidates = []
        for loc in locations_fallback:
            loc_lat = loc.get("lat")
            loc_lon = loc.get("lon")
            if loc_lat is None or loc_lon is None:
                continue
            name = (loc.get("name") or "").strip()
            if not name or name.lower() in seen:
                continue

            lat_f = float(loc_lat)
            lon_f = float(loc_lon)
            d_km = haversine_km(lat, lon, lat_f, lon_f)
            if d_km <= radius_km:
                c_val = (loc.get("category") or "").strip()
                if cat_filter and cat_filter != "all" and cat_filter not in c_val.lower():
                    continue
                candidates.append((d_km, loc))

        candidates.sort(key=lambda x: x[0])
        for d_km, loc in candidates[:max_results]:
            name = (loc.get("name") or "").strip()
            seen.add(name.lower())
            results.append({
                "id": loc.get("poi_id") or name,
                "name": name,
                "city": loc.get("city") or "",
                "province": loc.get("province") or "Pakistan",
                "category": loc.get("category") or "Attraction",
                "lat": float(loc.get("lat")),
                "lon": float(loc.get("lon")),
                "distance_km": d_km,
                "rating": float(loc.get("rating") or 4.5),
                "popularity_score": float(loc.get("popularity_score") or 0.8),
                "cost": float(loc.get("cost") or 0.0),
                "visit_duration": loc.get("visit_duration") or "1-2 hours",
            })

    results.sort(key=lambda r: r.get("distance_km", 0.0))

    return {
        "success": True,
        "center": {"lat": lat, "lon": lon},
        "radius_km": radius_km,
        "total": len(results),
        "locations": results[:max_results],
    }
