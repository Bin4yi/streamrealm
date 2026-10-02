# Safety, privacy and ethics

StreamRealm sends people to real streams. Safety comes before points.

## Physical safety

- **Before every check**, a full-screen safety step: stay on the path or bank, never go into the water, do not touch the water or pipes, skip any place that feels unsafe, kids play with an adult. The player must tap "I am on a safe path, not in the water" to continue.
- **Nothing in the game needs you to touch the water.** All questions are visual (colour, foam, trash, flow) or from the air (smell, from the path).
- Tiles are claimed from **40 m away**, so players can stay on public paths and bridges.
- Scientists can mark a tile **unsafe** (dashboard, or from a treasure like a dangerous outlet). It shows ⚠️, the check button is disabled, and the server rejects checks there. Unsafe tiles give no points.
- **Storm Quests** say "after heavy rain". The wording never asks people to go out *during* a storm. A future version should add a clear "wait until the rain stops; water levels rise fast" line and hide flood-risk tiles during warnings.
- Kid mode note: "Kids: play with an adult" on onboarding and the safety screen.

## Privacy

- Players choose a **nickname and an emoji avatar**. No real name, email, phone or login. Nicknames are limited to letters, numbers, spaces, `_` and `-`.
- The player's **position is only sent with a check**, to verify the 40 m rule, and stored with that check (`client_lat`, `client_lon`). Positions are never shown to other players.
- Uploaded photos are **re-saved without EXIF metadata**, which removes GPS coordinates and camera details. The EXIF capture time is read once, before stripping, only to warn about old photos.
- Exports use the nickname (CSV) or a **hashed player id** (FHIR). No other personal data exists.
- **Faces:** photos might show people by accident. Today we rely on the instruction to photograph the water. **Future work:** automatic face and licence-plate blur on upload, before storage.

## Data honesty

- The **health score is a game indicator**, not a measurement. The tile sheet, the claim flow and the dashboard all say it never means "safe to swim".
- Unconfirmed checks are **preliminary** (also in FHIR). Only checks confirmed by another player or a scientist are `final`.
- All **demo bots** are labelled "demo bot". Demo photos are drawn by code and say "DEMO". FHIR exports carry the HL7 `HTEST` test-data label.
- The **coverage experiment is labelled as a simulation** everywhere, with all assumptions listed.

## Fair play

- Server-side distance check (no claims from your sofa, except with the Dev Panel, which is for demos).
- Re-used photos are detected (perceptual hash) and fail the check.
- No points for checking the same tile again within 6 hours.
- Players cannot settle their own dispute.
- The AI never changes answers. It only suggests.

## Known risks

- Competitive play could push people to rush. Mitigations: no time-based scoring, no "first to arrive" races, the safety step every time, and unsafe tiles.
- Teams could collude to "confirm" each other. Confirmations need agreement between *different players*, and disputes can go to scientists. A pilot should watch for patterns (same players confirming each other repeatedly).
