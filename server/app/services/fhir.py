"""FHIR R4 export (Bundle of type "collection").

Alignment with the HL7 Europe OneAquaHealth IG (source read from github.com/hl7-eu/oah, input/fsh,
because the CI build page build.fhir.org/ig/hl7-eu/oah returned 404 during the hackathon):

- Location uses profile LocationOah (identifier 1.., name 1.., mode = instance, position lon/lat).
- Observations that are CONFIRMED by an independent check use profile ObservationIndicatorsOah, which
  fixes status = final and needs code, subject (LocationOah), effective[x] and performer.
- Unconfirmed checks are status = preliminary. The OAH profile fixes status to final, so those are
  plain R4 Observations without a profile claim.
- Components use the OAH temporary code system where a concept exists ("foam" = Foam/colour/smell,
  "hydrology" = Hydrology of the stream) and our own local codes for everything else.
Gaps are explained in docs/architecture.md.
"""
from __future__ import annotations

import base64
import html
import hashlib
import json
from typing import Optional

from sqlmodel import Session, select

from ..models import Observation, Tile, iso, utcnow

OAH_CANONICAL = "http://hl7.eu/fhir/ig/oah"
PROFILE_LOCATION = f"{OAH_CANONICAL}/StructureDefinition/location-oah"
PROFILE_OBSERVATION = f"{OAH_CANONICAL}/StructureDefinition/observation-indicators-oah"
OAH_CODES = f"{OAH_CANONICAL}/CodeSystem/temporarySystem-oah-eu"  # SUSHI default URL for CodeSystem id temporarySystem-oah-eu
GEOJSON_EXT = "http://hl7.org/fhir/StructureDefinition/location-boundary-geojson"  # FHIR R4 core extension
# Our own (non-official) identifiers, clearly namespaced.
SR_TILE = "urn:streamrealm:tile"
SR_CODE = "urn:streamrealm:code"
SR_ANSWER = "urn:streamrealm:answer"
SR_PLAYER = "urn:streamrealm:player"
TEST_DATA = {"system": "http://terminology.hl7.org/CodeSystem/v3-ActReason", "code": "HTEST", "display": "test health data"}

QUESTION_CODES = {
    "color": ("water-color", "Water colour (simplified citizen check)", "foam", "Foam/colour/smell"),
    "smell": ("water-smell", "Smell (simplified citizen check)", "foam", "Foam/colour/smell"),
    "foam": ("foam-film", "Foam or oily film (simplified citizen check)", "foam", "Foam/colour/smell"),
    "trash": ("trash", "Trash in or near the water (simplified citizen check)", None, None),
    "flow": ("water-flow", "Water flow (simplified citizen check)", "hydrology", "Hydrology of the stream"),
    "overall": ("overall-feeling", "Overall feeling: good / moderate / poor", None, None),
}


def _narrative(text: str) -> dict:
    return {"status": "generated", "div": f'<div xmlns="http://www.w3.org/1999/xhtml"><p>{html.escape(text)}</p></div>'}


def _cc(code: str, display: str, oah: Optional[str] = None, oah_display: Optional[str] = None) -> dict:
    coding = [{"system": SR_CODE, "code": code, "display": display}]
    if oah:
        coding.append({"system": OAH_CODES, "code": oah, "display": oah_display})
    return {"coding": coding, "text": display}


def location(tile: Tile) -> dict:
    gj = {"type": "LineString", "coordinates": tile.coords}
    return {
        "resourceType": "Location",
        "id": tile.id,
        "meta": {"profile": [PROFILE_LOCATION]},
        "text": _narrative(f"Stream section {tile.id} of {tile.stream_name}, about {round(tile.length_m)} m."),
        "extension": [{
            "url": GEOJSON_EXT,
            "valueAttachment": {"contentType": "application/geo+json", "data": base64.b64encode(json.dumps(gj).encode()).decode()},
        }],
        "identifier": [{"system": SR_TILE, "value": tile.id}],
        "status": "active",
        "name": f"{tile.stream_name} - stream section {tile.id.rsplit('-', 1)[-1]}",
        "description": f"About {round(tile.length_m)} m of {tile.stream_name} ({tile.waterway}), stream line from OpenStreetMap (ODbL).",
        "mode": "instance",
        "position": {"longitude": round(tile.center_lon, 6), "latitude": round(tile.center_lat, 6)},
    }


def observation(o: Observation, confirmed_by: Optional[str]) -> dict:
    final = o.status == "confirmed"
    answers = o.answers()
    components = []
    for q, (code, display, oah, oah_display) in QUESTION_CODES.items():
        v = answers.get(q)
        if v:
            components.append({"code": _cc(code, display, oah, oah_display), "valueCodeableConcept": {"coding": [{"system": SR_ANSWER, "code": v}], "text": v.replace("_", " ")}})
    components.append({
        "code": _cc("game-health-score", "StreamRealm game health score (0-100, game indicator, not a measurement)"),
        "valueQuantity": {"value": o.health_score, "unit": "score", "system": "http://unitsofmeasure.org", "code": "1"},
    })
    pseudo = hashlib.sha256(o.player_id.encode()).hexdigest()[:12]
    notes = [{"text": "Simplified citizen visual check from the StreamRealm game. Questions are based on the OneAquaHealth citizen assessment categories, simplified."}]
    if confirmed_by:
        notes.append({"text": f"Confirmed by an independent check from another player: Observation/{confirmed_by}."})
    elif final:
        notes.append({"text": "Confirmed by a scientist who reviewed a dispute in the StreamRealm dashboard."})
    ai = json.loads(o.ai_result_json or "{}")
    if ai.get("mode") in ("ai", "heuristic"):
        notes.append({"text": f"Photo check ({ai['mode']}): {ai.get('verdict')}. {' '.join(ai.get('reasons', [])[:3])}".strip()})
    res = {
        "resourceType": "Observation",
        "id": o.id,
        "text": _narrative(
            f"Citizen stream check ({'confirmed' if final else 'preliminary'}) at {o.tile_id}: "
            + ", ".join(f"{q} {v.replace('_', ' ')}" for q, v in answers.items())
            + f". Game health score {o.health_score}."
        ),
        "status": "final" if final else "preliminary",
        "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "survey", "display": "Survey"}]}],
        "code": _cc("stream-check", "Citizen stream check (simplified visual assessment)"),
        "subject": {"reference": f"Location/{o.tile_id}"},
        "effectiveDateTime": iso(o.created_at),
        "performer": [{"identifier": {"system": SR_PLAYER, "value": pseudo}, "display": "Citizen scientist (pseudonymous)"}],
        "component": components,
        "note": notes,
    }
    if final:
        res["meta"] = {"profile": [PROFILE_OBSERVATION]}
    if o.is_demo:
        res.setdefault("meta", {})["security"] = [TEST_DATA]
        res["meta"]["tag"] = [{"system": SR_CODE, "code": "synthetic-demo-data", "display": "Synthetic demo data (bot or demo photo)"}]
    return res


def bundle(session: Session, base_url: str, include_demo: bool = True) -> dict:
    obs_q = select(Observation).where(Observation.status.in_(["pending", "confirmed", "disputed"]))
    if not include_demo:
        obs_q = obs_q.where(Observation.is_demo == False)  # noqa: E712
    observations = session.exec(obs_q.order_by(Observation.created_at)).all()
    confirmed_by = {o.id: o.confirmed_by_observation_id for o in observations if o.confirmed_by_observation_id}
    tiles = session.exec(select(Tile).order_by(Tile.id)).all()
    entries = [{"fullUrl": f"{base_url}/Location/{t.id}", "resource": location(t)} for t in tiles]
    entries += [{"fullUrl": f"{base_url}/Observation/{o.id}", "resource": observation(o, confirmed_by.get(o.id))} for o in observations]
    return {
        "resourceType": "Bundle",
        "id": f"streamrealm-export-{utcnow().strftime('%Y%m%d%H%M%S')}",
        "meta": {"lastUpdated": iso(utcnow())},
        "type": "collection",
        "timestamp": iso(utcnow()),
        "entry": entries,
    }

