# Decisions and defaults

Small choices made while building, so reviewers can see why.

## Build plan

1. Skeleton + real map (Expo web + MapLibre, FastAPI, OSM tiles, Dev Panel).
2. Core loop (onboarding, stream check, points, fading, Time Warp).
3. Multiplayer feel (bots, attacks, disputes, treasures, quests, Storm Quest, kingdom).
4. Scientist dashboard, exports (CSV, GeoJSON, FHIR), AI vision mode.
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
| Agreement rounding | The score is rounded to 2 decimals before comparing with 0.67. | Without rounding, 4 of 6 equal answers is 0.6667 and fails, which is not what "0.67 = two thirds" means. Found by a unit test. |
| Dispute tie | If the third check agrees equally with both sides, the defender keeps the tile. | The attacker has not proven a change. |
| Attack points | Attack points (+30) are paid only when the attack wins (now or after the dispute is settled). | Stops "spam attacks" that only create disputes. |
| Unsafe tiles | Unsafe tiles cannot be checked (button disabled, server rejects). | Safety first. So they also give no points. |
| Identity | No login. The app keeps the player id in local storage. | Prototype. Noted in README Limitations. |
| AI model | OpenAI `gpt-6-luna` by default (`OPENAI_MODEL` to override). Responses API, image input, strict JSON schema, reasoning effort low. | Team request to use OpenAI. Luna is OpenAI's most efficient current model with image input and structured outputs (checked on developers.openai.com, 2026-10); a photo check needs speed and low cost more than deep reasoning. |
| OneAquaHealth research sites | Not shown. | `api.enora-oah.eu` (used by apps.oneaquahealth.eu) answers 401 without login. We did not invent site data. |
| FHIR IG | Profiles read from the IG source on GitHub (`hl7-eu/oah`, `input/fsh`). | `build.fhir.org/ig/hl7-eu/oah/` returned 404 during the hackathon. |
| Two-step check | `POST /observations` makes a draft with the photo check; `POST /observations/{id}/confirm-ai` applies the rules with the final answers. | The player must see the photo check and decide before anything counts. Both answer sets are stored. |
| Demo photos | Drawn by code (Pillow), labelled "DEMO". Real photos in `server/data/demo-photos/` are used instead when present. Demo photos skip the duplicate check and always add a "demo photo" note. | The brief forbids downloading photos. Many demo checks reuse the same 8 images. |
| Kingdom healing | Kingdom health = average tile health + 2 per healed tile (fixed treasure or cleanup). | +15 on one tile averaged over ~80 tiles changes nothing visible. The brief wants "Fixed" to visibly raise kingdom health. |
| Team patterns | Otters solid, Frogs white dots, Kingfishers white dashes on the map, plus a legend. | Colour is never the only signal (accessibility). |
| Dashboard colours | Freshness = one-hue blue ramp; health = diverging red-gray-blue; experiment lines = validated categorical slots (blue, orange, aqua) + dashes for the 50% runs. | Checked with a colour-vision-deficiency validator; the first idea (green-yellow-red) was a rainbow ramp. |
| Sounds | Web Audio oscillator "chiptune" sounds, web only, mute switch in Profile. | No sound files, so no licence questions. `expo-audio` needs files. |
| Bot city | Bots only play in `STREAMREALM_SEED_CITY` (Coimbra). | A city you add to film your own demo starts as all fog. |
| Coverage confirmations | Reported as-is: StreamRealm 30% vs normal app 32%. | We did not tune the model to make every number win. |
| FHIR confirmations | A confirmation is a note linking the confirming Observation, not `derivedFrom`. | The second check is not derived from the first. |
| FHIR validation | Validated with the HL7 validator against base R4 and against the OAH profiles compiled from the IG source with SUSHI. 0 errors in both. | Proves the claims in the README instead of only asserting them. |
| Android build | `npx expo export --platform android --no-bytecode` builds. The Hermes bytecode step failed on this Windows machine (`spawn UNKNOWN`). | Toolchain issue on the build machine, not in the app code. Not run on a device. |
| Server reload | `uvicorn --reload` on Windows sometimes kept serving old code during development; the scripts still use `--reload`, restart by hand if changes do not show. | Observed during the build. |
| AI provider | OpenAI instead of Claude for the optional photo check (team request): `gpt-6-luna`, Responses API, image input, strict JSON schema, reasoning effort low, 8 s timeout, heuristic fallback. | Model id and API shape checked on developers.openai.com. Tested with a fake client (request shape + parsing); no live key in the build environment. |
| Image source folder | Raw images are read from `app/assets/raw/` (where the team put them), not `asset-source/raw/`. `asset-source/` holds `assets.json`, the report and the contact sheet. | Follow where the files actually are. |
| Template images | The first processing run cleared `app/assets/images/`, which also held the Expo template images (react/expo logos, old icons). They were no longer used after the new app identity, so they stay removed. | Unplanned side effect, reported honestly. The script now only clears its own output folder contents. |
| No upscaling | Groups whose trimmed source is smaller than @2x/@3x get no @2x/@3x file (emblems, mascots, onboarding). Two onboarding images are exported at their source size (859 and 875 px). | The brief says never upscale. |
| Image size budget | pngquant (from the `pngquant-bin` dev dependency, quality 60-95, kept only if smaller); the in-app splash is a JPEG copy; the app icon is not in the in-app registry. Web build ships 8.7 MB of images. | Budget is 10 MB. |
| Tinting | Flags: "near-white" = value ≥ 105 and saturation ≤ 0.22 (cloth incl. its shading). Conquered tile: value ≥ 175 and saturation ≤ 0.18, so the grey rocks keep their colour. Multiply with the team colour, shading kept. | Looser threshold removed grey streaks on the flag; stricter one protects rocks. |
| Avatars (logic change) | The 8 new image avatars (heron, duck, owl, fox, salamander, dragonfly, trout, hedgehog) replace the emoji set. The server still accepts the old ids, and the app shows their emoji. Bots use the new ids. | New art; old players must keep working. |
| Treasure types on tiles (logic change, read-only) | Tile GeoJSON now includes `treasure_types` (open treasures). | The map needs the type to pick the right treasure icon. No game rule changed. |
| Level | Level = 1 + floor(points / 250), display only. | The HUD asks for a level star; no rule uses it. |
| Kingdom preview | `/kingdom?preview=<0-100>` sets the plant health on screen, only when the Dev Panel is on, with a "Preview" label. | Plant stages 1/3/5 are hard to reach with real data for screenshots and the demo. |
| Reduced motion | OS setting or *Profile → Reduced motion* stops idle loops, rays, sparkles and shakes. | Accessibility. Verified by pixel diff on `/kit`. |
| Fonts | Lilita One (titles, numbers, buttons) + Nunito (body); Cinzel is still loaded for the few older text styles. | SIL OFL fonts only; no game-company fonts. |
| Dashboard | Stays light and professional. Only small images: team emblems (24 px), treasure icons, empty-state art. | Judges must see a serious tool. |
| Slow base map | Besides the 9 s style timeout, the map now switches to OSM raster tiles when the OpenFreeMap base source has not loaded 12 s after the style (`isSourceLoaded('openmaptiles')`, not `map.loaded()`, because the pulse animation keeps the style "dirty"). | Seen during the build: style loaded, tiles never arrived; a plain MapLibre control page behaved the same. |
| Screenshots | Taken from the production web build (`expo export` + `npx serve -s dist`). | The dev server's on-the-fly compression of the 12 MB dev bundle took ~45 s per page load on Windows. |
