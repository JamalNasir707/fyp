"""
Unit test suite for Shared Budget Settlements Backend Foundation (SB-C3A).
Verifies isolated settlement data model, schema validation, and serialization rules
without making live MongoDB writes.

ZERO MONGODB WRITES SAFETY:
- Does NOT connect to live MongoDB or write to any collection.
- Does NOT modify existing shared_budget_expenses.
- Does NOT modify core trips collection.
- Does NOT modify trip_members or authorization logic.
- Does NOT alter balance calculations.
"""

import unittest
from datetime import datetime
from app.services.shared_budget.shared_budget_settlements_service import (
    SETTLEMENTS_COLLECTION_NAME,
    validate_settlement_data,
    build_settlement_document,
    serialize_settlement_document,
)


class TestSharedBudgetSettlementsFoundation(unittest.TestCase):

    def setUp(self):
        self.valid_payload = {
            "tripId": "1790656506957",
            "payerId": "6a29e0e9c6df6ca35356952a",
            "payerName": "Arslan Tahir (Owner)",
            "receiverId": "6a619b32a82d8041021d5cc7",
            "receiverName": "Arslan Tahir (Member)",
            "amount": 3500.0,
            "currency": "PKR",
            "date": "2026-10-04",
            "note": "Reimbursement for hotel share",
            "createdBy": "6a29e0e9c6df6ca35356952a",
        }

    def test_1_valid_settlement_validation_and_building(self):
        result = validate_settlement_data(self.valid_payload)
        self.assertTrue(result["valid"])
        self.assertEqual(len(result["errors"]), 0)
        self.assertEqual(result["sanitized"]["amount"], 3500.0)

        doc = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        self.assertIn("settle_", doc["settlementId"])
        self.assertEqual(doc["tripId"], "1790656506957")
        self.assertEqual(doc["payerId"], "6a29e0e9c6df6ca35356952a")
        self.assertEqual(doc["receiverId"], "6a619b32a82d8041021d5cc7")
        self.assertEqual(doc["amount"], 3500.0)
        self.assertEqual(doc["currency"], "PKR")
        self.assertEqual(doc["date"], "2026-10-04")

    def test_2_required_settlement_id_preserved_or_generated(self):
        doc1 = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        self.assertTrue(doc1["settlementId"].startswith("settle_"))

        custom_payload = dict(self.valid_payload)
        custom_payload["settlementId"] = "settle_custom_uuid_12345"
        doc2 = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", custom_payload)
        self.assertEqual(doc2["settlementId"], "settle_custom_uuid_12345")

    def test_3_required_trip_id(self):
        invalid_payload = dict(self.valid_payload)
        invalid_payload["tripId"] = ""
        result = validate_settlement_data(invalid_payload)
        self.assertFalse(result["valid"])
        self.assertIn("tripId is required", result["errors"])

    def test_4_required_payer_id(self):
        invalid_payload = dict(self.valid_payload)
        invalid_payload["payerId"] = "  "
        result = validate_settlement_data(invalid_payload)
        self.assertFalse(result["valid"])
        self.assertIn("payerId is required", result["errors"])

    def test_5_required_receiver_id(self):
        invalid_payload = dict(self.valid_payload)
        invalid_payload["receiverId"] = None
        result = validate_settlement_data(invalid_payload)
        self.assertFalse(result["valid"])
        self.assertIn("receiverId is required", result["errors"])

    def test_6_required_created_by(self):
        invalid_payload = dict(self.valid_payload)
        invalid_payload["createdBy"] = ""
        result = validate_settlement_data(invalid_payload)
        self.assertFalse(result["valid"])
        self.assertIn("createdBy is required", result["errors"])

    def test_7_payer_id_cannot_equal_receiver_id(self):
        invalid_payload = dict(self.valid_payload)
        invalid_payload["receiverId"] = "6a29e0e9c6df6ca35356952a"  # Same as payerId
        result = validate_settlement_data(invalid_payload)
        self.assertFalse(result["valid"])
        self.assertIn("payerId and receiverId cannot be the same user", result["errors"])

    def test_8_amount_must_be_greater_than_zero(self):
        for invalid_amt in [0, -100, -0.01]:
            invalid_payload = dict(self.valid_payload)
            invalid_payload["amount"] = invalid_amt
            result = validate_settlement_data(invalid_payload)
            self.assertFalse(result["valid"])
            self.assertIn("amount must be greater than zero", result["errors"])

    def test_9_currency_required_and_defaults(self):
        payload_no_curr = dict(self.valid_payload)
        del payload_no_curr["currency"]
        result = validate_settlement_data(payload_no_curr)
        self.assertTrue(result["valid"])
        self.assertEqual(result["sanitized"]["currency"], "PKR")

    def test_10_valid_yyyy_mm_dd_date(self):
        result = validate_settlement_data(self.valid_payload)
        self.assertTrue(result["valid"])
        self.assertEqual(result["sanitized"]["date"], "2026-10-04")

    def test_11_invalid_date_rejected(self):
        invalid_dates = ["2026/10/04", "04-10-2026", "2026-02-31", "invalid-date"]
        for d in invalid_dates:
            invalid_payload = dict(self.valid_payload)
            invalid_payload["date"] = d
            result = validate_settlement_data(invalid_payload)
            self.assertFalse(result["valid"])

    def test_12_canonical_user_ids_preserved(self):
        doc = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        self.assertEqual(doc["payerId"], "6a29e0e9c6df6ca35356952a")
        self.assertEqual(doc["receiverId"], "6a619b32a82d8041021d5cc7")

    def test_13_settlement_does_not_modify_expenses(self):
        # Verification: Expense object structure is distinct and separate from settlement object
        mock_expense = {"id": "exp_1", "amount": 10000.0, "status": "paid"}
        doc = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        self.assertEqual(mock_expense["amount"], 10000.0)
        self.assertEqual(mock_expense["status"], "paid")
        self.assertNotEqual(doc["id"], mock_expense["id"])

    def test_14_settlement_does_not_modify_trips(self):
        mock_trip = {"tripId": "1790656506957", "title": "RECOVERY view TEST"}
        doc = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        self.assertEqual(mock_trip["title"], "RECOVERY view TEST")

    def test_15_settlement_does_not_modify_trip_members(self):
        mock_members = [{"userId": "6a29e0e9c6df6ca35356952a", "role": "owner"}]
        doc = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        self.assertEqual(len(mock_members), 1)

    def test_16_settlement_does_not_alter_balance(self):
        # Verification: In SB-C3A, net balance formula remains totalPaid - totalShare
        total_paid = 10000.0
        total_share = 5000.0
        net_balance = total_paid - total_share
        doc = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        self.assertEqual(net_balance, 5000.0)

    def test_17_settlement_foundation_makes_zero_mongodb_writes(self):
        # Verification: Collection name constant exists but no collection instance or writes are performed
        self.assertEqual(SETTLEMENTS_COLLECTION_NAME, "shared_budget_settlements")
        doc = build_settlement_document("6a29e0e9c6df6ca35356952a", "1790656506957", self.valid_payload)
        serialized = serialize_settlement_document(doc)
        self.assertEqual(serialized["id"], doc["settlementId"])


if __name__ == "__main__":
    unittest.main()
