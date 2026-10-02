"""The game engine: turns a stream check into tile changes, points, confirmations and disputes.

Players go through two steps (create_draft -> finalize) so they can see the photo check and
decide about AI suggestions before anything counts. Bots call apply_rules directly.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from ..models import Event, Observation, Photo, Player, Tile, TileState, Treasure, aware
from . import photos, rules
from .ai_check import CheckPhoto, run_check
from .geo import distance_to_line_m
from .world import describe


class GameError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def log_event(session: Session, type_: str, payload: dict, at: datetime) -> None:
    session.add(Event(type=type_, payload_json=json.dumps(payload), created_at=at))


def check_position(tile: Tile, lat: Optional[float], lon: Optional[float]) -> float:
    if lat is None or lon is None:
        raise GameError(422, "We need your position to check a tile.")
    d = distance_to_line_m(lat, lon, tile.coords)
    if d > rules.CLAIM_RADIUS_M:
        raise GameError(422, f"You are {round(d)} m from this tile. Walk within {int(rules.CLAIM_RADIUS_M)} m to check it.")
    return d


def create_draft(
    session: Session,
    *,
    player: Player,
    tile: Tile,
    lat: Optional[float],
    lon: Optional[float],
    answers: dict,
    shots: list[CheckPhoto],
    treasure_type: Optional[str],
    treasure_photo: Optional[str],
    now: datetime,
) -> Observation:
    if tile.unsafe:
        raise GameError(403, "This tile is marked unsafe by scientists. Please do not check it.")
    distance = check_position(tile, lat, lon)
    try:
        clean = rules.validate_answers(answers)
    except ValueError as err:
        raise GameError(422, str(err)) from err
    if treasure_type and treasure_type not in rules.TREASURE_TYPES:
        raise GameError(422, f"Unknown treasure type '{treasure_type}'")
    if len(shots) != 2:
        raise GameError(422, "Please add an upstream and a downstream photo.")

    ai = run_check(session, shots, clean)
    ai["_hashes"] = [None if s.is_demo else photos.phash(s.image) for s in shots]
    obs = Observation(
        tile_id=tile.id,
        player_id=player.id,
        team=player.team,
        created_at=now,
        answers_json=json.dumps(clean),
        original_answers_json=json.dumps(clean),
        photo_up=shots[0].rel_path,
        photo_down=shots[1].rel_path,
        health_score=rules.health_score(clean),
        ai_result_json=json.dumps(ai),
        status="draft",
        client_lat=lat,
        client_lon=lon,
        distance_m=round(distance, 1),
        is_demo=all(s.is_demo for s in shots),
        treasure_json=json.dumps({"type": treasure_type, "photo": treasure_photo} if treasure_type else {}),
    )
    session.add(obs)
    session.commit()
    session.refresh(obs)
    return obs


def public_ai(obs: Observation) -> dict:
    ai = json.loads(obs.ai_result_json or "{}")
    ai.pop("_hashes", None)
    return ai


def finalize(
    session: Session,
    obs: Observation,
    *,
    answers: dict,
    ai_choices: dict,
    now: datetime,
    storm: bool,
) -> dict:
    if obs.status != "draft":
        raise GameError(409, "This check is already finished.")
    player = session.get(Player, obs.player_id)
    tile = session.get(Tile, obs.tile_id)
    ai = json.loads(obs.ai_result_json or "{}")
    if ai.get("verdict") == "fail":
        obs.status = "rejected"
        session.add(obs)
        session.commit()
        raise GameError(422, "The photo check failed. " + " ".join(ai.get("reasons", [])[:2]))
    try:
        clean = rules.validate_answers(answers)
    except ValueError as err:
        raise GameError(422, str(err)) from err
    obs.answers_json = json.dumps(clean)
    obs.ai_choices_json = json.dumps({k: v for k, v in (ai_choices or {}).items() if k in rules.QUESTIONS and v in ("accepted", "kept")})
    obs.health_score = rules.health_score(clean)
    obs.created_at = now
    # Photos join the duplicate index only once the check counts.
    for rel, h in zip((obs.photo_up, obs.photo_down), ai.get("_hashes", [])):
        if h:
            session.add(Photo(filename=rel, phash=h, observation_id=obs.id, created_at=now))
    return apply_rules(session, obs, player, tile, now=now, storm=storm)


def apply_rules(session: Session, obs: Observation, player: Player, tile: Tile, *, now: datetime, storm: bool) -> dict:
    ts = session.get(TileState, tile.id)
    if tile.unsafe:
        raise GameError(403, "This tile is marked unsafe by scientists. Please do not check it.")
    new_answers = obs.answers()
    last = aware(ts.last_check_at)
    state = rules.tile_state(last, ts.dispute_open, now)
    action = rules.classify_action(state, ts.owner_team, player.team)

    last_same = session.exec(
        select(Observation.created_at)
        .where(Observation.tile_id == tile.id, Observation.player_id == player.id, Observation.status != "draft", Observation.id != obs.id)
        .order_by(Observation.created_at.desc())
    ).first()
    farming = rules.is_farming(aware(last_same), now)

    prev = session.get(Observation, ts.last_observation_id) if ts.last_observation_id else None
    attack_success = True
    agreement: Optional[float] = None
    confirmed_previous = False
    outcome = "claimed"
    obs.status = "pending"

    if action == "confirm_dispute":
        a = session.get(Observation, ts.dispute_obs_a)
        b = session.get(Observation, ts.dispute_obs_b)
        if player.id in (a.player_id, b.player_id):
            raise GameError(409, "You are part of this dispute. Another player must settle it.")
        winner = rules.resolve_by_majority(a.answers(), b.answers(), new_answers)
        win, lose = (b, a) if winner == "b" else (a, b)
        agreement = rules.agreement(new_answers, win.answers())
        win.status, win.confirmed_by_observation_id = "confirmed", obs.id
        lose.status = "rejected"
        session.add_all([win, lose])
        if winner == "b":  # the attacker was right: pay the attack now
            attacker = session.get(Player, b.player_id)
            attacker.points += rules.POINTS["attack"]
            b.points += rules.POINTS["attack"]
            session.add(attacker)
        ts.owner_team = win.team
        ts.dispute_open = False
        ts.dispute_obs_a = ts.dispute_obs_b = None
        confirmed_previous = True
        outcome = "dispute_settled"
    elif action == "attack":
        agreement = rules.agreement(new_answers, prev.answers()) if prev else 1.0
        if agreement >= rules.AGREEMENT_THRESHOLD:
            if prev:
                prev.status, prev.confirmed_by_observation_id = "confirmed", obs.id
                session.add(prev)
                confirmed_previous = True
            ts.owner_team = player.team
            outcome = "attack_won"
        else:
            attack_success = False
            ts.dispute_open = True
            ts.dispute_obs_a = prev.id if prev else None
            ts.dispute_obs_b = obs.id
            if prev:
                prev.status = "disputed"
                session.add(prev)
            obs.status = "disputed"
            outcome = "dispute_started"
    elif action == "refresh":
        if prev and prev.player_id != player.id and prev.status == "pending":
            agreement = rules.agreement(new_answers, prev.answers())
            if agreement >= rules.AGREEMENT_THRESHOLD:
                prev.status, prev.confirmed_by_observation_id = "confirmed", obs.id
                session.add(prev)
                confirmed_previous = True
        outcome = "defended" if state == "owned_fading" else "refreshed"
    else:  # explore / claim_neutral
        ts.owner_team = player.team

    # Tile freshness and health always follow the newest data.
    ts.last_check_at = now
    if outcome != "dispute_started":
        ts.last_observation_id = obs.id
        ts.health_score = obs.health_score
        ts.health_bonus = 0
    ts.state = rules.tile_state(now, ts.dispute_open, now)

    treasure_info = json.loads(obs.treasure_json or "{}")
    treasure = None
    if treasure_info.get("type"):
        treasure = Treasure(observation_id=obs.id, tile_id=tile.id, type=treasure_info["type"], photo=treasure_info.get("photo"), created_at=now)
        session.add(treasure)

    today = now.strftime("%Y-%m-%d")
    scoring = not farming and not tile.unsafe
    streak, first_today = (player.streak, False)
    if scoring:
        streak, first_today = rules.streak_update(player.last_active_day, player.streak, today)
        player.streak, player.last_active_day = streak, today
    pts = rules.compute_points(
        action,
        attack_success=attack_success,
        treasure=treasure is not None,
        storm=storm,
        farming=farming,
        unsafe=tile.unsafe,
        streak=streak,
        first_check_today=first_today,
    )
    player.points += pts.total
    obs.points = pts.total
    obs.points_breakdown_json = json.dumps(pts.breakdown)
    obs.action = action
    obs.outcome = "farming" if farming else outcome
    obs.storm = storm
    session.add_all([obs, ts, player])
    log_event(
        session,
        "check",
        {
            "outcome": obs.outcome,
            "action": action,
            "nickname": player.nickname,
            "avatar": player.avatar,
            "team": player.team,
            "is_bot": player.is_bot,
            "stream": tile.stream_name,
            "tile_id": tile.id,
            "points": pts.total,
            "treasure": treasure.type if treasure else None,
        },
        now,
    )
    session.commit()
    session.refresh(ts)
    return {
        "observation_id": obs.id,
        "action": action,
        "outcome": obs.outcome,
        "status": obs.status,
        "agreement": agreement,
        "confirmed_previous": confirmed_previous,
        "points": pts.total,
        "breakdown": pts.breakdown,
        "health_score": obs.health_score,
        "streak": player.streak,
        "player_points": player.points,
        "treasure": treasure.type if treasure else None,
        "storm": storm,
        "tile": describe(tile, ts, now),
        "animation": {
            "type": "clash" if outcome == "dispute_started" else "paint",
            "team": ts.owner_team or player.team,
            "points": pts.total,
        },
    }
