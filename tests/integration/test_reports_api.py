import time
from conftest import TEST_API_KEY


def test_full_report_requires_api_key(client):
    response = client.post(
        "/v1/reports/full",
        json={"title_number": "ZNZ-12345", "region": "zanzibar", "format": "json"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "MISSING_API_KEY"


def test_report_async_flow_and_downloads(client):
    create = client.post(
        "/v1/reports/full",
        json={"title_number": "ZNZ-12345", "region": "zanzibar", "format": "pdf"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert create.status_code == 200
    create_payload = create.json()
    assert create_payload["processing_mode"] in {"queued", "inline"}
    report_id = create_payload["report_id"]

    status_payload = None
    for _ in range(10):
        status = client.get(f"/v1/reports/{report_id}", headers={"X-API-Key": TEST_API_KEY})
        assert status.status_code == 200
        status_payload = status.json()
        if status_payload["status"] == "completed":
            break
        time.sleep(0.05)

    assert status_payload is not None
    assert status_payload["status"] == "completed"
    assert status_payload["title_number"] == "ZNZ-12345"

    json_url = client.get(
        f"/v1/reports/{report_id}/download-url?format=json",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert json_url.status_code == 200
    json_download = client.get(json_url.json()["download_url"])
    assert json_download.status_code == 200
    assert json_download.headers["content-type"].startswith("application/json")

    pdf_url = client.get(
        f"/v1/reports/{report_id}/download-url?format=pdf",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert pdf_url.status_code == 200
    pdf_download = client.get(pdf_url.json()["download_url"])
    assert pdf_download.status_code == 200
    assert pdf_download.headers["content-type"].startswith("application/pdf")
    assert pdf_download.content.startswith(b"%PDF-")


def test_reports_list_returns_items(client):
    client.post(
        "/v1/reports/full",
        json={"title_number": "ZNZ-12345", "region": "zanzibar", "format": "json"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    response = client.get("/v1/reports", headers={"X-API-Key": TEST_API_KEY})
    assert response.status_code == 200
    payload = response.json()
    assert "data" in payload
    assert "pagination" in payload
    assert len(payload["data"]) >= 1

    filtered = client.get("/v1/reports?status=completed&region=zanzibar", headers={"X-API-Key": TEST_API_KEY})
    assert filtered.status_code == 200
