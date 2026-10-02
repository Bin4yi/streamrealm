import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.services import rules

NOW = datetime(2026, 10, 2, 12, tzinfo=timezone.utc)
CLEAN = {"color": "clear", "smell": "none", "foam": "none", "trash": "none", "flow": "flowing", "overall": "good"}
DIRTY = {"color": "brown", "smell": "bad", "foam": "a_lot", "trash": "a_lot", "flow": "still", "overall": "poor"}


def test_tile_state_timeline():
    assert rules.tile_state(None, False, NOW) == "fog"
    assert rules.tile_state(NOW - timedelta(days=7), False, NOW) == "owned_fresh"
    assert rules.tile_state(NOW - timedelta(days=7, minutes=1), False, NOW) == "owned_fading"
    assert rules.tile_state(NOW - timedelta(days=14), False, NOW) == "owned_fading"
    assert rules.tile_state(NOW - timedelta(days=14, minutes=1), False, NOW) == "neutral"
    assert rules.tile_state(NOW - timedelta(days=30), True, NOW) == "disputed"


def test_health_score_formula():
    assert rules.health_score(CLEAN) == 100
    assert rules.health_score(DIRTY) == 0
    assert rules.health_score({**CLEAN, "color": "slightly_cloudy", "foam": "a_little", "trash": "a_few"}) == 70


def test_agreement():
    assert rules.agreement(CLEAN, CLEAN) == 1
    assert rules.agreement(CLEAN, DIRTY) == 0
    assert rules.agreement(CLEAN, {**CLEAN, "foam": "a_little"}) == 0.92
    four_of_six = {**CLEAN, "color": "brown", "smell": "bad"}
    assert rules.agreement(CLEAN, four_of_six) == 0.67 >= rules.AGREEMENT_THRESHOLD
    assert rules.agreement(CLEAN, {**four_of_six, "flow": "dry"}) < rules.AGREEMENT_THRESHOLD


def test_points():
    assert rules.compute_points("explore").total == 50
    assert rules.compute_points("claim_neutral").total == 25
    assert rules.compute_points("refresh").total == 20
    assert rules.compute_points("attack").total == 30
    assert rules.compute_points("attack", attack_success=False).total == 0
    assert rules.compute_points("confirm_dispute").total == 15
    assert rules.compute_points("explore", treasure=True).total == 90
    assert rules.compute_points("explore", storm=True).total == 100
    assert rules.compute_points("explore", streak=3, first_check_today=True).total == 80
    assert rules.compute_points("explore", streak=9, first_check_today=True).total == 100  # bonus capped at 50
    assert rules.compute_points("explore", farming=True).total == 0
    assert rules.compute_points("explore", unsafe=True).total == 0


def test_anti_farming_and_streak():
    assert rules.is_farming(NOW - timedelta(hours=5), NOW)
    assert not rules.is_farming(NOW - timedelta(hours=7), NOW)
    assert rules.streak_update(None, 0, "2026-10-02") == (1, True)
    assert rules.streak_update("2026-10-01", 3, "2026-10-02") == (4, True)
    assert rules.streak_update("2026-10-02", 4, "2026-10-02") == (4, False)
    assert rules.streak_update("2026-09-28", 4, "2026-10-02") == (1, True)


def test_dispute_majority():
    assert rules.resolve_by_majority(CLEAN, DIRTY, {**DIRTY, "overall": "moderate"}) == "b"
    assert rules.resolve_by_majority(CLEAN, DIRTY, CLEAN) == "a"
    tie = {"color": "clear", "smell": "none", "foam": "none", "trash": "a_lot", "flow": "still", "overall": "poor"}
    assert rules.resolve_by_majority(CLEAN, DIRTY, tie) == "a"


def test_client_rules_match_server():
    """app/src/lib/gameRules.ts must use the same numbers as the server."""
    ts = (Path(__file__).resolve().parents[2] / "app" / "src" / "lib" / "gameRules.ts").read_text(encoding="utf-8")

    def num(name):
        return float(re.search(rf"export const {name} = ([\d.]+);", ts).group(1))

    assert num("FRESH_DAYS") == rules.FRESH_DAYS
    assert num("FADING_DAYS") == rules.FADING_DAYS
    assert num("CLAIM_RADIUS_M") == rules.CLAIM_RADIUS_M
    assert num("AGREEMENT_THRESHOLD") == rules.AGREEMENT_THRESHOLD
    assert num("ANTI_FARM_HOURS") == rules.ANTI_FARM_HOURS
    assert num("STORM_MULTIPLIER") == rules.STORM_MULTIPLIER
    assert num("STREAK_BONUS_MAX") == rules.STREAK_BONUS_MAX
    for key, value in rules.POINTS.items():
        assert re.search(rf"\b{key}: {value},", ts), key
    for q, penalties in rules.PENALTIES.items():
        for v, p in penalties.items():
            assert re.search(rf"\b{v}: {p}\b", ts), (q, v)
