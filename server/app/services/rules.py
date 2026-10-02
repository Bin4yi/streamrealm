"""StreamRealm game rules. Pure functions, no database access.

Every number here must match app/src/lib/gameRules.ts (tests check both).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

TEAMS = ("otters", "frogs", "kingfishers")

FRESH_DAYS = 7
FADING_DAYS = 14
CLAIM_RADIUS_M = 40.0
AGREEMENT_THRESHOLD = 0.67
ANTI_FARM_HOURS = 6
STORM_RAIN_MM_48H = 10.0

POINTS = {
    "explore": 50,          # claim a fog tile
    "claim_neutral": 25,    # claim a neutral tile
    "refresh": 20,          # re-check your own team's tile
    "attack": 30,           # successful attack on an enemy tile
    "confirm_dispute": 15,  # third check on a disputed tile
    "treasure": 40,
}
STORM_MULTIPLIER = 2
STREAK_BONUS_PER_DAY = 10
STREAK_BONUS_MAX = 50

TREASURE_TYPES = ("pipe", "trash", "wildlife", "plant", "algae")
FIX_HEALTH_BONUS = 15      # scientist marks a treasure "fixed"
CLEANUP_HEALTH_BONUS = 10  # a cleanup event is logged

# Question -> ordered list of allowed values (order matters for partial agreement).
QUESTIONS: dict[str, list[str]] = {
    "color": ["clear", "slightly_cloudy", "brown", "green", "other"],
    "smell": ["none", "earthy", "bad", "chemical"],
    "foam": ["none", "a_little", "a_lot"],
    "trash": ["none", "a_few", "a_lot"],
    "flow": ["flowing", "slow", "still", "dry"],
    "overall": ["good", "moderate", "poor"],
}
# Questions whose values are an ordered scale: neighbours get half agreement.
ORDINAL = {"foam", "trash", "overall"}

# Health score penalties (score = 100 - sum, clamped to 0..100). Game indicator only.
PENALTIES: dict[str, dict[str, int]] = {
    "color": {"clear": 0, "slightly_cloudy": 10, "brown": 25, "green": 25, "other": 15},
    "smell": {"none": 0, "earthy": 5, "bad": 30, "chemical": 30},
    "foam": {"none": 0, "a_little": 10, "a_lot": 25},
    "trash": {"none": 0, "a_few": 10, "a_lot": 25},
    "flow": {"flowing": 0, "slow": 5, "still": 15, "dry": 20},
    "overall": {"good": 0, "moderate": 10, "poor": 20},
}


def validate_answers(answers: dict) -> dict[str, str]:
    """Return a clean answers dict or raise ValueError with a simple message."""
    clean = {}
    for q, values in QUESTIONS.items():
        v = answers.get(q)
        if v not in values:
            raise ValueError(f"Please answer '{q}' with one of: {', '.join(values)}")
        clean[q] = v
    return clean


def health_score(answers: dict[str, str]) -> int:
    total = sum(PENALTIES[q].get(answers.get(q, ""), 0) for q in QUESTIONS)
    return max(0, min(100, 100 - total))


def agreement(a: dict[str, str], b: dict[str, str]) -> float:
    """Agreement between two checks over the 6 answers, 0..1.

    Same answer = 1. Neighbouring values on an ordered scale (foam, trash, overall) = 0.5.
    Rounded to 2 decimals, so 4 of 6 equal answers = 0.67 and passes the threshold.
    """
    score = 0.0
    for q, values in QUESTIONS.items():
        va, vb = a.get(q), b.get(q)
        if va is None or vb is None:
            continue
        if va == vb:
            score += 1
        elif q in ORDINAL and va in values and vb in values and abs(values.index(va) - values.index(vb)) == 1:
            score += 0.5
    return round(score / len(QUESTIONS), 2)


def tile_state(last_check_at: Optional[datetime], dispute_open: bool, now: datetime) -> str:
    if dispute_open:
        return "disputed"
    if last_check_at is None:
        return "fog"
    age = now - last_check_at
    if age <= timedelta(days=FRESH_DAYS):
        return "owned_fresh"
    if age <= timedelta(days=FADING_DAYS):
        return "owned_fading"
    return "neutral"


def classify_action(state: str, owner_team: Optional[str], player_team: str) -> str:
    if state == "fog":
        return "explore"
    if state == "neutral":
        return "claim_neutral"
    if state == "disputed":
        return "confirm_dispute"
    if owner_team == player_team:
        return "refresh"
    return "attack"


def is_farming(last_same_player_check: Optional[datetime], now: datetime) -> bool:
    return last_same_player_check is not None and now - last_same_player_check < timedelta(hours=ANTI_FARM_HOURS)


def streak_update(last_day: Optional[str], streak: int, today: str) -> tuple[int, bool]:
    """Return (new_streak, first_check_today)."""
    if last_day == today:
        return streak, False
    if last_day is not None:
        prev = datetime.strptime(last_day, "%Y-%m-%d").date()
        cur = datetime.strptime(today, "%Y-%m-%d").date()
        if (cur - prev).days == 1:
            return streak + 1, True
    return 1, True


def streak_bonus(streak: int) -> int:
    return min(STREAK_BONUS_PER_DAY * streak, STREAK_BONUS_MAX)


@dataclass
class PointsResult:
    total: int
    breakdown: list[dict] = field(default_factory=list)


def compute_points(
    action: str,
    *,
    attack_success: bool = True,
    treasure: bool = False,
    storm: bool = False,
    farming: bool = False,
    unsafe: bool = False,
    streak: int = 0,
    first_check_today: bool = False,
) -> PointsResult:
    """Points for one check. Breakdown lines are shown to the player."""
    if farming:
        return PointsResult(0, [{"label": "Checked this tile less than 6 hours ago", "points": 0}])
    if unsafe:
        return PointsResult(0, [{"label": "Unsafe tile: no points", "points": 0}])
    lines: list[dict] = []
    if action == "attack" and not attack_success:
        lines.append({"label": "Attack under review (dispute)", "points": 0})
    else:
        labels = {
            "explore": "Explorer bonus (fog tile)",
            "claim_neutral": "Claimed a neutral tile",
            "refresh": "Refreshed your team's tile",
            "attack": "Attack won",
            "confirm_dispute": "Settled a dispute",
        }
        lines.append({"label": labels[action], "points": POINTS[action]})
    if treasure:
        lines.append({"label": "Treasure found", "points": POINTS["treasure"]})
    if first_check_today and streak > 0:
        lines.append({"label": f"Streak day {streak}", "points": streak_bonus(streak)})
    total = sum(line["points"] for line in lines)
    if storm and total > 0:
        lines.append({"label": "Storm Quest x2", "points": total * (STORM_MULTIPLIER - 1)})
        total *= STORM_MULTIPLIER
    return PointsResult(total, lines)


def resolve_by_majority(a: dict[str, str], b: dict[str, str], c: dict[str, str]) -> str:
    """A third check decides a dispute: the side (a = defender, b = attacker) that agrees more with c wins.

    Ties go to the defender (a), because the attacker has not proven the change.
    """
    return "b" if agreement(c, b) > agreement(c, a) else "a"


def kingdom_health(tile_scores: list[int]) -> Optional[int]:
    if not tile_scores:
        return None
    return round(sum(tile_scores) / len(tile_scores))
