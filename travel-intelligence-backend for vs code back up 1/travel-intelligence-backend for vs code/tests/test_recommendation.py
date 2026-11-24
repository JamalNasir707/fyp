"""
Focused Unit & Integration Tests for TripNest Content-Based & Context-Aware Recommendation Module.
"""

import unittest
from app.recommendation import (
    compute_recommendation_score,
    compute_preference_similarity,
    score_and_rank_candidates,
    is_crowded_place,
    WEIGHT_PREFERENCE,
    WEIGHT_RATING,
    WEIGHT_POPULARITY,
    WEIGHT_IMPORTANCE,
    WEIGHT_AFFORDABILITY,
    WEIGHT_PROXIMITY,
    TOTAL_WEIGHT,
)
from fastapi.testclient import TestClient
from app.main import app


class TestRecommendationEngine(unittest.TestCase):

    def setUp(self):
        # Base POI fixtures for controlled component testing
        self.base_loc = {
            "name": "Test Landmark",
            "category": "historical",
            "lat": 31.5204,
            "lon": 74.3587,
            "rating": 4.5,
            "popularity_score": 8.0,
            "importance_level": 2,
            "cost": 500,
        }
        self.start_lat = 31.5200
        self.start_lon = 74.3580
        self.budget = 5000

    def test_weights_sum_to_one(self):
        """Weights must be properly normalized and sum to 1.00."""
        self.assertAlmostEqual(TOTAL_WEIGHT, 1.00, places=6)
        self.assertEqual(WEIGHT_PREFERENCE, 0.25)
        self.assertEqual(WEIGHT_RATING, 0.20)
        self.assertEqual(WEIGHT_POPULARITY, 0.15)
        self.assertEqual(WEIGHT_IMPORTANCE, 0.10)
        self.assertEqual(WEIGHT_AFFORDABILITY, 0.15)
        self.assertEqual(WEIGHT_PROXIMITY, 0.15)

    def test_score_always_bounded_between_0_and_100(self):
        """Scores must remain strictly within [0.0, 100.0]."""
        # Worst-case place: far away, expensive, unrated, unpopular, non-matching
        worst_loc = {
            "name": "Worst Spot",
            "category": "industrial",
            "lat": 35.0,
            "lon": 75.0,
            "rating": 0.0,
            "popularity_score": 0.0,
            "importance_level": 1,
            "cost": 999999,
        }
        score_worst, norm_worst, _, _ = compute_recommendation_score(
            worst_loc, self.start_lat, self.start_lon, max_budget=100, preferred_categories=["park"]
        )
        self.assertGreaterEqual(score_worst, 0.0)
        self.assertLessEqual(score_worst, 100.0)
        self.assertGreaterEqual(norm_worst, 0.0)
        self.assertLessEqual(norm_worst, 1.0)

        # Best-case place: 0km away, free, 5.0 rating, 10.0 pop, level 3, exact match
        best_loc = {
            "name": "Best Spot",
            "category": "historical",
            "lat": self.start_lat,
            "lon": self.start_lon,
            "rating": 5.0,
            "popularity_score": 10.0,
            "importance_level": 3,
            "cost": 0,
        }
        score_best, norm_best, _, _ = compute_recommendation_score(
            best_loc, self.start_lat, self.start_lon, max_budget=5000, preferred_categories=["historical"]
        )
        self.assertGreaterEqual(score_best, 0.0)
        self.assertLessEqual(score_best, 100.0)
        self.assertAlmostEqual(score_best, 100.0, delta=1.0)
        self.assertAlmostEqual(norm_best, 1.0, delta=0.01)

    def test_preference_and_category_differentiation(self):
        """Matching categories/environment must yield higher scores than unrelated categories."""
        historical_loc = dict(self.base_loc, category="historical")
        market_loc = dict(self.base_loc, category="market")

        # User wants historical places
        score_hist, _, breakdown_hist, _ = compute_recommendation_score(
            historical_loc, self.start_lat, self.start_lon, self.budget, preferred_categories=["historical"]
        )
        score_mkt, _, breakdown_mkt, _ = compute_recommendation_score(
            market_loc, self.start_lat, self.start_lon, self.budget, preferred_categories=["historical"]
        )

        self.assertGreater(score_hist, score_mkt)
        self.assertGreater(breakdown_hist["preference_similarity"], breakdown_mkt["preference_similarity"])

    def test_environment_preference_affects_score(self):
        """User environment preference (e.g. Mountains vs City) elevates matching POIs."""
        mountain_loc = dict(self.base_loc, category="mountain scenic")
        city_loc = dict(self.base_loc, category="urban mall")

        score_mtn, _, _, _ = compute_recommendation_score(
            mountain_loc, self.start_lat, self.start_lon, self.budget, environment="Mountains"
        )
        score_cty, _, _, _ = compute_recommendation_score(
            city_loc, self.start_lat, self.start_lon, self.budget, environment="Mountains"
        )

        self.assertGreater(score_mtn, score_cty)

    def test_rating_affects_score_under_comparable_conditions(self):
        """Higher rating yields higher recommendation score when other attributes are identical."""
        high_rated = dict(self.base_loc, rating=4.9)
        low_rated = dict(self.base_loc, rating=2.0)

        score_high, _, breakdown_high, _ = compute_recommendation_score(
            high_rated, self.start_lat, self.start_lon, self.budget
        )
        score_low, _, breakdown_low, _ = compute_recommendation_score(
            low_rated, self.start_lat, self.start_lon, self.budget
        )

        self.assertGreater(score_high, score_low)
        self.assertGreater(breakdown_high["rating_score"], breakdown_low["rating_score"])

    def test_affordability_affects_score_under_budget(self):
        """Free or lower cost attractions receive higher affordability scores than expensive ones."""
        free_loc = dict(self.base_loc, cost=0)
        expensive_loc = dict(self.base_loc, cost=4500)

        score_free, _, breakdown_free, _ = compute_recommendation_score(
            free_loc, self.start_lat, self.start_lon, max_budget=5000
        )
        score_exp, _, breakdown_exp, _ = compute_recommendation_score(
            expensive_loc, self.start_lat, self.start_lon, max_budget=5000
        )

        self.assertGreater(score_free, score_exp)
        self.assertGreater(breakdown_free["affordability_score"], breakdown_exp["affordability_score"])

    def test_proximity_affects_score(self):
        """Closer locations receive a higher proximity sub-score."""
        near_loc = dict(self.base_loc, lat=self.start_lat + 0.02, lon=self.start_lon + 0.02)  # ~3 km
        far_loc = dict(self.base_loc, lat=self.start_lat + 0.35, lon=self.start_lon + 0.35)   # ~45 km

        score_near, _, breakdown_near, _ = compute_recommendation_score(
            near_loc, self.start_lat, self.start_lon, self.budget
        )
        score_far, _, breakdown_far, _ = compute_recommendation_score(
            far_loc, self.start_lat, self.start_lon, self.budget
        )

        self.assertGreater(score_near, score_far)
        self.assertGreater(breakdown_near["proximity_score"], breakdown_far["proximity_score"])

    def test_crowd_preference_filtering_and_detection(self):
        """Crowded places are detected and excluded when avoid_crowds is enabled."""
        bazaar = {"name": "Anarkali Bazaar", "category": "market", "lat": self.start_lat, "lon": self.start_lon}
        nature_park = {"name": "Shalimar Gardens", "category": "park", "lat": self.start_lat, "lon": self.start_lon}

        self.assertTrue(is_crowded_place(bazaar["name"], bazaar["category"]))
        self.assertFalse(is_crowded_place(nature_park["name"], nature_park["category"]))

        scored, diag = score_and_rank_candidates(
            locations=[bazaar, nature_park],
            start_lat=self.start_lat,
            start_lon=self.start_lon,
            max_budget=self.budget,
            avoid_crowds=True,
            crowd_preference="Avoid crowds",
        )

        self.assertEqual(len(scored), 1)
        self.assertEqual(scored[0]["name"], "Shalimar Gardens")
        self.assertEqual(diag["removed_due_to_crowd"], 1)

    def test_different_questionnaires_produce_different_rankings(self):
        """Varying questionnaire inputs changes candidate ordering logically."""
        hist_spot = dict(self.base_loc, name="Historic Fort", category="historical", cost=200)
        nature_spot = dict(self.base_loc, name="Scenic Lake", category="lake scenic", cost=200)

        # Profile A: Cultural traveler
        ranked_cultural, _ = score_and_rank_candidates(
            locations=[hist_spot, nature_spot],
            start_lat=self.start_lat,
            start_lon=self.start_lon,
            max_budget=self.budget,
            travel_style="Cultural",
            environment="Historical",
        )
        self.assertEqual(ranked_cultural[0]["name"], "Historic Fort")

        # Profile B: Adventure / Mountain traveler
        ranked_adventure, _ = score_and_rank_candidates(
            locations=[hist_spot, nature_spot],
            start_lat=self.start_lat,
            start_lon=self.start_lon,
            max_budget=self.budget,
            travel_style="Adventure",
            environment="Mountains",
        )
        self.assertEqual(ranked_adventure[0]["name"], "Scenic Lake")

    def test_explanations_are_evidence_based(self):
        """why_selected reasons are generated only when backed by corresponding sub-scores."""
        high_rated_close = dict(
            self.base_loc,
            category="historical",
            rating=4.9,
            cost=0,
            lat=self.start_lat + 0.01,
            lon=self.start_lon + 0.01,
        )
        _, _, _, reasons = compute_recommendation_score(
            high_rated_close,
            self.start_lat,
            self.start_lon,
            self.budget,
            preferred_categories=["historical"],
        )
        self.assertTrue(len(reasons) > 0)
        # Check that reasons reflect the actual high scores
        reason_text = " ".join(reasons)
        self.assertTrue("preference" in reason_text or "rated" in reason_text or "budget" in reason_text or "starting point" in reason_text)

    def test_optimize_endpoint_integration(self):
        """End-to-end /optimize API test verifies recommendation integration and constraint preservation."""
        client = TestClient(app)
        payload = {
            "max_budget": 5000,
            "province": "Punjab",
            "start_lat": 31.5204,
            "start_lon": 74.3587,
            "max_travel_hours": 24,
            "preferred_categories": ["historical"],
            "travel_style": "Cultural",
            "environment": "Historical",
            "budget_level": "Medium",
            "score_weight": 1.0,
            "time_weight": 0.05,
            "cost_weight": 0.01,
        }
        r = client.post("/optimize", json=payload)
        self.assertEqual(r.status_code, 200)
        data = r.json()

        self.assertIn("optimized_route", data)
        self.assertIn("itinerary", data)
        self.assertIn("total_score", data)
        self.assertGreater(data["total_locations_selected"], 0)

        # Verify each stop has why_selected explanation tags
        for stop in data["optimized_route"]:
            self.assertIn("why_selected", stop)
            self.assertIsInstance(stop["why_selected"], list)

        # Verify constraints were respected
        self.assertLessEqual(data["budget_used"], 5000)
        self.assertLessEqual(data["total_time_hours"], 24)


if __name__ == "__main__":
    unittest.main()
