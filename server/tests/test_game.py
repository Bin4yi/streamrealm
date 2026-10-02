from PIL import Image
from sqlmodel import select

from app import config
from app.models import Observation, Tile
from app.services.geo import distance_to_line_m, haversine_m
from conftest import CLEAN, DIRTY, check, make_player, photo_bytes


def test_distance_helpers(fresh_tile):
    assert distance_to_line_m(fresh_tile.center_lat, fresh_tile.center_lon, fresh_tile.coords) < 1
    assert 110 < haversine_m(40.0, -8.0, 40.001, -8.0) < 112


def test_tiles_endpoint(client):
    r = client.get("/cities/coimbra/tiles")
    assert r.status_code == 200
    feats = r.json()["features"]
    assert 150 <= len(feats) <= 400
    assert {"id", "state", "owner_team", "health", "stream_name"} <= set(feats[0]["properties"])


def test_claim_fog_tile_then_fade(client, fresh_tile):
    p = make_player(client, "otters")
    r1, r2 = check(client, p, fresh_tile, CLEAN)
    assert r1.status_code == 200, r1.text
    assert r1.json()["ai_result"]["mode"] == "heuristic"  # no key in tests -> fallback
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["action"] == "explore" and body["outcome"] == "claimed"
    assert body["points"] == 60  # 50 explorer + 10 streak day 1
    assert body["tile"]["state"] == "owned_fresh" and body["tile"]["owner_team"] == "otters"
    assert client.get(f"/tiles/{fresh_tile.id}?time_warp_days=8").json()["state"] == "owned_fading"
    assert client.get(f"/tiles/{fresh_tile.id}?time_warp_days=15").json()["state"] == "neutral"


def test_too_far_is_rejected(client, fresh_tile):
    p = make_player(client)
    r1, _ = check(client, p, fresh_tile, CLEAN, lat=fresh_tile.center_lat + 0.002)  # ~220 m north
    assert r1.status_code == 422
    assert "Walk within 40 m" in r1.json()["detail"]


def test_bad_answers_rejected(client, fresh_tile):
    p = make_player(client)
    r1, _ = check(client, p, fresh_tile, {**CLEAN, "foam": "tons"})
    assert r1.status_code == 422


def test_attack_success_confirms_previous(client, fresh_tile, session):
    a = make_player(client, "frogs")
    b = make_player(client, "kingfishers")
    check(client, a, fresh_tile, CLEAN)
    _, r2 = check(client, b, fresh_tile, {**CLEAN, "foam": "a_little"})
    body = r2.json()
    assert body["outcome"] == "attack_won" and body["confirmed_previous"]
    assert body["tile"]["owner_team"] == "kingfishers"
    assert body["points"] == 40  # 30 attack + 10 streak
    first = session.exec(select(Observation).where(Observation.player_id == a["id"])).one()
    assert first.status == "confirmed" and first.confirmed_by_observation_id == body["observation_id"]


def test_disagreement_creates_dispute_and_third_check_settles(client, fresh_tile):
    a = make_player(client, "frogs")
    b = make_player(client, "otters")
    c = make_player(client, "kingfishers")
    check(client, a, fresh_tile, CLEAN)
    _, r2 = check(client, b, fresh_tile, DIRTY)
    assert r2.json()["outcome"] == "dispute_started"
    assert r2.json()["tile"]["state"] == "disputed"
    assert r2.json()["points"] == 10  # no attack points yet, only the streak bonus
    # Someone from the dispute cannot settle it.
    _, again = check(client, a, fresh_tile, CLEAN)
    assert again.status_code == 409
    # A third player agrees with the attacker: attacker wins and gets the attack points.
    before = client.get(f"/players/{b['id']}").json()["points"]
    _, r3 = check(client, c, fresh_tile, {**DIRTY, "overall": "moderate"})
    body = r3.json()
    assert body["outcome"] == "dispute_settled" and body["tile"]["owner_team"] == "otters"
    assert body["tile"]["state"] == "owned_fresh"
    assert client.get(f"/players/{b['id']}").json()["points"] == before + 30


def test_anti_farming(client, fresh_tile):
    p = make_player(client, "frogs")
    check(client, p, fresh_tile, CLEAN)
    _, r2 = check(client, p, fresh_tile, CLEAN)
    assert r2.json()["outcome"] == "farming" and r2.json()["points"] == 0
    _, r3 = check(client, p, fresh_tile, CLEAN, warp=0.5)  # 12 hours later
    assert r3.json()["outcome"] == "refreshed" and r3.json()["points"] > 0


def test_unsafe_tile_rejected(client, fresh_tile, session):
    tile = session.get(Tile, fresh_tile.id)
    tile.unsafe = True
    session.add(tile)
    session.commit()
    r1, _ = check(client, make_player(client), fresh_tile, CLEAN)
    assert r1.status_code == 403


def test_treasure_and_storm(client, fresh_tile):
    from app.services import weather

    weather.set_forced(True)
    try:
        _, r2 = check(client, make_player(client, "otters"), fresh_tile, CLEAN, treasure="pipe")
    finally:
        weather.set_forced(False)
    body = r2.json()
    assert body["storm"] and body["treasure"] == "pipe"
    assert body["points"] == (50 + 40 + 10) * 2


def test_duplicate_photo_fails_and_exif_gps_is_stripped(client, fresh_tile, session):
    p = make_player(client, "frogs")
    up, down = photo_bytes(1, exif_gps=True), photo_bytes(2)
    r1, r2 = check(client, p, fresh_tile, CLEAN, photos=(up, down))
    assert r1.status_code == 200 and r2.status_code == 200, (r1.text, r2 and r2.text)
    saved = config.DATA_DIR / r1.json()["photo_up"]
    assert 0x8825 not in Image.open(saved).getexif()  # no GPS block in the stored copy
    # The same photo again on another tile: fail.
    other = session.exec(select(Tile).where(Tile.id != fresh_tile.id).limit(400)).all()[-1]
    r3, r4 = check(client, make_player(client, "otters"), other, CLEAN, photos=(up, photo_bytes(3)))
    assert r3.json()["ai_result"]["verdict"] == "fail"
    assert r3.json()["ai_result"]["checks"]["duplicate_of"]
    assert r4.status_code == 422


def test_ai_falls_back_without_key(session):
    from app.services.ai_check import CheckPhoto, run_check

    img = Image.new("RGB", (64, 64), (80, 120, 160))
    res = run_check(session, [CheckPhoto("x.jpg", img, None), CheckPhoto("y.jpg", img, None)], CLEAN)
    assert res["mode"] == "heuristic"
    assert res["verdict"] in ("warn", "pass")  # plain image is blurry -> warn, never fail
    assert any("blurry" in r for r in res["reasons"])


def test_ai_error_falls_back(monkeypatch, session):
    from app.services import ai_check

    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "sk-test")

    def boom(*a, **k):
        raise TimeoutError("slow")

    monkeypatch.setattr(ai_check, "claude_vision", boom)
    img = Image.new("RGB", (64, 64), (80, 120, 160))
    res = ai_check.run_check(session, [ai_check.CheckPhoto("x.jpg", img, None), ai_check.CheckPhoto("y.jpg", img, None)], CLEAN)
    assert res["mode"] == "heuristic" and res["ai_error"] == "TimeoutError"
