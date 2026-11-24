"""
Comprehensive API test suite for Shared Budget Settlements SB-C3B.
Tests all required settlement operations: Create, List, Get Single, Delete,
roster validation, authorization boundaries, date/amount validation,
cross-trip isolation, non-destructive safety, and cleanup.

ZERO PERMANENT PERSISTENCE / ZERO PRODUCTION MUTATION.
"""

import unittest
import asyncio
from datetime import datetime, timezone
from app.auth_db import fallback_store
from app.services.shared_budget import (
    create_shared_budget_settlement,
    list_shared_budget_settlements,
    get_shared_budget_settlement,
    delete_shared_budget_settlement,
    create_shared_budget_expense,
    list_shared_budget_expenses,
    verify_shared_budget_access,
    SETTLEMENTS_COLLECTION_NAME,
)


class TestSharedBudgetSettlementsAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Prepare clean isolated demo fallback store state for testing."""
        fallback_store.setdefault("users", [])
        fallback_store.setdefault("trips", [])
        fallback_store.setdefault("trip_members", [])
        fallback_store.setdefault("shared_budget_expenses", [])
        fallback_store.setdefault(SETTLEMENTS_COLLECTION_NAME, [])

        # User setup
        cls.owner_id = "user_owner_settle_201"
        cls.member_accepted_id = "user_accepted_settle_202"
        cls.member_pending_id = "user_pending_settle_203"
        cls.member_declined_id = "user_declined_settle_204"
        cls.unrelated_user_id = "user_unrelated_settle_205"

        # Trip setup
        cls.trip_a_id = "trip_settle_alpha_200"
        cls.trip_b_id = "trip_settle_beta_300"

        # Add isolated trip records to fallback store
        fallback_store["trips"].extend([
            {"_id": cls.trip_a_id, "tripId": cls.trip_a_id, "userId": cls.owner_id, "title": "Settle Trip Alpha"},
            {"_id": cls.trip_b_id, "tripId": cls.trip_b_id, "userId": cls.owner_id, "title": "Settle Trip Beta"},
        ])

        # Add isolated membership records to fallback store
        fallback_store["trip_members"].extend([
            {"tripId": cls.trip_a_id, "userId": cls.member_accepted_id, "status": "accepted", "role": "member"},
            {"tripId": cls.trip_a_id, "userId": cls.member_pending_id, "status": "pending", "role": "member"},
            {"tripId": cls.trip_a_id, "userId": cls.member_declined_id, "status": "declined", "role": "member"},
            {"tripId": cls.trip_b_id, "userId": cls.member_accepted_id, "status": "accepted", "role": "member"},
        ])

    @classmethod
    def tearDownClass(cls):
        """Clean up ONLY the isolated test records created for this suite."""
        test_trip_ids = {cls.trip_a_id, cls.trip_b_id}

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

        fallback_store[SETTLEMENTS_COLLECTION_NAME] = [
            s for s in fallback_store.get(SETTLEMENTS_COLLECTION_NAME, [])
            if str(s.get("tripId")) not in test_trip_ids
        ]

    def setUp(self):
        """Clean settlements array before each test."""
        fallback_store[SETTLEMENTS_COLLECTION_NAME] = [
            s for s in fallback_store.get(SETTLEMENTS_COLLECTION_NAME, [])
            if str(s.get("tripId")) not in {self.trip_a_id, self.trip_b_id}
        ]

    def test_1_owner_creates_settlement(self):
        """TEST 1: Trip owner creates settlement."""
        payload = {
            "payerId": self.member_accepted_id,
            "payerName": "Accepted Tripmate",
            "receiverId": self.owner_id,
            "receiverName": "Owner",
            "amount": 1500.0,
            "currency": "PKR",
            "date": "2026-10-04",
            "note": "Repaying dinner share",
        }
        res = asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        self.assertIn("settlement", res)
        settle = res["settlement"]
        self.assertEqual(settle["amount"], 1500.0)
        self.assertEqual(settle["payerId"], self.member_accepted_id)
        self.assertEqual(settle["receiverId"], self.owner_id)
        self.assertEqual(settle["createdBy"], self.owner_id)

    def test_2_accepted_tripmate_creates_settlement(self):
        """TEST 2: Accepted Tripmate creates settlement."""
        payload = {
            "payerId": self.owner_id,
            "payerName": "Owner",
            "receiverId": self.member_accepted_id,
            "receiverName": "Accepted Tripmate",
            "amount": 800.0,
            "currency": "PKR",
            "date": "2026-10-04",
            "note": "Fuel repayment",
        }
        res = asyncio.run(create_shared_budget_settlement(self.member_accepted_id, self.trip_a_id, payload))
        self.assertTrue(res["success"])
        settle = res["settlement"]
        self.assertEqual(settle["amount"], 800.0)
        self.assertEqual(settle["createdBy"], self.member_accepted_id)

    def test_3_owner_lists_settlements(self):
        """TEST 3: Owner lists settlements."""
        payload = {
            "payerId": self.member_accepted_id,
            "receiverId": self.owner_id,
            "amount": 500.0,
            "date": "2026-10-04",
        }
        asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload))

        res = asyncio.run(list_shared_budget_settlements(self.owner_id, self.trip_a_id))
        self.assertTrue(res["success"])
        self.assertEqual(len(res["settlements"]), 1)
        self.assertEqual(res["settlements"][0]["amount"], 500.0)

    def test_4_accepted_tripmate_lists_settlements(self):
        """TEST 4: Accepted Tripmate lists settlements."""
        payload = {
            "payerId": self.member_accepted_id,
            "receiverId": self.owner_id,
            "amount": 1200.0,
            "date": "2026-10-04",
        }
        asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload))

        res = asyncio.run(list_shared_budget_settlements(self.member_accepted_id, self.trip_a_id))
        self.assertTrue(res["success"])
        self.assertEqual(len(res["settlements"]), 1)

    def test_5_owner_retrieves_settlement(self):
        """TEST 5: Owner retrieves a single settlement."""
        created = asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 300.0, "date": "2026-10-04"}
        ))
        s_id = created["settlement"]["settlementId"]

        res = asyncio.run(get_shared_budget_settlement(self.owner_id, self.trip_a_id, s_id))
        self.assertTrue(res["success"])
        self.assertEqual(res["settlement"]["settlementId"], s_id)

    def test_6_accepted_tripmate_retrieves_settlement(self):
        """TEST 6: Accepted Tripmate retrieves a single settlement."""
        created = asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 400.0, "date": "2026-10-04"}
        ))
        s_id = created["settlement"]["settlementId"]

        res = asyncio.run(get_shared_budget_settlement(self.member_accepted_id, self.trip_a_id, s_id))
        self.assertTrue(res["success"])
        self.assertEqual(res["settlement"]["settlementId"], s_id)

    def test_7_owner_deletes_settlement(self):
        """TEST 7: Owner deletes a settlement."""
        created = asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 700.0, "date": "2026-10-04"}
        ))
        s_id = created["settlement"]["settlementId"]

        del_res = asyncio.run(delete_shared_budget_settlement(self.owner_id, self.trip_a_id, s_id))
        self.assertTrue(del_res["success"])

        list_res = asyncio.run(list_shared_budget_settlements(self.owner_id, self.trip_a_id))
        self.assertEqual(len(list_res["settlements"]), 0)

    def test_8_accepted_tripmate_deletes_settlement(self):
        """TEST 8: Accepted Tripmate deletes a settlement."""
        created = asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 900.0, "date": "2026-10-04"}
        ))
        s_id = created["settlement"]["settlementId"]

        del_res = asyncio.run(delete_shared_budget_settlement(self.member_accepted_id, self.trip_a_id, s_id))
        self.assertTrue(del_res["success"])

    def test_9_pending_tripmate_rejected(self):
        """TEST 9: Pending Tripmate access rejected."""
        res = asyncio.run(list_shared_budget_settlements(self.member_pending_id, self.trip_a_id))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 403)

    def test_10_declined_tripmate_rejected(self):
        """TEST 10: Declined Tripmate access rejected."""
        res = asyncio.run(list_shared_budget_settlements(self.member_declined_id, self.trip_a_id))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 403)

    def test_11_unrelated_user_rejected(self):
        """TEST 11: Unrelated user access rejected."""
        res = asyncio.run(list_shared_budget_settlements(self.unrelated_user_id, self.trip_a_id))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 403)

    def test_12_cross_trip_list_isolation(self):
        """TEST 12: Cross-trip isolation (settlements of trip A do not show in trip B)."""
        asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 1000.0, "date": "2026-10-04"}
        ))

        res_b = asyncio.run(list_shared_budget_settlements(self.owner_id, self.trip_b_id))
        self.assertTrue(res_b["success"])
        self.assertEqual(len(res_b["settlements"]), 0)

    def test_13_invalid_amount_rejected(self):
        """TEST 13: Invalid/negative/zero amount rejected."""
        payload_zero = {
            "payerId": self.member_accepted_id,
            "receiverId": self.owner_id,
            "amount": 0.0,
            "date": "2026-10-04",
        }
        res_zero = asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload_zero))
        self.assertFalse(res_zero["success"])
        self.assertEqual(res_zero["status_code"], 400)

        payload_neg = {
            "payerId": self.member_accepted_id,
            "receiverId": self.owner_id,
            "amount": -500.0,
            "date": "2026-10-04",
        }
        res_neg = asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload_neg))
        self.assertFalse(res_neg["success"])
        self.assertEqual(res_neg["status_code"], 400)

    def test_14_invalid_date_rejected(self):
        """TEST 14: Invalid date format rejected."""
        payload = {
            "payerId": self.member_accepted_id,
            "receiverId": self.owner_id,
            "amount": 500.0,
            "date": "invalid-date",
        }
        res = asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 400)

    def test_15_same_payer_and_receiver_rejected(self):
        """TEST 15: Same payer and receiver rejected."""
        payload = {
            "payerId": self.owner_id,
            "receiverId": self.owner_id,
            "amount": 500.0,
            "date": "2026-10-04",
        }
        res = asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 400)

    def test_16_non_existent_settlement_404(self):
        """TEST 16: Non-existent settlement ID returns 404."""
        res = asyncio.run(get_shared_budget_settlement(self.owner_id, self.trip_a_id, "non_existent_id"))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 404)

    def test_17_cross_trip_settlement_id_404(self):
        """TEST 17: Settlement ID belonging to another trip returns 404."""
        created = asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 600.0, "date": "2026-10-04"}
        ))
        s_id = created["settlement"]["settlementId"]

        # Attempt to fetch s_id from trip B
        res = asyncio.run(get_shared_budget_settlement(self.owner_id, self.trip_b_id, s_id))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 404)

    def test_18_existing_expense_documents_remain_unchanged(self):
        """TEST 18: Creating/deleting settlements leaves existing expenses unchanged."""
        exp_created = asyncio.run(create_shared_budget_expense(
            self.owner_id, self.trip_a_id,
            {"name": "Original Expense", "amount": 2000.0, "payers": [{"userId": self.owner_id, "amount": 2000.0}]}
        ))
        exp_id = exp_created["expense"]["id"]

        # Create and delete a settlement
        settle_created = asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 1000.0, "date": "2026-10-04"}
        ))
        s_id = settle_created["settlement"]["settlementId"]
        asyncio.run(delete_shared_budget_settlement(self.owner_id, self.trip_a_id, s_id))

        # Verify expense is completely untouched
        exp_list = asyncio.run(list_shared_budget_expenses(self.owner_id, self.trip_a_id))
        self.assertEqual(len(exp_list["expenses"]), 1)
        self.assertEqual(exp_list["expenses"][0]["id"], exp_id)
        self.assertEqual(exp_list["expenses"][0]["amount"], 2000.0)

    def test_19_core_trip_documents_remain_unchanged(self):
        """TEST 19: Core trip document remains unchanged after settlement operations."""
        asyncio.run(create_shared_budget_settlement(
            self.owner_id, self.trip_a_id,
            {"payerId": self.member_accepted_id, "receiverId": self.owner_id, "amount": 500.0, "date": "2026-10-04"}
        ))
        # Verify trip object in fallback_store retains its original fields
        trip = next(t for t in fallback_store["trips"] if t["tripId"] == self.trip_a_id)
        self.assertEqual(trip["title"], "Settle Trip Alpha")
        self.assertEqual(trip["userId"], self.owner_id)

    def test_20_invalid_payer_roster_rejected(self):
        """TEST 20: Payer not on trip roster (e.g. pending member) is rejected."""
        payload = {
            "payerId": self.member_pending_id,
            "receiverId": self.owner_id,
            "amount": 500.0,
            "date": "2026-10-04",
        }
        res = asyncio.run(create_shared_budget_settlement(self.owner_id, self.trip_a_id, payload))
        self.assertFalse(res["success"])
        self.assertEqual(res["status_code"], 400)


if __name__ == "__main__":
    unittest.main()
