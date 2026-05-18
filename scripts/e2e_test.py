"""End-to-end test against a running uvicorn server.

Usage:
    # Start the server in another terminal:
    #   uvicorn app.main:app --host 127.0.0.1 --port 8000
    python scripts/e2e_test.py
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


BASE_URL = "http://127.0.0.1:8000"


def divider(title: str) -> None:
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)


def step_health(client: httpx.Client) -> None:
    divider("0. /health")
    r = client.get("/health")
    print(r.status_code, r.json())
    r.raise_for_status()


def step_user_state(client: httpx.Client, player_id: str) -> None:
    divider(f"1. GET /api/v1/user/{player_id}/state (auto-create)")
    r = client.get(f"/api/v1/user/{player_id}/state")
    print(r.status_code, r.json())
    r.raise_for_status()


def step_master_chat(client: httpx.Client, player_id: str) -> None:
    divider("2. POST /api/v1/master/chat (中风险：过乌130分钟)")
    body = {
        "player_state": {
            "player_id": player_id,
            "learner_level": "beginner",
            "current_stage": "parameter",
            "parameters": {
                "shuliang_concentration": 0.6,
                "dye_cycles": 10,
                "dye_water_temp": 28.0,
                "sun_hours": 6.0,
                "sun_total_days": 4,
                "wu_mud_thickness": 0.55,
                "wu_duration_minutes": 130.0,
                "wu_apply_count": 2,
                "wash_water_temp": 25.0,
                "air_dry_hours": 8.0,
            },
        },
        "operation_event": {
            "type": "param_change",
            "changes": {"wu_duration_minutes": 130.0},
        },
    }
    r = client.post("/api/v1/master/chat", json=body, timeout=60.0)
    print(r.status_code)
    data = r.json()
    print(f"  risk_tags: {data['risk_tags']}")
    print(f"  hint_type: {data['hint_type']}")
    print(f"  master_reply: {data['master_reply'][:150]}...")
    r.raise_for_status()


def step_artwork(client: httpx.Client, player_id: str, ideal: bool = True) -> str:
    divider(f"3. POST /api/v1/artwork/generate ({'ideal params' if ideal else 'bad params'})")
    params = {
        "shuliang_concentration": 0.6,
        "dye_cycles": 10,
        "dye_water_temp": 28.0,
        "sun_hours": 6.0,
        "sun_total_days": 4,
        "wu_mud_thickness": 0.55,
        "wu_duration_minutes": 75.0,
        "wu_apply_count": 2,
        "wash_water_temp": 25.0,
        "air_dry_hours": 8.0,
    }
    if not ideal:
        params["wu_duration_minutes"] = 130.0
        params["dye_cycles"] = 3

    body = {
        "player_id": player_id,
        "task_theme": "端午 · 红褐黑亮方巾",
        "target_pattern": "云纹",
        "parameters": params,
    }
    print("Submitting (this takes 30-60s) ...")
    start = time.time()
    r = client.post("/api/v1/artwork/generate", json=body, timeout=180.0)
    elapsed = time.time() - start
    print(f"  HTTP {r.status_code} in {elapsed:.1f}s")
    if r.status_code != 200:
        print("  body:", r.text[:500])
        r.raise_for_status()
    data = r.json()
    print(f"  artwork_id: {data['artwork_id']}")
    print(f"  image_url (local):  {data['image_url']}")
    print(f"  image_url (remote): {data.get('original_image_url', '')[:80]}...")
    print(f"  prompt: {data['prompt_used'][:200]}...")
    print(f"  rule_passed: {data['rule_check_passed']}, risks: {data['risk_tags']}")
    return data["artwork_id"]


def step_static(client: httpx.Client, artwork_id: str) -> None:
    divider(f"4. GET /static/images/{artwork_id}.png")
    r = client.get(f"/static/images/{artwork_id}.png")
    print(f"  HTTP {r.status_code}, {len(r.content)} bytes")
    r.raise_for_status()


def step_scoring(client: httpx.Client, artwork_id: str) -> None:
    divider(f"5. GET /api/v1/scoring/{artwork_id}")
    r = client.get(f"/api/v1/scoring/{artwork_id}", timeout=60.0)
    print(f"  HTTP {r.status_code}")
    if r.status_code != 200:
        print(r.text)
        return
    data = r.json()
    s = data["scores"]
    print(f"  scores: process={s['process_score']:.0f} pattern={s['pattern_score']:.0f} "
          f"color={s['color_score']:.0f} culture={s['culture_score']:.0f} progress={s['progress_score']:.0f}")
    print(f"  deductions: {len(data['deductions'])} items")
    print(f"  master_feedback: {data['master_feedback'][:200]}...")
    print(f"  next_task: {data['next_task_recommendation']}")


def step_user_state_after(client: httpx.Client, player_id: str) -> None:
    divider(f"6. GET /api/v1/user/{player_id}/state (after artwork)")
    r = client.get(f"/api/v1/user/{player_id}/state")
    data = r.json()
    print(f"  artworks: {len(data['artworks'])}")
    for a in data["artworks"][:3]:
        print(f"    - {a['artwork_id']} status={a['status']} url={a['image_url']}")
    print(f"  recent_risk_tags: {data['recent_risk_tags']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-artwork", action="store_true", help="Skip the Wanxiang call (saves money)")
    parser.add_argument("--bad-params", action="store_true", help="Use bad params (lower quality output)")
    parser.add_argument("--player-id", default="e2e_player")
    args = parser.parse_args()

    with httpx.Client(base_url=BASE_URL) as client:
        step_health(client)
        step_user_state(client, args.player_id)
        step_master_chat(client, args.player_id)

        if args.skip_artwork:
            print("\n(skipping artwork generation per --skip-artwork)")
            return

        artwork_id = step_artwork(client, args.player_id, ideal=not args.bad_params)
        step_static(client, artwork_id)
        step_scoring(client, artwork_id)
        step_user_state_after(client, args.player_id)

    print()
    print("✅ End-to-end test passed.")


if __name__ == "__main__":
    main()
