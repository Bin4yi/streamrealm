"""Leaderboard, quests, kingdom (team) view and player stats."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from ..db import get_session
from ..models import Observation, Player, Quest, QuestProgress, Tile, TileState, Treasure, aware
from ..services import rules, weather
from ..services.world import effective_health, game_now

router = APIRouter(tags=["social"])

QUESTS = [
    Quest(id="explore2", title="Explore 2 fog tiles", description="Be the first to check 2 unexplored tiles.", kind="daily", metric="explore", target=2, reward=40, icon="🌫️"),
    Quest(id="check3", title="Do 3 stream checks", description="Any 3 checks today.", kind="daily", metric="checks", target=3, reward=30, icon="📷"),
    Quest(id="defend1", title="Defend a fading tile", description="Refresh one of your team's fading tiles.", kind="daily", metric="defended", target=1, reward=25, icon="🛡️"),
    Quest(id="confirm1", title="Settle 1 dispute", description="Be the third check on a disputed tile.", kind="daily", metric="dispute_settled", target=1, reward=30, icon="⚖️"),
    Quest(id="treasure1", title="Find a treasure", description="Report a pipe, trash, wildlife, plant or algae.", kind="daily", metric="treasure", target=1, reward=30, icon="💎"),
    Quest(id="storm2", title="Storm Quest: 2 checks", description="Check 2 tiles while the Storm Quest is on. Data after rain is gold for scientists.", kind="storm", metric="storm", target=2, reward=60, icon="⛈️"),
    Quest(id="team40", title="Team challenge: 40 checks", description="Your whole team does 40 checks this week.", kind="weekly_team", metric="team_checks", target=40, reward=50, icon="🏰"),
]


def seed_quests(session: Session) -> None:
    for q in QUESTS:
        if not session.get(Quest, q.id):
            session.add(Quest(**q.model_dump()))
    session.commit()


def _period(kind: str, now: datetime) -> str:
    if kind == "weekly_team":
        y, w, _ = now.isocalendar()
        return f"{y}-W{w:02d}"
    return now.strftime("%Y-%m-%d")


def _period_start(kind: str, now: datetime) -> datetime:
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return day - timedelta(days=now.weekday()) if kind == "weekly_team" else day


def _counted(session: Session, since: datetime, until: datetime, *where) -> list[Observation]:
    return session.exec(
        select(Observation).where(
            Observation.status != "draft", Observation.status != "rejected", Observation.created_at >= since, Observation.created_at <= until, *where
        )
    ).all()


def quest_progress(session: Session, player: Player, quest: Quest, now: datetime) -> int:
    since = _period_start(quest.kind, now)
    if quest.metric == "team_checks":
        return len(_counted(session, since, now, Observation.team == player.team, Observation.outcome != "farming"))
    mine = _counted(session, since, now, Observation.player_id == player.id)
    if quest.metric == "explore":
        return sum(1 for o in mine if o.action == "explore")
    if quest.metric == "checks":
        return sum(1 for o in mine if o.outcome != "farming")
    if quest.metric in ("defended", "dispute_settled"):
        return sum(1 for o in mine if o.outcome == quest.metric)
    if quest.metric == "storm":
        return sum(1 for o in mine if o.storm)
    if quest.metric == "treasure":
        ids = [o.id for o in mine]
        return len(session.exec(select(Treasure.id).where(Treasure.observation_id.in_(ids))).all()) if ids else 0
    return 0


@router.get("/quests")
def quests(player_id: str, time_warp_days: float = 0, session: Session = Depends(get_session)):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Player not found")
    now = game_now(time_warp_days)
    tile = session.exec(select(Tile)).first()
    storm_on = weather.storm_status(tile.city)["active"] if tile else False
    out = []
    for q in session.exec(select(Quest)).all():
        if q.kind == "storm" and not storm_on:
            continue
        period = _period(q.kind, now)
        claimed = session.exec(
            select(QuestProgress).where(QuestProgress.quest_id == q.id, QuestProgress.player_id == player.id, QuestProgress.period == period)
        ).first()
        progress = quest_progress(session, player, q, now)
        out.append({
            **q.model_dump(),
            "period": period,
            "progress": min(progress, q.target),
            "done": progress >= q.target,
            "claimed": claimed is not None,
            "resets_in_hours": round(((_period_start(q.kind, now) + timedelta(days=7 if q.kind == "weekly_team" else 1)) - now).total_seconds() / 3600, 1),
        })
    order = {"storm": 0, "daily": 1, "weekly_team": 2}
    return sorted(out, key=lambda q: (order[q["kind"]], q["claimed"], not q["done"]))


@router.post("/quests/{quest_id}/claim")
def claim_quest(quest_id: str, player_id: str, time_warp_days: float = 0, session: Session = Depends(get_session)):
    player = session.get(Player, player_id)
    quest = session.get(Quest, quest_id)
    if not player or not quest:
        raise HTTPException(404, "Not found")
    now = game_now(time_warp_days)
    period = _period(quest.kind, now)
    if session.exec(select(QuestProgress).where(QuestProgress.quest_id == quest_id, QuestProgress.player_id == player_id, QuestProgress.period == period)).first():
        raise HTTPException(409, "You already got this reward.")
    if quest_progress(session, player, quest, now) < quest.target:
        raise HTTPException(409, "This quest is not finished yet.")
    session.add(QuestProgress(quest_id=quest_id, player_id=player_id, period=period, claimed_at=now, reward=quest.reward))
    player.points += quest.reward
    session.add(player)
    session.commit()
    return {"reward": quest.reward, "player_points": player.points}


@router.get("/leaderboard")
def leaderboard(scope: str = "week", player_id: Optional[str] = None, time_warp_days: float = 0, session: Session = Depends(get_session)):
    if scope not in ("week", "all"):
        raise HTTPException(422, "scope must be week or all")
    now = game_now(time_warp_days)
    players = {p.id: p for p in session.exec(select(Player)).all()}
    if scope == "all":
        scores = {pid: p.points for pid, p in players.items()}
    else:
        since = now - timedelta(days=7)
        scores = defaultdict(int)
        for pid, pts in session.exec(
            select(Observation.player_id, func.sum(Observation.points)).where(Observation.created_at >= since, Observation.created_at <= now).group_by(Observation.player_id)
        ).all():
            scores[pid] += pts or 0
        for pid, pts in session.exec(select(QuestProgress.player_id, func.sum(QuestProgress.reward)).where(QuestProgress.claimed_at >= since).group_by(QuestProgress.player_id)).all():
            scores[pid] += pts or 0
    ranked = sorted(players.values(), key=lambda p: (-scores.get(p.id, 0), p.nickname.lower()))
    rows = [{"rank": i + 1, "id": p.id, "nickname": p.nickname, "avatar": p.avatar, "team": p.team, "is_bot": p.is_bot, "points": scores.get(p.id, 0), "streak": p.streak}
            for i, p in enumerate(ranked)]
    team_points = Counter()
    for r in rows:
        team_points[r["team"]] += r["points"]
    tiles = kingdom_stats(session, now)
    teams = sorted(
        ({"team": t, "points": team_points.get(t, 0), "tiles": tiles[t]["tiles"], "players": sum(1 for p in players.values() if p.team == t)} for t in rules.TEAMS),
        key=lambda t: -t["points"],
    )
    me = next((r for r in rows if r["id"] == player_id), None)
    return {"scope": scope, "players": rows[:25], "me": me, "teams": teams}


def kingdom_stats(session: Session, now: datetime) -> dict:
    rows = session.exec(select(Tile, TileState).join(TileState, TileState.tile_id == Tile.id)).all()
    total = len(rows)
    out = {t: {"tiles": 0, "fresh": 0, "fading": 0, "health_scores": [], "healed": 0} for t in rules.TEAMS}
    for tile, ts in rows:
        st = rules.tile_state(aware(ts.last_check_at), ts.dispute_open, now)
        if st in ("owned_fresh", "owned_fading") and ts.owner_team in out:
            k = out[ts.owner_team]
            k["tiles"] += 1
            k["fresh" if st == "owned_fresh" else "fading"] += 1
            h = effective_health(ts)
            if h is not None:
                k["health_scores"].append(h)
            if ts.health_bonus > 0:
                k["healed"] += 1
    for k in out.values():
        k["share"] = round(k["tiles"] / total, 4) if total else 0
        k["health"] = rules.kingdom_health(k.pop("health_scores"))
    out["_total"] = total  # type: ignore[assignment]
    return out


@router.get("/kingdom")
def kingdom(player_id: str, time_warp_days: float = 0, session: Session = Depends(get_session)):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Player not found")
    now = game_now(time_warp_days)
    stats = kingdom_stats(session, now)
    total = stats.pop("_total")
    # Tiles of my team that fade or get lost soon.
    soon = []
    rows = session.exec(select(Tile, TileState).join(TileState, TileState.tile_id == Tile.id).where(TileState.owner_team == player.team)).all()
    mine_now = 0
    for tile, ts in rows:
        last = aware(ts.last_check_at)
        st = rules.tile_state(last, ts.dispute_open, now)
        if st not in ("owned_fresh", "owned_fading"):
            continue
        age = (now - last).total_seconds() / 86400
        if ts.last_observation_id:
            o = session.get(Observation, ts.last_observation_id)
            if o and o.player_id == player.id:
                mine_now += 1
        left = (rules.FADING_DAYS - age) if st == "owned_fading" else (rules.FRESH_DAYS - age)
        if st == "owned_fading" or left < 2:
            soon.append({"id": tile.id, "stream_name": tile.stream_name, "state": st, "days_left": round(left, 2), "center": [tile.center_lon, tile.center_lat], "health": effective_health(ts)})
    soon.sort(key=lambda s: (s["state"] != "owned_fading", s["days_left"]))
    my_checks = len(_counted(session, now - timedelta(days=7), now, Observation.player_id == player.id))
    fixed = session.exec(select(func.count(Treasure.id)).where(Treasure.status == "fixed")).one()
    return {
        "team": player.team,
        "total_tiles": total,
        "teams": stats,
        "my": {"tiles_held": mine_now, "checks_week": my_checks, "points": player.points},
        "fading_soon": soon[:12],
        "fixed_treasures": fixed,
    }


BADGES = [
    ("explorer", "Explorer", "🧭", "Explore 5 fog tiles", 5),
    ("defender", "Defender", "🛡️", "Defend 3 fading tiles", 3),
    ("detective", "Detective", "🔍", "Confirm 3 checks or settle disputes", 3),
    ("storm", "Storm Chaser", "⛈️", "Do 1 check in a Storm Quest", 1),
    ("treasure", "Treasure Hunter", "💎", "Find 2 treasures", 2),
]


@router.get("/players/{player_id}/stats")
def player_stats(player_id: str, session: Session = Depends(get_session)):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Player not found")
    obs = session.exec(select(Observation).where(Observation.player_id == player_id, Observation.status != "draft", Observation.status != "rejected")).all()
    ids = [o.id for o in obs]
    confirmations = session.exec(select(func.count(Observation.id)).where(Observation.confirmed_by_observation_id.in_(ids))).one() if ids else 0
    treasures = session.exec(select(func.count(Treasure.id)).where(Treasure.observation_id.in_(ids))).one() if ids else 0
    counts = {
        "explorer": sum(1 for o in obs if o.action == "explore"),
        "defender": sum(1 for o in obs if o.outcome == "defended"),
        "detective": confirmations + sum(1 for o in obs if o.outcome == "dispute_settled"),
        "storm": sum(1 for o in obs if o.storm),
        "treasure": treasures,
    }
    return {
        "checks": len(obs),
        "confirmed_mine": sum(1 for o in obs if o.status == "confirmed"),
        "confirmations_given": confirmations,
        "treasures": treasures,
        "streams": len(set(session.exec(select(Tile.stream_name).where(Tile.id.in_({o.tile_id for o in obs}))).all())) if obs else 0,
        "badges": [{"id": b, "name": n, "icon": i, "how": h, "target": t, "progress": min(counts[b], t), "earned": counts[b] >= t} for b, n, i, h, t in BADGES],
    }
