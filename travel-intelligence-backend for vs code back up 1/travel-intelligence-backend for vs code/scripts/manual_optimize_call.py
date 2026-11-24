import json
from fastapi.testclient import TestClient
from app.main import app


def main():
    client = TestClient(app)

    params = {
        "max_budget": 1500,
        "province": "Punjab",
        "start_lat": 31.5204,
        "start_lon": 74.3587,
        "max_travel_hours": 60,
        "score_weight": 1.0,
        "time_weight": 0.05,
        "cost_weight": 0.01,
        "preferred_categories": ["mosque", "fort", "waterfall"],
    }

    r = client.post("/optimize", params=params)
    print("Status:", r.status_code)
    try:
        data = r.json()
    except Exception:
        print("Non-JSON response:", r.text)
        return

    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
