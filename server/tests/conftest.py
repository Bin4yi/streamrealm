"""Test setup: a throw-away data directory with the real Coimbra tiles, no bots, no AI key."""
from __future__ import annotations

import io
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

SERVER = Path(__file__).resolve().parents[1]
_TMP = Path(tempfile.mkdtemp(prefix="streamrealm-test-"))
(_TMP / "tiles").mkdir()
shutil.copy(SERVER / "data" / "cities.json", _TMP / "cities.json")
shutil.copy(SERVER / "data" / "tiles" / "coimbra.geojson", _TMP / "tiles" / "coimbra.geojson")
os.environ["STREAMREALM_DATA_DIR"] = str(_TMP)
os.environ["STREAMREALM_DB_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["STREAMREALM_SEED_DEMO"] = "0"
os.environ["ANTHROPIC_API_KEY"] = ""
sys.path.insert(0, str(SERVER))

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Tile, TileState  # noqa: E402
from app.services import weather  # noqa: E402


@pytest.fixture(scope="session")
def client():
    weather.set_forced(False)  # never call the network for the storm check in tests
    with TestClient(app) as c:
        yield c


@pytest.fixture
def session(client):
    with Session(engine) as s:
        yield s


@pytest.fixture
def fresh_tile(session):
    """A tile nobody has touched yet in this test run."""
    used = set(fresh_tile.used)
    for ts in session.exec(select(TileState).where(TileState.last_check_at == None)).all():  # noqa: E711
        if ts.tile_id not in used:
            fresh_tile.used.add(ts.tile_id)
            return session.get(Tile, ts.tile_id)
    raise RuntimeError("no fog tile left")


fresh_tile.used = set()

CLEAN = {"color": "clear", "smell": "none", "foam": "none", "trash": "none", "flow": "flowing", "overall": "good"}
DIRTY = {"color": "brown", "smell": "bad", "foam": "a_lot", "trash": "a_lot", "flow": "still", "overall": "poor"}


def make_player(client, team="otters", name=None):
    name = name or f"P{len(make_player.n)}{team[:2]}"
    make_player.n.append(name)
    r = client.post("/players", json={"nickname": name, "avatar": "otter", "team": team})
    assert r.status_code == 200, r.text
    return r.json()


make_player.n = []


def photo_bytes(seed: int, exif_gps: bool = False) -> bytes:
    """A unique, sharp test image (random stripes so the pHash differs per seed)."""
    import random

    rnd = random.Random(seed)
    img = Image.new("RGB", (640, 480), (90, 140, 170))
    d = ImageDraw.Draw(img)
    for _ in range(120):
        x, y = rnd.randint(0, 640), rnd.randint(0, 480)
        d.rectangle([x, y, x + rnd.randint(5, 80), y + rnd.randint(5, 80)], fill=(rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255)))
    buf = io.BytesIO()
    if exif_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "N", 2: (40.0, 13.0, 21.0), 3: "W", 4: (8.0, 24.0, 18.0)}  # GPSInfo
        img.save(buf, "JPEG", exif=exif)
    else:
        img.save(buf, "JPEG")
    return buf.getvalue()


def check(client, player, tile, answers, *, demo=True, photos=None, lat=None, lon=None, treasure=None, warp=0.0):
    """Run the full two-step check. Returns (draft_response, final_response)."""
    data = {
        "player_id": player["id"],
        "tile_id": tile.id,
        "lat": str(tile.center_lat if lat is None else lat),
        "lon": str(tile.center_lon if lon is None else lon),
        "answers": json.dumps(answers),
        "time_warp_days": str(warp),
    }
    files = None
    if photos:
        files = {"photo_up": ("up.jpg", photos[0], "image/jpeg"), "photo_down": ("down.jpg", photos[1], "image/jpeg")}
    elif demo:
        data["demo_photos"] = "true"
    if treasure:
        data["treasure_type"] = treasure
    r1 = client.post("/observations", data=data, files=files)
    if r1.status_code != 200:
        return r1, None
    r2 = client.post(f"/observations/{r1.json()['observation_id']}/confirm-ai", json={"answers": answers, "time_warp_days": warp})
    return r1, r2
