# Demo video script (about 4 minutes)

**Setup before recording:** start both servers (`./dev.ps1` or `./dev.sh`). In the Dev Panel press **Reset demo**, set Storm to **Auto**, Time Warp **+0**. Browser window about 1280 × 800, zoom 100%. Have a second tab open on `http://localhost:8081/dashboard`. Optional: real stream photos in `server/data/demo-photos/` (your own photos only), or film one real check at a stream near you (see README, "Use a stream near you").

---

## 1. The problem (0:00-0:30)

**Show:** the dashboard coverage number, then the empty grey parts of the map.

**Say:** "Cities need to know how their streams are doing: every part, often, and with data they can trust. Citizen science helps, but people try an app once and stop. The few who stay check the same easy spots. Data gets old, and nobody double-checks it."

## 2. A stream check (0:30-1:15)

**Show:** the map. Click next to a grey dashed fog tile on Ribeira de Coselhas (teleport), then walk the last metres with W A S D until **CHECK THIS TILE** appears. Tap it. Safety screen → demo photos (or the real photo you filmed) → tap through the 5 questions and "Good" → add a 🔧 pipe treasure → photo check with the suggestion chip → **Claim it!** → victory → back on the map, the tile paints blue with a coin burst.

**Say:** "StreamRealm turns the stream into 100-metre pieces of land. To claim one, you do a one-minute check: two photos and five easy questions. A photo check looks for blurry or re-used photos and makes suggestions, but the player always decides. Fog tiles give the Explorer bonus. That is the first secret: exploring fog fills the gaps in the map."

## 3. Teams, fading and disputes (1:15-2:10)

**Show:** zoom out: three team colours (and patterns). Open the Dev Panel → Time Warp **+8 days**: the tile pulses (fading). **+15**: it turns free land. Back to +0. Find an orange (Kingfishers) tile, teleport, check it with very different answers (brown, bad smell, a lot of foam) → **ATTACK!** → "Dispute!" with ⚔️ on the map.

**Say:** "Land fades after 7 days. To keep it, your team has to come back: that is the second secret, fresh repeat data. Attacking an enemy tile means doing a full second check. If you agree with the last check, you take the tile and their data becomes confirmed by an independent check. If you disagree, the tile is disputed, and a third player or a scientist decides. Our game fights are a data-quality engine."

## 4. Storm Quest (2:10-2:35)

**Show:** Dev Panel → Storm **Force ON**. The rain banner appears with ×2, then the Quests tab with the storm quest.

**Say:** "When Open-Meteo forecasts 10 millimetres of rain in 48 hours, a Storm Quest starts with double points. After heavy rain sewers can overflow, so that is when data matters most." (Then set Storm back to Auto.)

## 5. Scientist dashboard (2:35-3:20)

**Show:** the dashboard tab. KPIs. Switch the map layer to Freshness, then Health. In the dispute queue, compare the photos and answers, click **Attacker is right**. In the treasure queue, mark the pipe **Fixed**: the green message shows the kingdom health going up. Switch to the game, Kingdom tab: the plant has grown. Click **FHIR R4 bundle**.

**Say:** "Scientists get a clean dashboard: coverage, data age, confirmed checks, a dispute queue and a treasure queue. When the city fixes a reported pipe, the team's kingdom heals: healthy streams, healthy animals, healthy people. Everything exports as CSV, GeoJSON and FHIR R4, aligned with the OneAquaHealth implementation guide and checked with the official HL7 validator."

## 6. Coverage experiment (3:20-3:45)

**Show:** scroll to the experiment chart, then hover over day 60.

**Say:** "Does the game really spread checks out? We simulated 60 days on the real Coimbra stream network, with the same players and the same number of checks in two worlds. With the game incentives, coverage went from 46 to 54 percent and data stayed four days fresher, also with half the players. It's a simulation with stated assumptions, not real results, and the effect is modest. The next step is a real pilot."

## 7. Closing (3:45-4:00)

**Show:** the map with all three teams, zoomed out.

**Say:** "Players conquer land. Scientists get the whole stream."

---

## Recording checklist

- [ ] Both servers running; `http://localhost:8000/health` says `ok`.
- [ ] Dev Panel → **Reset demo** right before recording (fresh, busy map).
- [ ] Storm on **Auto**, Time Warp **+0** at the start.
- [ ] Browser zoom 100%, window wide enough for the phone frame (game) and the full dashboard.
- [ ] Sound on in Profile if you want the click/success sounds.
- [ ] Fog tile picked on Ribeira de Coselhas (`Fog` filter chip helps).
- [ ] An enemy fresh tile picked for the attack (it must be another team's, fresh or fading).
- [ ] Dashboard tab open in advance (loads the experiment chart).
- [ ] After the storm segment, Storm back to **Auto**.
- [ ] Say "simulation" when showing the experiment.
