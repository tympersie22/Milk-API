from conftest import TEST_API_KEY


def test_property_search_requires_api_key(client):
    response = client.get("/v1/property/search")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "MISSING_API_KEY"


def test_property_search_returns_data(client):
    response = client.get(
        "/v1/property/search?region=zanzibar",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pagination"]["total"] == 1
    assert payload["data"][0]["title_number"] == "ZNZ-12345"


def test_property_verify(client):
    response = client.post(
        "/v1/property/verify",
        json={"title_number": "ZNZ-12345", "region": "zanzibar"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["found"] is True
    assert payload["verified"] is True
