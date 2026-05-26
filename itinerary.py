from typing import List, Dict, Any
from datetime import datetime, timedelta
from app.optimizer import haversine


def generate_itinerary(route: List[Dict[str, Any]], start_lat: float, start_lon: float, start_time: str = "09:00", avg_speed_kmh: float = 40.0) -> List[Dict[str, Any]]:
    def parse_time(s: str) -> datetime:
        try:
            t = datetime.strptime(s, "%H:%M")
            return t.replace(year=2000, month=1, day=1)
        except Exception:
            t = datetime.strptime("09:00", "%H:%M")
            return t.replace(year=2000, month=1, day=1)

    def fmt(dt: datetime) -> str:
        return dt.strftime("%H:%M")

    current_time = parse_time(start_time)
    items: List[Dict[str, Any]] = []

    for idx, loc in enumerate(route):
        if idx == 0:
            dist_km = haversine(start_lat, start_lon, loc.get("lat"), loc.get("lon"))
            travel_hours = dist_km / avg_speed_kmh if avg_speed_kmh > 0 else 0.0
            arrival_dt = current_time + timedelta(hours=travel_hours)
        else:
            prev = route[idx - 1]
            dist_km = haversine(prev.get("lat"), prev.get("lon"), loc.get("lat"), loc.get("lon"))
            travel_hours = dist_km / avg_speed_kmh if avg_speed_kmh > 0 else 0.0
            arrival_dt = current_time + timedelta(hours=travel_hours)

        visit_h = float(loc.get("visit_duration", 1.5))
        departure_dt = arrival_dt + timedelta(hours=visit_h)
        travel_minutes = int(round(travel_hours * 60))

        items.append(
            {
                "order": idx + 1,
                "name": loc.get("name"),
                "travel_distance_km": round(dist_km, 2),
                "travel_time_minutes": travel_minutes,
                "arrival_time": fmt(arrival_dt),
                "visit_duration_hours": visit_h,
                "departure_time": fmt(departure_dt),
            }
        )

        current_time = departure_dt

    return items
