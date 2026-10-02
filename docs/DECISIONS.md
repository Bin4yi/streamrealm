# Decisions and defaults

Small choices made while building, so reviewers can see why.

## Build plan

1. Skeleton + real map (Expo web + MapLibre, FastAPI, OSM tiles, Dev Panel).
2. Core loop (onboarding, stream check, points, fading, Time Warp).
3. Multiplayer feel (bots, attacks, disputes, treasures, quests, Storm Quest, kingdom).
4. Scientist dashboard, exports (CSV, GeoJSON, FHIR), Claude vision mode.
5. Coverage experiment, polish, docs.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Expo layout | Routes live in `app/src/app/` (not `app/app/`). | `create-expo-app` for SDK 57 uses the `src/` layout. The route names match the brief. |
| Web output | `web.output = "single"` (SPA). | MapLibre touches `window` at import time; static pre-rendering would crash. |
| MapLibre version | `maplibre-gl@5.24` instead of v6. | v6 is ESM-only and builds its worker from `import.meta.url`, which Metro cannot bundle. v5 ships a UMD build with the worker inlined. |
| Base map | OpenFreeMap "positron", re-tinted at runtime to soft nature colors. OSM raster tiles as fallback. | Muted base makes the team lines pop. Verified the style URL returns 200. |
| Demo city tiles | Coimbra, `waterway=stream` only, inside bbox `-8.465,40.175,-8.36,40.258`. 359 tiles, 35 km, 15 named streams. | The full set (with Rio Mondego and farm canals) gives more than 1,000 tiles and is not walkable. |
| Tile cutting | Each OSM way is cut into `n = round(length/100)` equal pieces (so 70-140 m each). Ways under 30 m are dropped. | No tiny leftovers at the end of a line. |
| Datetimes | All server times are timezone-aware UTC. | SQLModel 0.0.47 rejects naive datetimes. |
| Avatars | Emoji avatars (otter, frog, bird, swan, butterfly, fish, turtle, beaver). | No copyrighted art; works on every platform. |
| Agreement score | Exact match = 1. Neighbouring values on the ordered scales (foam, trash, overall) = 0.5. Average over 6 answers. | "A little" vs "A lot" of foam is a closer call than "None" vs "A lot". |
| Dispute tie | If the third check agrees equally with both sides, the defender keeps the tile. | The attacker has not proven a change. |
| Attack points | Attack points (+30) are paid only when the attack wins (now or after the dispute is settled). | Stops "spam attacks" that only create disputes. |
| Unsafe tiles | Unsafe tiles cannot be checked (button disabled, server rejects). | Safety first. So they also give no points. |
| Identity | No login. The app keeps the player id in local storage. | Prototype. Noted in README Limitations. |
| Claude model | `claude-opus-5` by default (`ANTHROPIC_MODEL` to override, e.g. `claude-haiku-4-5` for speed/cost). | Default from the Claude API reference used during the build. |
| OneAquaHealth research sites | Not shown. | `api.enora-oah.eu` (used by apps.oneaquahealth.eu) answers 401 without login. We did not invent site data. |
| FHIR IG | Profiles read from the IG source on GitHub (`hl7-eu/oah`, `input/fsh`). | `build.fhir.org/ig/hl7-eu/oah/` returned 404 during the hackathon. |
