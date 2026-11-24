"""OpenWeather current weather integration service with in-memory caching."""

import math
import os
import time
from typing import Any, Dict, Optional, Tuple
import requests
from fastapi import HTTPException

# In-memory weather cache: key -> (timestamp, data)
_WEATHER_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def is_valid_coordinates(lat: float, lon: float) -> bool:
    """Validate latitude and longitude ranges."""
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


def get_cached_weather(cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve weather data from memory cache if fresh."""
    if cache_key in _WEATHER_CACHE:
        timestamp, data = _WEATHER_CACHE[cache_key]
        if time.time() - timestamp < CACHE_TTL_SECONDS:
            return data
        _WEATHER_CACHE.pop(cache_key, None)
    return None


def set_cached_weather(cache_key: str, data: Dict[str, Any]) -> None:
    """Save weather data to memory cache."""
    _WEATHER_CACHE[cache_key] = (time.time(), data)


def fetch_current_weather(lat: float, lon: float, units: str = "metric") -> Dict[str, Any]:
    """
    Fetch current weather from OpenWeather Current Weather API for given lat/lon.
    Uses in-memory cache (5 min TTL).
    """
    if not is_valid_coordinates(lat, lon):
        raise HTTPException(status_code=400, detail="Invalid latitude or longitude coordinates")

    cache_key = f"{round(lat, 4)}:{round(lon, 4)}:{units.lower()}"
    cached = get_cached_weather(cache_key)
    if cached:
        return cached

    api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenWeather API key is not configured on backend"
        )

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "units": units,
        "appid": api_key,
    }

    try:
        response = requests.get(url, params=params, timeout=6)
        if response.status_code == 401:
            raise HTTPException(status_code=503, detail="Invalid OpenWeather API key configuration")
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Weather location not found")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="OpenWeather rate limit exceeded")
        response.raise_for_status()

        raw = response.json()
        weather_list = raw.get("weather", [])
        primary_weather = weather_list[0] if weather_list else {}
        main_data = raw.get("main", {})
        wind_data = raw.get("wind", {})

        result = {
            "temperature": round(main_data.get("temp", 0)),
            "feels_like": round(main_data.get("feels_like", 0)),
            "humidity": main_data.get("humidity", 0),
            "description": str(primary_weather.get("description", "")).capitalize(),
            "icon": primary_weather.get("icon", ""),
            "wind_speed": round(float(wind_data.get("speed", 0)), 1),
        }

        set_cached_weather(cache_key, result)
        return result

    except HTTPException:
        raise
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="Weather service temporarily unavailable")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse weather data")
