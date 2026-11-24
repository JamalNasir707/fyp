import os
import csv
import requests
import time
import re
from typing import List, Dict, Any

# OpenTripMap API key (Free tier)
# In a real production system, store this in an environment variable
OTM_API_KEY = "5ae2e3f221c38a28845f05b6e06b9b3e1a067e4e1a084c8a291f09ea" 

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, "data"))
DYNAMIC_DATA_FILE = os.path.join(DATA_DIR, "places_dynamic.csv")

def is_valid_location_name(name: str) -> bool:
    """
    Filter out invalid names like short codes, sectors, blocks, or purely numeric strings.
    """
    if not name or len(name) < 4:
        return False
    
    name_lower = name.lower()
    
    # Remove block/sector/phase generic names
    invalid_keywords = ['sec ', 'sector ', 'phase ', 'ph ', 'block ']
    if any(keyword in name_lower for keyword in invalid_keywords):
        return False
        
    # Check if mostly numbers or codes (e.g. "12345" or "A-12")
    # A valid name should have at least some real words/letters
    letters = re.sub(r'[^a-zA-Z]', '', name)
    if len(letters) < 3:
        return False
        
    return True

def map_osm_category_to_system(tags: Dict[str, str]) -> str:
    """
    Map OpenStreetMap tags to our system categories.
    """
    tourism = tags.get('tourism', '').lower()
    historic = tags.get('historic', '').lower()
    leisure = tags.get('leisure', '').lower()
    natural = tags.get('natural', '').lower()

    if natural in ['peak', 'volcano', 'glacier', 'ridge'] or 'mountain' in tags.get('name', '').lower():
        return 'mountain'
    if historic or tourism in ['museum', 'artwork', 'gallery']:
        return 'historical'
    if leisure in ['park', 'nature_reserve', 'garden'] or natural in ['wood', 'forest']:
        return 'park'
    if tourism in ['viewpoint']:
        return 'scenic'
    if tourism in ['attraction', 'theme_park', 'zoo']:
        return 'urban'
    
    return 'attraction'

def fetch_places_from_osm(lat: float, lon: float, radius_meters: int = 50000) -> List[Dict[str, Any]]:
    """
    Fetch places from OpenStreetMap Overpass API within a radius.
    Fallback when OpenTripMap fails (e.g. 401 Unauthorized).
    """
    print(f"Fetching from API (Overpass)")
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    # Query for specific meaningful tourism, historic, and leisure spots with names
    # Only keep high-value tags: tourism=(attraction|museum|viewpoint|zoo|gallery), leisure=park, historic=*
    overpass_query = f"""
    [out:json][timeout:25];
    (
      node["tourism"~"attraction|museum|viewpoint|zoo|gallery"](around:{radius_meters},{lat},{lon});
      way["tourism"~"attraction|museum|viewpoint|zoo|gallery"](around:{radius_meters},{lat},{lon});
      relation["tourism"~"attraction|museum|viewpoint|zoo|gallery"](around:{radius_meters},{lat},{lon});
      
      node["historic"](around:{radius_meters},{lat},{lon});
      way["historic"](around:{radius_meters},{lat},{lon});
      relation["historic"](around:{radius_meters},{lat},{lon});
      
      node["leisure"="park"](around:{radius_meters},{lat},{lon});
      way["leisure"="park"](around:{radius_meters},{lat},{lon});
      relation["leisure"="park"](around:{radius_meters},{lat},{lon});
    );
    out center;
    """
    
    try:
        response = requests.post(overpass_url, data={'data': overpass_query}, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        places = []
        raw_count = len(data.get('elements', []))
        print(f"[DEBUG] Raw elements from OSM: {raw_count}")
        
        for element in data.get('elements', []):
            tags = element.get('tags', {})
            name = tags.get('name') or tags.get('name:en')
            
            if not is_valid_location_name(name):
                continue
                
            lat_val = element.get('lat') or element.get('center', {}).get('lat')
            lon_val = element.get('lon') or element.get('center', {}).get('lon')
            
            if not lat_val or not lon_val:
                continue
                
            places.append({
                'name': name,
                'point': {'lat': lat_val, 'lon': lon_val},
                'kinds': map_osm_category_to_system(tags), # Map directly to our kinds here for reuse
                'rate': 3 # Default rating since OSM doesn't have ratings natively
            })
            
            if len(places) >= 300: # Limit to avoid overwhelming the system
                break
                
        print(f"Number of valid places fetched after cleaning: {len(places)}")
        return places
    except Exception as e:
        print(f"Error fetching from Overpass API: {e}")
        return []

def fetch_places_from_api(lat: float, lon: float, radius_meters: int = 50000, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch places from OpenTripMap API within a radius.
    """
    print(f"Fetching from API")
    url = f"https://api.opentripmap.com/0.1/en/places/radius"
    params = {
        "radius": radius_meters,
        "lon": lon,
        "lat": lat,
        "kinds": "interesting_places", # Broad category
        "rate": "2", # Minimum rating to filter out noise
        "limit": limit,
        "apikey": OTM_API_KEY,
        "format": "json"
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list) and len(data) > 0:
            print(f"Number of places fetched: {len(data)}")
            return data
    except Exception as e:
        print(f"Error fetching from OpenTripMap: {e}")
        
    print("Using fallback API")
    return fetch_places_from_osm(lat, lon, radius_meters)

def transform_and_save_data(raw_places: List[Dict[str, Any]], province: str = "Unknown") -> int:
    """
    Convert API response to our standardized format and save to CSV.
    Returns the number of new unique places added.
    """
    if not raw_places:
        return 0

    print("Saving file...")

    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Load existing places to avoid duplicates
    existing_places = set()
    if os.path.exists(DYNAMIC_DATA_FILE):
        with open(DYNAMIC_DATA_FILE, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Use name as a simple unique identifier for this scope
                existing_places.add(row.get('name', '').strip().lower())
    else:
        # Create file with headers if it doesn't exist
        with open(DYNAMIC_DATA_FILE, mode='w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "name", "latitude", "longitude", "category", "province", 
                "city", "popularity_score", "safety_rating", "average_cost"
            ])
            writer.writeheader()

    new_places_to_save = []
    
    # 2. Transform raw data
    for place in raw_places:
        name = place.get("name", "").strip()
        if not name:
            continue
            
        # Check for duplicates
        if name.lower() in existing_places:
            continue

        kinds = place.get("kinds", "")
        # OSM fallback already sets 'kinds' to our system categories
        if kinds in ['mountain', 'historical', 'park', 'mosque', 'lake', 'urban', 'attraction']:
            category = kinds
        else:
            category = "attraction" # If OTM was used and we didn't map it properly earlier, though we replaced map_otm_category_to_system
            
        # If the API gave us raw OTM kinds (we removed the map_otm_category_to_system), let's re-add a small mapper here just in case OTM somehow worked
        if category == "attraction" and kinds != "attraction":
            kinds_lower = kinds.lower()
            if "mountain" in kinds_lower or "peak" in kinds_lower or "nature_reserves" in kinds_lower:
                category = "mountain"
            elif "historic" in kinds_lower or "cultural" in kinds_lower or "monument" in kinds_lower or "museums" in kinds_lower:
                category = "historical"
            elif "park" in kinds_lower or "garden" in kinds_lower or "forest" in kinds_lower:
                category = "park"
            elif "religion" in kinds_lower or "mosque" in kinds_lower:
                category = "mosque"
            elif "lake" in kinds_lower or "water" in kinds_lower:
                category = "lake"
            elif "urban" in kinds_lower or "architecture" in kinds_lower:
                category = "urban"
        
        # OTM rate is usually 1-7, let's normalize it to a 0-10 popularity score roughly
        rate = place.get("rate", 3)
        popularity_score = min(10.0, rate * 1.5)

        transformed = {
            "name": name,
            "latitude": place.get("point", {}).get("lat"),
            "longitude": place.get("point", {}).get("lon"),
            "category": category,
            "province": province, # Inherit from user input for simplicity
            "city": "", # OTM radius search doesn't reliably give city, keep empty or derive
            "popularity_score": round(popularity_score, 1),
            "safety_rating": 8.0, # Default assumption
            "average_cost": 2000, # Default medium cost
        }
        
        # Only add if we have coordinates
        if transformed["latitude"] and transformed["longitude"]:
            new_places_to_save.append(transformed)
            existing_places.add(name.lower())

    # 3. Append new places to CSV
    if new_places_to_save:
        with open(DYNAMIC_DATA_FILE, mode='a', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "name", "latitude", "longitude", "category", "province", 
                "city", "popularity_score", "safety_rating", "average_cost"
            ])
            for place in new_places_to_save:
                writer.writerow(place)
        print(f"File saved at {DYNAMIC_DATA_FILE}")

    return len(new_places_to_save)

def update_dynamic_dataset(lat: float, lon: float, province: str) -> int:
    """
    Main function to fetch, transform, and save.
    """
    raw_data = fetch_places_from_api(lat, lon)
    new_count = transform_and_save_data(raw_data, province)
    return new_count
