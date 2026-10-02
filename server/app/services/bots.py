"""Demo world: bot players with 3 weeks of history, and live bot moves.

All bot data is synthetic and marked (Player.is_bot = True, photos labelled DEMO).
Each tile gets a hidden "true condition"; bots report it with some noise, so most
second checks agree (confirmations) and some disagree (disputes), like real people.
"""
from __future__ import annotations

import hashlib
import json
import random
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, delete, select

from ..models import Event, Observation, Photo, Player, QuestProgress, Tile, TileState, Treasure, aware
from . import photos, rules
from .game import GameError, apply_rules
from .geo import haversine_m
from .world import game_now

SEED = 42
HISTORY_DAYS = 21
RANGE_M = 1600  # bots play near home

BOT_NAMES = [
    "MossyPaws", "ReedRunner", "RippleRay", "PebbleScout", "WillowWisp", "BrookBean",
    "OtterlyCool", "SplashJay", "FernFinder", "CurrentKid", "LilyLeap", "DrizzleDot",
    "MudlarkMo", "TadpoleTed", "HeronHal", "BankRanger", "DewDrop", "StoneSkipper",
    "CressCat", "WaderWen", "FlowFox", "MarshMika", "SpringSam", "KelpKai",
]
AVATARS = ["otter", "frog", "bird", "swan", "butterfly", "fish", "turtle", "beaver"]


def _tile_rng(tile_id: str) -> random.Random:
    return random.Random(int(hashlib.sha1(tile_id.encode()).hexdigest()[:8], 16))


def true_condition(tile_id: str) -> dict[str, str]:
    r = _tile_rng(tile_id)
    pick = lambda opts: r.choices([o for o, _ in opts], [w for _, w in opts])[0]  # noqa: E731
    cond = {
        "color": pick([("clear", 45), ("slightly_cloudy", 32), ("brown", 15), ("green", 6), ("other", 2)]),
        "smell": pick([("none", 60), ("earthy", 28), ("bad", 10), ("chemical", 2)]),
        "foam": pick([("none", 62), ("a_little", 30), ("a_lot", 8)]),
        "trash": pick([("none", 42), ("a_few", 45), ("a_lot", 13)]),
        "flow": pick([("flowing", 55), ("slow", 30), ("still", 10), ("dry", 5)]),
    }
    penalty = sum(rules.PENALTIES[q][v] for q, v in cond.items())
    cond["overall"] = "good" if penalty <= 15 else "moderate" if penalty <= 40 else "poor"
    return cond


def tile_treasure(tile_id: str) -> Optional[str]:
    r = _tile_rng(tile_id + ":t")
    return r.choices([None, "pipe", "trash", "wildlife", "plant", "algae"], [95.5, 1.3, 1.3, 1, 0.6, 0.3])[0]


def noisy(cond: dict[str, str], rnd: random.Random, noise: float) -> dict[str, str]:
    out = {}
    for q, v in cond.items():
        values = rules.QUESTIONS[q]
        if rnd.random() < noise:
            i = values.index(v)
            j = max(0, min(len(values) - 1, i + rnd.choice([-1, 1]))) if rnd.random() < 0.7 else rnd.randrange(len(values))
            out[q] = values[j]
        else:
            out[q] = v
    return out


def _make_bots(session: Session, rnd: random.Random, tiles: list[Tile], now: datetime) -> list[Player]:
    bots = []
    for i, name in enumerate(BOT_NAMES):
        team = rules.TEAMS[i % 3]
        p = Player(nickname=name, avatar=rnd.choice(AVATARS), team=team, is_bot=True, created_at=now - timedelta(days=HISTORY_DAYS + 3))
        session.add(p)
        bots.append(p)
    session.commit()
    # Home tile: teams start in different parts of the city so borders form.
    by_lon = sorted(tiles, key=lambda t: t.center_lon)
    third = len(by_lon) // 3
    zones = {"otters": by_lon[:third + 40], "frogs": by_lon[third - 20: 2 * third + 20], "kingfishers": by_lon[2 * third - 40:]}
    for b in bots:
        b._home = rnd.choice(zones[b.team])  # type: ignore[attr-defined]
    return bots


def _nearby(tiles: list[Tile], home: Tile) -> list[Tile]:
    return [t for t in tiles if haversine_m(home.center_lat, home.center_lon, t.center_lat, t.center_lon) <= RANGE_M]


def _choose_tile(session: Session, rnd: random.Random, bot: Player, candidates: list[Tile], states: dict[str, TileState], now: datetime) -> Optional[Tile]:
    weights = []
    for t in candidates:
        ts = states[t.id]
        if t.unsafe:
            weights.append(0)
            continue
        st = rules.tile_state(aware(ts.last_check_at), ts.dispute_open, now)
        if st == "fog":
            w = 3.0
        elif st == "neutral":
            w = 2.2
        elif st == "disputed":
            w = 1.8
        elif ts.owner_team == bot.team:
            w = 2.4 if st == "owned_fading" else 0.25
        else:
            w = 1.1 if st == "owned_fresh" else 1.6
        weights.append(w)
    if not any(weights):
        return None
    return rnd.choices(candidates, weights)[0]


def bot_check(session: Session, rnd: random.Random, bot: Player, tile: Tile, now: datetime, noise: float, treasure_chance: float) -> Optional[dict]:
    answers = noisy(true_condition(tile.id), rnd, noise)
    up, down = photos.pick_demo_photos(rnd, 2)
    treasure = tile_treasure(tile.id)
    found = treasure and session.exec(select(Treasure.id).where(Treasure.tile_id == tile.id, Treasure.type == treasure)).first()
    tj = {"type": treasure, "photo": up} if treasure and not found and rnd.random() < treasure_chance else {}
    obs = Observation(
        tile_id=tile.id, player_id=bot.id, team=bot.team, created_at=now, answers_json=json.dumps(answers),
        original_answers_json=json.dumps(answers), photo_up=up, photo_down=down, health_score=rules.health_score(answers),
        ai_result_json=json.dumps({"verdict": "pass", "reasons": [], "suggestions": [], "checks": {}, "mode": "bot"}),
        status="draft", is_demo=True, treasure_json=json.dumps(tj),
        client_lat=tile.center_lat, client_lon=tile.center_lon, distance_m=0.0,
    )
    session.add(obs)
    try:
        return apply_rules(session, obs, bot, tile, now=now, storm=False)
    except GameError:
        session.rollback()
        return None


def seed_world(session: Session) -> dict:
    session.expire_on_commit = False  # bots touch hundreds of rows; no need to reload after each commit
    rnd = random.Random(SEED)
    tiles = session.exec(select(Tile).order_by(Tile.id)).all()
    if not tiles:
        return {"seeded": False}
    end = game_now(0)
    bots = _make_bots(session, rnd, tiles, end)
    near = {b.id: _nearby(tiles, b._home) for b in bots}  # type: ignore[attr-defined]
    checks = 0
    for day in range(HISTORY_DAYS, -1, -1):
        for bot in bots:
            for _ in range(rnd.choices([0, 1, 2, 3], [38, 40, 18, 4])[0]):
                now = end - timedelta(days=day, hours=rnd.uniform(0, 10), minutes=rnd.randint(0, 59))
                if now > end:
                    continue
                states = {s.tile_id: s for s in session.exec(select(TileState)).all()}
                tile = _choose_tile(session, rnd, bot, near[bot.id], states, now)
                if tile and bot_check(session, rnd, bot, tile, now, noise=0.12, treasure_chance=0.6):
                    checks += 1
    # Make sure the demo shows a few open disputes: careless attacks on fresh enemy tiles today.
    open_disputes = lambda: len(session.exec(select(TileState).where(TileState.dispute_open == True)).all())  # noqa: E712,E731
    tries = 0
    while open_disputes() < 5 and tries < 200:
        tries += 1
        bot = rnd.choice(bots)
        states = {s.tile_id: s for s in session.exec(select(TileState)).all()}
        targets = [t for t in near[bot.id] if states[t.id].owner_team not in (None, bot.team)
                   and rules.tile_state(aware(states[t.id].last_check_at), states[t.id].dispute_open, end) == "owned_fresh"]
        if targets:
            bot_check(session, rnd, bot, rnd.choice(targets), end - timedelta(minutes=rnd.randint(5, 600)), noise=0.75, treasure_chance=0)
    # Some treasures already handled by scientists, so the queue shows every status.
    treasures = session.exec(select(Treasure).order_by(Treasure.created_at)).all()
    for t, status in zip(treasures, ["reviewed", "needs_action", "reviewed"]):
        t.status = status
        session.add(t)
    session.commit()
    return {"seeded": True, "bots": len(bots), "checks": checks, "open_disputes": open_disputes(), "treasures": len(treasures)}


def reset_world(session: Session) -> dict:
    for model in (Event, Treasure, Photo, QuestProgress, Observation):
        session.exec(delete(model))
    session.exec(delete(Player).where(Player.is_bot == True))  # noqa: E712
    for p in session.exec(select(Player)).all():
        p.points, p.streak, p.last_active_day = 0, 0, None
        session.add(p)
    for ts in session.exec(select(TileState)).all():
        ts.owner_team = ts.last_check_at = ts.last_observation_id = ts.dispute_obs_a = ts.dispute_obs_b = ts.health_score = None
        ts.dispute_open, ts.health_bonus, ts.state = False, 0, "fog"
        session.add(ts)
    for t in session.exec(select(Tile).where(Tile.unsafe == True)).all():  # noqa: E712
        t.unsafe = False
        session.add(t)
    session.commit()
    return seed_world(session)


def tick(session: Session, time_warp_days: float = 0) -> dict:
    """1-3 bot moves right now (claim, attack, refresh, settle)."""
    session.expire_on_commit = False
    rnd = random.Random()
    bots = session.exec(select(Player).where(Player.is_bot == True)).all()  # noqa: E712
    tiles = session.exec(select(Tile)).all()
    if not bots or not tiles:
        return {"moves": []}
    now = game_now(time_warp_days)
    moves = []
    for _ in range(rnd.randint(1, 3)):
        bot = rnd.choice(bots)
        home = rnd.choice(tiles)
        states = {s.tile_id: s for s in session.exec(select(TileState)).all()}
        tile = _choose_tile(session, rnd, bot, _nearby(tiles, home), states, now)
        if not tile:
            continue
        careless = rnd.random() < 0.2
        res = bot_check(session, rnd, bot, tile, now, noise=0.6 if careless else 0.12, treasure_chance=0.15)
        if res:
            moves.append({"bot": bot.nickname, "team": bot.team, "tile_id": tile.id, "outcome": res["outcome"], "points": res["points"]})
    return {"moves": moves}
