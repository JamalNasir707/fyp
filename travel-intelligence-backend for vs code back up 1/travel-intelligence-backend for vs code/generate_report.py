import os

import requests


def generate_fyp_report() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    xlsx_path = os.path.join(base_dir, "data", "travel_intelligence_dataset_v2.xlsx")

    print("=== FYP SYSTEM PERFORMANCE REPORT ===")
    if os.path.exists(xlsx_path):
        print("Status: Dataset V2 (Excel) detected.")
    else:
        print("Status: Using Master CSV dataset.")

    url = "http://127.0.0.1:8000/optimize"
    payload = {
        "max_budget": 5000,
        "province": "Punjab",
        "start_lat": 31.5204,
        "start_lon": 74.3587,
        "max_travel_hours": 12,
        "preferred_categories": ["park", "scenic"],
        "score_weight": 1,
        "time_weight": 0.5,
        "cost_weight": 0.01,
        "personality": "Extrovert",
        "environment": "Nature",
        "travel_style": "Adventure",
    }

    print("\n--- Running Optimization Simulation ---")
    try:
        response = requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Error: Could not connect to backend. {e}")
        return 1

    if response.status_code != 200:
        print(f"Error: Backend returned {response.status_code}")
        print(response.text)
        return 1

    data = response.json()
    print(f"Optimization Successful: {data.get('total_locations_selected')} locations selected.")
    print(f"Utility Score: {data.get('utility_score')}")
    print(f"Total Distance: {data.get('total_distance_km')} km")
    print(f"Total Time: {data.get('total_time_hours')} hours")

    print("\n--- Intelligence Snippets (Explainability) ---")
    for stop in (data.get("optimized_route") or [])[:3]:
        reasons = stop.get("why_selected") or []
        if reasons:
            print(f"- {stop.get('name')}: {', '.join(reasons)}")
        else:
            print(f"- {stop.get('name')}")

    out_path = os.path.join(base_dir, "FYP_SYSTEM_REPORT.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("FYP SYSTEM REPORT\n")
        f.write("=================\n\n")
        f.write(f"Total Locations in Pool: {data.get('total_locations_selected')}\n")
        f.write(f"Final Utility Score: {data.get('utility_score')}\n")
        f.write(f"Total Distance Optimized: {data.get('total_distance_km')} km\n\n")
        f.write("Selected Route:\n")
        for i, stop in enumerate(data.get("optimized_route") or []):
            f.write(f"{i + 1}. {stop.get('name')} ({stop.get('category')})\n")
            reasons = stop.get("why_selected") or []
            if reasons:
                f.write(f"   Why: {', '.join(reasons)}\n")
    print(f"\nReport saved to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(generate_fyp_report())
