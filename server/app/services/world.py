"""Read-side helpers: game clock and tile state as GeoJSON."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from sqlmodel import Session, select

from ..models import Tile, TileState, Treasure, aware, iso, utcnow
from . import rules


def game_now(time_warp_days: float = 0.0) -> datetime:
    """The game clock. The Dev Panel's Time Warp moves it forward."""
    return utcnow() + timedelta(days=max(0.0, min(60.0, time_warp_days)))


def effective_health(ts: TileState) -> Optional[int]:
    if ts.health_score is None:
        return None
    return min(100, ts.health_score + ts.health_bonus)


def describe(tile: Tile, ts: TileState, now: datetime, treasures: int = 0) -> dict:
    last = aware(ts.last_check_at)
    state = rules.tile_state(last, ts.dispute_open, now)
    owner = ts.owner_team if state in ("owned_fresh", "owned_fading", "disputed") else None
    age_days = None
    next_change_days = None
    if last is not None:
        age_days = round((now - last).total_seconds() / 86400, 2)
        if state == "owned_fresh":
            next_change_days = round(rules.FRESH_DAYS - age_days, 2)
        elif state == "owned_fading":
            next_change_days = round(rules.FADING_DAYS - age_days, 2)
    return {
        "id": tile.id,
        "stream_name": tile.stream_name,
        "length_m": tile.length_m,
        "center": [tile.center_lon, tile.center_lat],
        "state": state,
        "owner_team": owner,
        "last_check_at": iso(ts.last_check_at),
        "age_days": age_days,
        "next_change_days": next_change_days,
        "health": effective_health(ts) if state != "fog" else None,
        "healed": ts.health_bonus > 0,
        "unsafe": tile.unsafe,
        "treasures": treasures,
    }


def open_treasure_counts(session: Session) -> Counter:
    rows = session.exec(select(Treasure.tile_id).where(Treasure.status != "fixed")).all()
    return Counter(rows)


def tiles_geojson(session: Session, city: str, now: datetime) -> dict:
    rows = session.exec(
        select(Tile, TileState).join(TileState, TileState.tile_id == Tile.id).where(Tile.city == city)
    ).all()
    counts = open_treasure_counts(session)
    features = []
    for tile, ts in rows:
        features.append({
            "type": "Feature",
            "id": tile.id,
            "properties": describe(tile, ts, now, counts.get(tile.id, 0)),
            "geometry": {"type": "LineString", "coordinates": tile.coords},
        })
    return {"type": "FeatureCollection", "generated_at": iso(now), "features": features}
