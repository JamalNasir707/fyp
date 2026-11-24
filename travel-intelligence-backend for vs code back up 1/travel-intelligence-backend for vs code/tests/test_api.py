import unittest
import json
from fastapi.testclient import TestClient
from app.main import app


class TestApiEndpoints(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_ctx.__exit__(None, None, None)

    def test_provinces_endpoint_contains_punjab(self):
        r = self.client.get("/provinces")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("provinces", data)
        self.assertTrue(any("Punjab" == p for p in data["provinces"]))

    def test_root_endpoint_reports_live_atlas_mode(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("message"), "Travel Intelligence Backend Running")
        self.assertTrue(data.get("live_mode"))
        self.assertEqual(data.get("database"), "travelIntelligence")
        self.assertFalse(data.get("fallback_active"))

    def test_controlled_trip_write_read_and_clean_up(self):
        token = self._login_user("demo", "demo123")
        self.assertIsNotNone(token, "Demo user authentication failed")
        
        # 1. Retrieve initial trips
        r_init = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_init.status_code, 200)
        initial_trip_count = len(r_init.json().get("trips", []))

        # 2. Save controlled test trip
        test_trip_id = "controlled-atlas-e2e-trip"
        payload = {
            "id": test_trip_id,
            "destination": "Skardu Valley",
            "startDate": "2026-09-10",
            "endDate": "2026-09-15",
            "itinerary": [{"day": 1, "locations": [{"name": "Shangrila Resort", "lat": 35.35, "lon": 75.50}]}],
            "preferences": {"budget": 15000}
        }
        r_save = self.client.put(f"/trips/{test_trip_id}", json={"trip": payload}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_save.status_code, 200)
        self.assertEqual(r_save.json()["trip"].get("name") or r_save.json()["trip"].get("destination"), "Skardu Valley")

        # 3. Read back from database
        r_after = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_after.status_code, 200)
        trips = r_after.json().get("trips", [])
        persisted = next((t for t in trips if str(t.get("id")) == test_trip_id), None)
        self.assertIsNotNone(persisted, "Controlled test trip was not found in database read-back")
        self.assertEqual(persisted.get("name") or persisted.get("destination"), "Skardu Valley")

        # 4. Clean up only the test trip
        r_del = self.client.delete(f"/trips/{test_trip_id}", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_del.status_code, 200)

        # 5. Verify cleanup
        r_final = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_final.status_code, 200)
        final_trips = r_final.json().get("trips", [])
        self.assertFalse(any(str(t.get("id")) == test_trip_id for t in final_trips))
        self.assertEqual(len(final_trips), initial_trip_count)

    def test_optimize_generous_cap_returns_itinerary(self):
        body = {
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
        r = self.client.post("/optimize", json=body)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("optimized_route", data)
        self.assertGreaterEqual(data["total_locations_selected"], 1)

    def test_user_search_public_endpoint(self):
        # Test searching demo users without @
        r = self.client.get("/api/users/search", params={"q": "demo"})
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["success"])
        self.assertIsInstance(data["users"], list)
        if len(data["users"]) > 0:
            first = data["users"][0]
            self.assertIn("username", first)
            self.assertIn("name", first)
            self.assertNotIn("password_hash", first)
            self.assertNotIn("email", first)

        # Test searching with @ prefix
        r2 = self.client.get("/api/users/search", params={"q": "@demo"})
        self.assertEqual(r2.status_code, 200)
        data2 = r2.json()
        self.assertTrue(data2["success"])

        # Test empty query
        r3 = self.client.get("/api/users/search", params={"q": ""})
        self.assertEqual(r3.status_code, 200)
        self.assertEqual(r3.json()["users"], [])

    def test_get_public_user_by_username_endpoint(self):
        # Existing user by clean username
        r = self.client.get("/api/users/by-username/demo")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["username"], "demo")
        self.assertIn("name", data["user"])
        self.assertNotIn("email", data["user"])
        self.assertNotIn("password_hash", data["user"])
        self.assertNotIn("role", data["user"])

        # Existing user case insensitive
        r2_case = self.client.get("/api/users/by-username/DEMO")
        self.assertEqual(r2_case.status_code, 200)
        self.assertEqual(r2_case.json()["user"]["username"], "demo")

        # Existing admin user
        r_admin = self.client.get("/api/users/by-username/admin")
        self.assertEqual(r_admin.status_code, 200)
        self.assertEqual(r_admin.json()["user"]["username"], "admin")

        # Non-existent user returns 404
        r3 = self.client.get("/api/users/by-username/nonexistent_user_99999")
        self.assertEqual(r3.status_code, 404)

    def _login_user(self, username="demo", password="demo123"):
        # Login or register helper
        r = self.client.post("/auth/login", json={"username": username, "password": password})
        if r.status_code == 200:
            return r.json()["token"]
        # Try registering if not present
        r_reg = self.client.post("/auth/register", json={
            "username": username,
            "email": f"{username}@example.com",
            "password": password
        })
        if r_reg.status_code == 200:
            r2 = self.client.post("/auth/login", json={"username": username, "password": password})
            return r2.json()["token"]
        return None

    def _create_test_trip(self, auth_token, trip_id="test-trip-share-101"):
        trip_payload = {
            "id": trip_id,
            "destination": "Hunza Valley",
            "startDate": "2026-08-01",
            "endDate": "2026-08-05",
            "itinerary": [{"day": 1, "locations": [{"name": "Attabad Lake", "lat": 36.33, "lon": 74.86}]}],
            "preferences": {"budget": 10000}
        }
        r = self.client.put(f"/trips/{trip_id}", json={"trip": trip_payload}, headers={"Authorization": f"Bearer {auth_token}"})
        self.assertEqual(r.status_code, 200)
        return trip_id

    def test_step1_1_owner_requests_view_only_token(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-view-only")

        # Test without payload (legacy)
        r = self.client.post(f"/trips/{trip_id}/share-token", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["shareToken"].startswith("sh_"))
        self.assertFalse(data["shareToken"].startswith("sh_edit_"))
        self.assertEqual(data.get("permission"), "view")

        # Test with explicit permission="view"
        r_view = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_view.status_code, 200)
        data_view = r_view.json()
        self.assertEqual(data_view["shareToken"], data["shareToken"])
        self.assertEqual(data_view["permission"], "view")

    def test_step1_2_owner_requests_edit_token(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-edit-token")

        r = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data["success"])
        self.assertEqual(data.get("permission"), "edit")
        self.assertIn("editShareToken", data)
        self.assertTrue(data["editShareToken"].startswith("sh_edit_"))
        self.assertGreater(len(data["editShareToken"]), 20)

    def test_step1_3_owner_requests_edit_token_again_reuses_token(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-edit-reuse")

        r1 = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r1.status_code, 200)
        edit_token_1 = r1.json()["editShareToken"]

        r2 = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r2.status_code, 200)
        edit_token_2 = r2.json()["editShareToken"]

        self.assertEqual(edit_token_1, edit_token_2)

    def test_step1_4_different_authenticated_user_cannot_request_edit_token(self):
        owner_token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(owner_token, "test-trip-isolation")

        other_token = self._login_user("attacker_user", "attacker123")

        r = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {other_token}"})
        self.assertEqual(r.status_code, 404)

    def test_step1_5_unauthenticated_request_is_rejected(self):
        r = self.client.post("/trips/test-trip-edit-anon/share-token", json={"permission": "edit"})
        self.assertEqual(r.status_code, 401)

    def test_step1_6_existing_view_only_shared_endpoint_returns_view(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-view-shared-endpoint")

        r_share = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_share.status_code, 200)
        view_token = r_share.json()["shareToken"]

        # Call public shared trip endpoint
        r_get = self.client.get(f"/trips/shared/{view_token}")
        self.assertEqual(r_get.status_code, 200)
        data = r_get.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["permission"], "view")
        self.assertEqual(data["trip"]["name"], "Hunza Valley")

    def test_step1_7_generating_edit_token_does_not_modify_itinerary_content(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-content-integrity")

        # Get trip before generating edit token
        r_before = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_before.status_code, 200)
        trip_before = next(t for t in r_before.json()["trips"] if str(t["id"]) == trip_id)

        # Generate edit token
        r_gen = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_gen.status_code, 200)

        # Get trip after generating edit token
        r_after = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_after.status_code, 200)
        trip_after = next(t for t in r_after.json()["trips"] if str(t["id"]) == trip_id)

        # Verify content integrity
        self.assertEqual(trip_before["name"], trip_after["name"])
        self.assertEqual(trip_before["startDate"], trip_after["startDate"])
        self.assertEqual(trip_before["endDate"], trip_after["endDate"])
        self.assertEqual(trip_before["data"].get("itinerary"), trip_after["data"].get("itinerary"))
        self.assertEqual(trip_before["data"].get("preferences"), trip_after["data"].get("preferences"))

    def test_step1_8_existing_view_token_not_overwritten_by_edit_token(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-dual-tokens")

        # Generate view token
        r_view = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_view.status_code, 200)
        view_token = r_view.json()["shareToken"]

        # Generate edit token
        r_edit = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_edit.status_code, 200)
        edit_token = r_edit.json()["editShareToken"]

        self.assertNotEqual(view_token, edit_token)
        self.assertTrue(view_token.startswith("sh_"))
        self.assertTrue(edit_token.startswith("sh_edit_"))

        # Fetch trips list and verify both tokens coexist on trip document
        r_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_trips.status_code, 200)
        trip_doc = next(t for t in r_trips.json()["trips"] if str(t["id"]) == trip_id)
        self.assertEqual(trip_doc["shareToken"], view_token)
        self.assertEqual(trip_doc["editShareToken"], edit_token)

    def test_step3_1_valid_edit_share_token_resolves_trip_with_edit_permission(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-step3-edit-valid")

        r_edit = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_edit.status_code, 200)
        edit_token = r_edit.json()["editShareToken"]

        # Call public shared edit trip endpoint without authentication
        r_get = self.client.get(f"/trips/shared/edit/{edit_token}")
        self.assertEqual(r_get.status_code, 200)
        data = r_get.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["permission"], "edit")
        self.assertEqual(data["trip"]["name"], "Hunza Valley")

    def test_step3_2_invalid_edit_token_returns_404(self):
        r = self.client.get("/trips/shared/edit/sh_edit_nonexistent_token_99999")
        self.assertEqual(r.status_code, 404)

        r_bad_prefix = self.client.get("/trips/shared/edit/random_invalid_token")
        self.assertEqual(r_bad_prefix.status_code, 404)

    def test_step3_3_view_token_sent_to_edit_endpoint_returns_404(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-step3-separation-1")

        r_view = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_view.status_code, 200)
        view_token = r_view.json()["shareToken"]

        # Send view token to edit endpoint -> MUST return 404
        r_get = self.client.get(f"/trips/shared/edit/{view_token}")
        self.assertEqual(r_get.status_code, 404)

    def test_step3_4_edit_token_sent_to_view_endpoint_returns_404(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-step3-separation-2")

        r_edit = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_edit.status_code, 200)
        edit_token = r_edit.json()["editShareToken"]

        # Send edit token to view endpoint -> MUST return 404
        r_get = self.client.get(f"/trips/shared/{edit_token}")
        self.assertEqual(r_get.status_code, 404)

    def test_step3_5_edit_get_endpoint_does_not_modify_trip_content(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-step3-integrity")

        r_edit = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_edit.status_code, 200)
        edit_token = r_edit.json()["editShareToken"]

        # Fetch trip before calling shared edit GET
        r_before = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        trip_before = next(t for t in r_before.json()["trips"] if str(t["id"]) == trip_id)

        # Call GET /trips/shared/edit/{edit_token}
        r_shared = self.client.get(f"/trips/shared/edit/{edit_token}")
        self.assertEqual(r_shared.status_code, 200)

        # Fetch trip after calling shared edit GET
        r_after = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        trip_after = next(t for t in r_after.json()["trips"] if str(t["id"]) == trip_id)

        self.assertEqual(trip_before, trip_after)

    def test_step3_6_owner_put_behavior_remains_intact_and_preserves_tokens(self):
        token = self._login_user("demo", "demo123")
        trip_id = self._create_test_trip(token, "test-trip-step3-put")

        # Generate both tokens
        r_v = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {token}"})
        view_token = r_v.json()["shareToken"]
        r_e = self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        edit_token = r_e.json()["editShareToken"]

        # Owner updates trip via normal PUT
        updated_payload = {
            "id": trip_id,
            "destination": "Hunza Valley - Updated",
            "startDate": "2026-08-01",
            "endDate": "2026-08-07",
            "itinerary": [{"day": 1, "locations": [{"name": "Passu Cones", "lat": 36.48, "lon": 74.88}]}],
            "preferences": {"budget": 15000}
        }
        r_put = self.client.put(f"/trips/{trip_id}", json={"trip": updated_payload}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_put.status_code, 200)
        saved_trip = r_put.json()["trip"]

        self.assertEqual(saved_trip["name"], "Hunza Valley - Updated")
        self.assertEqual(saved_trip["shareToken"], view_token)
        self.assertEqual(saved_trip["editShareToken"], edit_token)

    def test_step4_1_authenticated_user_b_copies_shared_edit_trip_gets_new_trip_id(self):
        # User A creates trip and generates edit token
        user_a_token = self._login_user("step4_user_a", "pass_a_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step4-src-1")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r_edit.status_code, 200)
        edit_token = r_edit.json()["editShareToken"]

        # Authenticated User B calls copy endpoint
        user_b_token = self._login_user("step4_user_b", "pass_b_123")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy.status_code, 200)
        copy_data = r_copy.json()
        self.assertTrue(copy_data["success"])
        copied_trip = copy_data["trip"]

        # Copy has a NEW tripId (different from source)
        self.assertNotEqual(str(copied_trip["id"]), str(source_trip_id))
        self.assertNotEqual(str(copied_trip["tripId"]), str(source_trip_id))

        # Copy is listed under User B's trips
        r_b_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_b_trips.status_code, 200)
        user_b_trip_ids = [str(t["id"]) for t in r_b_trips.json()["trips"]]
        self.assertIn(str(copied_trip["id"]), user_b_trip_ids)

    def test_step4_2_source_ownership_remains_with_user_a(self):
        user_a_token = self._login_user("step4_user_a2", "pass_a2_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step4-src-2")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step4_user_b2", "pass_b2_123")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy.status_code, 200)

        # Verify User A's trips list still contains source trip with original tripId
        r_a_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r_a_trips.status_code, 200)
        user_a_trip_ids = [str(t["id"]) for t in r_a_trips.json()["trips"]]
        self.assertIn(str(source_trip_id), user_a_trip_ids)

    def test_step4_3_source_content_integrity_preserved_after_copy(self):
        user_a_token = self._login_user("step4_user_a3", "pass_a3_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step4-src-3")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        # Fetch User A's trip before copy
        r_before = self.client.get("/trips", headers={"Authorization": f"Bearer {user_a_token}"})
        trip_before = next(t for t in r_before.json()["trips"] if str(t["id"]) == source_trip_id)

        # User B makes copy
        user_b_token = self._login_user("step4_user_b3", "pass_b3_123")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy.status_code, 200)

        # Fetch User A's trip after copy
        r_after = self.client.get("/trips", headers={"Authorization": f"Bearer {user_a_token}"})
        trip_after = next(t for t in r_after.json()["trips"] if str(t["id"]) == source_trip_id)

        self.assertEqual(trip_before["name"], trip_after["name"])
        self.assertEqual(trip_before["startDate"], trip_after["startDate"])
        self.assertEqual(trip_before["endDate"], trip_after["endDate"])
        self.assertEqual(trip_before["data"].get("itinerary"), trip_after["data"].get("itinerary"))
        self.assertEqual(trip_before["data"].get("preferences"), trip_after["data"].get("preferences"))
        self.assertEqual(trip_before.get("editShareToken"), trip_after.get("editShareToken"))

    def test_step4_4_copy_preserves_planning_content(self):
        user_a_token = self._login_user("step4_user_a4", "pass_a4_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step4-src-4")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step4_user_b4", "pass_b4_123")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy.status_code, 200)
        copied_trip = r_copy.json()["trip"]

        self.assertEqual(copied_trip["name"], "Hunza Valley")
        self.assertEqual(copied_trip["startDate"], "2026-08-01")
        self.assertEqual(copied_trip["endDate"], "2026-08-05")
        self.assertEqual(len(copied_trip["data"]["itinerary"]), 1)
        self.assertEqual(copied_trip["data"]["itinerary"][0]["locations"][0]["name"], "Attabad Lake")
        self.assertEqual(copied_trip["data"]["preferences"]["budget"], 10000)

    def test_step4_5_copy_does_not_inherit_source_share_tokens(self):
        user_a_token = self._login_user("step4_user_a5", "pass_a5_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step4-src-5")
        # Generate both view and edit tokens for source
        r_v = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {user_a_token}"})
        r_e = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        view_token = r_v.json()["shareToken"]
        edit_token = r_e.json()["editShareToken"]

        user_b_token = self._login_user("step4_user_b5", "pass_b5_123")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy.status_code, 200)
        copied_trip = r_copy.json()["trip"]

        # Copied trip must NOT have source tokens
        self.assertIsNone(copied_trip.get("shareToken"))
        self.assertIsNone(copied_trip.get("editShareToken"))
        self.assertIsNone(copied_trip["data"].get("shareToken"))
        self.assertIsNone(copied_trip["data"].get("editShareToken"))

    def test_step4_6_repeat_copy_request_returns_same_copy_idempotent(self):
        user_a_token = self._login_user("step4_user_a6", "pass_a6_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step4-src-6")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step4_user_b6", "pass_b6_123")
        # First copy
        r_copy_1 = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy_1.status_code, 200)
        copy_1_id = r_copy_1.json()["trip"]["id"]

        # Second copy with same token
        r_copy_2 = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy_2.status_code, 200)
        copy_2_id = r_copy_2.json()["trip"]["id"]

        # Third copy with same token
        r_copy_3 = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy_3.status_code, 200)
        copy_3_id = r_copy_3.json()["trip"]["id"]

        self.assertEqual(copy_1_id, copy_2_id)
        self.assertEqual(copy_1_id, copy_3_id)
        self.assertTrue(r_copy_2.json().get("isExistingCopy"))

        # Verify User B has only 1 copy in trips list for this source
        r_b_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_b_trips.status_code, 200)
        matching = [t for t in r_b_trips.json()["trips"] if str(t["id"]) == str(copy_1_id)]
        self.assertEqual(len(matching), 1)

    def test_step4_7_invalid_edit_token_returns_404(self):
        user_b_token = self._login_user("step4_user_b7", "pass_b7_123")
        r1 = self.client.post("/trips/shared/edit/sh_edit_nonexistent_token_99999/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r1.status_code, 404)

        r2 = self.client.post("/trips/shared/edit/invalid_prefix_token/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r2.status_code, 404)

    def test_step4_8_unauthenticated_copy_request_returns_401(self):
        r = self.client.post("/trips/shared/edit/sh_edit_valid_looking_fake_token_123/copy")
        self.assertEqual(r.status_code, 401)

    def test_step4_9_user_b_cannot_mutate_user_a_original_trip_directly(self):
        user_a_token = self._login_user("step4_user_a9", "pass_a9_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step4-src-9")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step4_user_b9", "pass_b9_123")
        # User B attempts to write directly to User A's trip via normal PUT
        malicious_payload = {
            "id": source_trip_id,
            "destination": "Attacker Hijacked Trip",
            "startDate": "2099-01-01",
            "endDate": "2099-01-02",
        }
        # When User B PUTs with source_trip_id, it is scoped to User B's userId and does not alter User A's trip
        self.client.put(f"/trips/{source_trip_id}", json={"trip": malicious_payload}, headers={"Authorization": f"Bearer {user_b_token}"})

        # Verify User A's trip was untouched
        r_a_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_a_token}"})
        trip_a = next(t for t in r_a_trips.json()["trips"] if str(t["id"]) == source_trip_id)
        self.assertEqual(trip_a["name"], "Hunza Valley")

    def test_step6_1_copy_sets_provenance_and_save_preserves_them(self):
        user_a_token = self._login_user("step6_user_a1", "pass_a1_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step6-src-1")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step6_user_b1", "pass_b1_123")
        # 1. Create copy
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy.status_code, 200)
        copy_data = r_copy.json()["trip"]
        copy_id = copy_data["id"]

        self.assertEqual(copy_data.get("copiedFromEditToken"), edit_token)
        self.assertEqual(str(copy_data.get("sourceTripId")), str(source_trip_id))

        # 2. Account B saves edits via PUT /trips/{tripId}
        updated_payload = {
            "id": copy_id,
            "destination": "Lahore (Edited by User B)",
            "startDate": "2026-09-01",
            "endDate": "2026-09-05",
            "itinerary": [{"day": 1, "locations": [{"name": "Badshahi Mosque", "lat": 31.58, "lon": 74.31}]}],
            "preferences": {"budget": 15000},
        }
        r_save = self.client.put(f"/trips/{copy_id}", json={"trip": updated_payload}, headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_save.status_code, 200)
        saved_trip = r_save.json()["trip"]

        # Provenance must be preserved on save
        self.assertEqual(saved_trip.get("copiedFromEditToken"), edit_token)
        self.assertEqual(str(saved_trip.get("sourceTripId")), str(source_trip_id))

    def test_step6_2_idempotency_after_save_and_reopen_returns_same_b_copy(self):
        user_a_token = self._login_user("step6_user_a2", "pass_a2_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step6-src-2")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step6_user_b2", "pass_b2_123")
        # Step 1: Initial copy
        r_copy_1 = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        copy_1_id = r_copy_1.json()["trip"]["id"]

        # Step 2: Edit and Save
        r_save = self.client.put(f"/trips/{copy_1_id}", json={
            "trip": {
                "id": copy_1_id,
                "destination": "Hunza & Skardu (B modified)",
                "startDate": "2026-08-01",
                "endDate": "2026-08-10",
            }
        }, headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_save.status_code, 200)

        # Step 3: Account B reopens the same edit-share link
        r_reopen = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_reopen.status_code, 200)
        data_reopen = r_reopen.json()
        self.assertTrue(data_reopen.get("isExistingCopy"))
        self.assertEqual(data_reopen["trip"]["id"], copy_1_id)

        # Step 4: Verify User B has exactly ONE trip in total
        r_b_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_b_token}"})
        matching = [t for t in r_b_trips.json()["trips"] if str(t.get("copiedFromEditToken")) == edit_token]
        self.assertEqual(len(matching), 1)

    def test_step6_3_repeated_save_reopen_cycles_remain_single_copy(self):
        user_a_token = self._login_user("step6_user_a3", "pass_a3_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step6-src-3")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step6_user_b3", "pass_b3_123")
        r_initial = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        copy_id = r_initial.json()["trip"]["id"]

        for cycle in range(1, 4):
            # Save
            self.client.put(f"/trips/{copy_id}", json={
                "trip": {
                    "id": copy_id,
                    "destination": f"Trip version {cycle}",
                    "startDate": "2026-08-01",
                    "endDate": "2026-08-05",
                }
            }, headers={"Authorization": f"Bearer {user_b_token}"})

            # Reopen
            r_reopen = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
            self.assertEqual(r_reopen.status_code, 200)
            self.assertEqual(r_reopen.json()["trip"]["id"], copy_id)
            self.assertTrue(r_reopen.json().get("isExistingCopy"))

        # Verify only 1 document exists for User B
        r_b_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_b_token}"})
        matching = [t for t in r_b_trips.json()["trips"] if str(t.get("copiedFromEditToken")) == edit_token]
        self.assertEqual(len(matching), 1)

    def test_step6_4_account_a_original_trip_remains_untouched_after_b_saves(self):
        user_a_token = self._login_user("step6_user_a4", "pass_a4_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step6-src-4")
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        edit_token = r_edit.json()["editShareToken"]

        user_b_token = self._login_user("step6_user_b4", "pass_b4_123")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        copy_id = r_copy.json()["trip"]["id"]

        # Account B modifies and saves
        self.client.put(f"/trips/{copy_id}", json={
            "trip": {
                "id": copy_id,
                "destination": "Swat Valley (Totally New Destination)",
                "startDate": "2026-11-01",
                "endDate": "2026-11-10",
                "itinerary": [{"day": 1, "locations": [{"name": "Malam Jabba", "lat": 35.0, "lon": 72.5}]}],
            }
        }, headers={"Authorization": f"Bearer {user_b_token}"})

        # Fetch Account A's trip and assert it is unchanged
        r_a_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_a_token}"})
        trip_a = next(t for t in r_a_trips.json()["trips"] if str(t["id"]) == source_trip_id)
        self.assertEqual(trip_a["name"], "Hunza Valley")
        self.assertEqual(trip_a["startDate"], "2026-08-01")
        self.assertEqual(trip_a["endDate"], "2026-08-05")
        self.assertEqual(trip_a["data"]["itinerary"][0]["locations"][0]["name"], "Attabad Lake")

    def test_step6_5_view_only_sharing_still_works_without_provenance_bleed(self):
        user_a_token = self._login_user("step6_user_a5", "pass_a5_123")
        source_trip_id = self._create_test_trip(user_a_token, "test-trip-step6-src-5")
        r_view = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {user_a_token}"})
        view_token = r_view.json()["shareToken"]

        # View-only access
        r_shared = self.client.get(f"/trips/shared/{view_token}")
        self.assertEqual(r_shared.status_code, 200)
        self.assertEqual(r_shared.json()["permission"], "view")
        self.assertEqual(r_shared.json()["trip"]["name"], "Hunza Valley")
        self.assertIsNone(r_shared.json()["trip"].get("copiedFromEditToken"))

    def test_step6_6_normal_non_shared_trip_does_not_receive_provenance(self):
        user_token = self._login_user("step6_user_normal", "pass_norm_123")
        trip_id = self._create_test_trip(user_token, "test-trip-normal-1")

        r_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_token}"})
        trip = next(t for t in r_trips.json()["trips"] if str(t["id"]) == str(trip_id))
        self.assertIsNone(trip.get("copiedFromEditToken"))
        self.assertIsNone(trip.get("sourceTripId"))

    def test_step6_7_malicious_client_cannot_inject_provenance_on_unrelated_trip(self):
        attacker_token = self._login_user("step6_attacker", "pass_atk_123")
        fake_token = "sh_edit_fake_injected_token_12345"
        malicious_payload = {
            "id": "attacker-trip-1",
            "destination": "Injected Provenance Trip",
            "startDate": "2026-09-01",
            "endDate": "2026-09-05",
            "copiedFromEditToken": fake_token,
            "sourceTripId": 99999,
            "data": {
                "copiedFromEditToken": fake_token,
                "sourceTripId": 99999,
            }
        }
        r_put = self.client.put("/trips/attacker-trip-1", json={"trip": malicious_payload}, headers={"Authorization": f"Bearer {attacker_token}"})
        self.assertEqual(r_put.status_code, 200)
        saved = r_put.json()["trip"]

        # Server must NOT have accepted injected provenance on a trip that was not created as an edit copy
        self.assertIsNone(saved.get("copiedFromEditToken"))
        self.assertIsNone(saved.get("sourceTripId"))
        self.assertNotIn("copiedFromEditToken", saved["data"])

    def test_bio_1_new_user_without_bio_works_normally(self):
        user_token = self._login_user("bio_user_test1", "pass_bio_123")
        r_verify = self.client.post("/auth/verify", json={"token": user_token})
        self.assertEqual(r_verify.status_code, 200)
        user_data = r_verify.json()["user"]
        self.assertEqual(user_data.get("bio"), "")
        self.assertEqual(user_data.get("username"), "bio_user_test1")

    def test_bio_2_and_3_bio_can_be_saved_and_returned_correctly(self):
        user_token = self._login_user("bio_user_test2", "pass_bio_123")
        test_bio = "Photographer & mountain hiker based in Lahore."
        payload = {
            "name": "Bio Tester Two",
            "username": "bio_user_test2",
            "email": "bio_user_test2@example.com",
            "profileImage": "",
            "bio": test_bio,
        }
        r_update = self.client.put("/account/profile", json=payload, headers={"Authorization": f"Bearer {user_token}"})
        self.assertEqual(r_update.status_code, 200)
        res = r_update.json()
        self.assertTrue(res["success"])
        self.assertEqual(res["user"]["bio"], test_bio)

    def test_bio_4_bio_appears_on_public_profile_serialization(self):
        user_token = self._login_user("bio_user_test4", "pass_bio_123")
        test_bio = "Exploring the Northern areas of Pakistan."
        self.client.put("/account/profile", json={
            "name": "Public Bio User",
            "username": "bio_user_test4",
            "email": "bio_user_test4@example.com",
            "bio": test_bio,
        }, headers={"Authorization": f"Bearer {user_token}"})

        r_pub = self.client.get("/api/users/by-username/bio_user_test4")
        self.assertEqual(r_pub.status_code, 200)
        pub_user = r_pub.json()["user"]
        self.assertEqual(pub_user["bio"], test_bio)
        self.assertEqual(pub_user["username"], "bio_user_test4")

    def test_bio_5_empty_bio_is_allowed(self):
        user_token = self._login_user("bio_user_test5", "pass_bio_123")
        # First set a bio
        self.client.put("/account/profile", json={
            "name": "User Five",
            "username": "bio_user_test5",
            "email": "bio_user_test5@example.com",
            "bio": "Initial bio text",
        }, headers={"Authorization": f"Bearer {user_token}"})

        # Clear bio with empty string
        r_clear = self.client.put("/account/profile", json={
            "name": "User Five",
            "username": "bio_user_test5",
            "email": "bio_user_test5@example.com",
            "bio": "",
        }, headers={"Authorization": f"Bearer {user_token}"})
        self.assertEqual(r_clear.status_code, 200)
        self.assertEqual(r_clear.json()["user"]["bio"], "")

    def test_bio_6_exactly_250_characters_is_accepted(self):
        user_token = self._login_user("bio_user_test6", "pass_bio_123")
        exact_250 = "A" * 250
        r = self.client.put("/account/profile", json={
            "name": "User Six",
            "username": "bio_user_test6",
            "email": "bio_user_test6@example.com",
            "bio": exact_250,
        }, headers={"Authorization": f"Bearer {user_token}"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user"]["bio"], exact_250)

    def test_bio_7_more_than_250_characters_is_rejected_by_backend(self):
        user_token = self._login_user("bio_user_test7", "pass_bio_123")
        too_long = "X" * 251
        r = self.client.put("/account/profile", json={
            "name": "User Seven",
            "username": "bio_user_test7",
            "email": "bio_user_test7@example.com",
            "bio": too_long,
        }, headers={"Authorization": f"Bearer {user_token}"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("250", r.json().get("detail", ""))

    def test_bio_8_updating_other_fields_preserves_existing_bio(self):
        user_token = self._login_user("bio_user_test8", "pass_bio_123")
        saved_bio = "Preserve this bio text across edits."
        self.client.put("/account/profile", json={
            "name": "Original Name",
            "username": "bio_user_test8",
            "email": "bio_user_test8@example.com",
            "bio": saved_bio,
        }, headers={"Authorization": f"Bearer {user_token}"})

        # Update name and email without passing bio (bio is None)
        r_update = self.client.put("/account/profile", json={
            "name": "Updated Name",
            "username": "bio_user_test8",
            "email": "bio_user_test8_new@example.com",
        }, headers={"Authorization": f"Bearer {user_token}"})
        self.assertEqual(r_update.status_code, 200)
        user_data = r_update.json()["user"]
        self.assertEqual(user_data["name"], "Updated Name")
        self.assertEqual(user_data["email"], "bio_user_test8_new@example.com")
        self.assertEqual(user_data["bio"], saved_bio)

    def test_bio_9_public_serialization_exposes_bio_and_excludes_private_fields(self):
        user_token = self._login_user("bio_user_test9", "pass_bio_123")
        self.client.put("/account/profile", json={
            "name": "Public Safe User",
            "username": "bio_user_test9",
            "email": "private_secret_email@example.com",
            "bio": "Publicly visible bio info.",
        }, headers={"Authorization": f"Bearer {user_token}"})

        r_pub = self.client.get("/api/users/by-username/bio_user_test9")
        self.assertEqual(r_pub.status_code, 200)
        pub_user = r_pub.json()["user"]
        self.assertEqual(pub_user["bio"], "Publicly visible bio info.")
        self.assertEqual(pub_user["username"], "bio_user_test9")
        self.assertEqual(pub_user["name"], "Public Safe User")

        # Confirm private fields are NOT present
        self.assertNotIn("email", pub_user)
        self.assertNotIn("password_hash", pub_user)
        self.assertNotIn("password", pub_user)
        self.assertNotIn("googleId", pub_user)
        self.assertNotIn("role", pub_user)
        self.assertNotIn("status", pub_user)

    def test_bio_10_public_user_search_includes_bio_and_preserves_functionality(self):
        user_token = self._login_user("bio_search_user", "pass_bio_123")
        self.client.put("/account/profile", json={
            "name": "Searchable Wanderer",
            "username": "bio_search_user",
            "email": "bio_search@example.com",
            "bio": "Searching for the next peak.",
        }, headers={"Authorization": f"Bearer {user_token}"})

        r_search = self.client.get("/api/users/search", params={"q": "bio_search_user"})
        self.assertEqual(r_search.status_code, 200)
        users = r_search.json()["users"]
        matching = next((u for u in users if u["username"] == "bio_search_user"), None)
        self.assertIsNotNone(matching)
        self.assertEqual(matching["bio"], "Searching for the next peak.")
        self.assertNotIn("email", matching)
        self.assertNotIn("password_hash", matching)

    def test_step1_privacy_persistence_and_normalization(self):
        token = self._login_user("step1_priv_user", "pass_priv_123")

        # 1. Default / missing privacy safely becomes "private"
        trip_no_priv = {
            "id": "priv-test-1",
            "destination": "Naran Valley",
            "startDate": "2026-07-01",
            "endDate": "2026-07-05",
        }
        r1 = self.client.put("/trips/priv-test-1", json={"trip": trip_no_priv}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r1.status_code, 200)
        t1 = r1.json()["trip"]
        self.assertEqual(t1["privacy"], "private")
        self.assertEqual(t1["data"]["privacy"], "private")

        # 2. Saving a public trip produces privacy="public" and data.privacy="public"
        trip_public = {
            "id": "priv-test-2",
            "destination": "Skardu Valley",
            "startDate": "2026-08-01",
            "endDate": "2026-08-05",
            "privacy": "public",
        }
        r2 = self.client.put("/trips/priv-test-2", json={"trip": trip_public}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r2.status_code, 200)
        t2 = r2.json()["trip"]
        self.assertEqual(t2["privacy"], "public")
        self.assertEqual(t2["data"]["privacy"], "public")

        # 3. Saving a friends trip produces privacy="friends" and data.privacy="friends"
        trip_friends = {
            "id": "priv-test-3",
            "destination": "Kaghan Valley",
            "startDate": "2026-09-01",
            "endDate": "2026-09-05",
            "privacy": "friends",
        }
        r3 = self.client.put("/trips/priv-test-3", json={"trip": trip_friends}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r3.status_code, 200)
        t3 = r3.json()["trip"]
        self.assertEqual(t3["privacy"], "friends")
        self.assertEqual(t3["data"]["privacy"], "friends")

        # 4. Saving an explicit private trip produces privacy="private" and data.privacy="private"
        trip_private = {
            "id": "priv-test-4",
            "destination": "Chitral Valley",
            "startDate": "2026-10-01",
            "endDate": "2026-10-05",
            "privacy": "private",
        }
        r4 = self.client.put("/trips/priv-test-4", json={"trip": trip_private}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r4.status_code, 200)
        t4 = r4.json()["trip"]
        self.assertEqual(t4["privacy"], "private")
        self.assertEqual(t4["data"]["privacy"], "private")

        # 6. Invalid privacy safely normalizes to "private"
        trip_invalid = {
            "id": "priv-test-5",
            "destination": "Neelum Valley",
            "startDate": "2026-11-01",
            "endDate": "2026-11-05",
            "privacy": "UNSUPPORTED_RANDOM_STATE",
        }
        r5 = self.client.put("/trips/priv-test-5", json={"trip": trip_invalid}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r5.status_code, 200)
        t5 = r5.json()["trip"]
        self.assertEqual(t5["privacy"], "private")
        self.assertEqual(t5["data"]["privacy"], "private")

        # 7. Loading trips from GET /trips includes serialized top-level privacy and data.privacy
        r_list = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_list.status_code, 200)
        trips = {str(t["id"]): t for t in r_list.json()["trips"]}
        self.assertEqual(trips["priv-test-2"]["privacy"], "public")
        self.assertEqual(trips["priv-test-2"]["data"]["privacy"], "public")
        self.assertEqual(trips["priv-test-3"]["privacy"], "friends")
        self.assertEqual(trips["priv-test-4"]["privacy"], "private")

        # 8-12. Owner update with sharing tokens preserves tokens and privacy
        r_share = self.client.post("/trips/priv-test-2/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_share.status_code, 200)
        view_token = r_share.json()["shareToken"]

        r_edit_share = self.client.post("/trips/priv-test-2/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_edit_share.status_code, 200)
        edit_token = r_edit_share.json()["editShareToken"]

        # Owner saves again
        t2["destination"] = "Skardu Valley (Updated)"
        r_up = self.client.put("/trips/priv-test-2", json={"trip": t2}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_up.status_code, 200)
        saved_up = r_up.json()["trip"]
        self.assertEqual(saved_up["privacy"], "public")
        self.assertEqual(saved_up["shareToken"], view_token)
        self.assertEqual(saved_up["editShareToken"], edit_token)

        # View-only retrieval still works and does not leak private fields
        r_shared_view = self.client.get(f"/trips/shared/{view_token}")
        self.assertEqual(r_shared_view.status_code, 200)
        self.assertEqual(r_shared_view.json()["trip"]["privacy"], "public")

        # Can-edit copy preserves privacy on new recipient copy
        recipient_token = self._login_user("step1_recipient_user", "pass_recip_123")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {recipient_token}"})
        self.assertEqual(r_copy.status_code, 200)
        copy_trip = r_copy.json()["trip"]
        self.assertIn("privacy", copy_trip)
        self.assertEqual(copy_trip["privacy"], "public")

    def test_public_trips_retrieval_endpoint(self):
        # Setup User A with multiple trips of different privacy settings
        user_a_token = self._login_user("step2b_user_a", "pass_a_123")
        user_b_token = self._login_user("step2b_user_b", "pass_b_123")
        empty_user_token = self._login_user("step2b_empty_user", "pass_empty_123")

        # Create trips for User A
        # Trip 1: Public with places & itinerary
        trip_pub = {
            "id": "step2b-pub-1",
            "title": "Public Hunza Expedition",
            "destination": "Hunza Valley",
            "startDate": "2026-10-01",
            "endDate": "2026-10-05",
            "privacy": "public",
            "budget": 50000,
            "expenses": [{"item": "hotel", "cost": 20000}],
            "notes": "Secret internal planning notes",
            "days": [
                {"day": 1, "items": [{"name": "Altit Fort", "lat": 36.31, "lon": 74.69}]},
                {"day": 2, "items": [{"name": "Baltit Fort", "lat": 36.32, "lon": 74.68}]},
            ],
            "placesPool": [{"name": "Attabad Lake"}],
        }
        r1 = self.client.put("/trips/step2b-pub-1", json={"trip": trip_pub}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r1.status_code, 200)

        # Trip 2: Private
        trip_priv = {
            "id": "step2b-priv-2",
            "title": "Private Lahore Stay",
            "destination": "Lahore",
            "startDate": "2026-10-10",
            "endDate": "2026-10-12",
            "privacy": "private",
        }
        r2 = self.client.put("/trips/step2b-priv-2", json={"trip": trip_priv}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r2.status_code, 200)

        # Trip 3: Friends
        trip_friends = {
            "id": "step2b-friends-3",
            "title": "Friends Swat Trip",
            "destination": "Swat Valley",
            "startDate": "2026-10-15",
            "endDate": "2026-10-18",
            "privacy": "friends",
        }
        r3 = self.client.put("/trips/step2b-friends-3", json={"trip": trip_friends}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r3.status_code, 200)

        # Trip 4: Private trip WITH a shareToken (View Only)
        trip_priv_shared = {
            "id": "step2b-priv-shared-4",
            "title": "Private Shared Chitral",
            "destination": "Chitral",
            "startDate": "2026-10-20",
            "endDate": "2026-10-22",
            "privacy": "private",
        }
        r4 = self.client.put("/trips/step2b-priv-shared-4", json={"trip": trip_priv_shared}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r4.status_code, 200)
        r4_token = self.client.post("/trips/step2b-priv-shared-4/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r4_token.status_code, 200)

        # Trip 5: Private trip WITH an editShareToken (Can Edit)
        trip_priv_edit = {
            "id": "step2b-priv-edit-5",
            "title": "Private Edit Naran",
            "destination": "Naran",
            "startDate": "2026-10-25",
            "endDate": "2026-10-27",
            "privacy": "private",
        }
        r5 = self.client.put("/trips/step2b-priv-edit-5", json={"trip": trip_priv_edit}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r5.status_code, 200)
        r5_token = self.client.post("/trips/step2b-priv-edit-5/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r5_token.status_code, 200)

        # User B Trip: Public trip belonging to User B
        trip_b = {
            "id": "step2b-user-b-pub",
            "title": "User B Public Skardu",
            "destination": "Skardu",
            "startDate": "2026-11-01",
            "endDate": "2026-11-05",
            "privacy": "public",
        }
        rb = self.client.put("/trips/step2b-user-b-pub", json={"trip": trip_b}, headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(rb.status_code, 200)

        # 1. Unauthenticated request retrieves public trips for user A
        r_public_unauth = self.client.get("/api/users/step2b_user_a/public-trips")
        self.assertEqual(r_public_unauth.status_code, 200)
        data = r_public_unauth.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["username"], "step2b_user_a")
        self.assertIn("user", data)
        self.assertIn("trips", data)

        # 2. Only public trips returned (exactly 1 for user A)
        trip_ids = [t["tripId"] for t in data["trips"]]
        self.assertIn("step2b-pub-1", trip_ids)
        self.assertEqual(len(trip_ids), 1)

        # 3. Private trip is excluded
        self.assertNotIn("step2b-priv-2", trip_ids)

        # 4. Friends trip is excluded
        self.assertNotIn("step2b-friends-3", trip_ids)

        # 5. Private trip with shareToken is excluded
        self.assertNotIn("step2b-priv-shared-4", trip_ids)

        # 6. Private trip with editShareToken is excluded
        self.assertNotIn("step2b-priv-edit-5", trip_ids)

        # 7. User B's public trip is NOT returned under User A
        self.assertNotIn("step2b-user-b-pub", trip_ids)

        # 8. Authenticated request also works
        r_public_auth = self.client.get("/api/users/step2b_user_a/public-trips", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_public_auth.status_code, 200)
        data_auth = r_public_auth.json()
        self.assertEqual(len(data_auth["trips"]), 1)

        # 9. Case-insensitive username lookup works
        r_case = self.client.get("/api/users/STEP2B_USER_A/public-trips")
        self.assertEqual(r_case.status_code, 200)
        self.assertEqual(r_case.json()["username"], "step2b_user_a")

        # 10. Direct alias /users/{username}/public-trips works identically
        r_alias = self.client.get("/users/step2b_user_a/public-trips")
        self.assertEqual(r_alias.status_code, 200)
        self.assertEqual(len(r_alias.json()["trips"]), 1)

        # 11. Public trip summary contains only approved safe fields
        t_sum = data["trips"][0]
        self.assertEqual(t_sum["tripId"], "step2b-pub-1")
        self.assertEqual(t_sum["title"], "Public Hunza Expedition")
        self.assertEqual(t_sum["destination"], "Hunza Valley")
        self.assertEqual(t_sum["startDate"], "2026-10-01")
        self.assertEqual(t_sum["endDate"], "2026-10-05")
        self.assertEqual(t_sum["privacy"], "public")
        self.assertEqual(t_sum["placeCount"], 3)  # 2 in days + 1 in placesPool
        self.assertEqual(t_sum["dayCount"], 2)   # 2 days in days list

        # 12. Sensitive / private fields explicitly excluded
        forbidden_fields = [
            "shareToken", "editShareToken", "copiedFromEditToken", "sourceTripId",
            "userId", "email", "password_hash", "googleId", "role", "status",
            "budget", "expenses", "notes", "placesPool", "days", "itinerary", "data"
        ]
        for f in forbidden_fields:
            self.assertNotIn(f, t_sum, f"Field '{f}' must NOT be exposed in public trip summary")

        # 13. Public user object in response contains only safe public profile fields
        user_info = data["user"]
        self.assertIn("username", user_info)
        self.assertIn("name", user_info)
        self.assertNotIn("email", user_info)
        self.assertNotIn("password_hash", user_info)
        self.assertNotIn("role", user_info)

        # 14. Nonexistent user returns 404
        r_404 = self.client.get("/api/users/nonexistent_user_xyz_999/public-trips")
        self.assertEqual(r_404.status_code, 404)

        # 15. User with 0 public trips returns success with empty list
        r_empty = self.client.get("/api/users/step2b_empty_user/public-trips")
        self.assertEqual(r_empty.status_code, 200)
        self.assertTrue(r_empty.json()["success"])
        self.assertEqual(r_empty.json()["trips"], [])

    def test_privacy_persistence_lifecycle(self):
        token = self._login_user("privacy_lifecycle_user", "pass_priv_123")
        trip_id = "priv-lifecycle-1"

        # 1. Create a trip initially as Private
        initial_trip = {
            "id": trip_id,
            "title": "Kaghan Valley Trek",
            "destination": "Kaghan",
            "startDate": "2026-08-01",
            "endDate": "2026-08-05",
            "privacy": "private",
        }
        r1 = self.client.put(f"/trips/{trip_id}", json={"trip": initial_trip}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r1.status_code, 200)
        t1 = r1.json()["trip"]
        self.assertEqual(t1["privacy"], "private")
        self.assertEqual(t1["data"]["privacy"], "private")

        # 2. Update to Public (Private -> Public)
        updated_to_public = {**t1, "privacy": "public"}
        r2 = self.client.put(f"/trips/{trip_id}", json={"trip": updated_to_public}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r2.status_code, 200)
        t2 = r2.json()["trip"]
        self.assertEqual(t2["privacy"], "public")
        self.assertEqual(t2["data"]["privacy"], "public")

        # 3. Reload from GET /trips and verify it returned Public
        r_reload1 = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_reload1.status_code, 200)
        saved_trips = {str(t["id"]): t for t in r_reload1.json()["trips"]}
        self.assertEqual(saved_trips[trip_id]["privacy"], "public")
        self.assertEqual(saved_trips[trip_id]["data"]["privacy"], "public")

        # 4. Update to Friends (Public -> Friends)
        updated_to_friends = {**t2, "privacy": "friends"}
        r3 = self.client.put(f"/trips/{trip_id}", json={"trip": updated_to_friends}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r3.status_code, 200)
        t3 = r3.json()["trip"]
        self.assertEqual(t3["privacy"], "friends")
        self.assertEqual(t3["data"]["privacy"], "friends")

        # 5. Reload and verify Friends
        r_reload2 = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_reload2.status_code, 200)
        saved_trips2 = {str(t["id"]): t for t in r_reload2.json()["trips"]}
        self.assertEqual(saved_trips2[trip_id]["privacy"], "friends")

        # 6. Update back to Private (Friends -> Private)
        updated_to_private = {**t3, "privacy": "private"}
        r4 = self.client.put(f"/trips/{trip_id}", json={"trip": updated_to_private}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r4.status_code, 200)
        t4 = r4.json()["trip"]
        self.assertEqual(t4["privacy"], "private")
        self.assertEqual(t4["data"]["privacy"], "private")

        # 7. Reload and verify Private
        r_reload3 = self.client.get("/trips", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r_reload3.status_code, 200)
        saved_trips3 = {str(t["id"]): t for t in r_reload3.json()["trips"]}
        self.assertEqual(saved_trips3[trip_id]["privacy"], "private")

    def test_can_edit_full_lifecycle_and_privacy_idempotency(self):
        # 1. Account A owns trip
        user_a_token = self._login_user("reg_user_a", "pass_reg_a1")
        source_trip_id = self._create_test_trip(user_a_token, "reg-trip-islamabad-src")

        # 2. A generates/has editShareToken
        r_edit = self.client.post(f"/trips/{source_trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r_edit.status_code, 200)
        edit_token = r_edit.json()["editShareToken"]
        self.assertTrue(edit_token.startswith("sh_edit_"))

        # 3. Account B opens edit link
        user_b_token = self._login_user("reg_user_b", "pass_reg_b1")
        r_copy = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_copy.status_code, 200)

        # 4 & 5. B receives/creates independent copy, record B copy tripId
        copy_b_trip = r_copy.json()["trip"]
        copy_b_id = copy_b_trip["id"]
        self.assertNotEqual(str(copy_b_id), str(source_trip_id))

        # 6. Verify provenance exists server-side
        self.assertEqual(copy_b_trip.get("copiedFromEditToken"), edit_token)
        self.assertEqual(str(copy_b_trip.get("sourceTripId")), str(source_trip_id))

        # 7. B performs a normal save/update of that copy
        updated_payload = {
            "id": copy_b_id,
            "title": "Trip to Islamabad (B customized)",
            "destination": "Islamabad",
            "startDate": "2026-04-04",
            "endDate": "2026-04-10",
            "privacy": "private",
        }
        r_save1 = self.client.put(f"/trips/{copy_b_id}", json={"trip": updated_payload}, headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_save1.status_code, 200)
        saved_b_trip = r_save1.json()["trip"]

        # 8 & 9. Reload B trips and verify SAME tripId
        r_b_trips1 = self.client.get("/trips", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_b_trips1.status_code, 200)
        b_trips1 = r_b_trips1.json()["trips"]
        matching1 = [t for t in b_trips1 if str(t.get("copiedFromEditToken")) == edit_token]
        self.assertEqual(len(matching1), 1, "Account B must have exactly ONE copy with this edit token")
        self.assertEqual(str(matching1[0]["id"]), str(copy_b_id))

        # 10. Verify provenance still exists server-side
        self.assertEqual(matching1[0].get("copiedFromEditToken"), edit_token)
        self.assertEqual(str(matching1[0].get("sourceTripId")), str(source_trip_id))

        # 11 & 12. Open SAME edit token again as B, verify SAME existing copy returned
        r_reopen1 = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_reopen1.status_code, 200)
        self.assertTrue(r_reopen1.json().get("isExistingCopy"))
        self.assertEqual(str(r_reopen1.json()["trip"]["id"]), str(copy_b_id))

        # 13. Save again
        r_save2 = self.client.put(f"/trips/{copy_b_id}", json={"trip": {**updated_payload, "notes": "Second save note"}}, headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_save2.status_code, 200)

        # 14. Verify B still has exactly ONE recipient copy for that edit token
        r_b_trips2 = self.client.get("/trips", headers={"Authorization": f"Bearer {user_b_token}"})
        matching2 = [t for t in r_b_trips2.json()["trips"] if str(t.get("copiedFromEditToken")) == edit_token]
        self.assertEqual(len(matching2), 1)

        # 15. Verify A still has exactly ONE original and is unchanged
        r_a_trips = self.client.get("/trips", headers={"Authorization": f"Bearer {user_a_token}"})
        a_matching = [t for t in r_a_trips.json()["trips"] if str(t["id"]) == str(source_trip_id)]
        self.assertEqual(len(a_matching), 1)
        self.assertEqual(a_matching[0]["name"], "Hunza Valley")

        # Test: B changes privacy on their recipient copy -> saves -> provenance remains -> same edit link resolves to same copy
        updated_with_public_privacy = {**updated_payload, "privacy": "public"}
        r_save_priv = self.client.put(f"/trips/{copy_b_id}", json={"trip": updated_with_public_privacy}, headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_save_priv.status_code, 200)
        self.assertEqual(r_save_priv.json()["trip"]["privacy"], "public")

        # Reopen edit link after privacy change
        r_reopen_after_priv = self.client.post(f"/trips/shared/edit/{edit_token}/copy", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_reopen_after_priv.status_code, 200)
        self.assertTrue(r_reopen_after_priv.json().get("isExistingCopy"))
        self.assertEqual(str(r_reopen_after_priv.json()["trip"]["id"]), str(copy_b_id))

        # Check trips list
        r_b_trips3 = self.client.get("/trips", headers={"Authorization": f"Bearer {user_b_token}"})
        matching3 = [t for t in r_b_trips3.json()["trips"] if str(t.get("copiedFromEditToken")) == edit_token]
        self.assertEqual(len(matching3), 1)
        self.assertEqual(matching3[0]["privacy"], "public")
        self.assertEqual(matching3[0].get("copiedFromEditToken"), edit_token)

    def test_public_trip_detail_endpoint(self):
        user_a_token = self._login_user("pub_detail_user_a", "pass_a_detail_123")
        user_b_token = self._login_user("pub_detail_user_b", "pass_b_detail_123")

        trip_id = "pub-detail-test-101"
        trip_payload = {
            "id": trip_id,
            "title": "Public Karakoram Highway Adventure",
            "destination": "Hunza & Gilgit",
            "startDate": "2026-08-01",
            "endDate": "2026-08-07",
            "privacy": "public",
            "budget": {"currency": "PKR", "amount": 80000},
            "expenses": [{"item": "Fuel", "cost": 25000}],
            "notes": "Secret personal itinerary notes and phone numbers",
            "customLists": [{"name": "Packing", "items": ["Trekking shoes"]}],
            "enginePreferences": {"maxBudget": 80000, "province": "Gilgit-Baltistan"},
            "days": [
                {
                    "id": "day-1",
                    "label": "Day 1: Arrival in Gilgit",
                    "shortLabel": "Day 1",
                    "date": "2026-08-01",
                    "items": [
                        {
                            "id": "place-1",
                            "title": "Gilgit Serena Hotel",
                            "name": "Gilgit Serena Hotel",
                            "category": "hotel",
                            "subtitle": "Sherullah Baig Road",
                            "address": "Sherullah Baig Road, Gilgit",
                            "lat": 35.9208,
                            "lon": 74.3144,
                            "image": "/assets/images/hotel.jpg",
                            "startTime": "14:00",
                            "endTime": "15:00",
                            "note": "Secret room code 404",
                        }
                    ],
                },
                {
                    "id": "day-2",
                    "label": "Day 2: Baltit Fort",
                    "shortLabel": "Day 2",
                    "date": "2026-08-02",
                    "items": [
                        {
                            "id": "place-2",
                            "title": "Baltit Fort",
                            "name": "Baltit Fort",
                            "category": "attraction",
                            "subtitle": "Karimabad",
                            "lat": 36.3256,
                            "lon": 74.6708,
                            "startTime": "10:00",
                            "endTime": "12:30",
                        }
                    ],
                }
            ],
            "placesPool": [
                {
                    "id": "pool-1",
                    "title": "Attabad Lake",
                    "category": "scenic",
                    "lat": 36.3353,
                    "lon": 74.8661,
                }
            ],
        }

        # 1. User A saves public trip and creates share tokens
        r_save = self.client.put(f"/trips/{trip_id}", json={"trip": trip_payload}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r_save.status_code, 200)

        # Generate tokens on User A's trip to confirm they exist in DB
        self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "view"}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.client.post(f"/trips/{trip_id}/share-token", json={"permission": "edit"}, headers={"Authorization": f"Bearer {user_a_token}"})

        # 2. Unauthenticated request to /api/trips/public/{trip_id}
        r_pub = self.client.get(f"/api/trips/public/{trip_id}")
        self.assertEqual(r_pub.status_code, 200)
        data = r_pub.json()
        self.assertTrue(data.get("success"))
        trip = data.get("trip")
        self.assertIsNotNone(trip)

        # Verify safe presentation fields
        self.assertEqual(trip["tripId"], trip_id)
        self.assertEqual(trip["id"], trip_id)
        self.assertEqual(trip["title"], "Public Karakoram Highway Adventure")
        self.assertEqual(trip["destination"], "Hunza & Gilgit")
        self.assertEqual(trip["startDate"], "2026-08-01")
        self.assertEqual(trip["endDate"], "2026-08-07")
        self.assertEqual(trip["privacy"], "public")
        self.assertEqual(trip["placeCount"], 3)  # 2 in days + 1 in pool
        self.assertEqual(trip["dayCount"], 2)

        # Verify days structure
        self.assertEqual(len(trip["days"]), 2)
        day1 = trip["days"][0]
        self.assertEqual(day1["id"], "day-1")
        self.assertEqual(day1["label"], "Day 1: Arrival in Gilgit")
        self.assertEqual(len(day1["items"]), 1)
        place1 = day1["items"][0]
        self.assertEqual(place1["id"], "place-1")
        self.assertEqual(place1["title"], "Gilgit Serena Hotel")
        self.assertEqual(place1["category"], "hotel")
        self.assertEqual(place1["lat"], 35.9208)
        self.assertEqual(place1["lon"], 74.3144)
        self.assertEqual(place1["startTime"], "14:00")
        self.assertEqual(place1["endTime"], "15:00")

        # Verify placesPool
        self.assertEqual(len(trip["placesPool"]), 1)
        self.assertEqual(trip["placesPool"][0]["title"], "Attabad Lake")

        # 3. Verify owner public identity
        self.assertIn("owner", trip)
        self.assertEqual(trip["owner"]["username"], "pub_detail_user_a")
        self.assertIn("name", trip["owner"])
        self.assertNotIn("email", trip["owner"])
        self.assertNotIn("password_hash", trip["owner"])
        self.assertNotIn("userId", trip["owner"])
        self.assertNotIn("role", trip["owner"])

        # 4. SENSITIVE FIELD STRIPPING AUDIT
        forbidden_fields = [
            "shareToken", "editShareToken", "copiedFromEditToken", "sourceTripId",
            "userId", "email", "password_hash", "googleId", "role", "status",
            "budget", "expenses", "notes", "customLists", "checklists",
            "enginePreferences", "preferences", "questionnaire", "_id", "data"
        ]
        for f in forbidden_fields:
            self.assertNotIn(f, trip, f"Field '{f}' must NOT be in public trip detail root")

        # Check inside day and place objects
        for d in trip["days"]:
            for f in ["notes", "budget", "expenses"]:
                self.assertNotIn(f, d)
            for p in d.get("items", []):
                for f in ["note", "notes", "secret", "visitDetails"]:
                    self.assertNotIn(f, p, f"Field '{f}' must NOT be in place object")

        # 5. Direct alias /trips/public/{trip_id} works identically
        r_alias = self.client.get(f"/trips/public/{trip_id}")
        self.assertEqual(r_alias.status_code, 200)
        self.assertEqual(r_alias.json()["trip"]["tripId"], trip_id)

        # 6. User B (authenticated) can also access User A's public trip
        r_user_b = self.client.get(f"/api/trips/public/{trip_id}", headers={"Authorization": f"Bearer {user_b_token}"})
        self.assertEqual(r_user_b.status_code, 200)

        # 7. Non-existent trip returns 404
        r_not_found = self.client.get("/api/trips/public/nonexistent_trip_id_99999")
        self.assertEqual(r_not_found.status_code, 404)

        # 8. Trip changed to Private returns 404
        r_priv = self.client.put(f"/trips/{trip_id}", json={"trip": {**trip_payload, "privacy": "private"}}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r_priv.status_code, 200)

        r_pub_priv = self.client.get(f"/api/trips/public/{trip_id}")
        self.assertEqual(r_pub_priv.status_code, 404)

        # 9. Trip changed to Friends returns 404
        r_friends = self.client.put(f"/trips/{trip_id}", json={"trip": {**trip_payload, "privacy": "friends"}}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r_friends.status_code, 200)

        r_pub_friends = self.client.get(f"/api/trips/public/{trip_id}")
        self.assertEqual(r_pub_friends.status_code, 404)

        # 10. Integer tripId polymorphism test
        int_trip_id = 1774393282000
        int_trip_payload = {
            "id": int_trip_id,
            "title": "Integer ID Public Trip",
            "destination": "Skardu",
            "privacy": "public",
        }
        r_int_save = self.client.put(f"/trips/{int_trip_id}", json={"trip": int_trip_payload}, headers={"Authorization": f"Bearer {user_a_token}"})
        self.assertEqual(r_int_save.status_code, 200)

        r_int_pub = self.client.get(f"/api/trips/public/{int_trip_id}")
        self.assertEqual(r_int_pub.status_code, 200)
        self.assertEqual(str(r_int_pub.json()["trip"]["tripId"]), str(int_trip_id))

    def test_follow_unfollow_lifecycle(self):
        # 1. Setup isolated test users
        suffix = "fol_test_" + str(int(self.client.get("/provinces").elapsed.total_seconds() * 1000000))[-6:]
        user_a_username = f"user_a_{suffix}"
        user_b_username = f"user_b_{suffix}"

        token_a = self._login_user(username=user_a_username, password="password123")
        token_b = self._login_user(username=user_b_username, password="password123")

        self.assertTrue(token_a)
        self.assertTrue(token_b)

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 2. Unauthenticated follow is rejected (401)
        r_unauth = self.client.post(f"/api/users/{user_b_username}/follow")
        self.assertEqual(r_unauth.status_code, 401)

        # 3. Non-existent target user is rejected (404)
        r_nonexistent = self.client.post("/api/users/nonexistent_usr_99999/follow", headers=headers_a)
        self.assertEqual(r_nonexistent.status_code, 404)

        # 4. Self-follow is rejected (400)
        r_self = self.client.post(f"/api/users/{user_a_username}/follow", headers=headers_a)
        self.assertEqual(r_self.status_code, 400)

        # 5. Initial state check
        r_init_b = self.client.get(f"/api/users/{user_b_username}/follow-status", headers=headers_a)
        self.assertEqual(r_init_b.status_code, 200)
        init_data = r_init_b.json()
        self.assertEqual(init_data["followerCount"], 0)
        self.assertEqual(init_data["followingCount"], 0)
        self.assertFalse(init_data["isFollowing"])

        # 6. User A follows User B
        r_follow = self.client.post(f"/api/users/{user_b_username}/follow", headers=headers_a)
        self.assertEqual(r_follow.status_code, 200)
        fol_data = r_follow.json()
        self.assertTrue(fol_data["success"])
        self.assertTrue(fol_data["isFollowing"])
        self.assertEqual(fol_data["followerCount"], 1)

        # 7. Duplicate follow is idempotent (follower count stays 1, no duplicate)
        r_dup_follow = self.client.post(f"/api/users/{user_b_username}/follow", headers=headers_a)
        self.assertEqual(r_dup_follow.status_code, 200)
        dup_data = r_dup_follow.json()
        self.assertTrue(dup_data["success"])
        self.assertTrue(dup_data["isFollowing"])
        self.assertEqual(dup_data["followerCount"], 1)

        # 8. Follow status & public user query verification
        # 8a. User B's status viewed by User A
        r_status_a_viewing_b = self.client.get(f"/api/users/{user_b_username}/follow-status", headers=headers_a)
        self.assertEqual(r_status_a_viewing_b.status_code, 200)
        data_a_viewing_b = r_status_a_viewing_b.json()
        self.assertEqual(data_a_viewing_b["followerCount"], 1)
        self.assertEqual(data_a_viewing_b["followingCount"], 0)
        self.assertTrue(data_a_viewing_b["isFollowing"])

        # 8b. User A's status viewed by User B
        r_status_b_viewing_a = self.client.get(f"/api/users/{user_a_username}/follow-status", headers=headers_b)
        self.assertEqual(r_status_b_viewing_a.status_code, 200)
        data_b_viewing_a = r_status_b_viewing_a.json()
        self.assertEqual(data_b_viewing_a["followerCount"], 0)
        self.assertEqual(data_b_viewing_a["followingCount"], 1)
        self.assertFalse(data_b_viewing_a["isFollowing"])

        # 8c. User B's status viewed anonymously (no token)
        r_status_anon = self.client.get(f"/api/users/{user_b_username}/follow-status")
        self.assertEqual(r_status_anon.status_code, 200)
        data_anon = r_status_anon.json()
        self.assertEqual(data_anon["followerCount"], 1)
        self.assertFalse(data_anon["isFollowing"])

        # 8d. Public profile endpoint includes follow counts without exposing private fields
        r_pub_b = self.client.get(f"/api/users/by-username/{user_b_username}")
        self.assertEqual(r_pub_b.status_code, 200)
        pub_b_data = r_pub_b.json()
        self.assertEqual(pub_b_data["user"]["followerCount"], 1)
        self.assertEqual(pub_b_data["user"]["followingCount"], 0)
        self.assertNotIn("email", pub_b_data["user"])
        self.assertNotIn("password_hash", pub_b_data["user"])
        self.assertNotIn("role", pub_b_data["user"])

        # 9. User A unfollows User B
        r_unfollow = self.client.delete(f"/api/users/{user_b_username}/follow", headers=headers_a)
        self.assertEqual(r_unfollow.status_code, 200)
        unfol_data = r_unfollow.json()
        self.assertTrue(unfol_data["success"])
        self.assertFalse(unfol_data["isFollowing"])
        self.assertEqual(unfol_data["followerCount"], 0)

        # 10. Idempotent unfollow
        r_dup_unfollow = self.client.delete(f"/api/users/{user_b_username}/follow", headers=headers_a)
        self.assertEqual(r_dup_unfollow.status_code, 200)
        dup_unfol_data = r_dup_unfollow.json()
        self.assertTrue(dup_unfol_data["success"])
        self.assertFalse(dup_unfol_data["isFollowing"])
        self.assertEqual(dup_unfol_data["followerCount"], 0)

        # Clean up test accounts
        self.client.delete("/account", headers=headers_a)
        self.client.delete("/account", headers=headers_b)

    def test_notification_follow_lifecycle(self):
        # 1. Setup isolated test users
        suffix = "notif_" + str(int(self.client.get("/provinces").elapsed.total_seconds() * 1000000))[-6:]
        user_a_username = f"user_a_{suffix}"
        user_b_username = f"user_b_{suffix}"

        token_a = self._login_user(username=user_a_username, password="password123")
        token_b = self._login_user(username=user_b_username, password="password123")

        self.assertTrue(token_a)
        self.assertTrue(token_b)

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 2. Unauthenticated notification access is rejected (401)
        r_unauth = self.client.get("/api/notifications")
        self.assertEqual(r_unauth.status_code, 401)

        # 3. User A initially has 0 notifications
        r_init_a = self.client.get("/api/notifications", headers=headers_a)
        self.assertEqual(r_init_a.status_code, 200)
        data_init_a = r_init_a.json()
        self.assertTrue(data_init_a["success"])
        self.assertEqual(len(data_init_a["notifications"]), 0)
        self.assertEqual(data_init_a["unreadCount"], 0)

        # 4. User B follows User A -> A receives 1 notification
        r_follow = self.client.post(f"/api/users/{user_a_username}/follow", headers=headers_b)
        self.assertEqual(r_follow.status_code, 200)

        r_notifs_a = self.client.get("/api/notifications", headers=headers_a)
        self.assertEqual(r_notifs_a.status_code, 200)
        data_notifs_a = r_notifs_a.json()
        self.assertTrue(data_notifs_a["success"])
        self.assertEqual(len(data_notifs_a["notifications"]), 1)
        self.assertEqual(data_notifs_a["unreadCount"], 1)

        first_notif = data_notifs_a["notifications"][0]
        self.assertEqual(first_notif["type"], "follow")
        self.assertFalse(first_notif["read"])
        self.assertEqual(first_notif["actor"]["username"], user_b_username)
        self.assertIn("started following you", first_notif["message"])
        self.assertNotIn("password_hash", first_notif["actor"])
        self.assertNotIn("email", first_notif["actor"])

        # 5. Duplicate follow by User B does NOT create duplicate notification
        r_dup_follow = self.client.post(f"/api/users/{user_a_username}/follow", headers=headers_b)
        self.assertEqual(r_dup_follow.status_code, 200)

        r_notifs_a_dup = self.client.get("/api/notifications", headers=headers_a)
        self.assertEqual(len(r_notifs_a_dup.json()["notifications"]), 1)
        self.assertEqual(r_notifs_a_dup.json()["unreadCount"], 1)

        # 6. User B unfollows User A -> no notification created
        r_unfollow = self.client.delete(f"/api/users/{user_a_username}/follow", headers=headers_b)
        self.assertEqual(r_unfollow.status_code, 200)

        r_notifs_a_after_unfollow = self.client.get("/api/notifications", headers=headers_a)
        self.assertEqual(len(r_notifs_a_after_unfollow.json()["notifications"]), 1)

        # 7. User B follows User A again after unfollow -> a new notification is created
        r_refollow = self.client.post(f"/api/users/{user_a_username}/follow", headers=headers_b)
        self.assertEqual(r_refollow.status_code, 200)

        r_notifs_a_refollow = self.client.get("/api/notifications", headers=headers_a)
        data_refollow = r_notifs_a_refollow.json()
        self.assertEqual(len(data_refollow["notifications"]), 2)
        self.assertEqual(data_refollow["unreadCount"], 2)

        # 8. User B cannot retrieve User A's notifications (private)
        r_notifs_b = self.client.get("/api/notifications", headers=headers_b)
        self.assertEqual(r_notifs_b.status_code, 200)
        self.assertEqual(len(r_notifs_b.json()["notifications"]), 0)
        self.assertEqual(r_notifs_b.json()["unreadCount"], 0)

        # 9. Mark individual notification as read
        latest_notif_id = data_refollow["notifications"][0]["id"]
        r_read_one = self.client.patch(f"/api/notifications/{latest_notif_id}/read", headers=headers_a)
        self.assertEqual(r_read_one.status_code, 200)
        self.assertEqual(r_read_one.json()["unreadCount"], 1)

        # 10. Mark all notifications as read
        r_read_all = self.client.post("/api/notifications/read-all", headers=headers_a)
        self.assertEqual(r_read_all.status_code, 200)
        self.assertEqual(r_read_all.json()["unreadCount"], 0)

        r_final_a = self.client.get("/api/notifications", headers=headers_a)
        self.assertEqual(r_final_a.json()["unreadCount"], 0)
        self.assertTrue(all(n["read"] for n in r_final_a.json()["notifications"]))

        # Clean up test accounts
        self.client.delete("/account", headers=headers_a)
        self.client.delete("/account", headers=headers_b)












