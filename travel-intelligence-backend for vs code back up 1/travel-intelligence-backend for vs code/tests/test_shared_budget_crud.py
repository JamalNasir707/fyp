"""
Comprehensive CRUD API test suite for Shared Budget SB-B2.
Tests all 16 required backend CRUD operations, multi-payer/multi-participant rules,
authorization boundaries, metadata protection, and non-destructive cleanup.

ZERO PERMANENT PERSISTENCE / ZERO PRODUCTION MUTATION.
"""

import unittest
import asyncio
from datetime import datetime, timezone
from app.auth_db import fallback_store, use_demo_fallback
from app.services.shared_budget import (
    create_shared_budget_expense,
    list_shared_budget_expenses,
    get_shared_budget_expense,
    update_shared_budget_expense,
    delete_shared_budget_expense,
    verify_shared_budget_access,
)


class TestSharedBudgetCRUD(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Prepare clean isolated demo fallback store state for testing."""
        fallback_store.setdefault("users", [])
        fallback_store.setdefault("trips", [])
        fallback_store.setdefault("trip_members", [])
        fallback_store.setdefault("shared_budget_expenses", [])

        # User setup
        cls.owner_id = "user_owner_crud_101"
        cls.member_accepted_id = "user_accepted_crud_102"
        cls.member_pending_id = "user_pending_crud_103"
        cls.member_declined_id = "user_declined_crud_104"
        cls.unrelated_user_id = "user_unrelated_crud_105"

        # Trip setup
        cls.trip_a_id = "trip_crud_alpha_100"
        cls.trip_b_id = "trip_crud_beta_200"

        # Add isolated trip records to fallback store
        fallback_store["trips"].extend([
            {"_id": cls.trip_a_id, "tripId": cls.trip_a_id, "userId": cls.owner_id, "title": "Trip Alpha"},
            {"_id": cls.trip_b_id, "tripId": cls.trip_b_id, "userId": cls.owner_id, "title": "Trip Beta"},
        ])

        # Add isolated membership records to fallback store
        fallback_store["trip_members"].extend([
            {"tripId": cls.trip_a_id, "userId": cls.member_accepted_id, "status": "accepted", "role": "member"},
            {"tripId": cls.trip_a_id, "userId": cls.member_pending_id, "status": "pending", "role": "member"},
            {"tripId": cls.trip_a_id, "userId": cls.member_declined_id, "status": "declined", "role": "member"},
        ])

    @classmethod
    def tearDownClass(cls):
        """Clean up ONLY the isolated test records created for this suite."""
        test_trip_ids = {cls.trip_a_id, cls.trip_b_id}
        test_user_ids = {
            cls.owner_id,
            cls.member_accepted_id,
            cls.member_pending_id,
            cls.member_declined_id,
            cls.unrelated_user_id,
        }

        fallback_store["trips"] = [
            t for t in fallback_store.get("trips", [])
            if str(t.get("tripId") or t.get("id") or t.get("_id")) not in test_trip_ids
        ]

        fallback_store["trip_members"] = [
            m for m in fallback_store.get("trip_members", [])
            if str(m.get("tripId")) not in test_trip_ids
        ]

        fallback_store["shared_budget_expenses"] = [
            e for e in fallback_store.get("shared_budget_expenses", [])
            if str(e.get("tripId")) not in test_trip_ids
        ]

    def setUp(self):
        """Clean expenses array before each test."""
        fallback_store["shared_budget_expenses"] = [
            e for e in fallback_store.get("shared_budget_expenses", [])
            if str(e.get("tripId")) not in {self.trip_a_id, self.trip_b_id}
        ]

    def test_1_owner_only_create_expense(self):
        """TEST 1: Owner-only CREATE expense."""
        payload = {
            "name": "Solo Dinner",
            "amount": 2500.0,
            "currency": "PKR",
            "category": "Eat & Drink",
            "date": "2026-10-02",
            "destinationReference": "Islamabad",
            "status": "paid",
            "payers": [{"userId": self.owner_id, "name": "Owner", "amount": 2500.0}],
            "participants": [{"userId": self.owner_id, "name": "Owner", "share": 2500.0}],
        }
        res = asyncio.run(create_shared_budget_expense(self.owner_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        self.assertIn("expense", res)
        self.assertEqual(res["expense"]["name"], "Solo Dinner")
        self.assertEqual(res["expense"]["amount"], 2500.0)

    def test_2_owner_can_list_expenses(self):
        """TEST 2: Owner can LIST expenses."""
        payload = {"name": "Item A", "amount": 100.0, "payers": [{"name": "P1"}]}
        asyncio.run(create_shared_budget_expense(self.owner_id, self.trip_a_id, payload))

        res = asyncio.run(list_shared_budget_expenses(self.owner_id, self.trip_a_id))
        self.assertTrue(res["success"])
        self.assertEqual(len(res["expenses"]), 1)
        self.assertEqual(res["expenses"][0]["name"], "Item A")

    def test_3_owner_can_get_one_expense(self):
        """TEST 3: Owner can GET one expense."""
        created = asyncio.run(create_shared_budget_expense(
            self.owner_id, self.trip_a_id, {"name": "Taxi", "amount": 500.0, "payers": [{"name": "P1"}]}
        ))
        exp_id = created["expense"]["id"]

        res = asyncio.run(get_shared_budget_expense(self.owner_id, self.trip_a_id, exp_id))
        self.assertTrue(res["success"])
        self.assertEqual(res["expense"]["id"], exp_id)
        self.assertEqual(res["expense"]["name"], "Taxi")

    def test_4_owner_can_update_expense(self):
        """TEST 4: Owner can UPDATE an expense."""
        created = asyncio.run(create_shared_budget_expense(
            self.owner_id, self.trip_a_id, {"name": "Old Name", "amount": 1000.0, "payers": [{"name": "P1"}]}
        ))
        exp_id = created["expense"]["id"]

        update_res = asyncio.run(update_shared_budget_expense(
            self.owner_id, self.trip_a_id, exp_id, {"name": "Updated Name", "amount": 1200.0}
        ))
        self.assertTrue(update_res["success"])
        self.assertEqual(update_res["expense"]["name"], "Updated Name")
        self.assertEqual(update_res["expense"]["amount"], 1200.0)

    def test_5_owner_can_delete_expense(self):
        """TEST 5: Owner can DELETE an expense."""
        created = asyncio.run(create_shared_budget_expense(
            self.owner_id, self.trip_a_id, {"name": "Delete Me", "amount": 300.0, "payers": [{"name": "P1"}]}
        ))
        exp_id = created["expense"]["id"]

        del_res = asyncio.run(delete_shared_budget_expense(self.owner_id, self.trip_a_id, exp_id))
        self.assertTrue(del_res["success"])

        # Verify list is empty
        list_res = asyncio.run(list_shared_budget_expenses(self.owner_id, self.trip_a_id))
        self.assertEqual(len(list_res["expenses"]), 0)

    def test_6_multiple_payers(self):
        """TEST 6: Multiple payers (A pays 6000, B pays 4000, total = 10000)."""
        payload = {
            "name": "Hotel Deposit",
            "amount": 10000.0,
            "payers": [
                {"userId": self.owner_id, "name": "Arslan", "amount": 6000.0},
                {"userId": self.member_accepted_id, "name": "Companion", "amount": 4000.0},
            ],
        }
        res = asyncio.run(create_shared_budget_expense(self.owner_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        payers = res["expense"]["payers"]
        self.assertEqual(len(payers), 2)
        self.assertEqual(payers[0]["amount"], 6000.0)
        self.assertEqual(payers[1]["amount"], 4000.0)
        self.assertEqual(sum(p["amount"] for p in payers), 10000.0)

    def test_7_multiple_participants(self):
        """TEST 7: Multiple participants (A share = 5000, B share = 3000, C share = 2000)."""
        payload = {
            "name": "Feast",
            "amount": 10000.0,
            "payers": [{"userId": self.owner_id, "name": "Arslan", "amount": 10000.0}],
            "participants": [
                {"userId": self.owner_id, "name": "Arslan", "share": 5000.0},
                {"userId": self.member_accepted_id, "name": "Bilal", "share": 3000.0},
                {"userId": self.member_pending_id, "name": "Hamza", "share": 2000.0},
            ],
        }
        res = asyncio.run(create_shared_budget_expense(self.owner_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        parts = res["expense"]["participants"]
        self.assertEqual(len(parts), 3)
        self.assertEqual(parts[0]["share"], 5000.0)
        self.assertEqual(parts[1]["share"], 3000.0)
        self.assertEqual(parts[2]["share"], 2000.0)

    def test_8_payers_and_participants_independent(self):
        """TEST 8: Payers and participants remain independent."""
        payload = {
            "name": "Gift",
            "amount": 5000.0,
            "payers": [{"userId": self.owner_id, "name": "Sponsor", "amount": 5000.0}],
            "participants": [{"userId": self.member_accepted_id, "name": "Recipient", "share": 5000.0}],
        }
        res = asyncio.run(create_shared_budget_expense(self.owner_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        self.assertEqual(res["expense"]["payers"][0]["userId"], self.owner_id)
        self.assertEqual(res["expense"]["participants"][0]["userId"], self.member_accepted_id)

    def test_9_pending_expense(self):
        """TEST 9: Pending expense."""
        payload = {
            "name": "Unpaid Ticket",
            "amount": 1500.0,
            "status": "pending",
            "payers": [{"userId": self.owner_id, "name": "Owner", "amount": 0.0}],
        }
        res = asyncio.run(create_shared_budget_expense(self.owner_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        self.assertEqual(res["expense"]["status"], "pending")

    def test_10_destination_reference_isolation(self):
        """TEST 10: Destination reference stored purely as a string label without location mutation."""
        payload = {
            "name": "Mosque Entry",
            "amount": 200.0,
            "destinationReference": "Faisal Masjid",
            "payers": [{"name": "P1", "amount": 200.0}],
        }
        res = asyncio.run(create_shared_budget_expense(self.owner_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        self.assertEqual(res["expense"]["destinationReference"], "Faisal Masjid")
        self.assertIsInstance(res["expense"]["destinationReference"], str)

    def test_11_cross_trip_isolation(self):
        """TEST 11: Cross-trip isolation (expense from trip A cannot be returned from trip B)."""
        created = asyncio.run(create_shared_budget_expense(
            self.owner_id, self.trip_a_id, {"name": "Trip A Expense", "amount": 100.0, "payers": [{"name": "P1"}]}
        ))
        exp_id = created["expense"]["id"]

        # Attempt to get exp_id from trip B
        get_res = asyncio.run(get_shared_budget_expense(self.owner_id, self.trip_b_id, exp_id))
        self.assertFalse(get_res["success"])
        self.assertEqual(get_res["status_code"], 404)

    def test_12_unauthorized_non_member_access(self):
        """TEST 12: Unauthorized/non-member access is rejected."""
        res = asyncio.run(list_shared_budget_expenses(self.unrelated_user_id, self.trip_a_id))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 403)

    def test_13_pending_tripmate_access(self):
        """TEST 13: Pending Tripmate invitation does NOT grant access."""
        res = asyncio.run(list_shared_budget_expenses(self.member_pending_id, self.trip_a_id))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 403)

    def test_14_declined_member_access(self):
        """TEST 14: Declined member does NOT grant access."""
        res = asyncio.run(list_shared_budget_expenses(self.member_declined_id, self.trip_a_id))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 403)

    def test_15_update_protected_metadata(self):
        """TEST 15: Update cannot change protected metadata (id, tripId, createdBy, createdAt)."""
        created = asyncio.run(create_shared_budget_expense(
            self.owner_id, self.trip_a_id, {"name": "Initial", "amount": 100.0, "payers": [{"name": "P1"}]}
        ))
        exp_id = created["expense"]["id"]
        orig_created_at = created["expense"]["createdAt"]

        update_res = asyncio.run(update_shared_budget_expense(
            self.owner_id, self.trip_a_id, exp_id,
            {"id": "hacked_id", "tripId": "hacked_trip", "createdBy": "hacked_user", "name": "Safely Updated"}
        ))
        self.assertTrue(update_res["success"])
        self.assertEqual(update_res["expense"]["id"], exp_id)
        self.assertEqual(update_res["expense"]["tripId"], self.trip_a_id)
        self.assertEqual(update_res["expense"]["createdBy"], self.owner_id)
        self.assertEqual(update_res["expense"]["createdAt"], orig_created_at)
        self.assertEqual(update_res["expense"]["name"], "Safely Updated")

    def test_16_delete_removes_only_expense(self):
        """TEST 16: Delete removes ONLY the expense record; trip itself still exists."""
        created = asyncio.run(create_shared_budget_expense(
            self.owner_id, self.trip_a_id, {"name": "To Delete", "amount": 100.0, "payers": [{"name": "P1"}]}
        ))
        exp_id = created["expense"]["id"]

        del_res = asyncio.run(delete_shared_budget_expense(self.owner_id, self.trip_a_id, exp_id))
        self.assertTrue(del_res["success"])

        # Verify access to trip is still intact (owner access check returns True)
        auth_check = asyncio.run(verify_shared_budget_access(self.owner_id, self.trip_a_id))
        self.assertTrue(auth_check["success"])


if __name__ == "__main__":
    unittest.main()
