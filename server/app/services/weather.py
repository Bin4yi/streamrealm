"""Storm Quest trigger from the Open-Meteo forecast (free, no key)."""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

import httpx

from ..db import load_cities
from ..models import iso, utcnow
from . import rules

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
CACHE_S = 30 * 60
_cache: dict[str, tuple[float, dict]] = {}
_forced: Optional[bool] = None  # set by the Dev Panel; None = follow the weather


def set_forced(value: Optional[bool]) -> None:
    global _forced
    _forced = value


def get_forced() -> Optional[bool]:
    return _forced


def rain_next_48h(lat: float, lon: float) -> float:
    resp = httpx.get(
        OPEN_METEO,
        params={"latitude": lat, "longitude": lon, "hourly": "precipitation", "forecast_days": 3, "timezone": "UTC"},
        timeout=8,
    )
    resp.raise_for_status()
    hourly = resp.json()["hourly"]
    now_hour = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
    times = hourly["time"]
    start = times.index(now_hour) if now_hour in times else 0
    values = [v or 0.0 for v in hourly["precipitation"][start:start + 48]]
    return round(sum(values), 1)


def storm_status(city: str) -> dict:
    cfg = load_cities().get(city)
    if not cfg:
        raise KeyError(city)
    cached = _cache.get(city)
    if cached and time.time() - cached[0] < CACHE_S:
        weather = cached[1]
    else:
        lon, lat = cfg["center"]
        try:
            mm = rain_next_48h(lat, lon)
            weather = {"rain_mm_48h": mm, "source": "open-meteo", "checked_at": iso(utcnow())}
        except Exception as err:  # offline or API change: no storm, say why
            weather = {"rain_mm_48h": None, "source": f"unavailable ({type(err).__name__})", "checked_at": iso(utcnow())}
        _cache[city] = (time.time(), weather)
    by_weather = weather["rain_mm_48h"] is not None and weather["rain_mm_48h"] >= rules.STORM_RAIN_MM_48H
    active = _forced if _forced is not None else by_weather
    return {
        "active": bool(active),
        "forced": _forced,
        "threshold_mm": rules.STORM_RAIN_MM_48H,
        "message": "After heavy rain, sewers can overflow. Your checks matter most now!" if active else "No storm right now.",
        **weather,
    }
