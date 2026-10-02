"""Stream checks, storm status and the activity feed."""
from __future__ import annotations

import json
import random
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import Event, Observation, Player, Tile, iso
from ..services import photos, weather
from ..services.ai_check import CheckPhoto
from ..services.game import GameError, create_draft, finalize, public_ai
from ..services.world import game_now

router = APIRouter(tags=["play"])


async def _read_photo(upload: Optional[UploadFile]) -> Optional[CheckPhoto]:
    if upload is None:
        return None
    data = await upload.read()
    try:
        rel, img, exif_time = photos.save_upload(data)
    except photos.PhotoError as err:
        raise HTTPException(422, str(err)) from err
    return CheckPhoto(rel, img, exif_time)


@router.post("/observations")
async def create_observation(
    player_id: str = Form(...),
    tile_id: str = Form(...),
    lat: float = Form(...),
    lon: float = Form(...),
    answers: str = Form(..., description="JSON object with the 6 answers"),
    time_warp_days: float = Form(0),
    demo_photos: bool = Form(False),
    treasure_type: Optional[str] = Form(None),
    photo_up: Optional[UploadFile] = File(None),
    photo_down: Optional[UploadFile] = File(None),
    treasure_photo: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
):
    """Step 1 of a check: distance check + photo check. Nothing counts yet."""
    player = session.get(Player, player_id)
    tile = session.get(Tile, tile_id)
    if not player:
        raise HTTPException(404, "Player not found. Please restart the app.")
    if not tile:
        raise HTTPException(404, "Tile not found")
    try:
        parsed = json.loads(answers)
        assert isinstance(parsed, dict)
    except Exception as err:
        raise HTTPException(422, "answers must be a JSON object") from err

    shots: list[CheckPhoto] = []
    if demo_photos:
        for rel in photos.pick_demo_photos(random.Random(), 2):
            shots.append(CheckPhoto(rel, photos.open_relative(rel), None, is_demo=True))
    else:
        for up in (photo_up, photo_down):
            shot = await _read_photo(up)
            if shot is None:
                raise HTTPException(422, "Please add an upstream and a downstream photo.")
            shots.append(shot)
    treasure_rel = None
    if treasure_type:
        t = await _read_photo(treasure_photo)
        treasure_rel = t.rel_path if t else (shots[0].rel_path if demo_photos else None)

    try:
        obs = create_draft(
            session,
            player=player,
            tile=tile,
            lat=lat,
            lon=lon,
            answers=parsed,
            shots=shots,
            treasure_type=treasure_type or None,
            treasure_photo=treasure_rel,
            now=game_now(time_warp_days),
        )
    except GameError as err:
        raise HTTPException(err.status, err.message) from err
    return {
        "observation_id": obs.id,
        "ai_result": public_ai(obs),
        "health_score": obs.health_score,
        "distance_m": obs.distance_m,
        "photo_up": obs.photo_up,
        "photo_down": obs.photo_down,
    }


class ConfirmBody(BaseModel):
    answers: dict
    choices: dict = {}
    time_warp_days: float = 0


@router.post("/observations/{obs_id}/confirm-ai")
def confirm_observation(obs_id: str, body: ConfirmBody, session: Session = Depends(get_session)):
    """Step 2: the player keeps or accepts AI suggestions; then the game rules run."""
    obs = session.get(Observation, obs_id)
    if not obs:
        raise HTTPException(404, "Check not found")
    tile = session.get(Tile, obs.tile_id)
    try:
        storm = weather.storm_status(tile.city)["active"]
        return finalize(session, obs, answers=body.answers, ai_choices=body.choices, now=game_now(body.time_warp_days), storm=storm)
    except GameError as err:
        raise HTTPException(err.status, err.message) from err


@router.get("/storm")
def storm(city: str = "coimbra"):
    try:
        return weather.storm_status(city)
    except KeyError as err:
        raise HTTPException(404, f"Unknown city '{city}'") from err


@router.get("/events")
def events(limit: int = 20, session: Session = Depends(get_session)):
    rows = session.exec(select(Event).order_by(Event.created_at.desc(), Event.id.desc()).limit(min(limit, 100))).all()
    return [{"id": e.id, "type": e.type, "created_at": iso(e.created_at), **json.loads(e.payload_json)} for e in rows]
