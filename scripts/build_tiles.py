"""Split stream lines into ~100 m game tiles.

Usage:
    python scripts/build_tiles.py --city coimbra

Reads server/data/streams/<city>.geojson, keeps named streams of the waterway
types listed in cities.json, clips them to the city bbox, and cuts each line
into equal pieces close to 100 m. Lines shorter than 30 m are dropped.
Output: server/data/tiles/<city>.geojson
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from shapely.geometry import LineString, MultiLineString, box
from shapely.ops import substring, transform

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "server" / "data"
TARGET_M = 100.0
MIN_M = 30.0


def projector(lat0: float):
    """Local equirectangular projection in metres (accurate to <0.5% over a city)."""
    kx = 111_320.0 * math.cos(math.radians(lat0))
    ky = 110_540.0

    def fwd(x, y, z=None):
        return (x * kx, y * ky)

    def inv(x, y, z=None):
        return (x / kx, y / ky)

    return fwd, inv


def parts(geom):
    if isinstance(geom, LineString):
        return [geom] if not geom.is_empty else []
    if isinstance(geom, MultiLineString):
        return [g for g in geom.geoms if not g.is_empty]
    if hasattr(geom, "geoms"):
        return [g for g in geom.geoms if isinstance(g, LineString) and not g.is_empty]
    return []


def build(city: str) -> dict:
    cities = json.loads((DATA / "cities.json").read_text(encoding="utf-8"))
    cfg = cities[city]
    streams = json.loads((DATA / "streams" / f"{city}.geojson").read_text(encoding="utf-8"))
    clip = box(*cfg["bbox"])
    allowed = set(cfg.get("waterways", ["stream", "river", "canal", "ditch"]))
    fwd, inv = projector(cfg["center"][1])

    tiles = []
    for feat in streams["features"]:
        props = feat["properties"]
        if not props.get("name") or props.get("waterway") not in allowed:
            continue
        line = LineString(feat["geometry"]["coordinates"]).intersection(clip)
        for part_idx, part in enumerate(parts(line)):
            m = transform(fwd, part)
            length = m.length
            if length < MIN_M:
                continue
            n = max(1, round(length / TARGET_M))
            step = length / n
            for i in range(n):
                seg_m = substring(m, i * step, (i + 1) * step)
                seg = transform(inv, seg_m)
                mid = transform(inv, m.interpolate((i + 0.5) * step))
                suffix = f"{part_idx}-" if part_idx else ""
                tiles.append({
                    "type": "Feature",
                    "properties": {
                        "id": f"{city}-w{props['osm_id']}-{suffix}{i:03d}",
                        "stream_name": props["name"],
                        "waterway": props["waterway"],
                        "length_m": round(seg_m.length, 1),
                        "center": [round(mid.x, 6), round(mid.y, 6)],
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[round(x, 6), round(y, 6)] for x, y in seg.coords],
                    },
                })
    return {
        "type": "FeatureCollection",
        "city": city,
        "attribution": "Stream lines (c) OpenStreetMap contributors, ODbL 1.0",
        "features": tiles,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="coimbra")
    args = ap.parse_args()
    gj = build(args.city)
    out = DATA / "tiles" / f"{args.city}.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(gj, ensure_ascii=False), encoding="utf-8")
    feats = gj["features"]
    total = sum(f["properties"]["length_m"] for f in feats)
    names = sorted({f["properties"]["stream_name"] for f in feats})
    print(f"{len(feats)} tiles, {total / 1000:.1f} km, {len(names)} streams: {', '.join(names)}")
    if not 150 <= len(feats) <= 400:
        print("Note: tile count is outside the 150-400 demo target. Adjust bbox or waterways in cities.json.")


if __name__ == "__main__":
    main()
