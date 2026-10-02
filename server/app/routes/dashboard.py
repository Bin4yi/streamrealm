"""Scientist dashboard: KPIs, dispute queue, treasure queue, cleanups, unsafe flags."""
from __future__ import annotations

import json
import statistics
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, func, select

from ..db import get_session
from ..models import Observation, Player, Tile, TileState, Treasure, aware, iso
from ..services import rules
from ..services.game import log_event
from ..services.world import describe, game_now

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _kingdom(session: Session, now, team: Optional[str]) -> Optional[int]:
    from .social import kingdom_stats

    return kingdom_stats(session, now)[team]["health"] if team in rules.TEAMS else None


@router.get("/kpis")
def kpis(time_warp_days: float = 0, session: Session = Depends(get_session)):
    now = game_now(time_warp_days)
    states = session.exec(select(TileState)).all()
    total = len(states)
    ages = [(now - aware(s.last_check_at)).total_seconds() / 86400 for s in states if s.last_check_at]
    covered = sum(1 for a in ages if a <= rules.FADING_DAYS)
    counted = session.exec(select(Observation).where(Observation.status.in_(["pending", "confirmed", "disputed", "rejected"]))).all()
    confirmed = sum(1 for o in counted if o.status == "confirmed")
    # How often players kept their own answer when the photo check suggested something else.
    shown = kept = 0
    for o in counted:
        ai = json.loads(o.ai_result_json or "{}")
        orig = json.loads(o.original_answers_json or "{}")
        for s in ai.get("suggestions", []):
            if orig.get(s["question"]) != s["value"]:
                shown += 1
                kept += json.loads(o.answers_json).get(s["question"]) != s["value"]
    week = now - timedelta(days=7)
    active = session.exec(select(func.count(func.distinct(Observation.player_id))).where(Observation.created_at >= week, Observation.status != "draft")).one()
    return {
        "tiles_total": total,
        "coverage_pct": round(100 * covered / total, 1) if total else 0,
        "median_data_age_days": round(statistics.median(ages), 1) if ages else None,
        "never_checked": total - len(ages),
        "confirmed_pct": round(100 * confirmed / len(counted), 1) if counted else 0,
        "observations_total": len(counted),
        "open_disputes": sum(1 for s in states if s.dispute_open),
        "open_treasures": session.exec(select(func.count(Treasure.id)).where(Treasure.status != "fixed")).one(),
        "fixed_treasures": session.exec(select(func.count(Treasure.id)).where(Treasure.status == "fixed")).one(),
        "unsafe_tiles": session.exec(select(func.count(Tile.id)).where(Tile.unsafe == True)).one(),  # noqa: E712
        "active_players_week": active,
        "bot_share_pct": round(100 * sum(1 for o in counted if o.is_demo) / len(counted), 1) if counted else 0,
        "suggestion_disagreements": {"shown": shown, "kept_own_answer": kept},
        "generated_at": iso(now),
    }


def _obs_view(session: Session, o: Optional[Observation]) -> Optional[dict]:
    if not o:
        return None
    p = session.get(Player, o.player_id)
    return {
        "id": o.id,
        "nickname": p.nickname if p else "?",
        "team": o.team,
        "is_bot": bool(p and p.is_bot),
        "created_at": iso(o.created_at),
        "answers": o.answers(),
        "health_score": o.health_score,
        "photo_up": o.photo_up,
        "photo_down": o.photo_down,
        "ai": {k: v for k, v in json.loads(o.ai_result_json or "{}").items() if k in ("verdict", "reasons", "mode")},
    }


@router.get("/disputes")
def disputes(time_warp_days: float = 0, session: Session = Depends(get_session)):
    now = game_now(time_warp_days)
    out = []
    for ts in session.exec(select(TileState).where(TileState.dispute_open == True)).all():  # noqa: E712
        tile = session.get(Tile, ts.tile_id)
        a, b = session.get(Observation, ts.dispute_obs_a) if ts.dispute_obs_a else None, session.get(Observation, ts.dispute_obs_b)
        out.append({
            "tile": describe(tile, ts, now),
            "defender": _obs_view(session, a),
            "attacker": _obs_view(session, b),
            "agreement": rules.agreement(a.answers(), b.answers()) if a and b else None,
            "differences": [q for q in rules.QUESTIONS if a and b and a.answers().get(q) != b.answers().get(q)],
        })
    return sorted(out, key=lambda d: d["attacker"]["created_at"] if d["attacker"] else "", reverse=True)


class Resolve(BaseModel):
    winner: Literal["defender", "attacker"]
    note: str = ""


@router.post("/disputes/{tile_id}/resolve")
def resolve(tile_id: str, body: Resolve, time_warp_days: float = 0, session: Session = Depends(get_session)):
    ts = session.get(TileState, tile_id)
    if not ts or not ts.dispute_open:
        raise HTTPException(404, "No open dispute on this tile")
    now = game_now(time_warp_days)
    a = session.get(Observation, ts.dispute_obs_a) if ts.dispute_obs_a else None
    b = session.get(Observation, ts.dispute_obs_b)
    win, lose = (b, a) if body.winner == "attacker" else (a, b)
    if win is None:
        raise HTTPException(409, "That side has no check to confirm")
    win.status = "confirmed"
    if lose:
        lose.status = "rejected"
        session.add(lose)
    if body.winner == "attacker":
        attacker = session.get(Player, b.player_id)
        attacker.points += rules.POINTS["attack"]
        b.points += rules.POINTS["attack"]
        session.add(attacker)
    ts.owner_team = win.team
    ts.dispute_open = False
    ts.dispute_obs_a = ts.dispute_obs_b = None
    ts.last_observation_id = win.id
    ts.health_score = win.health_score
    ts.health_bonus = 0
    session.add_all([win, ts])
    tile = session.get(Tile, tile_id)
    log_event(session, "scientist_resolved", {"tile_id": tile_id, "stream": tile.stream_name, "winner": body.winner, "team": win.team, "note": body.note[:200]}, now)
    session.commit()
    return {"ok": True, "tile": describe(tile, ts, now)}


@router.get("/treasures")
def treasures(status: Optional[str] = None, session: Session = Depends(get_session)):
    q = select(Treasure, Tile).join(Tile, Tile.id == Treasure.tile_id).order_by(Treasure.created_at.desc())
    if status:
        q = q.where(Treasure.status == status)
    out = []
    for t, tile in session.exec(q).all():
        o = session.get(Observation, t.observation_id)
        p = session.get(Player, o.player_id) if o else None
        out.append({
            "id": t.id, "type": t.type, "status": t.status, "note": t.note, "photo": t.photo, "created_at": iso(t.created_at),
            "tile_id": tile.id, "stream_name": tile.stream_name, "center": [tile.center_lon, tile.center_lat], "unsafe": tile.unsafe,
            "reporter": p.nickname if p else "?", "reporter_is_bot": bool(p and p.is_bot), "team": o.team if o else None,
        })
    return out


class TreasureUpdate(BaseModel):
    status: Optional[Literal["open", "reviewed", "needs_action", "fixed"]] = None
    note: Optional[str] = None
    mark_unsafe: Optional[bool] = None


@router.patch("/treasures/{treasure_id}")
def update_treasure(treasure_id: str, body: TreasureUpdate, time_warp_days: float = 0, session: Session = Depends(get_session)):
    t = session.get(Treasure, treasure_id)
    if not t:
        raise HTTPException(404, "Treasure not found")
    now = game_now(time_warp_days)
    tile = session.get(Tile, t.tile_id)
    ts = session.get(TileState, t.tile_id)
    before = _kingdom(session, now, ts.owner_team)
    if body.status and body.status != t.status:
        if body.status == "fixed" and t.status != "fixed":
            ts.health_bonus = min(100, ts.health_bonus + rules.FIX_HEALTH_BONUS)
            session.add(ts)
        t.status = body.status
        log_event(session, "treasure_" + body.status, {"tile_id": tile.id, "stream": tile.stream_name, "treasure": t.type, "team": ts.owner_team}, now)
    if body.note is not None:
        t.note = body.note[:500]
    if body.mark_unsafe is not None:
        tile.unsafe = body.mark_unsafe
        session.add(tile)
        log_event(session, "tile_unsafe" if body.mark_unsafe else "tile_safe", {"tile_id": tile.id, "stream": tile.stream_name}, now)
    session.add(t)
    session.commit()
    return {"ok": True, "treasure_id": t.id, "status": t.status, "tile": describe(tile, ts, now), "kingdom": {"team": ts.owner_team, "before": before, "after": _kingdom(session, now, ts.owner_team)}}


class Cleanup(BaseModel):
    note: str = ""


@router.post("/tiles/{tile_id}/cleanup")
def cleanup(tile_id: str, body: Cleanup, time_warp_days: float = 0, session: Session = Depends(get_session)):
    tile = session.get(Tile, tile_id)
    ts = session.get(TileState, tile_id)
    if not tile:
        raise HTTPException(404, "Tile not found")
    now = game_now(time_warp_days)
    before = _kingdom(session, now, ts.owner_team)
    ts.health_bonus = min(100, ts.health_bonus + rules.CLEANUP_HEALTH_BONUS)
    session.add(ts)
    log_event(session, "cleanup", {"tile_id": tile_id, "stream": tile.stream_name, "note": body.note[:200], "team": ts.owner_team}, now)
    session.commit()
    return {"ok": True, "tile": describe(tile, ts, now), "kingdom": {"team": ts.owner_team, "before": before, "after": _kingdom(session, now, ts.owner_team)}}


@router.post("/tiles/{tile_id}/unsafe")
def set_unsafe(tile_id: str, value: bool = True, session: Session = Depends(get_session)):
    tile = session.get(Tile, tile_id)
    if not tile:
        raise HTTPException(404, "Tile not found")
    tile.unsafe = value
    session.add(tile)
    session.commit()
    return {"ok": True, "unsafe": tile.unsafe}
