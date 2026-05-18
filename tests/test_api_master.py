"""Integration tests for the master_chat endpoint using FastAPI TestClient + mocked LLM."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.agent.llm_client import ChatResponse, LLMClient
from app.api.deps import get_agent
from app.agent.master_agent import MasterAgent
from app.agent.tool_registry import ToolRegistry
from app.main import create_app


class StubLLM(LLMClient):
    def __init__(self, content: str = "测试用师傅回复") -> None:
        self.content = content

    def chat(self, messages, **kwargs):
        return ChatResponse(content=self.content)


@pytest.fixture()
def client(monkeypatch):
    """TestClient with a stub Agent that never hits real APIs."""
    app = create_app()
    stub_agent = MasterAgent(llm=StubLLM(), registry=ToolRegistry())
    app.dependency_overrides[get_agent] = lambda: stub_agent
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_master_chat_returns_agent_response_shape(client):
    body = {
        "player_state": {
            "player_id": "p_test",
            "learner_level": "beginner",
            "current_stage": "parameter",
            "parameters": {"wu_duration_minutes": 130.0},
        },
        "message": "这样行不行？",
        "operation_event": {"type": "param_change", "changes": {"wu_duration_minutes": 130.0}},
    }
    r = client.post("/api/v1/master/chat", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    # Rule engine guardrail should fire regardless of stub LLM
    assert "wu_too_long" in data["risk_tags"]
    assert data["master_reply"] == "测试用师傅回复"
    assert data["recommended_actions"]
    assert data["stage"] == "parameter"


def test_master_chat_idle_event_no_risks(client):
    body = {
        "player_state": {
            "player_id": "p_idle",
            "learner_level": "beginner",
            "current_stage": "parameter",
        },
    }
    r = client.post("/api/v1/master/chat", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["risk_tags"] == []
