"""Download real stream lines from OpenStreetMap (Overpass API) for a city.

Usage:
    python scripts/fetch_streams.py --city coimbra
    python scripts/fetch_streams.py --name mystream --bbox -8.43,40.21,-8.38,40.23

Using --bbox with --name also adds the city to server/data/cities.json so the
server and the app pick it up. Output: server/data/streams/<city>.geojson.
Data (c) OpenStreetMap contributors, ODbL.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "server" / "data"
CITIES = DATA / "cities.json"
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
USER_AGENT = "StreamRealm-hackathon/0.1 (OneAquaHealth IEEE hackathon prototype)"


def overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    last_err: Exception | None = None
    for attempt in range(2):
        for url in MIRRORS:
            try:
                req = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    text = resp.read().decode("utf-8")
                if text.lstrip().startswith("{"):
                    return json.loads(text)
                last_err = RuntimeError(f"{url} returned a non-JSON answer")
            except Exception as err:  # network errors, timeouts, rate limits
                last_err = err
            print(f"  {url} failed: {last_err}", file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    raise SystemExit(f"All Overpass mirrors failed: {last_err}")


def to_geojson(osm: dict) -> dict:
    features = []
    for el in osm.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
        if len(coords) < 2:
            continue
        tags = el.get("tags", {})
        features.append({
            "type": "Feature",
            "properties": {
                "osm_id": el["id"],
                "name": tags.get("name"),
                "waterway": tags.get("waterway"),
                "intermittent": tags.get("intermittent"),
                "tunnel": tags.get("tunnel"),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })
    return {
        "type": "FeatureCollection",
        "attribution": "(c) OpenStreetMap contributors, ODbL 1.0",
        "fetched_at": osm.get("osm3s", {}).get("timestamp_osm_base"),
        "features": features,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", help="city key in server/data/cities.json")
    ap.add_argument("--name", help="key for a new area (use with --bbox)")
    ap.add_argument("--bbox", help="minLon,minLat,maxLon,maxLat")
    args = ap.parse_args()

    cities = json.loads(CITIES.read_text(encoding="utf-8"))
    if args.bbox:
        if not args.name:
            ap.error("--bbox needs --name")
        bbox = [float(v) for v in args.bbox.split(",")]
        if len(bbox) != 4 or bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
            ap.error("bbox must be minLon,minLat,maxLon,maxLat")
        key = args.name.lower()
        cities[key] = {
            "name": args.name,
            "country": "",
            "bbox": bbox,
            "center": [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
            "zoom": 15,
            "waterways": ["stream", "river", "canal", "ditch"],
            "note": "Added with fetch_streams.py --bbox",
        }
        CITIES.write_text(json.dumps(cities, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    else:
        key = (args.city or "coimbra").lower()
        if key not in cities:
            ap.error(f"unknown city '{key}'. Known: {', '.join(cities)}")

    min_lon, min_lat, max_lon, max_lat = cities[key]["bbox"]
    query = (
        "[out:json][timeout:90];"
        f'(way["waterway"~"^(stream|river|canal|ditch)$"]({min_lat},{min_lon},{max_lat},{max_lon}););'
        "out geom;"
    )
    print(f"Fetching waterways for '{key}' from Overpass ...")
    gj = to_geojson(overpass(query))
    out = DATA / "streams" / f"{key}.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(gj, ensure_ascii=False), encoding="utf-8")
    named = sum(1 for f in gj["features"] if f["properties"]["name"])
    print(f"Saved {len(gj['features'])} ways ({named} named) to {out.relative_to(ROOT)}")
    print(f"Next: python scripts/build_tiles.py --city {key}")


if __name__ == "__main__":
    main()
