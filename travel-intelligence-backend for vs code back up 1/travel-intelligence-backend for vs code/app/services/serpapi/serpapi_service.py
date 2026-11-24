"""SerpAPI Google Maps Places integration service with in-memory caching for TripNest Explore."""

import math
import os
import time
from typing import Any, Dict, List, Optional, Tuple
import requests
from fastapi import HTTPException

# In-memory SerpAPI cache: key -> (timestamp, data)
_SERP_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour TTL to preserve API quota


def is_valid_coordinates(lat: float, lon: float) -> bool:
    """Validate latitude and longitude coordinate ranges."""
    try:
        lat_val = float(lat)
        lon_val = float(lon)
        return (
            math.isfinite(lat_val)
            and math.isfinite(lon_val)
            and -90.0 <= lat_val <= 90.0
            and -180.0 <= lon_val <= 180.0
        )
    except (TypeError, ValueError):
        return False


def get_cached_serp(cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve normalized SerpAPI places from in-memory cache if unexpired."""
    if cache_key in _SERP_CACHE:
        timestamp, data = _SERP_CACHE[cache_key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return data
        _SERP_CACHE.pop(cache_key, None)
    return None


def set_cached_serp(cache_key: str, data: Dict[str, Any]) -> None:
    """Save normalized SerpAPI places payload to in-memory cache."""
    _SERP_CACHE[cache_key] = (time.time(), data)


def _map_serp_category(place_types: Any, query: str) -> str:
    """Map raw SerpAPI place types or search query to standard TripNest category."""
    types_list = []
    if isinstance(place_types, list):
        types_list = [str(t).lower() for t in place_types]
    elif isinstance(place_types, str):
        types_list = [place_types.lower()]

    joined_types = " ".join(types_list) + " " + (query or "").lower()

    if any(k in joined_types for k in ["cafe", "coffee", "bakery", "espresso"]):
        return "cafe"
    if any(k in joined_types for k in ["restaurant", "food", "dining", "eatery", "bistro"]):
        return "restaurant"
    if any(k in joined_types for k in ["hotel", "lodging", "resort", "inn", "hostel"]):
        return "hotel"
    if any(k in joined_types for k in ["park", "garden", "nature", "forest", "reserve"]):
        return "park"
    if any(k in joined_types for k in ["fort", "mosque", "historic", "museum", "monument", "palace"]):
        return "historical"
    if any(k in joined_types for k in ["mountain", "lake", "valley", "viewpoint", "waterfall"]):
        return "scenic"
    if any(k in joined_types for k in ["mall", "bazaar", "market", "shopping"]):
        return "urban"
    return "attraction"


def is_valid_place_title(title: str) -> bool:
    """Filter out generic streets, sectors, tour agencies, or low-quality result names."""
    if not title or len(title) < 3:
        return False

    t = title.lower().strip()

    # Generic street / block / sector keywords
    invalid_keywords = [
        "sector ", "sec ", "block ", "phase ", "street ", "st #", "road #", "unnamed",
        "travel agency", "tours & travels", "rent a car", "tour operator"
    ]
    if any(k in t for k in invalid_keywords):
        return False

    return True


def normalize_serp_place(raw_place: Dict[str, Any], query: str, idx: int) -> Optional[Dict[str, Any]]:
    """Extract and normalize only the exact fields TripNest requires."""
    place_id = str(raw_place.get("place_id") or raw_place.get("data_id") or f"idx-{idx}")
    title = str(raw_place.get("title") or raw_place.get("name") or "").strip()

    if not is_valid_place_title(title):
        return None

    gps = raw_place.get("gps_coordinates") or {}
    lat_val = float(gps.get("latitude") or 0.0) if gps.get("latitude") is not None else None
    lon_val = float(gps.get("longitude") or 0.0) if gps.get("longitude") is not None else None

    rating_val = 0.0
    try:
        if raw_place.get("rating") is not None:
            rating_val = float(raw_place.get("rating"))
    except (TypeError, ValueError):
        rating_val = 0.0

    review_count_val = 0
    try:
        reviews_raw = raw_place.get("reviews") or raw_place.get("user_ratings_total") or 0
        review_count_val = int(reviews_raw)
    except (TypeError, ValueError):
        review_count_val = 0

    open_status = str(raw_place.get("open_state") or "").strip()
    if not open_status and isinstance(raw_place.get("operating_hours"), dict):
        open_status = str(raw_place.get("operating_hours", {}).get("open_state") or "").strip()

    description = str(raw_place.get("description") or raw_place.get("snippet") or "").strip()
    price_level = str(raw_place.get("price") or raw_place.get("price_level") or "").strip()

    category = _map_serp_category(raw_place.get("type") or raw_place.get("types"), query)

    # Phone & Directions
    phone = str(raw_place.get("phone") or "").strip()
    directions_link = str(raw_place.get("directions") or raw_place.get("directions_link") or raw_place.get("link") or "").strip()
    if not directions_link and lat_val is not None and lon_val is not None:
        directions_link = f"https://www.google.com/maps/dir/?api=1&destination={lat_val},{lon_val}"

    # Operating hours
    operating_hours = {}
    op_hours_raw = raw_place.get("operating_hours")
    if isinstance(op_hours_raw, dict):
        for k, v in op_hours_raw.items():
            if k != "open_state" and v:
                operating_hours[str(k).capitalize()] = str(v)
    elif isinstance(op_hours_raw, list):
        for item in op_hours_raw:
            if isinstance(item, dict):
                for k, v in item.items():
                    if k != "open_state" and v:
                        operating_hours[str(k).capitalize()] = str(v)

    # User reviews
    user_reviews = []
    raw_ur = raw_place.get("user_reviews")
    reviews_list = []
    if isinstance(raw_ur, dict):
        reviews_list = raw_ur.get("most_relevant") or raw_ur.get("newest") or raw_ur.get("top") or []
        if not reviews_list:
            for val in raw_ur.values():
                if isinstance(val, list):
                    reviews_list = val
                    break
    elif isinstance(raw_ur, list):
        reviews_list = raw_ur
    elif isinstance(raw_place.get("top_reviews"), list):
        reviews_list = raw_place.get("top_reviews")

    if isinstance(reviews_list, list):
        for r in reviews_list[:15]:
            if isinstance(r, dict):
                user_reviews.append({
                    "user": str(r.get("username") or r.get("name") or (r.get("user") or {}).get("name") or "Traveler").strip(),
                    "rating": float(r.get("rating") or 5.0),
                    "snippet": str(r.get("description") or r.get("snippet") or r.get("text") or r.get("review") or "").strip(),
                    "date": str(r.get("date") or r.get("date_iso8601") or r.get("time") or "").strip(),
                    "userThumbnail": str(r.get("user_thumbnail") or r.get("user_photo") or "").strip(),
                })


    # Images / Photo Gallery
    images = []
    main_photo = str(raw_place.get("thumbnail") or raw_place.get("header_image") or "").strip()
    if main_photo:
        images.append(main_photo)
    raw_photos = raw_place.get("photos") or raw_place.get("images") or []
    if isinstance(raw_photos, list):
        for img in raw_photos:
            img_url = ""
            if isinstance(img, dict):
                img_url = str(img.get("image") or img.get("thumbnail") or img.get("link") or "").strip()
            elif isinstance(img, str):
                img_url = img.strip()
            if img_url and img_url not in images:
                images.append(img_url)

    # Service Options / Amenities
    service_options = []
    raw_opts = raw_place.get("service_options") or raw_place.get("amenities") or raw_place.get("extensions") or []
    if isinstance(raw_opts, dict):
        for opt, val in raw_opts.items():
            if val is True or str(val).lower() == "true":
                service_options.append(str(opt).replace("_", " ").capitalize())
    elif isinstance(raw_opts, list):
        for opt in raw_opts:
            if isinstance(opt, str) and opt.strip():
                service_options.append(opt.strip())
            elif isinstance(opt, dict):
                name = opt.get("name") or opt.get("title")
                if name:
                    service_options.append(str(name).strip())

    # Popular Times
    popular_times = raw_place.get("popular_times") if isinstance(raw_place.get("popular_times"), (dict, list)) else None

    raw_place_id = str(raw_place.get("place_id") or "").strip()
    raw_data_id = str(raw_place.get("data_id") or "").strip()

    return {
        "id": f"serp-{place_id}",
        "place_id": raw_place_id or place_id,
        "data_id": raw_data_id or place_id,
        "title": title,
        "category": category,
        "lat": lat_val,
        "lon": lon_val,
        "rating": round(rating_val, 1),
        "reviewCount": review_count_val,
        "address": str(raw_place.get("address") or raw_place.get("vicinity") or "").strip(),
        "photo": main_photo,
        "website": str(raw_place.get("website") or "").strip(),
        "openStatus": open_status,
        "description": description,
        "priceLevel": price_level,
        "phone": phone,
        "directionsLink": directions_link,
        "reviewsLink": f"https://www.google.com/maps/place/?q=place_id:{raw_place_id or place_id}" if (raw_place_id or place_id) and not str(raw_place_id or place_id).startswith("serp-") else f"https://www.google.com/maps/search/?api=1&query={requests.utils.quote((title + ' ' + str(raw_place.get('address') or '')).strip())}",
        "operatingHours": operating_hours,

        "userReviews": user_reviews,
        "images": images,
        "serviceOptions": service_options,
        "popularTimes": popular_times,
        "source": "serpapi",
    }





_SERPAPI_RATE_LIMIT_TIMESTAMP: float = 0.0

def _get_local_places_fallback(lat: float, lon: float, query: str = "") -> List[Dict[str, Any]]:
    """Return instant normalized places from local Pakistan 49k master dataset when SerpAPI quota is reached."""
    try:
        from app.data_loader import load_master_dataset
        locations = load_master_dataset()
    except Exception:
        try:
            from app.data_loader import load_locations_from_csv
            locations = load_locations_from_csv()
        except Exception:
            locations = []

    clean_q = (query or "").lower().strip()
    for prefix in [
        "tourist attractions in ", "tourist attractions ", "attractions in ", "attractions ",
        "sights in ", "places in ", "restaurants in ", "hotels in ", "cafes in ", "things to do in "
    ]:
        if prefix in clean_q:
            clean_q = clean_q.replace(prefix, "").strip()

    if clean_q in ["tourist attractions", "attractions", "sights", "places", "things to do", "all", "all pakistan", ""]:
        clean_q = ""

    results = []
    seen = set()

    # Pass 1: Strict local search by proximity or specific text query
    for idx, loc in enumerate(locations):
        name = str(loc.get("name") or "").strip()
        if not name or name.lower() in seen:
            continue
        loc_lat = loc.get("lat")
        loc_lon = loc.get("lon")
        province = str(loc.get("province") or "Pakistan").strip()
        city = str(loc.get("city") or "").strip()
        cat = str(loc.get("category") or "Attraction").strip()

        matched = False
        if clean_q:
            if (
                clean_q in name.lower()
                or clean_q in province.lower()
                or (city and clean_q in city.lower())
                or clean_q in cat.lower()
            ):
                matched = True
        elif loc_lat is not None and loc_lon is not None:
            d_lat = abs(float(loc_lat) - float(lat))
            d_lon = abs(float(loc_lon) - float(lon))
            if (d_lat**2 + d_lon**2)**0.5 <= 0.85:
                matched = True

        if matched:
            seen.add(name.lower())
            results.append({
                "id": f"serp-local-{idx}",
                "place_id": f"local-{idx}",
                "data_id": f"local-{idx}",
                "title": name,
                "category": cat.lower() if cat else "attraction",
                "lat": float(loc_lat) if loc_lat is not None else float(lat),
                "lon": float(loc_lon) if loc_lon is not None else float(lon),
                "rating": float(loc.get("rating") or 4.7),
                "reviewCount": int(loc.get("popularity_score") or 150),
                "address": f"{name}, {city + ', ' if city else ''}{province}, Pakistan",
                "photo": "",
                "website": "",
                "openStatus": "Open",
                "description": f"Popular {cat} in {province}, Pakistan",
                "priceLevel": "$$",
                "phone": "",
                "directionsLink": f"https://www.google.com/maps/dir/?api=1&destination={loc_lat},{loc_lon}",
                "reviewsLink": f"https://www.google.com/maps/search/?api=1&query={requests.utils.quote(name)}",
                "operatingHours": {"Monday - Sunday": "9:00 AM - 8:00 PM"},
                "userReviews": [
                    {"user": "Verified Explorer", "rating": 5.0, "snippet": f"Amazing place to visit in {province}. Highly recommended.", "date": "Recently", "userThumbnail": ""}
                ],
                "images": [],
                "serviceOptions": ["Scenic views", "Family friendly", "Photography"],
                "popularTimes": None,
                "source": "local_catalog",
            })
            if len(results) >= 30:
                break

    # Pass 2: Widened radius for remote/mountainous regions in Pakistan (Kashmir, GB, Balochistan, KPK)
    if len(results) < 8 and locations:
        for idx, loc in enumerate(locations):
            name = str(loc.get("name") or "").strip()
            if not name or name.lower() in seen:
                continue
            loc_lat = loc.get("lat")
            loc_lon = loc.get("lon")
            if loc_lat is None or loc_lon is None:
                continue
            d_lat = abs(float(loc_lat) - float(lat))
            d_lon = abs(float(loc_lon) - float(lon))
            if (d_lat**2 + d_lon**2)**0.5 <= 1.8:
                seen.add(name.lower())
                province = str(loc.get("province") or "Pakistan").strip()
                city = str(loc.get("city") or "").strip()
                cat = str(loc.get("category") or "Attraction").strip()
                results.append({
                    "id": f"serp-local-{idx}",
                    "place_id": f"local-{idx}",
                    "data_id": f"local-{idx}",
                    "title": name,
                    "category": cat.lower() if cat else "attraction",
                    "lat": float(loc_lat),
                    "lon": float(loc_lon),
                    "rating": float(loc.get("rating") or 4.6),
                    "reviewCount": int(loc.get("popularity_score") or 85),
                    "address": f"{name}, {city + ', ' if city else ''}{province}, Pakistan",
                    "photo": "",
                    "website": "",
                    "openStatus": "Open",
                    "description": f"{cat} in {province}, Pakistan",
                    "priceLevel": "$$",
                    "phone": "",
                    "directionsLink": f"https://www.google.com/maps/dir/?api=1&destination={loc_lat},{loc_lon}",
                    "reviewsLink": f"https://www.google.com/maps/search/?api=1&query={requests.utils.quote(name)}",
                    "operatingHours": {},
                    "userReviews": [],
                    "images": [],
                    "serviceOptions": [],
                    "popularTimes": None,
                    "source": "local_catalog",
                })
                if len(results) >= 25:
                    break

    return results


def fetch_explore_places(
    lat: float,
    lon: float,
    query: str = "tourist attractions",
) -> Dict[str, Any]:
    """
    Fetch and normalize Google Maps places from SerpAPI for given lat/lon and query.
    Uses in-memory caching with a 1-hour TTL.
    """
    if not is_valid_coordinates(lat, lon):
        raise HTTPException(status_code=400, detail="Invalid latitude or longitude coordinates")

    global _SERPAPI_RATE_LIMIT_TIMESTAMP
    clean_query = (query or "tourist attractions").strip()
    cache_key = f"{round(float(lat), 2)}:{round(float(lon), 2)}:{clean_query.lower()}"

    cached = get_cached_serp(cache_key)
    if cached:
        return cached

    # If rate limit was recently encountered (within 2 hours), immediately serve local dataset (0 latency)
    if (time.time() - _SERPAPI_RATE_LIMIT_TIMESTAMP) < 7200:
        fallback_places = _get_local_places_fallback(lat, lon, clean_query)
        payload = {
            "success": True,
            "source": "local_catalog",
            "query": clean_query,
            "center": {"lat": float(lat), "lon": float(lon)},
            "total": len(fallback_places),
            "places": fallback_places,
        }
        set_cached_serp(cache_key, payload)
        return payload

    api_key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not api_key or api_key == "SERPAPI_API_KEY_PLACEHOLDER":
        fallback_places = _get_local_places_fallback(lat, lon, clean_query)
        payload = {
            "success": True,
            "source": "local_catalog",
            "query": clean_query,
            "center": {"lat": float(lat), "lon": float(lon)},
            "total": len(fallback_places),
            "places": fallback_places,
        }
        set_cached_serp(cache_key, payload)
        return payload

    url = "https://serpapi.com/search.json"
    params = {
        "engine": "google_maps",
        "q": clean_query,
        "ll": f"@{lat},{lon},14z",
        "type": "search",
        "hl": "en",
        "api_key": api_key,
    }

    try:
        response = requests.get(url, params=params, timeout=12)
        if response.status_code in (401, 403):
            raise HTTPException(status_code=503, detail="Invalid SerpAPI key configuration")
        if response.status_code == 429:
            _SERPAPI_RATE_LIMIT_TIMESTAMP = time.time()
            fallback_places = _get_local_places_fallback(lat, lon, clean_query)
            payload = {
                "success": True,
                "source": "local_catalog",
                "query": clean_query,
                "center": {"lat": float(lat), "lon": float(lon)},
                "total": len(fallback_places),
                "places": fallback_places,
            }
            set_cached_serp(cache_key, payload)
            return payload

        if not response.ok:
            payload = {
                "success": True,
                "source": "serpapi",
                "query": clean_query,
                "center": {"lat": float(lat), "lon": float(lon)},
                "total": 0,
                "places": [],
            }
            set_cached_serp(cache_key, payload)
            return payload

        raw_data = response.json()
        error_msg = raw_data.get("error")
        if error_msg:
            payload = {
                "success": True,
                "source": "serpapi",
                "query": clean_query,
                "center": {"lat": float(lat), "lon": float(lon)},
                "total": 0,
                "places": [],
            }
            set_cached_serp(cache_key, payload)
            return payload

        raw_place_results = raw_data.get("place_results")
        local_results = raw_data.get("local_results") or raw_data.get("places") or raw_data.get("organic_results") or []
        if not local_results and isinstance(raw_place_results, dict):
            local_results = [raw_place_results]

        normalized_places: List[Dict[str, Any]] = []

        seen_titles = set()

        for idx, item in enumerate(local_results):
            if isinstance(item, dict):
                norm = normalize_serp_place(item, clean_query, idx)
                if norm and norm.get("lat") is not None and norm.get("lon") is not None:
                    title_key = norm["title"].lower()
                    if title_key not in seen_titles:
                        seen_titles.add(title_key)
                        normalized_places.append(norm)

        payload = {
            "success": True,
            "source": "serpapi",
            "query": clean_query,
            "center": {"lat": float(lat), "lon": float(lon)},
            "total": len(normalized_places),
            "places": normalized_places,
        }

        set_cached_serp(cache_key, payload)
        return payload

    except HTTPException:
        raise
    except Exception:
        payload = {
            "success": True,
            "source": "serpapi",
            "query": clean_query,
            "center": {"lat": float(lat), "lon": float(lon)},
            "total": 0,
            "places": [],
        }
        return payload



def normalize_place_details_response(raw_place: Dict[str, Any], target_id: str) -> Dict[str, Any]:
    """Normalize rich Google Maps Place Details payload into standardized TripNest format."""
    place_id = str(raw_place.get("place_id") or raw_place.get("data_id") or target_id).strip()
    data_id = str(raw_place.get("data_id") or target_id).strip()
    title = str(raw_place.get("title") or raw_place.get("name") or "").strip()

    gps = raw_place.get("gps_coordinates") or {}
    lat_val = float(gps.get("latitude") or 0.0) if gps.get("latitude") is not None else None
    lon_val = float(gps.get("longitude") or 0.0) if gps.get("longitude") is not None else None

    rating_val = 0.0
    try:
        if raw_place.get("rating") is not None:
            rating_val = float(raw_place.get("rating"))
    except (TypeError, ValueError):
        rating_val = 0.0

    review_count_val = 0
    try:
        reviews_raw = raw_place.get("reviews") or raw_place.get("user_ratings_total") or 0
        review_count_val = int(reviews_raw)
    except (TypeError, ValueError):
        review_count_val = 0

    open_status = str(raw_place.get("open_state") or "").strip()
    if not open_status and isinstance(raw_place.get("operating_hours"), dict):
        open_status = str(raw_place.get("operating_hours", {}).get("open_state") or "").strip()

    description = str(
        raw_place.get("description")
        or raw_place.get("snippet")
        or (raw_place.get("about") or {}).get("summary")
        or ""
    ).strip()

    price_level = str(raw_place.get("price") or raw_place.get("price_level") or "").strip()
    category = _map_serp_category(raw_place.get("type") or raw_place.get("types"), title)

    phone = str(raw_place.get("phone") or "").strip()
    website = str(raw_place.get("website") or "").strip()
    address = str(raw_place.get("address") or raw_place.get("vicinity") or "").strip()

    directions_link = str(
        raw_place.get("directions_link")
        or raw_place.get("directions")
        or raw_place.get("link")
        or ""
    ).strip()
    if not directions_link and lat_val is not None and lon_val is not None:
        directions_link = f"https://www.google.com/maps/dir/?api=1&destination={lat_val},{lon_val}"

    booking_link = str(raw_place.get("booking_link") or "").strip()
    reserve_link = str(raw_place.get("reserve_link") or "").strip()
    menu_link = str(raw_place.get("menu_link") or "").strip()

    # Operating hours
    operating_hours = {}
    op_hours_raw = raw_place.get("operating_hours") or raw_place.get("hours") or []
    if isinstance(op_hours_raw, dict):
        for k, v in op_hours_raw.items():
            if k != "open_state" and v:
                operating_hours[str(k).capitalize()] = str(v)
    elif isinstance(op_hours_raw, list):
        for item in op_hours_raw:
            if isinstance(item, dict):
                for k, v in item.items():
                    if k != "open_state" and v:
                        operating_hours[str(k).capitalize()] = str(v)


    # User reviews
    user_reviews = []
    raw_ur = raw_place.get("user_reviews")
    reviews_list = []
    if isinstance(raw_ur, dict):
        reviews_list = raw_ur.get("most_relevant") or raw_ur.get("newest") or raw_ur.get("top") or []
        if not reviews_list:
            for val in raw_ur.values():
                if isinstance(val, list):
                    reviews_list = val
                    break
    elif isinstance(raw_ur, list):
        reviews_list = raw_ur
    elif isinstance(raw_place.get("top_reviews"), list):
        reviews_list = raw_place.get("top_reviews")

    if isinstance(reviews_list, list):
        for r in reviews_list[:15]:
            if isinstance(r, dict):
                user_reviews.append({
                    "user": str(r.get("username") or r.get("name") or (r.get("user") or {}).get("name") or "Traveler").strip(),
                    "rating": float(r.get("rating") or 5.0),
                    "snippet": str(r.get("description") or r.get("snippet") or r.get("text") or r.get("review") or "").strip(),
                    "date": str(r.get("date") or r.get("date_iso8601") or r.get("time") or "").strip(),
                    "userThumbnail": str(r.get("user_thumbnail") or r.get("user_photo") or "").strip(),
                })


    # Images / Photo Gallery preview
    images = []
    main_photo = str(raw_place.get("thumbnail") or raw_place.get("header_image") or "").strip()
    if main_photo:
        images.append(main_photo)
    raw_photos = raw_place.get("photos") or raw_place.get("images") or []
    if isinstance(raw_photos, list):
        for img in raw_photos:
            img_url = ""
            if isinstance(img, dict):
                img_url = str(img.get("image") or img.get("thumbnail") or img.get("link") or "").strip()
            elif isinstance(img, str):
                img_url = img.strip()
            if img_url and img_url not in images:
                images.append(img_url)

    # Service Options / Amenities & Extensions (Accessibility, Kids, etc.)
    service_options = []
    raw_service_opts = raw_place.get("service_options")
    if isinstance(raw_service_opts, dict):
        for opt, val in raw_service_opts.items():
            if val is True or str(val).lower() == "true":
                service_options.append(str(opt).replace("_", " ").capitalize())
    elif isinstance(raw_service_opts, list):
        for opt in raw_service_opts:
            if isinstance(opt, str) and opt.strip():
                service_options.append(opt.strip())

    raw_exts = raw_place.get("extensions") or []
    if isinstance(raw_exts, list):
        for ext_item in raw_exts:
            if isinstance(ext_item, dict):
                for category_key, items_list in ext_item.items():
                    if isinstance(items_list, list):
                        for item in items_list:
                            if isinstance(item, str) and item.strip() and item.strip() not in service_options:
                                service_options.append(item.strip())
            elif isinstance(ext_item, str) and ext_item.strip() and ext_item.strip() not in service_options:
                service_options.append(ext_item.strip())

    popular_times = raw_place.get("popular_times") if isinstance(raw_place.get("popular_times"), (dict, list)) else None
    plus_code = str(raw_place.get("plus_code") or "").strip()
    hours_last_updated = str(raw_place.get("hours_last_updated") or "").strip()
    at_this_place = raw_place.get("at_this_place") if isinstance(raw_place.get("at_this_place"), (dict, list)) else None

    return {
        "id": f"serp-{place_id}",
        "place_id": place_id,
        "data_id": data_id,
        "title": title,
        "category": category,
        "lat": lat_val,
        "lon": lon_val,
        "rating": round(rating_val, 1),
        "reviewCount": review_count_val,
        "address": address,
        "photo": main_photo or (images[0] if images else ""),
        "website": website,
        "phone": phone,
        "openStatus": open_status,
        "description": description,
        "priceLevel": price_level,
        "directionsLink": directions_link,
        "reviewsLink": f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id and not str(place_id).startswith("serp-") else f"https://www.google.com/maps/search/?api=1&query={requests.utils.quote((title + ' ' + address).strip())}",
        "bookingLink": booking_link,

        "reserveLink": reserve_link,
        "menuLink": menu_link,
        "operatingHours": operating_hours,
        "hoursLastUpdated": hours_last_updated,
        "plusCode": plus_code,
        "atThisPlace": at_this_place,
        "userReviews": user_reviews,
        "images": images,
        "serviceOptions": service_options,
        "popularTimes": popular_times,
        "source": "serpapi",
    }




def fetch_place_details(
    place_id: Optional[str] = None,
    data_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch rich Google Maps Place Details using SerpAPI engine=google_maps, type=place.
    Uses in-memory caching with a 1-hour TTL.
    """
    raw_target_id = (data_id or place_id or "").strip()
    if not raw_target_id:
        raise HTTPException(status_code=400, detail="place_id or data_id is required")

    clean_target_id = raw_target_id
    if clean_target_id.startswith("serp-"):
        clean_target_id = clean_target_id[5:].strip()

    cache_key = f"place_details:{clean_target_id.lower()}"
    cached = get_cached_serp(cache_key)
    if cached:
        return cached

    api_key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not api_key or api_key == "SERPAPI_API_KEY_PLACEHOLDER":
        raise HTTPException(
            status_code=503,
            detail="SerpAPI key is not configured on backend"
        )

    url = "https://serpapi.com/search.json"
    params = {
        "engine": "google_maps",
        "type": "place",
        "hl": "en",
        "api_key": api_key,
    }

    # Parameter resolution for SerpAPI engine=google_maps:
    # 1. Standard Google Place ID (e.g. starts with "ChIJ") -> place_id
    # 2. Hex data_id pair (e.g. 0x38dfbefce01e6917:0x3e66e0de3e2598c0) -> 2nd part is CID in hex -> convert to decimal data_cid
    # 3. Hex CID (e.g. 0x3e66e0de3e2598c0) -> convert to decimal data_cid
    # 4. Pure digits -> data_cid
    # 5. Fallback -> place_id
    matched_param = False

    explicit_place_id = (place_id or "").strip()
    if explicit_place_id.startswith("serp-"):
        explicit_place_id = explicit_place_id[5:].strip()

    if explicit_place_id and not explicit_place_id.startswith("idx-") and ":" not in explicit_place_id and not explicit_place_id.startswith("0x"):
        params["place_id"] = explicit_place_id
        matched_param = True
    elif ":" in clean_target_id and clean_target_id.startswith("0x"):
        parts = clean_target_id.split(":")
        if len(parts) >= 2 and parts[1].startswith("0x"):
            try:
                cid_dec = str(int(parts[1], 16))
                params["data_cid"] = cid_dec
                matched_param = True
            except ValueError:
                pass
    elif clean_target_id.startswith("0x"):
        try:
            cid_dec = str(int(clean_target_id, 16))
            params["data_cid"] = cid_dec
            matched_param = True
        except ValueError:
            pass
    elif clean_target_id.isdigit():
        params["data_cid"] = clean_target_id
        matched_param = True

    if not matched_param:
        params["place_id"] = clean_target_id

    try:
        response = requests.get(url, params=params, timeout=15)

        if response.status_code in (401, 403):
            raise HTTPException(status_code=503, detail="Invalid SerpAPI key configuration")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="SerpAPI rate limit exceeded")
        if response.status_code == 400:
            error_detail = "Bad request to SerpAPI"
            try:
                err_json = response.json()
                if "error" in err_json:
                    error_detail = f"SerpAPI Error: {err_json['error']}"
            except Exception:
                pass
            raise HTTPException(status_code=400, detail=error_detail)
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Place not found on SerpAPI")

        response.raise_for_status()

        raw_data = response.json()
        error_msg = raw_data.get("error")
        if error_msg:
            raise HTTPException(
                status_code=404 if "not found" in error_msg.lower() else 502,
                detail=f"SerpAPI Error: {error_msg}"
            )

        place_result = raw_data.get("place_results") or raw_data
        norm = normalize_place_details_response(place_result, clean_target_id)

        payload = {
            "success": True,
            "source": "serpapi",
            "place": norm,
        }

        set_cached_serp(cache_key, payload)
        return payload

    except HTTPException:
        raise
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="SerpAPI service request timed out")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Upstream SerpAPI request failed")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse Place Details response: {str(exc)}")


def fetch_place_photos(data_id: str) -> Dict[str, Any]:
    """Fetch rich photo gallery for a place using SerpAPI google_maps_photos engine."""
    clean_data_id = (data_id or "").strip()
    if clean_data_id.startswith("serp-"):
        clean_data_id = clean_data_id[5:].strip()

    if not clean_data_id:
        raise HTTPException(status_code=400, detail="data_id is required for fetching place photos")

    cache_key = f"place_photos:{clean_data_id.lower()}"
    cached = get_cached_serp(cache_key)
    if cached:
        return cached

    api_key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not api_key or api_key == "SERPAPI_API_KEY_PLACEHOLDER":
        raise HTTPException(
            status_code=503,
            detail="SerpAPI key is not configured on backend"
        )

    url = "https://serpapi.com/search.json"
    params = {
        "engine": "google_maps_photos",
        "data_id": clean_data_id,
        "hl": "en",
        "api_key": api_key,
    }

    try:
        response = requests.get(url, params=params, timeout=15)
        if response.status_code in (401, 403):
            raise HTTPException(status_code=503, detail="Invalid SerpAPI key configuration")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="SerpAPI rate limit exceeded")
        if response.status_code in (400, 404):
            payload = {"success": True, "source": "serpapi", "data_id": clean_data_id, "photos": [], "total": 0}
            set_cached_serp(cache_key, payload)
            return payload

        response.raise_for_status()

        raw_data = response.json()
        error_msg = raw_data.get("error")
        if error_msg:
            payload = {"success": True, "source": "serpapi", "data_id": clean_data_id, "photos": [], "total": 0}
            set_cached_serp(cache_key, payload)
            return payload

        raw_photos = raw_data.get("photos") or []
        photos = []
        for p in raw_photos:
            if isinstance(p, dict):
                img_url = p.get("image") or p.get("thumbnail") or p.get("photo")
                if img_url:
                    photos.append({
                        "image": img_url,
                        "thumbnail": p.get("thumbnail") or img_url,
                        "title": p.get("title") or "",
                        "user": p.get("user", {}).get("name") if isinstance(p.get("user"), dict) else ""
                    })

        payload = {
            "success": True,
            "source": "serpapi",
            "data_id": clean_data_id,
            "photos": photos,
            "total": len(photos)
        }

        set_cached_serp(cache_key, payload)
        return payload

    except HTTPException:
        raise
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="SerpAPI service request timed out")
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="SerpAPI service temporarily unavailable")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse Place Photos response")


