"""Database engine, session and startup loading."""
from __future__ import annotations

import json
from collections.abc import Iterator

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select

from . import config
from .models import Tile, TileState

engine = create_engine(config.DB_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record):
    if config.DB_URL.startswith("sqlite"):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.close()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def load_cities() -> dict:
    return json.loads(config.CITIES_FILE.read_text(encoding="utf-8"))


def load_tiles(session: Session) -> int:
    """Insert tiles from data/tiles/*.geojson that are not in the database yet."""
    known = set(session.exec(select(Tile.id)).all())
    added = 0
    for path in sorted(config.TILES_DIR.glob("*.geojson")):
        gj = json.loads(path.read_text(encoding="utf-8"))
        city = gj.get("city", path.stem)
        for feat in gj["features"]:
            p = feat["properties"]
            if p["id"] in known:
                continue
            session.add(Tile(
                id=p["id"], city=city, stream_name=p["stream_name"], waterway=p.get("waterway", "stream"),
                length_m=p["length_m"], geometry_json=json.dumps(feat["geometry"]["coordinates"]),
                center_lon=p["center"][0], center_lat=p["center"][1],
            ))
            session.add(TileState(tile_id=p["id"]))
            added += 1
    session.commit()
    return added


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        load_tiles(session)
