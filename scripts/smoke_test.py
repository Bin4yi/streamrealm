"""End-to-end smoke test against a running server (default http://localhost:8000).

create player -> stand on a fog tile ("teleport") -> stream check -> tile state changes -> fades with time warp.
Uses only the Python standard library.

    python scripts/smoke_test.py [--api http://localhost:8000]
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid


def call(api: str, method: str, path: str, body=None, form: dict | None = None):
    url = api + path
    headers = {}
    data = None
    if form is not None:
        boundary = uuid.uuid4().hex
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in form.items()]
        data = ("".join(parts) + f"--{boundary}--\r\n").encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000")
    api = ap.parse_args().api.rstrip("/")
    ok = True

    def step(name: str, cond: bool, detail=""):
        nonlocal ok
        ok &= cond
        print(f"[{'PASS' if cond else 'FAIL'}] {name} {detail}")

    s, health = call(api, "GET", "/health")
    step("server is up", s == 200, health)
    s, player = call(api, "POST", "/players", {"nickname": f"Smoke{uuid.uuid4().hex[:4]}", "avatar": "fox", "team": "otters"})
    step("create player", s == 200, player.get("id") if s == 200 else player)
    _, tiles = call(api, "GET", "/cities/coimbra/tiles")
    fog = next(f for f in tiles["features"] if f["properties"]["state"] == "fog" and not f["properties"]["unsafe"])
    lon, lat = fog["properties"]["center"]
    answers = {"color": "clear", "smell": "none", "foam": "none", "trash": "a_few", "flow": "flowing", "overall": "good"}
    form = {"player_id": player["id"], "tile_id": fog["id"], "lat": lat + 0.001, "lon": lon, "answers": json.dumps(answers), "demo_photos": "true"}
    s, body = call(api, "POST", "/observations", form=form)
    step("far away (~110 m) is rejected", s == 422, body.get("detail"))
    form["lat"] = lat  # "teleport" onto the tile
    s, draft = call(api, "POST", "/observations", form=form)
    step("photo check runs", s == 200 and draft["ai_result"]["verdict"] in ("pass", "warn"), f"mode={draft.get('ai_result', {}).get('mode')}")
    s, res = call(api, "POST", f"/observations/{draft['observation_id']}/confirm-ai", {"answers": answers})
    step("claim fog tile", s == 200 and res["outcome"] == "claimed", f"+{res.get('points')} points")
    _, tile = call(api, "GET", f"/tiles/{fog['id']}")
    step("tile is fresh and ours", tile["state"] == "owned_fresh" and tile["owner_team"] == "otters", tile["state"])
    _, warped = call(api, "GET", f"/tiles/{fog['id']}?time_warp_days=8")
    step("time warp +8 days -> fading", warped["state"] == "owned_fading")
    for path in ("/export/csv", "/export/geojson", "/export/fhir", "/dashboard/kpis", f"/quests?player_id={player['id']}", "/leaderboard?scope=week"):
        req = urllib.request.Request(api + path)
        with urllib.request.urlopen(req, timeout=60) as r:
            step(f"GET {path}", r.status == 200)
    print("ALL PASSED" if ok else "SOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
