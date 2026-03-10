from conftest import TEST_API_KEY


def test_full_report_requires_api_key(client):
    response = client.post(
        "/v1/reports/full",
        json={"title_number": "ZNZ-12345", "region": "zanzibar", "format": "json"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "MISSING_API_KEY"


def test_full_report_json_by_title(client):
    response = client.post(
        "/v1/reports/full",
        json={"title_number": "ZNZ-12345", "region": "zanzibar", "format": "json"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["property"]["title_number"] == "ZNZ-12345"
    assert payload["property"]["region"] == "zanzibar"
    assert payload["current_owner"]["owner_name"] == "Asha Ali"


def test_full_report_pdf_download(client):
    response = client.post(
        "/v1/reports/full",
        json={"title_number": "ZNZ-12345", "region": "zanzibar", "format": "pdf"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert response.content.startswith(b"%PDF-")


def test_full_report_mainland_from_eardhi_connector(client):
    response = client.post(
        "/v1/reports/full",
        json={"title_number": "MLD-DAR-0001", "region": "mainland", "format": "json"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["property"]["title_number"] == "MLD-DAR-0001"
    assert payload["property"]["region"] == "mainland"
