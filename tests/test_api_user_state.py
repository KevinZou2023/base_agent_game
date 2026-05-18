"""Integration tests for user_state endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


def test_get_user_state_auto_creates(client):
    r = client.get("/api/v1/user/new_player_xyz/state")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["player_id"] == "new_player_xyz"
    assert data["level"] == "beginner"
    assert data["artworks"] == []
    assert data["recent_risk_tags"] == []


def test_put_user_state_updates_nickname_and_level(client):
    r = client.put(
        "/api/v1/user/p_update/state",
        json={"nickname": "阿勇", "level": "intermediate"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["nickname"] == "阿勇"
    assert data["level"] == "intermediate"

    # Roundtrip GET should reflect changes
    r2 = client.get("/api/v1/user/p_update/state")
    assert r2.json()["nickname"] == "阿勇"
    assert r2.json()["level"] == "intermediate"


def test_get_scoring_missing_artwork_returns_404(client):
    r = client.get("/api/v1/scoring/nonexistent_id")
    assert r.status_code == 404
