"""
Targeted tests for Tripmates Backend Foundation (Step 1A & Step 1E.1).
Tests membership, invitation operations, and Tripmate itinerary write capabilities without touching core trip systems.
Uses httpx.AsyncClient to share the same event loop with Motor/MongoDB.
Cleans up all created test artifacts upon completion.
"""

import asyncio
import httpx

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


async def run_targeted_tests():
    print("\n--- STARTING TRIPMATES BACKEND TARGETED TESTS ---")
    await init_db()
    from app.services.tripmates.tripmates_service import ensure_trip_members_indexes
    await ensure_trip_members_indexes()

    # 1. Create safe test users
    owner_username = "tm_test_owner"
    owner_email = "tm_test_owner@example.com"
    invitee_username = "tm_test_invitee"
    invitee_email = "tm_test_invitee@example.com"
    unrelated_username = "tm_test_unrelated"
    unrelated_email = "tm_test_unrelated@example.com"
    password = "password123"

    print("Step 1: Preparing test users and sessions...")
    owner_res = await create_user(owner_username, owner_email, password)
    if not owner_res["success"]:
        owner_auth = await authenticate_user(owner_username, password)
        owner_id = owner_auth["user_id"]
    else:
        owner_id = owner_res["user_id"]

    invitee_res = await create_user(invitee_username, invitee_email, password)
    if not invitee_res["success"]:
        invitee_auth = await authenticate_user(invitee_username, password)
        invitee_id = invitee_auth["user_id"]
    else:
        invitee_id = invitee_res["user_id"]

    unrelated_res = await create_user(unrelated_username, unrelated_email, password)
    if not unrelated_res["success"]:
        unrelated_auth = await authenticate_user(unrelated_username, password)
        unrelated_id = unrelated_auth["user_id"]
    else:
        unrelated_id = unrelated_res["user_id"]

    owner_session = await create_session(owner_id)
    owner_token = owner_session["token"]

    invitee_session = await create_session(invitee_id)
    invitee_token = invitee_session["token"]

    unrelated_session = await create_session(unrelated_id)
    unrelated_token = unrelated_session["token"]

    # 2. Create test trip owned by owner
    test_trip_id = 99901
    print("Step 2: Creating safe test trip for owner...")
    from app.auth_db import mongo_db, fallback_store, use_demo_fallback
    if mongo_db is not None:
        await mongo_db["trips"].delete_many({"$or": [{"id": test_trip_id}, {"tripId": test_trip_id}]})
        await mongo_db["trip_members"].delete_many({"$or": [{"id": test_trip_id}, {"tripId": test_trip_id}]})
    if use_demo_fallback:
        fallback_store["trips"] = [t for t in fallback_store.get("trips", []) if t.get("id") != test_trip_id and t.get("tripId") != test_trip_id]
        fallback_store["trip_members"] = [m for m in fallback_store.get("trip_members", []) if m.get("tripId") != test_trip_id]
    trip_payload = {
        "id": test_trip_id,
        "tripId": test_trip_id,
        "title": "Test Tripmates Trip",
        "name": "Murree Hills",
        "destination": "Murree",
        "startDate": "2026-08-01",
        "endDate": "2026-08-05",
        "privacy": "private",
        "itinerary": [],
        "preferences": {},
        "expenses": [],
        "budget": {"currency": "PKR", "amount": 10000},
        "data": {
            "id": test_trip_id,
            "title": "Test Tripmates Trip",
            "name": "Murree Hills",
            "destination": "Murree",
            "days": [],
            "placesPool": [],
            "expenses": [],
            "budget": {"currency": "PKR", "amount": 10000},
        },
    }
    save_res = await save_trip_document(owner_id, trip_payload)
    assert save_res["success"], f"Failed to create test trip: {save_res}"
    print("[PASS] Normal trip created via untouched save_trip_document()")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        try:
            headers_owner = {"Authorization": f"Bearer {owner_token}"}
            headers_invitee = {"Authorization": f"Bearer {invitee_token}"}
            headers_unrelated = {"Authorization": f"Bearer {unrelated_token}"}

            # 3. Test: Owner invites another user
            print("Step 3: Testing invite creation...")
            res = await client.post(
                f"/trips/{test_trip_id}/members/invite",
                json={"identifier": invitee_username},
                headers=headers_owner,
            )
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["success"] is True
            assert data["invitation"]["status"] == "pending"
            assert data["invitation"]["userId"] == invitee_id
            invite_id = data["invitation"]["id"]
            print("[PASS] Owner successfully invited another user (status=pending)")

            # Test C: Pending member attempts itinerary update -> 403
            print("Step 3c (Test C): Testing pending member itinerary write rejection...")
            res_pending = await client.put(
                f"/api/tripmates/trips/{test_trip_id}/itinerary",
                json={"days": [{"day": 1, "title": "Sneaky Pending Write"}]},
                headers=headers_invitee,
            )
            assert res_pending.status_code == 403, f"Expected 403 for pending member, got {res_pending.status_code}"
            print("[PASS] Pending member write attempt correctly rejected (403)")

            # Test D: Non-member attempts itinerary update -> 403
            print("Step 3d (Test D): Testing non-member itinerary write rejection...")
            res_nonmember = await client.put(
                f"/api/tripmates/trips/{test_trip_id}/itinerary",
                json={"days": [{"day": 1, "title": "Sneaky Non-Member Write"}]},
                headers=headers_unrelated,
            )
            assert res_nonmember.status_code == 403, f"Expected 403 for non-member, got {res_nonmember.status_code}"
            print("[PASS] Non-member write attempt correctly rejected (403)")

            # Verify tripmate_invite notification was created for invitee
            from app.auth_db import list_notifications_for_user
            notif_res = await list_notifications_for_user(invitee_id)
            assert notif_res["success"] is True
            notifs = notif_res["notifications"]
            tripmate_notifs = [n for n in notifs if n.get("type") == "tripmate_invite"]
            assert len(tripmate_notifs) == 1, f"Expected 1 tripmate_invite notification, got {len(tripmate_notifs)}"
            target_notif = tripmate_notifs[0]
            assert target_notif["recipientId"] == invitee_id
            assert target_notif["actorId"] == owner_id
            assert target_notif["metadata"]["inviteId"] == invite_id
            assert str(target_notif["metadata"]["tripId"]) == str(test_trip_id)
            assert target_notif["metadata"]["tripTitle"] == "Test Tripmates Trip"
            print("[PASS] Tripmate invitation notification successfully created with valid metadata")

            # 4. Test: Self-invite blocked
            print("Step 4: Testing self-invite rejection...")
            res_self = await client.post(
                f"/trips/{test_trip_id}/members/invite",
                json={"identifier": owner_username},
                headers=headers_owner,
            )
            assert res_self.status_code == 400, f"Expected 400 for self-invite, got {res_self.status_code}"
            print("[PASS] Self-invite correctly rejected (400)")

            # 5. Test: Non-existent user invite blocked
            print("Step 5: Testing non-existent user invite rejection...")
            res_ghost = await client.post(
                f"/trips/{test_trip_id}/members/invite",
                json={"identifier": "non_existent_ghost_user_99999"},
                headers=headers_owner,
            )
            assert res_ghost.status_code == 404, f"Expected 404 for ghost user, got {res_ghost.status_code}"
            print("[PASS] Non-existent user invite correctly rejected (404)")

            # 6. Test: Duplicate invite blocked
            print("Step 6: Testing duplicate invite rejection...")
            res_dup = await client.post(
                f"/trips/{test_trip_id}/members/invite",
                json={"identifier": invitee_email},
                headers=headers_owner,
            )
            assert res_dup.status_code == 400, f"Expected 400 for duplicate invite, got {res_dup.status_code}"
            print("[PASS] Duplicate pending invite correctly rejected (400)")

            # Verify duplicate notification was NOT created
            notif_res_dup = await list_notifications_for_user(invitee_id)
            tripmate_notifs_dup = [n for n in notif_res_dup["notifications"] if n.get("type") == "tripmate_invite"]
            assert len(tripmate_notifs_dup) == 1, f"Duplicate notification unexpectedly created! Count: {len(tripmate_notifs_dup)}"
            print("[PASS] Duplicate notification correctly prevented")

            # 7. Test: Non-owner cannot invite
            print("Step 7: Testing unauthorized invite rejection...")
            res_unauth = await client.post(
                f"/trips/{test_trip_id}/members/invite",
                json={"identifier": owner_username},
                headers=headers_invitee,
            )
            assert res_unauth.status_code == 403, f"Expected 403 for non-owner, got {res_unauth.status_code}"
            print("[PASS] Non-owner invite attempt correctly rejected (403)")

            # 8. Test: Owner retrieves trip members & pending invites
            print("Step 8: Testing member roster retrieval...")
            res_roster = await client.get(
                f"/trips/{test_trip_id}/members",
                headers=headers_owner,
            )
            assert res_roster.status_code == 200, f"Expected 200, got {res_roster.status_code}"
            roster_data = res_roster.json()
            assert roster_data["owner"]["id"] == owner_id
            assert len(roster_data["pendingInvites"]) >= 1
            assert any(inv["id"] == invite_id for inv in roster_data["pendingInvites"])
            print("[PASS] Member roster correctly retrieved with pending invites")

            # 9. Test: Invitee retrieves their pending invitations
            print("Step 9: Testing user invitations retrieval...")
            res_invites = await client.get(
                "/trips/invitations",
                headers=headers_invitee,
            )
            assert res_invites.status_code == 200, f"Expected 200, got {res_invites.status_code}"
            invites_data = res_invites.json()
            assert any(inv["id"] == invite_id for inv in invites_data["invitations"])
            print("[PASS] Invitee successfully retrieved their pending invitations")

            # 10. Test: Invitee accepts invitation
            print("Step 10: Testing invitation acceptance...")
            res_accept = await client.post(
                f"/trips/invitations/{invite_id}/respond",
                json={"action": "accept"},
                headers=headers_invitee,
            )
            assert res_accept.status_code == 200, f"Expected 200, got {res_accept.status_code}"
            accept_data = res_accept.json()
            assert accept_data["invitation"]["status"] == "accepted"
            assert accept_data["invitation"]["acceptedAt"] is not None
            print("[PASS] Invitee successfully accepted invitation (status=accepted)")

            # Test B: Accepted Tripmate performs itinerary write -> 200
            print("Step 10b (Test B): Testing accepted Tripmate itinerary write...")
            tripmate_payload = {
                "days": [{"day": 1, "title": "Day 1 by Tripmate"}],
                "placesPool": [{"id": "p1", "name": "Faisal Mosque"}],
                "customLists": [{"id": "cl1", "title": "Packing List"}],
            }
            res_tm_write = await client.put(
                f"/api/tripmates/trips/{test_trip_id}/itinerary",
                json=tripmate_payload,
                headers=headers_invitee,
            )
            assert res_tm_write.status_code == 200, f"Expected 200, got {res_tm_write.status_code}: {res_tm_write.text}"
            tm_write_data = res_tm_write.json()
            assert tm_write_data["success"] is True
            saved_trip_data = tm_write_data["trip"]["data"]
            assert saved_trip_data["days"] == [{"day": 1, "title": "Day 1 by Tripmate"}]
            assert saved_trip_data["placesPool"] == [{"id": "p1", "name": "Faisal Mosque"}]
            assert saved_trip_data["customLists"] == [{"id": "cl1", "title": "Packing List"}]
            print("[PASS] Accepted Tripmate successfully updated itinerary fields (200)")

            # Test A: Owner performs itinerary write -> 200
            print("Step 10c (Test A): Testing canonical owner itinerary write...")
            owner_payload = {
                "days": [{"day": 1, "title": "Day 1 by Owner"}, {"day": 2, "title": "Day 2 by Owner"}],
                "placesPool": [{"id": "p1", "name": "Faisal Mosque"}, {"id": "p2", "name": "Daman-e-Koh"}],
                "customLists": [{"id": "cl1", "title": "Packing List"}, {"id": "cl2", "title": "Tips"}],
            }
            res_owner_write = await client.put(
                f"/api/tripmates/trips/{test_trip_id}/itinerary",
                json=owner_payload,
                headers=headers_owner,
            )
            assert res_owner_write.status_code == 200, f"Expected 200, got {res_owner_write.status_code}: {res_owner_write.text}"
            owner_write_data = res_owner_write.json()
            assert owner_write_data["success"] is True
            saved_owner_data = owner_write_data["trip"]["data"]
            assert len(saved_owner_data["days"]) == 2
            assert saved_owner_data["days"][0]["title"] == "Day 1 by Owner"
            print("[PASS] Canonical owner successfully updated itinerary fields (200)")

            # Test F & G: Budget & Expenses Preservation
            print("Step 10d (Test F & G): Testing budget and expenses preservation...")
            assert saved_owner_data.get("budget") == {"currency": "PKR", "amount": 10000}, f"Budget mutated! {saved_owner_data.get('budget')}"
            assert saved_owner_data.get("expenses") == [], f"Expenses mutated! {saved_owner_data.get('expenses')}"
            print("[PASS] Budget and expenses remained strictly untouched")

            # Test H, I, J: Ownership, No Duplicate, Protected Metadata Preservation
            print("Step 10e (Test H, I, J): Testing ownership, single trip document, and metadata preservation...")
            assert owner_write_data["trip"]["userId"] == owner_id, f"Ownership changed! {owner_write_data['trip']['userId']}"
            assert owner_write_data["trip"]["tripId"] == test_trip_id
            assert owner_write_data["trip"]["name"] == "Murree Hills"
            assert owner_write_data["trip"]["startDate"] == "2026-08-01"
            assert owner_write_data["trip"]["endDate"] == "2026-08-05"
            assert owner_write_data["trip"]["privacy"] == "private"

            if mongo_db is not None:
                trip_docs = await mongo_db["trips"].find({"$or": [{"id": test_trip_id}, {"tripId": test_trip_id}]}).to_list(length=None)
                assert len(trip_docs) == 1, f"Expected exactly 1 trip document, got {len(trip_docs)}"
            print("[PASS] Ownership, single document constraint, and protected metadata verified")

            # 11. Test: Already accepted invite cannot be accepted again
            print("Step 11: Testing duplicate response rejection...")
            res_accept_again = await client.post(
                f"/trips/invitations/{invite_id}/respond",
                json={"action": "accept"},
                headers=headers_invitee,
            )
            assert res_accept_again.status_code == 400, f"Expected 400, got {res_accept_again.status_code}"
            print("[PASS] Cannot respond to already accepted invitation (400)")

            # 12. Test: Roster now lists user as accepted member
            print("Step 12: Testing roster after acceptance...")
            res_roster2 = await client.get(
                f"/trips/{test_trip_id}/members",
                headers=headers_owner,
            )
            roster_data2 = res_roster2.json()
            assert any(m["userId"] == invitee_id for m in roster_data2["members"])
            assert not any(inv["id"] == invite_id for inv in roster_data2["pendingInvites"])
            print("[PASS] Roster reflects accepted member and cleared pending invite")

            # 12b. Test: Accepted member discovers shared trip via GET /api/tripmates/shared-trips
            print("Step 12b: Testing accepted member shared trips discovery endpoint...")
            res_shared_list = await client.get(
                "/api/tripmates/shared-trips",
                headers=headers_invitee,
            )
            assert res_shared_list.status_code == 200, f"Expected 200, got {res_shared_list.status_code}"
            shared_list_data = res_shared_list.json()
            assert shared_list_data["success"] is True
            assert any(str(t.get("id") or t.get("tripId")) == str(test_trip_id) and t.get("isTripmate") is True for t in shared_list_data["trips"])
            print("[PASS] Accepted member successfully retrieved shared Tripmate trip (isTripmate=True)")


            # 13. Test: Owner removes accepted member
            print("Step 13: Testing member removal by owner...")
            res_del = await client.delete(
                f"/trips/{test_trip_id}/members/{invitee_id}",
                headers=headers_owner,
            )
            assert res_del.status_code == 200, f"Expected 200, got {res_del.status_code}"
            print("[PASS] Owner successfully removed member")

            # Test E: Removed member attempts write -> 403
            print("Step 13b (Test E): Testing removed member itinerary write rejection...")
            res_removed_write = await client.put(
                f"/api/tripmates/trips/{test_trip_id}/itinerary",
                json={"days": [{"day": 1, "title": "Sneaky Removed Write"}]},
                headers=headers_invitee,
            )
            assert res_removed_write.status_code == 403, f"Expected 403 for removed member write, got {res_removed_write.status_code}"
            print("[PASS] Removed member write attempt correctly rejected (403)")

            # 14. Test: Non-owner cannot remove member
            print("Step 14: Testing unauthorized member removal rejection...")
            res_del_unauth = await client.delete(
                f"/trips/{test_trip_id}/members/{owner_id}",
                headers=headers_invitee,
            )
            assert res_del_unauth.status_code in (400, 403), f"Expected 400/403, got {res_del_unauth.status_code}"
            print("[PASS] Unauthorized member removal attempt correctly rejected")

        finally:
            # Cleanup test artifacts
            print("\nStep 16: Cleaning up test artifacts...")
            owner_user_dict = {"user_id": owner_id, "role": "user"}
            await delete_trip_for_user(owner_user_dict, test_trip_id)
            await delete_user_account(owner_id)
            await delete_user_account(invitee_id)
            await delete_user_account(unrelated_id)
            await close_db()
            print("[PASS] All test artifacts cleanly deleted.")

    print("\nALL TARGETED TESTS (STEP 1A & STEP 1E.1) PASSED PERFECTLY!\n")


if __name__ == "__main__":
    asyncio.run(run_targeted_tests())
