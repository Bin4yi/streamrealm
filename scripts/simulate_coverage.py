"""Coverage experiment: does the game spread checks along the whole stream?

THIS IS A SIMULATION WITH STATED ASSUMPTIONS, NOT REAL-WORLD RESULTS.

Two worlds share the same players, homes, walking range and number of checks per day,
on the real Coimbra tile network. Only the way players choose a tile differs:

- Baseline ("normal citizen app"): players prefer a few easy, popular access points.
- StreamRealm: the same preference, multiplied by the game incentives
  (fog bonus, fading tiles to defend, enemy tiles to attack, disputes to settle).

Usage:
    python scripts/simulate_coverage.py            # 20 seeds, writes JSON + PNG
    python scripts/simulate_coverage.py --runs 5   # quicker
Output: server/data/experiment/coverage.json and coverage.png
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
TILES = ROOT / "server" / "data" / "tiles" / "coimbra.geojson"
OUT = ROOT / "server" / "data" / "experiment"

DAYS = 60
FRESH, FADING = 7, 14
AGE_CAP = 60  # never-checked or very old tiles count as 60 days old in the median
PARAMS = {
    "players": 24,
    "checks_per_day": 18,
    "walk_radius_m": 1500,
    "home_decay_m": 800,        # weight falls off with distance from home: exp(-d/800)
    "popular_spots": 3,
    "spot_decay_m": 250,        # pull of the nearest popular spot: exp(-d/250)
    "spot_share": 0.85,         # 85% of the base preference is "near a popular spot", 15% anywhere
    "p_disagree": 0.15,         # chance two honest checks of the same tile disagree
    "incentives": {"fog": 3.0, "neutral": 2.2, "own_fading": 2.4, "own_fresh": 0.25, "enemy_fresh": 1.1, "enemy_fading": 1.6, "disputed": 1.8},
}
ASSUMPTIONS = [
    "Tile network: the real 359 Coimbra stream tiles (OpenStreetMap). Everything else is simulated.",
    "Both worlds: same 24 players, same homes, same 18 checks per day, same walking range (1.5 km from home).",
    "The same random numbers decide who checks on each day in both worlds.",
    "Base preference in BOTH worlds: 85% pull towards the nearest of 3 popular access points, 15% any tile; times distance decay from home.",
    "The 3 popular access points are 3 random tiles per run (stand-ins for parks, bridges, car parks).",
    "StreamRealm only multiplies that base preference by game incentives (fog x3, own fading x2.4, neutral x2.2, disputed x1.8, enemy fading x1.6, enemy fresh x1.1, own fresh x0.25).",
    "Two honest checks of the same tile disagree 15% of the time; a disagreement on an enemy tile opens a dispute that the next check by a third player settles.",
    "A check is 'confirmed' when a different player checks the same tile within 14 days and agrees.",
    "Median data age is over all tiles; never-checked tiles count as 60 days old.",
    "Players never get bored and never quit (no churn) in either world, so the numbers only show where checks go, not how many people keep playing.",
    "Results are the mean of several random seeds; the band shows the min-max across seeds.",
]


def load_tiles():
    gj = json.loads(TILES.read_text(encoding="utf-8"))
    centers = np.array([f["properties"]["center"] for f in gj["features"]], dtype=float)
    lat0 = centers[:, 1].mean()
    xy = np.column_stack([centers[:, 0] * 111_320 * math.cos(math.radians(lat0)), centers[:, 1] * 110_540])
    return xy


def simulate(xy: np.ndarray, world: str, seed: int, players: int, checks_per_day: int) -> dict:
    p = PARAMS
    n = len(xy)
    setup = np.random.default_rng(seed)           # homes, teams, spots: shared by both worlds
    who_rng = np.random.default_rng(seed + 1000)  # who checks each day: shared by both worlds
    pick_rng = np.random.default_rng(seed + 2000 + (0 if world == "baseline" else 1))
    homes = xy[setup.integers(0, n, players)] + setup.normal(0, 300, (players, 2))
    teams = np.arange(players) % 3
    spots = xy[setup.choice(n, p["popular_spots"], replace=False)]
    d_spot = np.min(np.linalg.norm(xy[:, None, :] - spots[None, :, :], axis=2), axis=1)
    base = p["spot_share"] * np.exp(-d_spot / p["spot_decay_m"]) + (1 - p["spot_share"])
    d_home = np.linalg.norm(xy[None, :, :] - homes[:, None, :], axis=2)
    reach = np.where(d_home <= p["walk_radius_m"], np.exp(-d_home / p["home_decay_m"]), 0.0)
    # Players with no tile in range walk to the nearest one.
    for i in range(players):
        if reach[i].sum() == 0:
            reach[i, np.argmin(d_home[i])] = 1.0

    last = np.full(n, -np.inf)       # day of last check
    owner = np.full(n, -1)
    last_player = np.full(n, -1)
    last_obs = np.full(n, -1)
    disputed = np.zeros(n, bool)
    dispute_parties: dict[int, tuple[int, int]] = {}
    obs_confirmed: list[bool] = []
    coverage, median_age, confirmed = [], [], []
    inc = p["incentives"]

    for day in range(DAYS):
        for _ in range(checks_per_day):
            pl = int(who_rng.integers(0, players))
            w = reach[pl] * base
            if world == "streamrealm":
                age = day - last
                fog = np.isinf(last)
                own = owner == teams[pl]
                fresh = age <= FRESH
                fading = (age > FRESH) & (age <= FADING)
                neutral = ~fog & (age > FADING)
                mult = np.where(fog, inc["fog"],
                       np.where(disputed, inc["disputed"],
                       np.where(neutral, inc["neutral"],
                       np.where(own & fading, inc["own_fading"],
                       np.where(own & fresh, inc["own_fresh"],
                       np.where(fading, inc["enemy_fading"], inc["enemy_fresh"]))))))
                w = w * mult
            t = int(pick_rng.choice(n, p=w / w.sum()))
            obs_id = len(obs_confirmed)
            obs_confirmed.append(False)
            agree = pick_rng.random() > p["p_disagree"]
            recent = day - last[t] <= FADING
            if disputed[t]:
                a, b = dispute_parties[t]
                if pl not in (a, b):
                    disputed[t] = False
                    winner = a if agree else b
                    obs_confirmed[winner] = True
            elif recent and last_player[t] != pl and last_obs[t] >= 0:
                if agree:
                    obs_confirmed[last_obs[t]] = True
                elif owner[t] != teams[pl]:
                    disputed[t] = True
                    dispute_parties[t] = (last_obs[t], obs_id)
            if not disputed[t]:
                owner[t] = teams[pl]
            last[t], last_player[t], last_obs[t] = day, pl, obs_id
        ages = np.minimum(np.where(np.isinf(last), AGE_CAP, day - last), AGE_CAP)
        coverage.append(round(100 * float(np.mean(ages <= FADING)), 2))
        median_age.append(round(float(np.median(ages)), 2))
        confirmed.append(round(100 * sum(obs_confirmed) / len(obs_confirmed), 2) if obs_confirmed else 0.0)
    return {"coverage_pct": coverage, "median_age_days": median_age, "confirmed_pct": confirmed}


def run_all(runs: int) -> dict:
    xy = load_tiles()
    configs = {
        "baseline": ("baseline", PARAMS["players"], PARAMS["checks_per_day"], "Normal citizen app"),
        "streamrealm": ("streamrealm", PARAMS["players"], PARAMS["checks_per_day"], "StreamRealm"),
        "baseline_half": ("baseline", PARAMS["players"] // 2, PARAMS["checks_per_day"] // 2, "Normal app, 50% players"),
        "streamrealm_half": ("streamrealm", PARAMS["players"] // 2, PARAMS["checks_per_day"] // 2, "StreamRealm, 50% players"),
    }
    worlds = {}
    for key, (world, players, cpd, label) in configs.items():
        results = [simulate(xy, world, seed, players, cpd) for seed in range(runs)]
        out = {"label": label, "players": players, "checks_per_day": cpd}
        for metric in ("coverage_pct", "median_age_days", "confirmed_pct"):
            arr = np.array([r[metric] for r in results])
            out[metric] = [round(float(v), 2) for v in arr.mean(axis=0)]
            out[metric + "_min"] = [round(float(v), 2) for v in arr.min(axis=0)]
            out[metric + "_max"] = [round(float(v), 2) for v in arr.max(axis=0)]
        worlds[key] = out
    last = lambda k, m: worlds[k][m][-1]  # noqa: E731
    summary = {
        "Coverage day 60: StreamRealm": f"{last('streamrealm', 'coverage_pct'):.0f}%",
        "Coverage day 60: normal app": f"{last('baseline', 'coverage_pct'):.0f}%",
        "Median data age day 60": f"{last('streamrealm', 'median_age_days'):.0f} d vs {last('baseline', 'median_age_days'):.0f} d",
        "Confirmed checks": f"{last('streamrealm', 'confirmed_pct'):.0f}% vs {last('baseline', 'confirmed_pct'):.0f}%",
        "50% players, coverage": f"{last('streamrealm_half', 'coverage_pct'):.0f}% vs {last('baseline_half', 'coverage_pct'):.0f}%",
    }
    return {
        "title": "Coverage experiment (simulation, not real-world data)",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "days": DAYS,
        "runs": runs,
        "tiles": int(len(xy)),
        "params": PARAMS,
        "assumptions": ASSUMPTIONS,
        "worlds": worlds,
        "summary": summary,
    }


def plot(res: dict, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    colors = {"streamrealm": "#2a78d6", "baseline": "#eb6834", "streamrealm_half": "#1baf7a", "baseline_half": "#eb6834"}
    styles = {"streamrealm": "-", "baseline": "-", "streamrealm_half": "--", "baseline_half": "--"}
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.6), dpi=130)
    titles = {"coverage_pct": "Coverage: % tiles checked in last 14 days", "median_age_days": "Median data age (days, all tiles)", "confirmed_pct": "% checks confirmed by another player"}
    days = np.arange(res["days"])
    for ax, metric in zip(axes, titles):
        for key, w in res["worlds"].items():
            ax.fill_between(days, w[metric + "_min"], w[metric + "_max"], color=colors[key], alpha=0.10, linewidth=0)
            ax.plot(days, w[metric], styles[key], color=colors[key], linewidth=2, label=w["label"])
        ax.set_title(titles[metric], fontsize=11, loc="left")
        ax.set_xlabel("Day")
        ax.grid(color="#e9e8e4", linewidth=0.8)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        if metric != "median_age_days":
            ax.set_ylim(0, 100)
    axes[0].legend(frameon=False, fontsize=9)
    fig.suptitle(f"SIMULATION, not real-world results. Real Coimbra tile network ({res['tiles']} tiles), mean of {res['runs']} seeds, band = min-max.", fontsize=10, color="#52514e", x=0.01, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    fig.savefig(path)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=20)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    res = run_all(args.runs)
    (OUT / "coverage.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    plot(res, OUT / "coverage.png")
    for k, v in res["summary"].items():
        print(f"{k}: {v}")
    print(f"Saved {OUT / 'coverage.json'} and coverage.png")


if __name__ == "__main__":
    main()
