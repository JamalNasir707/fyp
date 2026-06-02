import json
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_provinces_endpoint_contains_punjab():
    r = client.get("/provinces")
    assert r.status_code == 200
    data = r.json()
    assert "provinces" in data
    assert any("Punjab" == p for p in data["provinces"])


def test_optimize_tight_cap_returns_violation():
    params = {
        "max_budget": 5000,
        "province": "Punjab",
        "start_lat": 31.5204,
        "start_lon": 74.3587,
        "max_travel_hours": 12,
        "score_weight": 1.0,
        "time_weight": 0.05,
        "cost_weight": 0.01,
        "preferred_categories": ["lake", "mountain"],
    }
    r = client.post("/optimize", params=params)
    assert r.status_code == 200
    data = r.json()
    assert "error" in data


def test_optimize_generous_cap_returns_itinerary():
    params = {
        "max_budget": 5000,
        "province": "Punjab",
        "start_lat": 31.5204,
        "start_lon": 74.3587,
        "max_travel_hours": 60,
        "score_weight": 1.0,
        "time_weight": 0.05,
        "cost_weight": 0.01,
        "preferred_categories": ["lake", "mountain"],
    }
    r = client.post("/optimize", params=params)
    assert r.status_code == 200
    data = r.json()
    assert "optimized_route" in data
    assert data["total_locations_selected"] >= 1


def test_optimize_json_generous():
    body = {
        "max_budget": 5000,
        "province": "Punjab",
        "start_lat": 31.5204,
        "start_lon": 74.3587,
        "max_travel_hours": 60,
        "preferred_categories": ["lake", "mountain"],
        "score_weight": 1.0,
        "time_weight": 0.05,
        "cost_weight": 0.01,
    }
    r = client.post("/optimize_json", json=body)
    assert r.status_code == 200
    data = r.json()
    assert "optimized_route" in data


def test_scenario_run_tight_with_feasible_minimal():
    r = client.post("/scenario_run", params={"name": "Punjab tight", "feasible_minimal": True})
    assert r.status_code == 200
    data = r.json()
    assert "optimized_route" in data
