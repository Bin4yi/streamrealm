"""Dev tools for demos: storm switch, bot activity, reset."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ..db import get_session
from ..services import weather

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/storm")
def force_storm(on: str = "auto"):
    value = {"true": True, "false": False, "auto": None}.get(on.lower())
    if on.lower() not in ("true", "false", "auto"):
        raise HTTPException(422, "on must be true, false or auto")
    weather.set_forced(value)
    return {"forced": value}


@router.post("/reset")
def reset(session: Session = Depends(get_session)):
    from ..services.bots import reset_world

    return reset_world(session)


@router.post("/bots/tick")
def bots_tick(time_warp_days: float = 0, session: Session = Depends(get_session)):
    from ..services.bots import tick

    return tick(session, time_warp_days)
