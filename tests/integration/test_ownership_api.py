from conftest import TEST_API_KEY


def _property_id(client) -> str:
    resp = client.get("/v1/property/search?title_number=ZNZ-12345", headers={"X-API-Key": TEST_API_KEY})
    assert resp.status_code == 200
    return resp.json()["data"][0]["id"]


def test_ownership_requires_consent(client):
    property_id = _property_id(client)
    resp = client.get(f"/v1/property/{property_id}/ownership", headers={"X-API-Key": TEST_API_KEY})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "CONSENT_REQUIRED"


def test_ownership_returns_decrypted_owner(client):
    property_id = _property_id(client)
    resp = client.get(
        f"/v1/property/{property_id}/ownership?consent_confirmed=true&legal_basis=consent",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["current_owner"]["owner_name"] == "Asha Ali"


def test_ownership_history_returns_records(client):
    property_id = _property_id(client)
    resp = client.get(
        f"/v1/property/{property_id}/ownership/history?consent_confirmed=true&legal_basis=contract",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert resp.status_code == 200
    assert len(resp.json()["history"]) >= 1
