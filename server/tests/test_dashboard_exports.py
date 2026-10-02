import csv
import io
import json
import re

from conftest import CLEAN, DIRTY, check, make_player

FHIR_ID = re.compile(r"^[A-Za-z0-9\-\.]{1,64}$")


def test_kpis(client, fresh_tile):
    check(client, make_player(client, "otters"), fresh_tile, CLEAN)
    k = client.get("/dashboard/kpis").json()
    for key in ("tiles_total", "coverage_pct", "median_data_age_days", "confirmed_pct", "open_disputes", "open_treasures"):
        assert key in k
    assert k["tiles_total"] > 100 and 0 < k["coverage_pct"] <= 100


def test_resolve_dispute(client, fresh_tile):
    a, b = make_player(client, "frogs"), make_player(client, "otters")
    check(client, a, fresh_tile, CLEAN)
    check(client, b, fresh_tile, DIRTY)
    disputes = client.get("/dashboard/disputes").json()
    d = next(d for d in disputes if d["tile"]["id"] == fresh_tile.id)
    assert d["agreement"] < 0.67 and len(d["differences"]) == 6
    r = client.post(f"/dashboard/disputes/{fresh_tile.id}/resolve", json={"winner": "attacker"})
    assert r.status_code == 200
    assert r.json()["tile"]["owner_team"] == "otters" and r.json()["tile"]["state"] == "owned_fresh"
    assert client.post(f"/dashboard/disputes/{fresh_tile.id}/resolve", json={"winner": "attacker"}).status_code == 404


def test_fixing_treasure_raises_health(client, fresh_tile):
    check(client, make_player(client, "kingfishers"), fresh_tile, {**CLEAN, "trash": "a_lot"}, treasure="trash")
    t = next(t for t in client.get("/dashboard/treasures").json() if t["tile_id"] == fresh_tile.id)
    before = client.get(f"/tiles/{fresh_tile.id}").json()["health"]
    r = client.patch(f"/dashboard/treasures/{t['id']}", json={"status": "fixed", "note": "City removed the trash"})
    assert r.status_code == 200
    after = client.get(f"/tiles/{fresh_tile.id}").json()
    assert after["health"] == min(100, before + 15) and after["healed"]


def test_mark_unsafe_via_treasure(client, fresh_tile):
    check(client, make_player(client, "frogs"), fresh_tile, CLEAN, treasure="pipe")
    t = next(t for t in client.get("/dashboard/treasures").json() if t["tile_id"] == fresh_tile.id)
    client.patch(f"/dashboard/treasures/{t['id']}", json={"status": "needs_action", "mark_unsafe": True})
    assert client.get(f"/tiles/{fresh_tile.id}").json()["unsafe"] is True
    r1, _ = check(client, make_player(client, "otters"), fresh_tile, CLEAN)
    assert r1.status_code == 403


def test_csv_and_geojson(client, fresh_tile):
    check(client, make_player(client, "otters"), fresh_tile, CLEAN)
    rows = list(csv.DictReader(io.StringIO(client.get("/export/csv").text)))
    assert rows and {"observation_id", "tile_id", "color", "health_score", "status"} <= set(rows[0])
    gj = json.loads(client.get("/export/geojson").text)
    assert gj["type"] == "FeatureCollection" and gj["features"][0]["geometry"]["type"] == "LineString"


def test_fhir_bundle_shape(client, fresh_tile):
    a, b = make_player(client, "frogs"), make_player(client, "kingfishers")
    check(client, a, fresh_tile, CLEAN)
    check(client, b, fresh_tile, CLEAN)  # agrees -> a's check becomes confirmed (final)
    r = client.get("/export/fhir")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/fhir+json")
    bundle = r.json()
    assert bundle["resourceType"] == "Bundle" and bundle["type"] == "collection"
    assert "total" not in bundle  # bdl-1: total only for searchset/history
    locations = {e["resource"]["id"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Location"}
    seen_final = False
    for e in bundle["entry"]:
        res = e["resource"]
        assert e["fullUrl"].endswith(f"/{res['resourceType']}/{res['id']}")
        assert FHIR_ID.match(res["id"])
        if res["resourceType"] == "Location":
            assert res["mode"] == "instance" and res["identifier"] and res["name"]
            assert {"longitude", "latitude"} <= set(res["position"])
            assert res["meta"]["profile"] == ["http://hl7.eu/fhir/ig/oah/StructureDefinition/location-oah"]
        else:
            assert res["resourceType"] == "Observation"
            assert res["status"] in ("preliminary", "final")
            assert res["subject"]["reference"].split("/")[1] in locations
            assert res["effectiveDateTime"].endswith("Z") and res["performer"] and res["component"]
            for c in res["component"]:
                assert c["code"]["coding"] and ("valueCodeableConcept" in c or "valueQuantity" in c)
            profiles = res.get("meta", {}).get("profile", [])
            if res["status"] == "final":
                seen_final = True
                assert profiles == ["http://hl7.eu/fhir/ig/oah/StructureDefinition/observation-indicators-oah"]
                assert any(n["text"].startswith("Confirmed by") for n in res["note"])
            else:
                assert not profiles  # the OAH profile fixes status = final
    assert seen_final


def test_fix_raises_kingdom_health(client, fresh_tile):
    p = make_player(client, "kingfishers")
    check(client, p, fresh_tile, {**CLEAN, "trash": "a_lot"}, treasure="trash")
    t = next(t for t in client.get("/dashboard/treasures").json() if t["tile_id"] == fresh_tile.id)
    k = client.patch(f"/dashboard/treasures/{t['id']}", json={"status": "fixed"}).json()["kingdom"]
    assert k["team"] == "kingfishers" and k["after"] > k["before"]
