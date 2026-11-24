"""
Focused backend unit tests for Shared Budget SB-B1 Data Model & Service Foundation.
Verifies data schema validation, multi-payer support, independent participant shares,
destination reference isolation, and serialization using unittest.

ZERO DATABASE MUTATION ON PRODUCTION COLLECTIONS.
"""

import unittest
from app.services.shared_budget import (
    validate_expense_data,
    build_expense_document,
    serialize_expense_document,
)


class TestSharedBudgetFoundation(unittest.TestCase):

    def test_1_owner_only_expense_structure(self):
        """Verify valid owner-only expense structure can be represented."""
        raw_data = {
            "tripId": "test_trip_100",
            "name": "Hotel Booking",
            "amount": 15000.0,
            "currency": "PKR",
            "category": "Sleep",
            "date": "2026-10-02",
            "destinationReference": "Islamabad",
            "status": "paid",
            "payers": [{"userId": "user_owner", "name": "Arslan (Owner)", "amount": 15000.0}],
            "participants": [{"userId": "user_owner", "name": "Arslan (Owner)", "share": 15000.0}],
            "createdBy": "user_owner",
        }
        validated = validate_expense_data(raw_data)
        self.assertEqual(validated["tripId"], "test_trip_100")
        self.assertEqual(validated["amount"], 15000.0)
        self.assertEqual(len(validated["payers"]), 1)
        self.assertEqual(validated["payers"][0]["userId"], "user_owner")
        self.assertEqual(validated["payers"][0]["amount"], 15000.0)
        self.assertEqual(len(validated["participants"]), 1)
        self.assertEqual(validated["participants"][0]["share"], 15000.0)

    def test_2_multi_member_and_multi_payer_support(self):
        """Verify multi-member and multi-payer expense structures (e.g. A pays 6000, B pays 4000, total = 10000)."""
        raw_data = {
            "tripId": "test_trip_200",
            "name": "Group Dinner",
            "amount": 10000.0,
            "currency": "PKR",
            "category": "Eat & Drink",
            "date": "2026-10-02",
            "destinationReference": "Rawal Lake",
            "status": "paid",
            "payers": [
                {"userId": "user_a", "name": "Arslan", "amount": 6000.0},
                {"userId": "user_b", "name": "Bilal", "amount": 4000.0},
            ],
            "participants": [
                {"userId": "user_a", "name": "Arslan", "share": 5000.0},
                {"userId": "user_b", "name": "Bilal", "share": 5000.0},
            ],
            "createdBy": "user_a",
        }
        validated = validate_expense_data(raw_data)
        self.assertEqual(validated["amount"], 10000.0)
        self.assertEqual(len(validated["payers"]), 2)
        self.assertEqual(validated["payers"][0]["amount"], 6000.0)
        self.assertEqual(validated["payers"][1]["amount"], 4000.0)
        self.assertEqual(sum(p["amount"] for p in validated["payers"]), 10000.0)

    def test_3_payers_and_participants_are_independent(self):
        """Verify that payers and participants are independent (someone can pay who isn't a participant, etc.)."""
        raw_data = {
            "tripId": "test_trip_300",
            "name": "Taxi for Companions",
            "amount": 3000.0,
            "currency": "PKR",
            "category": "Transport",
            "status": "paid",
            "payers": [
                {"userId": "user_sponsor", "name": "Sponsor Member", "amount": 3000.0}
            ],
            "participants": [
                {"userId": "user_p1", "name": "Rider 1", "share": 1500.0},
                {"userId": "user_p2", "name": "Rider 2", "share": 1500.0},
            ],
        }
        validated = validate_expense_data(raw_data)
        self.assertEqual(validated["payers"][0]["userId"], "user_sponsor")
        self.assertEqual(len(validated["participants"]), 2)
        self.assertEqual(validated["participants"][0]["userId"], "user_p1")
        self.assertEqual(validated["participants"][1]["userId"], "user_p2")

    def test_4_trip_id_required(self):
        """Verify tripId is required and fails if missing or empty."""
        with self.assertRaises(ValueError):
            validate_expense_data({"name": "No Trip", "amount": 100, "payers": [{"name": "A"}]})

        with self.assertRaises(ValueError):
            validate_expense_data({"tripId": "   ", "amount": 100, "payers": [{"name": "A"}]})

    def test_5_amount_and_currency_validation(self):
        """Verify amount must be non-negative number and currency is normalized."""
        with self.assertRaises(ValueError):
            validate_expense_data({"tripId": "t1", "amount": -50, "payers": [{"name": "A"}]})

        validated = validate_expense_data({
            "tripId": "t1",
            "amount": 250.0,
            "currency": "usd",
            "payers": [{"userId": "u1", "name": "A", "amount": 250.0}],
        })
        self.assertEqual(validated["amount"], 250.0)
        self.assertEqual(validated["currency"], "USD")

    def test_6_status_validation(self):
        """Verify status accepts 'paid' and 'pending' and rejects invalid values."""
        val_paid = validate_expense_data({
            "tripId": "t1",
            "amount": 100,
            "status": "PAID",
            "payers": [{"name": "A", "amount": 100}],
        })
        self.assertEqual(val_paid["status"], "paid")

        val_pending = validate_expense_data({
            "tripId": "t1",
            "amount": 100,
            "status": "pending",
            "payers": [{"name": "A", "amount": 0}],
        })
        self.assertEqual(val_pending["status"], "pending")

        with self.assertRaises(ValueError):
            validate_expense_data({
                "tripId": "t1",
                "amount": 100,
                "status": "unknown_status",
                "payers": [{"name": "A"}],
            })

    def test_7_destination_reference_isolation(self):
        """Verify destination reference is stored purely as a string label without location side effects."""
        validated = validate_expense_data({
            "tripId": "t1",
            "amount": 500,
            "destinationReference": "Faisal Masjid",
            "payers": [{"name": "A", "amount": 500}],
        })
        self.assertEqual(validated["destinationReference"], "Faisal Masjid")
        self.assertIsInstance(validated["destinationReference"], str)

    def test_8_document_building_and_serialization(self):
        """Verify document construction and JSON serialization."""
        doc = build_expense_document(
            trip_id="trip_999",
            name="Faisal Mosque Entry Ticket",
            amount=1200.0,
            currency="PKR",
            category="See & Do",
            date="2026-10-02",
            destination_reference="Faisal Masjid",
            status="paid",
            payers=[
                {"userId": "u1", "name": "Arslan", "amount": 800.0},
                {"userId": "u2", "name": "Companion", "amount": 400.0},
            ],
            participants=[
                {"userId": "u1", "name": "Arslan", "share": 600.0},
                {"userId": "u2", "name": "Companion", "share": 600.0},
            ],
            created_by="u1",
        )

        self.assertEqual(doc["tripId"], "trip_999")
        self.assertEqual(doc["amount"], 1200.0)
        self.assertIsNotNone(doc["createdAt"])

        serialized = serialize_expense_document(doc)
        self.assertEqual(serialized["tripId"], "trip_999")
        self.assertEqual(serialized["amount"], 1200.0)
        self.assertEqual(len(serialized["payers"]), 2)
        self.assertEqual(len(serialized["participants"]), 2)
        self.assertEqual(serialized["destinationReference"], "Faisal Masjid")


if __name__ == "__main__":
    unittest.main()
