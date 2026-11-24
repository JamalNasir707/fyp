import csv
import os
from typing import List, Dict, Any, Optional
try:
    from openpyxl import load_workbook
except Exception:
    load_workbook = None


def get_category_score(category: str) -> int:
    if not category:
        return 6

    category = category.lower().strip()

    if "mountain" in category:
        return 9
    if "valley" in category:
        return 9
    if "lake" in category:
        return 8
    if "waterfall" in category:
        return 8
    if "island" in category:
        return 8
    if "national" in category:
        return 8
    if "mosque" in category:
        return 7
    if "fort" in category:
        return 7
    if "hill" in category:
        return 7
    if "coastal" in category:
        return 7

    return 6


def get_visit_duration(category: str) -> float:
    """
    Estimated realistic visit duration (in hours)
    based on attraction type.
    """

    if not category:
        return 1.5

    cat = category.lower().strip()

    if "national park" in cat:
        return 2.5
    if "mountain" in cat or "trek" in cat or "hiking" in cat:
        return 3.0
    if "valley" in cat:
        return 2.5
    if "lake" in cat:
        return 2.0
    if "waterfall" in cat:
        return 1.5
    if "zoo" in cat or "safari" in cat:
        return 2.0
    if "amusement" in cat or "theme_park" in cat or "water_park" in cat:
        return 2.5
    if "park" in cat or "garden" in cat or "playground" in cat:
        return 1.0
    if "museum" in cat or "gallery" in cat:
        return 1.5
    if "mosque" in cat or "shrine" in cat or "church" in cat or "temple" in cat:
        return 1.0
    if "fort" in cat or "palace" in cat:
        return 1.5
    if "hill" in cat or "scenic" in cat or "viewpoint" in cat:
        return 1.0
    if "monument" in cat or "historical" in cat or "heritage" in cat or "ruins" in cat:
        return 1.0
    if "market" in cat or "bazaar" in cat or "mall" in cat or "shopping" in cat:
        return 1.5

    return 1.5


def get_district_cost(district: str) -> int:
    if not district:
        return 150

    district = district.lower().strip()

    high_cost_regions = [
        "gilgit", "skardu", "hunza", "astore", "khaplu"
    ]

    medium_cost_regions = [
        "khyber", "azad", "balochistan"
    ]

    for region in high_cost_regions:
        if region in district:
            return 500

    for region in medium_cost_regions:
        if region in district:
            return 300

    return 150


def _safe_float(v) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def _normalize_province(p: Any) -> str:
    s = "" if p is None else str(p).strip()
    s = s.replace("\u2010", "-")
    s = s.replace("\u2011", "-")
    s = s.replace("\u2012", "-")
    s = s.replace("\u2013", "-")
    s = s.replace("\u2014", "-")
    s = s.replace("\u2015", "-")
    s = s.replace("\u2212", "-")
    return s


def _load_locations_from_xlsx_v2_if_available() -> Optional[List[Dict[str, Any]]]:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    xlsx_path = os.path.join(base_dir, "data", "travel_intelligence_dataset_v2.xlsx")

    if not os.path.exists(xlsx_path):
        return None
    if load_workbook is None:
        return None

    wb = load_workbook(filename=xlsx_path, read_only=True, data_only=True)
    ws = wb.active

    rows = list(ws.rows)
    if not rows:
        return []

    headers = [str(c.value).strip().lower() if c.value is not None else "" for c in rows[0]]
    idx = {h: i for i, h in enumerate(headers)}

    required = ["latitude", "longitude", "category", "province", "popularity_score"]
    if not all(h in idx for h in required):
        return None

    locations: List[Dict[str, Any]] = []

    for r in rows[1:]:
        def val(key: str):
            i = idx.get(key)
            return r[i].value if i is not None and i < len(r) else None

        raw_name = val("name") if "name" in idx else None
        lat = _safe_float(val("latitude"))
        lon = _safe_float(val("longitude"))
        category = val("category") if val("category") is not None else ""
        province = _normalize_province(val("province"))
        city_val = val("city") if "city" in idx else None
        city = (str(city_val).strip() if city_val is not None else "")
        visit_duration = None
        if "average_visit_duration" in idx:
            visit_duration = _safe_float(val("average_visit_duration"))
        elif "visit_duration_hours" in idx:
            visit_duration = _safe_float(val("visit_duration_hours"))
        popularity = _safe_float(val("popularity_score"))
        safety = _safe_float(val("safety_rating")) if "safety_rating" in idx else None
        if "transport_access" in idx:
            transport = _safe_float(val("transport_access"))
        elif "transport_accessibility" in idx:
            transport = _safe_float(val("transport_accessibility"))
        else:
            transport = None
        avg_cost = _safe_float(val("average_cost")) if "average_cost" in idx else None

        if lat is None or lon is None:
            continue

        if raw_name is None or str(raw_name).strip() == "":
            synthesized = f"{str(category).strip() or 'Attraction'} - {city or province}"
            name = synthesized
        else:
            name = str(raw_name).strip()

        cat_score = get_category_score(str(category))
        final_score = (
            0.5 * (popularity if popularity is not None else 0.0)
            + 0.2 * (safety if safety is not None else 0.0)
            + 0.2 * (transport if transport is not None else 0.0)
            + 0.1 * cat_score
        )

        pop_val = popularity if popularity is not None else 70.0
        if pop_val > 10.0:
            pop_val = round(pop_val / 10.0, 1)

        location = {
            "name": str(name).strip(),
            "lat": lat,
            "lon": lon,
            "category": str(category).strip(),
            "province": province,
            "city": city,
            "visit_duration": visit_duration if visit_duration is not None else get_visit_duration(str(category)),
            "score": final_score,
            "cost": avg_cost if avg_cost is not None else get_district_cost(province),
            "rating": safety if safety is not None else 4.0,
            "popularity_score": pop_val,
            "importance_level": 2,
        }

        locations.append(location)

    return locations


def load_locations_from_csv(use_live_data: bool = False):
    locations = []
    v2 = _load_locations_from_xlsx_v2_if_available()
    if v2 is not None:
        locations.extend(v2)
    else:
        file_path = os.path.join(os.path.dirname(__file__), "tourist-destinations-in-pakistan.csv")
        with open(file_path, newline='', encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    district = row.get("district", "")
                    province = _normalize_province(district)
                    category = row.get("category", "").strip()

                    if not province or not row.get("latitude") or not row.get("longitude"):
                        continue

                    location = {
                        "name": row.get("_key", "").strip(),
                        "lat": float(row["latitude"]),
                        "lon": float(row["longitude"]),
                        "category": category,
                        "score": get_category_score(category),
                        "cost": get_district_cost(province),
                        "visit_duration": get_visit_duration(category),
                        "province": province,
                        "city": ""
                    }
                    locations.append(location)
                except Exception:
                    continue

    if use_live_data:
        dynamic_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, "data", "places_dynamic.csv"))
        if os.path.exists(dynamic_file_path):
            with open(dynamic_file_path, newline='', encoding="utf-8") as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    try:
                        category = row.get("category", "").strip()
                        cat_score = get_category_score(category)
                        popularity = _safe_float(row.get("popularity_score")) or 5.0
                        safety = _safe_float(row.get("safety_rating")) or 8.0
                        
                        final_score = (
                            0.5 * popularity
                            + 0.2 * safety
                            + 0.2 * 5.0 # transport default
                            + 0.1 * cat_score
                        )
                        
                        location = {
                            "name": row.get("name", "").strip(),
                            "lat": float(row["latitude"]),
                            "lon": float(row["longitude"]),
                            "category": category,
                            "score": final_score,
                            "cost": _safe_float(row.get("average_cost")) or 2000,
                            "visit_duration": get_visit_duration(category),
                            "province": _normalize_province(row.get("province", "")),
                            "city": row.get("city", "").strip()
                        }
                        locations.append(location)
                    except Exception:
                        continue
    
    # Deduplicate by name just in case
    seen_names = set()
    unique_locations = []
    for loc in locations:
        n = loc["name"].lower()
        if n not in seen_names:
            seen_names.add(n)
            unique_locations.append(loc)

    # Enrich with comprehensive 49k tourism records
    try:
        k49 = load_tourism_master_49k_dataset()
        for loc in k49:
            n = loc["name"].lower()
            if n not in seen_names:
                seen_names.add(n)
                unique_locations.append(loc)
    except Exception as e:
        print(f"Notice: 49k dataset load error: {e}")

    return unique_locations

def infer_province_from_coords(lat: float, lon: float) -> str:
    """Accurately infers Pakistan administrative province / territory from GPS coordinates."""
    if 34.5 <= lat <= 37.6 and 72.0 <= lon <= 77.8:
        return "Gilgit-Baltistan"
    if 33.0 <= lat <= 35.8 and 73.3 <= lon <= 75.9:
        return "Azad Kashmir"
    if 33.55 <= lat <= 33.85 and 72.90 <= lon <= 73.30:
        return "Islamabad"
    if 23.0 <= lat <= 28.8 and 66.5 <= lon <= 71.5:
        return "Sindh"
    if 24.0 <= lat <= 32.0 and 60.5 <= lon <= 70.8:
        return "Balochistan"
    if 31.0 <= lat <= 36.6 and 69.0 <= lon <= 73.3:
        return "Khyber Pakhtunkhwa"
    if 27.0 <= lat <= 34.6 and 69.0 <= lon <= 75.6:
        return "Punjab"
    return "Punjab"

def load_tourism_master_49k_dataset(max_records: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Loads records from data/tourism_master_49k.csv (49,947 Tourism Master Records).
    Used for TripNest Recommendation Engine, Spatial Clustering, and Explore services.
    """
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    candidate_paths = [
        os.path.join(base_dir, "data", "tourism_master_49k.csv"),
        os.path.join(os.path.expanduser("~"), "Downloads", "tourism_master_49k.csv"),
    ]
    csv_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            csv_path = p
            break

    if not csv_path:
        return []

    locations: List[Dict[str, Any]] = []
    with open(csv_path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            try:
                name = (row.get("name") or "").strip()
                lat = _safe_float(row.get("latitude"))
                lon = _safe_float(row.get("longitude"))
                if not name or lat is None or lon is None:
                    continue
                if not (23.0 <= float(lat) <= 38.0 and 60.0 <= float(lon) <= 78.6):
                    continue

                category = (row.get("category") or "Attraction").strip()
                rating = _safe_float(row.get("rating")) or 4.5
                pop_score = _safe_float(row.get("popularity_score")) or 0.8
                poi_id = (row.get("poi_id") or f"POI_{count:05d}").strip()
                province = infer_province_from_coords(float(lat), float(lon))
                cost = get_district_cost(province)
                visit_duration = get_visit_duration(category)
                score = round(min(10.0, rating + pop_score * 2.0), 2)

                locations.append({
                    "poi_id": poi_id,
                    "name": name,
                    "lat": float(lat),
                    "lon": float(lon),
                    "category": category,
                    "province": province,
                    "city": "",
                    "visit_duration": visit_duration,
                    "cost": cost,
                    "rating": rating,
                    "popularity_score": pop_score,
                    "importance_level": 2 if pop_score >= 0.8 else 1,
                    "score": score,
                    "combined_features": (row.get("combined_features") or f"{name} {category}").strip(),
                })
                count += 1
                if max_records and count >= max_records:
                    break
            except Exception:
                continue

    return locations

def load_master_dataset() -> List[Dict[str, Any]]:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    master_path = os.path.join(base_dir, "data", "pakistan_master_dataset.csv")
    locations: List[Dict[str, Any]] = []

    # 1. Authoritative primary curated master dataset (524 verified destinations)
    if os.path.exists(master_path):
        with open(master_path, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    name = (row.get("name") or "").strip()
                    lat = _safe_float(row.get("latitude"))
                    lon = _safe_float(row.get("longitude"))
                    category = (row.get("category") or "").strip()
                    province = _normalize_province(row.get("province"))
                    city = (row.get("city") or "").strip()
                    avg_cost = _safe_float(row.get("average_cost"))
                    rating = _safe_float(row.get("rating")) or 0.0
                    popularity = _safe_float(row.get("popularity_score")) or 0.0
                    importance = int(float(row.get("importance_level") or 1))
                    if not name or lat is None or lon is None or not province:
                        continue
                    cost_val = avg_cost if avg_cost is not None else get_district_cost(province)
                    location = {
                        "name": name,
                        "lat": lat,
                        "lon": lon,
                        "category": category,
                        "province": province,
                        "city": city,
                        "visit_duration": get_visit_duration(category),
                        "cost": cost_val,
                        "rating": rating,
                        "popularity_score": popularity,
                        "importance_level": importance,
                        "score": 0.0,
                    }
                    locations.append(location)
                except Exception:
                    continue
        print(f"Loaded {len(locations)} authoritative curated locations from master CSV")

    # 2. Complement with any unique locations from V2 Excel
    v2_locations = _load_locations_from_xlsx_v2_if_available()
    if v2_locations:
        seen_names = set((x.get("name") or "").strip().lower() for x in locations)
        v2_added = 0
        for loc in v2_locations:
            key = (loc.get("name") or "").strip().lower()
            if key and key not in seen_names:
                seen_names.add(key)
                locations.append(loc)
                v2_added += 1
        if v2_added:
            print(f"Added {v2_added} unique locations from Dataset V2 (Excel)")

    # 3. Extend with comprehensive 49,947 Tourism Master Records
    k49_locations = load_tourism_master_49k_dataset()
    if k49_locations:
        seen = set((x.get("name") or "").strip().lower() for x in locations)
        k49_added = 0
        for loc in k49_locations:
            key = (loc.get("name") or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            locations.append(loc)
            k49_added += 1
        print(f"Extended dataset with {k49_added:,} unique locations from tourism_master_49k.csv (total {len(locations):,})")

    # 4. Fallback to API CSVs if available
    api_csv_1 = r"F:\Travel System Fyp Datatsets\API CREATED DATA\pakistan_places1.csv"
    api_csv_2 = r"F:\Travel System Fyp Datatsets\API CREATED DATA\pakistan_places.csv"
    if os.path.exists(api_csv_1) or os.path.exists(api_csv_2):
        seen = set((x.get("name") or "").strip().lower() for x in locations)
        api_locations = load_google_places_csv(api_csv_1) + load_google_places_csv(api_csv_2)
        api_added = 0
        for loc in api_locations:
            key = (loc.get("name") or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            locations.append(loc)
            api_added += 1
        if api_added:
            print(f"Extended dataset with {api_added} unique API locations (total {len(locations)})")

    return locations


def load_google_places_csv(path: str) -> List[Dict[str, Any]]:
    locations: List[Dict[str, Any]] = []
    if not path or not os.path.exists(path):
        return locations

    def infer_province(lat: float, lon: float) -> str:
        if 34.5 <= lat <= 37.6 and 72.0 <= lon <= 77.8:
            return "Gilgit-Baltistan"
        if 33.0 <= lat <= 35.8 and 73.3 <= lon <= 75.9:
            return "Azad Kashmir"
        if 33.55 <= lat <= 33.85 and 72.90 <= lon <= 73.30:
            return "Islamabad"
        if 23.0 <= lat <= 28.8 and 66.5 <= lon <= 71.5:
            return "Sindh"
        if 24.0 <= lat <= 32.0 and 60.5 <= lon <= 70.8:
            return "Balochistan"
        if 31.0 <= lat <= 36.6 and 69.0 <= lon <= 73.3:
            return "Khyber Pakhtunkhwa"
        if 27.0 <= lat <= 34.6 and 69.0 <= lon <= 75.6:
            return "Punjab"
        return "Unknown"

    with open(path, newline="", encoding="utf-8", errors="replace") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            try:
                name = (row.get("name") or "").strip()
                lat = _safe_float(row.get("lat"))
                lon = _safe_float(row.get("lng"))
                category = (row.get("category") or "").strip()
                rating = _safe_float(row.get("rating_avg")) or 0.0
                rating_count = int(float(row.get("rating_count") or 0))
                price_level = (row.get("price_level") or "").strip()

                if not name or lat is None or lon is None:
                    continue
                if not (23.0 <= float(lat) <= 38.0 and 60.0 <= float(lon) <= 78.6):
                    continue

                category_lower = category.lower()
                if any(k in category_lower for k in ["restaurant", "cafe", "food", "bakery", "bar"]):
                    continue
                if any(k in category_lower for k in ["school", "bank", "pharmacy", "hospital", "atm", "fuel"]):
                    continue

                score = max(0.0, min(10.0, rating))
                if rating_count > 0:
                    score = min(10.0, score + min(2.0, (rating_count ** 0.5) / 10.0))
                province = infer_province(float(lat), float(lon))

                # Source price_level first, then category-grounded fallback
                if price_level == "PRICE_LEVEL_INEXPENSIVE":
                    est_cost = 100.0
                elif price_level == "PRICE_LEVEL_MODERATE":
                    est_cost = 500.0
                elif price_level == "PRICE_LEVEL_EXPENSIVE":
                    est_cost = 1500.0
                elif price_level == "PRICE_LEVEL_VERY_EXPENSIVE":
                    est_cost = 3000.0
                elif any(k in category_lower for k in ["mosque", "shrine", "church", "temple", "market", "bazaar"]):
                    est_cost = 0.0
                elif any(k in category_lower for k in ["park", "garden", "playground"]):
                    est_cost = 50.0
                elif any(k in category_lower for k in ["monument", "memorial"]):
                    est_cost = 100.0
                elif any(k in category_lower for k in ["museum", "fort", "palace"]):
                    est_cost = 200.0
                elif any(k in category_lower for k in ["water_park", "amusement_park", "theme_park"]):
                    est_cost = 500.0
                else:
                    est_cost = 250.0

                locations.append({
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "category": category_lower or "attraction",
                    "province": province,
                    "city": "",
                    "visit_duration": get_visit_duration(category_lower),
                    "cost": est_cost,
                    "rating": float(rating),
                    "popularity_score": float(score),
                    "importance_level": 1,
                    "score": float(score),
                })
            except Exception:
                continue

    seen = set()
    unique = []
    for loc in locations:
        key = loc["name"].lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(loc)
    return unique
