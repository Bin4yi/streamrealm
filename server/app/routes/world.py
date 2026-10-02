"""Cities, tiles and players."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session, load_cities
from ..models import Event, Player, Tile, TileState, iso
from ..services import rules
from ..services.world import describe, dispute_parties, game_now, tiles_geojson

router = APIRouter(tags=["world"])

AVATARS = ("heron", "duck", "owl", "fox", "salamander", "dragonfly", "trout", "hedgehog")
LEGACY_AVATARS = ("otter", "frog", "bird", "swan", "butterfly", "fish", "turtle", "beaver")  # emoji-only, before the image pack


@router.get("/cities")
def cities():
    return [{"key": k, **v} for k, v in load_cities().items()]


@router.get("/cities/{city}/tiles")
def city_tiles(city: str, time_warp_days: float = 0, session: Session = Depends(get_session)):
    if city not in load_cities():
        raise HTTPException(404, f"Unknown city '{city}'")
    return tiles_geojson(session, city, game_now(time_warp_days))


@router.get("/tiles/{tile_id}")
def tile_detail(tile_id: str, time_warp_days: float = 0, session: Session = Depends(get_session)):
    from ..models import Observation, Treasure  # local import keeps router imports short

    tile = session.get(Tile, tile_id)
    if not tile:
        raise HTTPException(404, "Tile not found")
    ts = session.get(TileState, tile_id)
    now = game_now(time_warp_days)
    treasures = session.exec(select(Treasure).where(Treasure.tile_id == tile_id).order_by(Treasure.created_at.desc())).all()
    obs = session.exec(
        select(Observation, Player)
        .join(Player, Player.id == Observation.player_id)
        .where(Observation.tile_id == tile_id, Observation.status != "draft")
        .order_by(Observation.created_at.desc())
        .limit(3)
    ).all()
    history = [{
        "id": o.id,
        "nickname": p.nickname,
        "avatar": p.avatar,
        "team": o.team,
        "created_at": iso(o.created_at),
        "health_score": o.health_score,
        "status": o.status,
        "action": o.action,
        "answers": o.answers(),
        "photo_up": o.photo_up,
        "confirmed_by": o.confirmed_by_observation_id,
    } for o, p in obs]
    return {
        **describe(tile, ts, now, sum(1 for t in treasures if t.status != "fixed"), dispute_parties(session).get(tile_id)),
        "geometry": tile.coords,
        "history": history,
        "treasure_list": [{"id": t.id, "type": t.type, "status": t.status, "photo": t.photo} for t in treasures],
    }


class NewPlayer(BaseModel):
    nickname: str = Field(min_length=2, max_length=20)
    avatar: str = "otter"
    team: str


@router.post("/players")
def create_player(body: NewPlayer, session: Session = Depends(get_session)):
    nickname = body.nickname.strip()
    if body.team not in rules.TEAMS:
        raise HTTPException(422, "Pick a team: otters, frogs or kingfishers")
    if body.avatar not in AVATARS + LEGACY_AVATARS:
        raise HTTPException(422, f"Pick an avatar: {', '.join(AVATARS)}")
    if not nickname.replace("_", "").replace("-", "").replace(" ", "").isalnum():
        raise HTTPException(422, "Use letters and numbers only in your nickname")
    player = Player(nickname=nickname, avatar=body.avatar, team=body.team)
    session.add(player)
    session.add(Event(type="join", payload_json=json.dumps({"nickname": nickname, "team": body.team})))
    session.commit()
    session.refresh(player)
    return player


@router.get("/players/{player_id}")
def get_player(player_id: str, session: Session = Depends(get_session)):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(404, "Player not found")
    return player

