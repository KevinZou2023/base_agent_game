"""Tests for the SQLite ORM layer."""

from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.storage.db import Artwork, Base, LearningEventRow, ScoreRecord, User


@pytest.fixture()
def session():
    """In-memory SQLite for isolated tests."""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    s = Session()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


def test_create_user_and_artwork(session):
    user = User(player_id="p001", nickname="阿勇", level="beginner")
    artwork = Artwork(
        artwork_id="art001",
        player_id="p001",
        task_theme="端午红褐方巾",
        parameters_json={"shuliang_concentration": 0.6, "dye_cycles": 10},
        status="done",
        image_path="storage/images/art001.png",
    )
    user.artworks.append(artwork)
    session.add(user)
    session.commit()

    fetched = session.get(User, "p001")
    assert fetched is not None
    assert fetched.nickname == "阿勇"
    assert len(fetched.artworks) == 1
    assert fetched.artworks[0].artwork_id == "art001"


def test_score_record_one_to_one(session):
    user = User(player_id="p002")
    artwork = Artwork(artwork_id="art002", player_id="p002", parameters_json={})
    user.artworks.append(artwork)
    artwork.score = ScoreRecord(
        artwork_id="art002",
        process_score=78.0,
        pattern_score=85.0,
        color_score=70.0,
        culture_score=90.0,
        progress_score=60.0,
        deductions_json=[{"dimension": "color_score", "points": 5, "reason": "底色偏浅"}],
        master_feedback="底色还可以再厚实一些",
    )
    session.add(user)
    session.commit()

    fetched = session.get(Artwork, "art002")
    assert fetched.score is not None
    assert fetched.score.process_score == 78.0
    assert fetched.score.deductions_json[0]["reason"] == "底色偏浅"


def test_learning_history(session):
    user = User(player_id="p003")
    session.add(user)
    session.flush()
    session.add_all([
        LearningEventRow(player_id="p003", stage="parameter", risk_tag="dye_temp_too_high", note="水温60度"),
        LearningEventRow(player_id="p003", stage="wu_process", risk_tag="wu_too_long", note="过乌130分钟"),
    ])
    session.commit()

    user_fetched = session.get(User, "p003")
    assert len(user_fetched.history) == 2
    tags = {e.risk_tag for e in user_fetched.history}
    assert tags == {"dye_temp_too_high", "wu_too_long"}
