# Game design

All numbers live in two files that are tested to match: `server/app/services/rules.py` (source of truth) and `app/src/lib/gameRules.ts` (client copy). The test `server/tests/test_rules.py::test_client_rules_match_server` fails if they drift apart.

## Teams

| Team | Colour | Map pattern (so colour is never the only signal) |
|---|---|---|
| 🦦 Otters | `#2F80ED` blue | solid line |
| 🐸 Frogs | `#27AE60` green | line with white dots |
| 🐦 Kingfishers | `#F2994A` orange | line with white dashes |

## Tiles

Each named stream in the city is cut into pieces of about 100 m (70-140 m, equal parts per OSM way). Coimbra has **359 tiles on 15 streams (35 km)**.

| State | Rule | Look |
|---|---|---|
| `fog` | never checked | grey, dashed, soft white "cloud" glow |
| `owned_fresh` | last check ≤ 7 days ago | team colour, full, glow |
| `owned_fading` | 7-14 days ago | team colour, slow opacity pulse |
| `neutral` | > 14 days ago, owner lost | light grey |
| `disputed` | two checks disagree (stays until settled) | red-purple pulse, white stripes, ⚔️ |

State is always computed from the last check time and the game clock, so the **Time Warp** (Dev Panel, +0 to +30 days) shows fading instantly.

## The stream check

1. Safety tap ("I am on a safe path, not in the water").
2. Photo upstream. 3. Photo downstream.
4. Five questions (simplified from the OneAquaHealth citizen assessment categories; **this is our simplification**):
   - Water colour: clear / slightly cloudy / brown / green / other
   - Smell: none / earthy / bad (sewage, rotten) / chemical
   - Foam or oily film: none / a little / a lot
   - Trash: none / a few items / a lot
   - Water flow: flowing / slow / still / dry
5. Overall feeling: good / moderate / poor.
6. Optional treasure: pipe, trash hotspot, bird or animal, strange plant, algae bloom.
7. Photo check result with suggestion chips (the player decides), then **Claim it!**
8. Victory screen; the tile paints along the line on the map with a coin burst.

The player must be within **40 m** of the tile line. The server checks this again.

## Health score (0-100)

**A game indicator, not a scientific measurement.** It never means "safe to swim".

`health = 100 - (sum of penalties)`, clamped to 0..100.

| Question | Answer → penalty |
|---|---|
| Colour | clear 0 · slightly cloudy 10 · brown 25 · green 25 · other 15 |
| Smell | none 0 · earthy 5 · bad 30 · chemical 30 |
| Foam / oily film | none 0 · a little 10 · a lot 25 |
| Trash | none 0 · a few 10 · a lot 25 |
| Flow | flowing 0 · slow 5 · still 15 · dry 20 |
| Overall | good 0 · moderate 10 · poor 20 |

Example: slightly cloudy + a little foam + a few items of trash, everything else best → 100 - 10 - 10 - 10 = **70**.

A tile's health is the health of its latest check, plus a **healing bonus**: +15 when a scientist marks a treasure there as **Fixed**, +10 when a **cleanup event** is logged (max 100). The next check replaces the bonus with fresh data.

## Points

| Action | Points |
|---|---|
| Claim a fog tile (Explorer bonus) | +50 |
| Claim a neutral tile | +25 |
| Re-check your own team's tile (refresh) | +20 |
| Attack an enemy tile (only if the attack wins) | +30 |
| Settle a dispute (third check) | +15 |
| Treasure found | +40 |
| Streak bonus, first scoring check of the day | +10 per streak day, max +50 |
| Storm Quest active | ×2 on everything above |

**No points** when: the same player checked the same tile less than **6 hours** ago (anti-farming; the data is still saved), the tile is **unsafe** (it cannot be checked at all), or the photo check **fails** (re-used photo, or "not a stream" in AI mode).

Quests add rewards on top (see below).

## Attacks, confirmations and disputes (the data-quality engine)

**Agreement score** between two checks: average over the 6 answers. Same answer = 1. On the ordered scales (foam, trash, overall) a neighbouring answer = 0.5. Everything else = 0. The score is **rounded to 2 decimals**, so 4 of 6 equal answers = 0.67.

- **Attack** = a check on an enemy team's fresh or fading tile.
  - Agreement **≥ 0.67** → the attack wins, the tile changes team, and the previous check becomes **confirmed by an independent check** ✅.
  - Agreement **< 0.67** → the tile becomes **disputed**. The attacker gets no attack points yet.
- **Refresh** by a different player of the same team that agrees also confirms the previous check.
- **Dispute settlement**:
  - A **third player** (not one of the two) checks the tile. The side whose answers agree more with the third check wins (a tie goes to the defender, because the change is not proven). The winning check is confirmed, the losing one rejected, and the tile goes to the winner's team. If the attacker wins, they now get their +30.
  - Or a **scientist** picks the right side in the dashboard (same effect).
  - Players who are part of a dispute cannot settle it themselves; the app says "Waiting for a third player".

## Storm Quest

The server asks Open-Meteo for the hourly precipitation at the city centre and sums the next 48 hours (cached 30 min). **≥ 10 mm → Storm Quest**: ×2 points, a rain banner, and the message "After heavy rain, sewers can overflow. Your checks matter most now!". A storm-only quest appears. The Dev Panel can force it on or off.

## Kingdom health (the One Health link)

`kingdom health = average health of the team's fresh + fading tiles + 2 × (number of healed tiles)`, max 100.

A healed tile is one where a treasure was marked **Fixed** or a **cleanup** was logged, until the next check. So when the city fixes a pipe that players reported, the team's plant visibly grows. Message: *Healthy streams → healthy animals → healthy people.*

The plant blooms (flowers at ≥ 60, more at ≥ 85) and wilts (droops and turns brown) with the number.

## Treasures

Found during a check (+40). They appear as 💎 on the map and go to the scientist **treasure queue**, where they become Reviewed / Needs action / Fixed, or the tile can be marked **Unsafe** (⚠️, no more checks).

## Quests

| Quest | Kind | Target | Reward |
|---|---|---|---|
| Explore 2 fog tiles | daily | 2 | +40 |
| Do 3 stream checks | daily | 3 | +30 |
| Defend a fading tile | daily | 1 | +25 |
| Settle 1 dispute | daily | 1 | +30 |
| Find a treasure | daily | 1 | +30 |
| Storm Quest: 2 checks | only during a storm | 2 | +60 |
| Team challenge: 40 checks | weekly, whole team | 40 | +50 each |

Progress is computed from saved checks, so it cannot get out of sync. Rewards are claimed with a button.

## Badges

Explorer (5 fog tiles), Defender (3 fading tiles defended), Detective (3 confirmations or settled disputes), Storm Chaser (1 storm check), Treasure Hunter (2 treasures).

## Demo bots

24 bots (8 per team) with 3 weeks of seeded history (deterministic seed 42). Each tile has a hidden "true condition"; bots answer it with 12% noise per answer, and sometimes (live moves) carelessly with 60% noise. That is why most second checks agree and some disagree. Bots choose tiles with the same incentive weights the coverage simulation uses (fog 3.0, own fading 2.4, neutral 2.2, disputed 1.8, enemy fading 1.6, enemy fresh 1.1, own fresh 0.25) within 1.6 km of a home tile. They are labelled "demo bot" in the app, dashboard and exports.
