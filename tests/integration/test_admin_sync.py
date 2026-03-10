def _login(client, email: str, password: str) -> str:
    res = client.post("/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_admin_sync_requires_enterprise_tier(client):
    register = client.post(
        "/v1/auth/register",
        json={
            "email": "free-user@milki.tz",
            "password": "Password123!Aa",
            "name": "Free User",
        },
    )
    assert register.status_code == 200

    token = _login(client, "free-user@milki.tz", "Password123!Aa")
    res = client.post("/v1/admin/sync/run", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_admin_sync_run_and_monitoring(client):
    token = _login(client, "test@milki.tz", "Password123!")

    run = client.post("/v1/admin/sync/run", headers={"Authorization": f"Bearer {token}"})
    assert run.status_code == 200
    payload = run.json()
    assert "results" in payload
    assert len(payload["results"]) >= 2

    runs = client.get("/v1/admin/sync/runs", headers={"Authorization": f"Bearer {token}"})
    assert runs.status_code == 200
    assert len(runs.json()["data"]) >= 1

    health = client.get("/v1/admin/sync/health", headers={"Authorization": f"Bearer {token}"})
    assert health.status_code == 200
    assert len(health.json()["data"]) >= 2
