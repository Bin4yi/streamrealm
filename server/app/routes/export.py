"""Open data exports (CSV, GeoJSON, FHIR R4) and the coverage experiment results."""
from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from sqlmodel import Session, select

from .. import config
from ..db import get_session
from ..models import Observation, Player, Tile, TileState, iso
from ..services import fhir, rules
from ..services.world import describe, game_now

router = APIRouter(tags=["export"])

CSV_COLUMNS = [
    "observation_id", "tile_id", "stream_name", "lat", "lon", "created_at", "team", "player_pseudonym", "is_demo",
    "status", "action", "outcome", *rules.QUESTIONS.keys(), "health_score", "photo_check_mode", "photo_check_verdict",
    "suggestions", "suggestion_choices", "confirmed_by", "photo_up", "photo_down",
]


def _download(content: str, media: str, name: str) -> Response:
    return Response(content, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/export/csv")
def export_csv(session: Session = Depends(get_session)):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    w.writeheader()
    tiles = {t.id: t for t in session.exec(select(Tile)).all()}
    players = {p.id: p for p in session.exec(select(Player)).all()}
    for o in session.exec(select(Observation).where(Observation.status != "draft").order_by(Observation.created_at)).all():
        t = tiles[o.tile_id]
        ai = json.loads(o.ai_result_json or "{}")
        a = o.answers()
        w.writerow({
            "observation_id": o.id, "tile_id": o.tile_id, "stream_name": t.stream_name, "lat": t.center_lat, "lon": t.center_lon,
            "created_at": iso(o.created_at), "team": o.team, "player_pseudonym": players[o.player_id].nickname if o.player_id in players else "",
            "is_demo": o.is_demo, "status": o.status, "action": o.action, "outcome": o.outcome, **{q: a.get(q, "") for q in rules.QUESTIONS},
            "health_score": o.health_score, "photo_check_mode": ai.get("mode", ""), "photo_check_verdict": ai.get("verdict", ""),
            "suggestions": json.dumps([{k: s[k] for k in ("question", "value", "confidence")} for s in ai.get("suggestions", [])]),
            "suggestion_choices": o.ai_choices_json, "confirmed_by": o.confirmed_by_observation_id or "",
            "photo_up": o.photo_up or "", "photo_down": o.photo_down or "",
        })
    return _download(buf.getvalue(), "text/csv; charset=utf-8", "streamrealm-observations.csv")


@router.get("/export/geojson")
def export_geojson(time_warp_days: float = 0, session: Session = Depends(get_session)):
    now = game_now(time_warp_days)
    feats = []
    for tile, ts in session.exec(select(Tile, TileState).join(TileState, TileState.tile_id == Tile.id)).all():
        last = session.get(Observation, ts.last_observation_id) if ts.last_observation_id else None
        props = describe(tile, ts, now)
        props.pop("dispute_parties", None)
        props["latest_answers"] = last.answers() if last else None
        props["latest_status"] = last.status if last else None
        feats.append({"type": "Feature", "id": tile.id, "properties": props, "geometry": {"type": "LineString", "coordinates": tile.coords}})
    gj = {"type": "FeatureCollection", "attribution": "Stream lines (c) OpenStreetMap contributors, ODbL. Checks: StreamRealm players (demo data included).", "features": feats}
    return _download(json.dumps(gj), "application/geo+json", "streamrealm-tiles.geojson")


@router.get("/export/fhir")
def export_fhir(request: Request, include_demo: bool = True, session: Session = Depends(get_session)):
    base = str(request.base_url).rstrip("/") + "/fhir"
    return _download(json.dumps(fhir.bundle(session, base, include_demo), indent=1), "application/fhir+json", "streamrealm-fhir-bundle.json")


@router.get("/experiment/coverage")
def experiment():
    path = config.EXPERIMENT_DIR / "coverage.json"
    if not path.exists():
        raise HTTPException(404, "Run scripts/simulate_coverage.py first")
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/experiment/coverage.png")
def experiment_png():
    path = config.EXPERIMENT_DIR / "coverage.png"
    if not path.exists():
        raise HTTPException(404, "Run scripts/simulate_coverage.py first")
    return FileResponse(path, media_type="image/png")
