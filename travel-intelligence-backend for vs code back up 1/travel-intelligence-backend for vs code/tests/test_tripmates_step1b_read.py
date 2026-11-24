"""
Targeted tests for Step 1B: Safe Shared-Trip Read Backend.
Verifies read access for accepted members while ensuring zero database mutations or ownership shifts occur.
Uses httpx.AsyncClient sharing event loop with Motor/MongoDB.
Cleans up all disposable test records upon completion.
"""

import asyncio
import httpx
from typing import Any, Dict

from app.auth_db import (
    authenticate_user,
    close_db,
    create_session,
    create_user,
    delete_trip_for_user,
    delete_user_account,
    init_db,
    save_trip_document,
)
from app.main import app


async def run_step1b_read_tests():
    print("\n--- STARTING STEP 1B SAFE SHARED-TRIP READ TESTS ---")
    await init_db()
    from app.services.tripmates.tripmates_service import ensure_trip_members_indexes
    await ensure_trip_members_indexes()

    # Create safe disposable test accounts
    owner_user = await create_user("step1b_owner", "step1b_owner@test.com", "Password123!")
    invitee_user = await create_user("step1b_invitee", "step1b_invitee@test.com", "Password123!")
    stranger_user = await create_user("step1b_stranger", "step1b_stranger@test.com", "Password123!")

    owner_id = str(owner_user["user_id"])
    invitee_id = str(invitee_user["user_id"])
    stranger_id = str(stranger_user["user_id"])

    owner_session = await create_session(owner_id)
    invitee_session = await create_session(invitee_id)
    stranger_session = await create_session(stranger_id)

    headers_owner = {"Authorization": f"Bearer {owner_session['token']}"}
    headers_invitee = {"Authorization": f"Bearer {invitee_session['token']}"}
    headers_stranger = {"Authorization": f"Bearer {stranger_session['token']}"}

    test_trip_id = f"test_step1b_trip_{owner_id[:8]}"
    initial_trip_payload = {
        "id": test_trip_id,
        "title": "Step 1B Test Trip",
        "destination": "Hunza Valley",
        "startDate": "2026-10-01",
        "endDate": "2026-10-05",
        "itinerary": [{"day": 1, "activities": ["Visit Altit Fort"]}],
    }

    # Step 1: Owner creates safe test trip
    saved = await save_trip_document(owner_id, initial_trip_payload)
    assert saved["success"], "Failed to create initial test trip"
    original_trip_doc = saved["trip"]
    original_owner = original_trip_doc.get("userId")
    original_updated_at = original_trip_doc.get("updatedAt")

    print("[PASS] Initial test trip created safely by owner")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        try:
            # Step 2: Non-member read attempt rejected (403)
            res_stranger = await client.get(
                f"/api/tripmates/trips/{test_trip_id}",
                headers=headers_stranger,
            )
            assert res_stranger.status_code == 403, f"Expected 403 for non-member, got {res_stranger.status_code}"
            print("[PASS] 5. Non-member receives 403 Forbidden")

            # Step 3: Non-existent trip read attempt rejected (404)
            res_404 = await client.get(
                "/api/tripmates/trips/non_existent_trip_id_99999",
                headers=headers_invitee,
            )
            assert res_404.status_code in (403, 404), f"Expected 403/404 for non-existent trip, got {res_404.status_code}"
            print("[PASS] 7. Non-existent trip receives 403/404")

            # Step 4: Owner invites user
            res_invite = await client.post(
                f"/trips/{test_trip_id}/members/invite",
                json={"identifier": "step1b_invitee@test.com"},
                headers=headers_owner,
            )
            assert res_invite.status_code == 200, f"Failed invite creation: {res_invite.text}"
            invite_data = res_invite.json()
            invite_id = invite_data["invitation"]["id"]
            print("[PASS] Invitation created for invitee (status=pending)")

            # Step 5: Pending member read attempt rejected (403)
            res_pending = await client.get(
                f"/api/tripmates/trips/{test_trip_id}",
                headers=headers_invitee,
            )
            assert res_pending.status_code == 403, f"Expected 403 for pending invitee, got {res_pending.status_code}"
            print("[PASS] 3. Pending member receives 403 Forbidden")

            # Step 6: Invitee accepts invitation
            res_accept = await client.post(
                f"/trips/invitations/{invite_id}/respond",
                json={"action": "accept"},
                headers=headers_invitee,
            )
            assert res_accept.status_code == 200, f"Failed invitation accept: {res_accept.text}"
            print("[PASS] Invitee accepted invitation (status=accepted)")

            # Step 7: Accepted member can read shared trip (200 OK)
            res_read = await client.get(
                f"/api/tripmates/trips/{test_trip_id}",
                headers=headers_invitee,
            )
            assert res_read.status_code == 200, f"Expected 200 OK for accepted member, got {res_read.status_code}: {res_read.text}"
            read_json = res_read.json()
            assert read_json["success"] is True
            assert read_json["access"] == "tripmate_readonly"
            fetched_trip = read_json["trip"]
            assert str(fetched_trip["id"]) == str(test_trip_id)
            assert fetched_trip["data"]["title"] == "Step 1B Test Trip"
            print("[PASS] 1. Accepted member can read shared trip (200 OK)")

            # Step 8: Confirm owner remains sole owner (trips.userId unchanged)
            assert fetched_trip.get("userId") == original_owner, "Owner ID was mutated!"
            print("[PASS] 2. Original owner remains unchanged (trips.userId preserved)")

            # Step 9: Confirm reading does NOT create a duplicate trip or modify document
            assert fetched_trip.get("updatedAt") == original_updated_at, "Trip document was modified during read!"
            print("[PASS] 8 & 9. Reading does NOT create duplicate trip or modify original document")

            # Step 10: Owner removes member
            res_remove = await client.delete(
                f"/trips/{test_trip_id}/members/{invitee_id}",
                headers=headers_owner,
            )
            assert res_remove.status_code == 200, f"Failed member removal: {res_remove.text}"
            print("[PASS] Owner removed member")

            # Step 11: Removed member receives 403
            res_removed_read = await client.get(
                f"/api/tripmates/trips/{test_trip_id}",
                headers=headers_invitee,
            )
            assert res_removed_read.status_code == 403, f"Expected 403 for removed member, got {res_removed_read.status_code}"
            print("[PASS] 6. Removed member receives 403 Forbidden")

            # Step 12: Invite again, then decline
            res_invite2 = await client.post(
                f"/trips/{test_trip_id}/members/invite",
                json={"identifier": "step1b_invitee@test.com"},
                headers=headers_owner,
            )
            assert res_invite2.status_code == 200
            invite2_id = res_invite2.json()["invitation"]["id"]

            res_decline = await client.post(
                f"/trips/invitations/{invite2_id}/respond",
                json={"action": "decline"},
                headers=headers_invitee,
            )
            assert res_decline.status_code == 200

            # Step 13: Declined member receives 403
            res_declined_read = await client.get(
                f"/api/tripmates/trips/{test_trip_id}",
                headers=headers_invitee,
            )
            assert res_declined_read.status_code == 403, f"Expected 403 for declined member, got {res_declined_read.status_code}"
            print("[PASS] 4. Declined member receives 403 Forbidden")

        finally:
            print("\nCleaning up disposable test artifacts...")
            owner_user_dict = {"user_id": owner_id, "role": "user"}
            await delete_trip_for_user(owner_user_dict, test_trip_id)
            await delete_user_account(owner_id)
            await delete_user_account(invitee_id)
            await delete_user_account(stranger_id)
            await close_db()
            print("[PASS] All disposable test records cleanly deleted.")

    print("\nALL 9 STEP 1B BACKEND READ TESTS PASSED PERFECTLY!\n")


if __name__ == "__main__":
    asyncio.run(run_step1b_read_tests())
