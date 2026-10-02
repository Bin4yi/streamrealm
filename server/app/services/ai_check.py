"""Photo check: always-on heuristics, plus OpenAI vision when OPENAI_API_KEY is set.

Rules: "fail" only for "not a stream photo" or an exact duplicate photo. Everything else
is at most "warn". Suggestions never change the player's answers; the player decides.
"""
from __future__ import annotations

import base64
import io
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from PIL import Image
from sqlmodel import Session, select

from .. import config
from ..models import Photo, utcnow
from . import photos, rules

log = logging.getLogger("streamrealm.ai")

BLUR_WARN = 60.0
DARK_WARN = 40.0
BRIGHT_WARN = 225.0
DUP_FAIL = 2      # pHash distance: same photo (maybe re-saved)
DUP_WARN = 8      # very similar photo
EXIF_MAX_AGE = timedelta(hours=24)


@dataclass
class CheckPhoto:
    rel_path: str
    image: Image.Image
    exif_time: Optional[datetime]
    is_demo: bool = False


def _dup_of(session: Session, h: str) -> tuple[Optional[str], int]:
    best_id, best = None, 99
    for pid, other in session.exec(select(Photo.id, Photo.phash).where(Photo.is_demo == False, Photo.phash != None)).all():  # noqa: E711,E712
        d = photos.hash_distance(h, other)
        if d < best:
            best_id, best = pid, d
    return best_id, best


def heuristic(session: Session, shots: list[CheckPhoto], answers: dict[str, str], now: Optional[datetime] = None) -> dict:
    now = now or utcnow()
    reasons: list[str] = []
    verdict = "pass"
    checks: dict = {"is_stream_photo": None, "blur_score": None, "duplicate_of": None, "exif_time_ok": None, "brightness": None}
    hashes = []
    blur_scores, exif_ok = [], []
    for label, shot in zip(("upstream", "downstream"), shots):
        img = shot.image
        b = photos.blur_score(img)
        blur_scores.append(b)
        if b < BLUR_WARN:
            reasons.append(f"The {label} photo is a bit blurry. Hold the phone still.")
        light = photos.brightness(img)
        checks["brightness"] = round(light, 1)
        if light < DARK_WARN:
            reasons.append(f"The {label} photo is very dark.")
        elif light > BRIGHT_WARN:
            reasons.append(f"The {label} photo is very bright.")
        h = photos.phash(img)
        hashes.append(h)
        if shot.is_demo:
            continue
        dup_id, dist = _dup_of(session, h)
        if dup_id and dist <= DUP_FAIL:
            verdict = "fail"
            checks["duplicate_of"] = dup_id
            reasons.append(f"The {label} photo was already used in another check. Please take a new photo.")
        elif dup_id and dist <= DUP_WARN:
            reasons.append(f"The {label} photo looks very similar to an older photo.")
        if shot.exif_time is not None:
            ok = now - shot.exif_time <= EXIF_MAX_AGE
            exif_ok.append(ok)
            if not ok:
                reasons.append(f"The {label} photo was taken more than 24 hours ago.")
    if any(s.is_demo for s in shots):
        reasons.append("Demo photo used (test mode). Real checks need real photos.")
    if len(hashes) == 2 and photos.hash_distance(hashes[0], hashes[1]) <= DUP_FAIL and not all(s.is_demo for s in shots):
        reasons.append("The upstream and downstream photos look the same.")
    checks["blur_score"] = round(min(blur_scores), 1) if blur_scores else None
    checks["exif_time_ok"] = all(exif_ok) if exif_ok else None  # None = no EXIF (normal for web uploads)
    if verdict != "fail" and reasons:
        verdict = "warn"

    # Simple colour rule (not AI): average colour of the lower part of the upstream photo.
    suggestions = []
    if shots:
        guess = photos.hue_name(photos.lower_half_color(shots[0].image))
        if guess:
            suggestions.append({
                "question": "color",
                "value": guess,
                "confidence": 0.35,
                "why": "Simple colour rule: average colour of the water area in your photo. Not AI, so check it yourself.",
            })
    return {"verdict": verdict, "reasons": reasons, "suggestions": suggestions, "notable": [], "checks": checks, "mode": "heuristic"}


# ---------- OpenAI vision ----------

PROMPT = """You help a citizen-science game about city streams. A player took two photos of the same
stream spot (upstream and downstream) and answered 5 simple questions plus an overall feeling.

Player answers (JSON): {answers}

Allowed values:
- color: clear, slightly_cloudy, brown, green, other
- smell: none, earthy, bad, chemical   (you cannot smell a photo: never suggest smell)
- foam: none, a_little, a_lot   (foam or oily film on the water)
- trash: none, a_few, a_lot
- flow: flowing, slow, still, dry
- overall: good, moderate, poor

Tasks:
1. is_stream_photo: true only if at least one photo clearly shows an outdoor stream, river, canal or ditch.
2. suggestions: for color, foam, trash, flow (and overall if clear), give your best value, a confidence 0-1,
   and a short reason in very simple English (max 12 words). Only include questions you can judge from the photos.
3. notable: things scientists may care about that you can see: possible pipe or outlet, trash hotspot,
   algae bloom, unusual plant, animal. Short simple English. Empty list if none.
4. reasons: short simple-English notes about photo quality problems (blur, too dark, water not visible). Empty if fine.
Be honest. If unsure, use a low confidence."""

SCHEMA = {
    "type": "object",
    "properties": {
        "is_stream_photo": {"type": "boolean"},
        "suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "enum": ["color", "foam", "trash", "flow", "overall"]},
                    "value": {"type": "string"},
                    "confidence": {"type": "number"},
                    "why": {"type": "string"},
                },
                "required": ["question", "value", "confidence", "why"],
                "additionalProperties": False,
            },
        },
        "notable": {"type": "array", "items": {"type": "string"}},
        "reasons": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["is_stream_photo", "suggestions", "notable", "reasons"],
    "additionalProperties": False,
}


def _b64(img: Image.Image) -> str:
    small = img.copy()
    small.thumbnail((1024, 1024))
    buf = io.BytesIO()
    small.save(buf, "JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()


def openai_vision(shots: list[CheckPhoto], answers: dict[str, str]) -> dict:
    """OpenAI Responses API: both photos + answers in, strict JSON schema out."""
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY, timeout=config.AI_TIMEOUT_S, max_retries=0)
    content: list[dict] = []
    for label, shot in zip(("Upstream photo:", "Downstream photo:"), shots):
        content.append({"type": "input_text", "text": label})
        content.append({"type": "input_image", "image_url": f"data:image/jpeg;base64,{_b64(shot.image)}"})
    content.append({"type": "input_text", "text": PROMPT.format(answers=json.dumps(answers))})
    resp = client.responses.create(
        model=config.OPENAI_MODEL,
        input=[{"role": "user", "content": content}],
        reasoning={"effort": "low"},
        text={"format": {"type": "json_schema", "name": "stream_photo_check", "schema": SCHEMA, "strict": True}},
    )
    data = json.loads(resp.output_text)
    # Strict post-validation: drop anything outside the allowed values.
    clean = []
    for s in data.get("suggestions", []):
        q, v = s.get("question"), s.get("value")
        if q in rules.QUESTIONS and q != "smell" and v in rules.QUESTIONS[q]:
            clean.append({"question": q, "value": v, "confidence": max(0.0, min(1.0, float(s["confidence"]))), "why": str(s["why"])[:120]})
    return {
        "is_stream_photo": bool(data["is_stream_photo"]),
        "suggestions": clean,
        "notable": [str(n)[:120] for n in data.get("notable", [])][:5],
        "reasons": [str(r)[:160] for r in data.get("reasons", [])][:4],
    }


def run_check(session: Session, shots: list[CheckPhoto], answers: dict[str, str]) -> dict:
    result = heuristic(session, shots, answers)
    if not config.OPENAI_API_KEY or all(s.is_demo for s in shots):
        return result
    try:
        ai = openai_vision(shots, answers)
    except Exception as err:  # timeout, network, bad JSON, refusal: keep the heuristic result
        log.warning("AI check failed, using heuristics: %s", err)
        result["ai_error"] = type(err).__name__
        return result
    result["mode"] = "ai"
    result["checks"]["is_stream_photo"] = ai["is_stream_photo"]
    result["suggestions"] = ai["suggestions"]
    result["notable"] = ai["notable"]
    result["reasons"] = ai["reasons"] + result["reasons"]
    if not ai["is_stream_photo"]:
        result["verdict"] = "fail"
        result["reasons"].insert(0, "This does not look like a stream photo. Please photograph the water.")
    elif result["verdict"] == "pass" and ai["reasons"]:
        result["verdict"] = "warn"
    return result
