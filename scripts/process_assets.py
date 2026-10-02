"""Turn the raw generated PNGs into app-ready images.

    python scripts/process_assets.py            # process everything
    python scripts/process_assets.py --debug    # also save halo before/after crops

Input:  app/assets/raw/<id>.png (or --raw), described by asset-source/assets.json
Output: app/assets/images/<group>/<id>.png (+ @2x, @3x)
        app/src/lib/assets.ts      (static require() registry for Metro)
        asset-source/report.md, asset-source/contact-sheet.png (+ copy in docs/screenshots/)

Never calls an image API. Transparent images keep their real alpha; there is no chroma keying.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "app" / "assets" / "raw"
SPEC = ROOT / "asset-source" / "assets.json"
OUT = ROOT / "app" / "assets" / "images"
REGISTRY = ROOT / "app" / "src" / "lib" / "assets.ts"
REPORT = ROOT / "asset-source" / "report.md"
SHEET = ROOT / "asset-source" / "contact-sheet.png"

ALPHA_FLOOR = 8          # alpha below this becomes 0 (generator noise)
ISLAND_FRACTION = 0.001  # opaque islands smaller than 0.1% of the image are removed
SOLID_ALPHA = 250        # pixels at or above this count as "solid" colour sources for halo fixing
PAD = 0.06
TEAM_COLORS = {"otters": (47, 128, 237), "frogs": (39, 174, 96), "kingfishers": (242, 153, 74)}
NO_SQUARE = {"onboarding", "moments"}


@dataclass
class Result:
    id: str
    group: str
    size_in: tuple[int, int] = (0, 0)
    size_out: list[str] = field(default_factory=list)
    alpha_ok: bool = True
    halo_fixed: bool = False
    islands_removed: int = 0
    warnings: list[str] = field(default_factory=list)
    files: list[Path] = field(default_factory=list)


# ---------------------------------------------------------------- pure image steps

def has_transparent_corners(img: Image.Image) -> bool:
    if img.mode != "RGBA":
        return False
    a = np.asarray(img.getchannel("A"))
    return all(a[y, x] < ALPHA_FLOOR for y, x in ((0, 0), (0, -1), (-1, 0), (-1, -1)))


def clean_alpha(img: Image.Image) -> tuple[Image.Image, int]:
    """Zero faint alpha and drop tiny isolated islands. Returns (image, islands removed)."""
    from scipy import ndimage

    arr = np.array(img.convert("RGBA"))
    a = arr[..., 3]
    a[a < ALPHA_FLOOR] = 0
    labels, n = ndimage.label(a > 0)
    removed = 0
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), labels, index=np.arange(1, n + 1))
        min_size = ISLAND_FRACTION * a.size
        small = np.flatnonzero(sizes < min_size) + 1
        if len(small):
            a[np.isin(labels, small)] = 0
            removed = int(len(small))
    arr[..., 3] = a
    return Image.fromarray(arr, "RGBA"), removed


def fix_halo(img: Image.Image) -> Image.Image:
    """Bleed the colour of the nearest solid pixel into soft-edge pixels. Alpha is not changed.

    Soft pixels (0 < a < 255) get mixed towards the nearest solid colour, more strongly the more
    transparent they are (that is where light/dark fringes show). Fully transparent pixels take the
    solid colour too, so resizing does not pull dark or white colour into the edges.
    """
    from scipy import ndimage

    arr = np.array(img.convert("RGBA")).astype(np.float32)
    a = arr[..., 3]
    solid = a >= SOLID_ALPHA
    if not solid.any():
        return img
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    nearest = arr[iy, ix, :3]
    t = (1.0 - a / 255.0)[..., None]
    soft = (a < 255)[..., None]
    rgb = np.where(soft, arr[..., :3] * (1 - t) + nearest * t, arr[..., :3])
    out = np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def trim_pad(img: Image.Image, pad: float = PAD, square: bool = True) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img
    crop = img.crop(bbox)
    w, h = crop.size
    p = round(max(w, h) * pad)
    cw, ch = (max(w, h) + 2 * p,) * 2 if square else (w + 2 * p, h + 2 * p)
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(crop, ((cw - w) // 2, (ch - h) // 2))
    return canvas


def resize(img: Image.Image, longest: int) -> Image.Image:
    """LANCZOS resize with premultiplied alpha (no dark fringes from transparent pixels)."""
    w, h = img.size
    s = longest / max(w, h)
    size = (max(1, round(w * s)), max(1, round(h * s)))
    if img.mode == "RGBA":
        return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")
    return img.resize(size, Image.LANCZOS)


def pot_width(img: Image.Image) -> tuple[float, float]:
    """Width and centre x of the pot, measured on the row at 88% of the image height."""
    a = np.asarray(img.getchannel("A")) > 128
    rows = np.flatnonzero(a.any(axis=1))
    y = int(rows[0] + 0.88 * (rows[-1] - rows[0]))
    xs = np.flatnonzero(a[y])
    if not len(xs):
        return float(img.width), img.width / 2
    # The longest continuous run on that row is the pot.
    runs = np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1)
    run = max(runs, key=len)
    return float(len(run)), float(run.mean())


def align_on_baseline(imgs: list[Image.Image], pad: float = PAD) -> list[Image.Image]:
    """Same scale (pot width) and same bottom line for every stage, on one shared square canvas."""
    trimmed = [im.crop(im.getchannel("A").getbbox()) for im in imgs]
    widths = [pot_width(im)[0] for im in trimmed]
    ref = float(np.median(widths))
    scaled = [im.resize((max(1, round(im.width * ref / w)), max(1, round(im.height * ref / w))), Image.LANCZOS) for im, w in zip(trimmed, widths)]
    centres = [pot_width(im)[1] for im in scaled]
    left = max(c for c in centres)
    right = max(im.width - c for im, c in zip(scaled, centres))
    height = max(im.height for im in scaled)
    side = round(max(2 * max(left, right), height) * (1 + 2 * pad))
    base = side - round(side * pad)
    out = []
    for im, c in zip(scaled, centres):
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(im, (round(side / 2 - c), base - im.height), im)
        out.append(canvas)
    return out


def tint_near_white(img: Image.Image, color: tuple[int, int, int], min_value: int = 175, max_sat: float = 0.18) -> tuple[Image.Image, float]:
    """Multiply near-white, low-saturation pixels (the cloth) by a team colour.

    Keeps shading (multiply) and leaves the pole, outline and everything coloured unchanged.
    Returns (image, share of opaque pixels tinted).
    """
    arr = np.array(img.convert("RGBA")).astype(np.float32)
    rgb = arr[..., :3]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    mask = (mx >= min_value) & (sat <= max_sat) & (arr[..., 3] > 0)
    tint = np.array(color, np.float32) / 255.0
    # Lift the shading a bit so the colour stays bright: white -> team colour, light grey -> darker team colour.
    shade = (rgb / 255.0) ** 0.8
    rgb[mask] = np.clip(shade[mask] * tint * 255.0 * 1.04, 0, 255)
    arr[..., :3] = rgb
    opaque = max(1, int((arr[..., 3] > 0).sum()))
    return Image.fromarray(arr.astype(np.uint8), "RGBA"), float(mask.sum()) / opaque


def locked(img: Image.Image, opacity: float = 0.45) -> Image.Image:
    gray = img.convert("LA").convert("RGBA")
    a = np.array(gray)
    a[..., 3] = (a[..., 3] * opacity).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


# ---------------------------------------------------------------- pipeline

def find_tool(name: str) -> str | None:
    """On PATH, or the binary that `npm install` puts in app/node_modules (pngquant-bin)."""
    exe = shutil.which(name)
    if exe:
        return exe
    for cand in (ROOT / "app" / "node_modules" / f"{name}-bin" / "vendor").glob(f"{name}*"):
        if cand.is_file() and cand.suffix in ("", ".exe"):
            return str(cand)
    return None


def optimize(path: Path, lossy: bool = True) -> None:
    """pngquant (lossy palette, quality 70-95, kept only if smaller), then oxipng (lossless), when installed."""
    pq = find_tool("pngquant")
    if lossy and pq:
        subprocess.run([pq, "--quality=70-95", "--speed", "3", "--skip-if-larger", "--force", "--strip", "--ext", ".png", str(path)], check=False)
    ox = find_tool("oxipng")
    if ox:
        subprocess.run([ox, "-o", "3", "--strip", "safe", "-q", str(path)], check=False)


def save_variants(img: Image.Image, base: int, dest: Path, res: Result, source_longest: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    for k in (1, 2, 3):
        target = base * k
        if k == 1 and target > source_longest:
            res.warnings.append(f"@1x made at the source size {source_longest}px (target {target}px; no upscaling)")
            target = source_longest
        elif target > source_longest:
            res.warnings.append(f"@{k}x ({target}px) skipped: source is only {source_longest}px")
            continue
        out = resize(img, target) if target != max(img.size) else img
        path = dest if k == 1 else dest.with_name(f"{dest.stem}@{k}x.png")
        out.save(path, "PNG", optimize=True)
        optimize(path)
        res.files.append(path)
        res.size_out.append(f"@{k}x {out.width}x{out.height}")


def prepare(raw: Image.Image, res: Result, debug_dir: Path | None) -> Image.Image:
    res.alpha_ok = has_transparent_corners(raw)
    if not res.alpha_ok:
        res.warnings.append("needs_regeneration: no transparent alpha, the app will use a fallback")
        return raw.convert("RGBA")
    img, res.islands_removed = clean_alpha(raw)
    fixed = fix_halo(img)
    res.halo_fixed = True
    if debug_dir:
        bbox = img.getchannel("A").getbbox()
        box = (bbox[0], bbox[1], min(bbox[0] + 200, bbox[2]), min(bbox[1] + 200, bbox[3]))
        pair = Image.new("RGBA", (400, 200), (14, 42, 51, 255))
        pair.alpha_composite(img.crop(box), (0, 0))
        pair.alpha_composite(fixed.crop(box), (200, 0))
        pair.save(debug_dir / f"{res.id}-halo.png")
    return fixed


def process(raw_dir: Path, debug: bool) -> list[Result]:
    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    if OUT.exists():  # clear old output (contents only, so an open folder does not block us on Windows)
        for child in OUT.iterdir():
            shutil.rmtree(child) if child.is_dir() else child.unlink()
    debug_dir = ROOT / "asset-source" / "debug" if debug else None
    if debug_dir:
        debug_dir.mkdir(parents=True, exist_ok=True)
    results: list[Result] = []
    plants: dict[str, tuple[Result, Image.Image, int]] = {}
    for item in spec:
        res = Result(item["id"], item["group"])
        results.append(res)
        src = raw_dir / f"{item['id']}.png"
        if not src.exists():
            res.alpha_ok = False
            res.warnings.append("missing source file")
            continue
        raw = Image.open(src)
        raw.load()
        res.size_in = raw.size
        group = item["group"]
        if group == "identity":
            ident = OUT / "identity"
            ident.mkdir(parents=True, exist_ok=True)
            if item["id"] == "app-icon":
                icon = raw.convert("RGBA")
                icon.save(ident / "icon.png", optimize=True)
                adaptive = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
                adaptive.paste(resize(icon, 676), (174, 174))
                adaptive.save(ident / "adaptive-icon.png", optimize=True)
                resize(icon, 48).save(ident / "favicon.png", optimize=True)
                res.files += [ident / "icon.png", ident / "adaptive-icon.png", ident / "favicon.png"]
                res.size_out = ["icon 1024", "adaptive 1024 (66%)", "favicon 48"]
            elif item["id"] == "splash-art":
                path = ident / "splash.png"
                raw.convert("RGB").save(path, optimize=True)
                optimize(path)
                res.files.append(path)
                res.size_out = [f"{raw.width}x{raw.height} (no upscaling)"]
            else:  # game-bg-pattern: seamless, never trimmed
                for s in (512, 256):
                    path = ident / ("bg-pattern.png" if s == 512 else "bg-pattern-256.png")
                    raw.convert("RGB").resize((s, s), Image.LANCZOS).save(path, optimize=True)
                    res.files.append(path)
                res.size_out = ["512", "256"]
            continue

        img = prepare(raw, res, debug_dir)
        if group == "plant":
            plants[item["id"]] = (res, img, item["size"])
            continue
        trimmed = trim_pad(img, square=group not in NO_SQUARE)
        longest = max(trimmed.size)
        dest = OUT / group / f"{item['id']}.png"
        save_variants(trimmed, item["size"], dest, res, longest)

        if item["id"] in ("flag-white", "tile-conquered"):
            share = tint_near_white(trimmed, (255, 255, 255))[1]
            if share < 0.05:
                res.warnings.append(f"only {share:.0%} near-white pixels found to tint")
            name = "flag" if item["id"] == "flag-white" else "tile-conquered"
            # The flag image has only cloth, a brown pole and outlines, so shaded cloth can be included.
            # tile-conquered also has grey rocks, so it keeps the strict "near-white" rule.
            loose = {"min_value": 105, "max_sat": 0.22} if name == "flag" else {}
            for team, color in TEAM_COLORS.items():
                tinted, _ = tint_near_white(trimmed, color, **loose)
                save_variants(tinted, item["size"], OUT / group / f"{name}-{team}.png", res, longest)
        if group == "badges":
            save_variants(locked(trimmed), item["size"], OUT / group / f"{item['id']}-locked.png", res, longest)

    if plants:
        ids = sorted(plants)
        aligned = align_on_baseline([plants[i][1] for i in ids])
        for pid, im in zip(ids, aligned):
            res, _, size = plants[pid]
            save_variants(im, size, OUT / "plant" / f"{pid}.png", res, max(im.size))
            res.warnings.append("aligned with the other stages (same pot width and bottom line)")
    return results


# ---------------------------------------------------------------- registry, report, contact sheet

def camel(s: str) -> str:
    head, *rest = s.split("-")
    return head + "".join(r.title() for r in rest)


def write_registry(results: list[Result]) -> None:
    def req(rel: str) -> str | None:
        return f"require('../../assets/images/{rel}')" if (OUT / rel).exists() else None

    sections: dict[str, dict[str, str | None]] = {
        "emblem": {t: req(f"emblems/emblem-{t}.png") for t in TEAM_COLORS},
        "mascot": {m: req(f"mascots/mascot-{m}.png") for m in ("otter", "frog", "kingfisher")},
        "avatar": {a: req(f"avatars/avatar-{a}.png") for a in ("heron", "duck", "owl", "fox", "salamander", "dragonfly", "trout", "hedgehog")},
        "marker": {m: req(f"markers/marker-{m}.png") for m in ("player", "outpost", "disputed", "unsafe", "fog")},
        "flag": {**{t: req(f"markers/flag-{t}.png") for t in TEAM_COLORS}, "white": req("markers/flag-white.png")},
        "treasure": {t: req(f"treasures/treasure-{t}.png") for t in ("pipe", "trash", "wildlife", "plant", "algae")},
        "badge": {camel(b): req(f"badges/badge-{b}.png") for b in ("explorer", "defender", "detective", "storm-chaser", "treasure-hunter")},
        "badgeLocked": {camel(b): req(f"badges/badge-{b}-locked.png") for b in ("explorer", "defender", "detective", "storm-chaser", "treasure-hunter")},
        "effect": {"coin": req("effects/coin.png"), "coinPile": req("effects/coin-pile.png"), "sparkle": req("effects/sparkle.png"), "streak": req("effects/icon-streak-flame.png")},
        "onboarding": {o: req(f"onboarding/onboarding-{o}.png") for o in ("explore", "science", "safety")},
        "moment": {
            "storm": req("moments/storm-cloud.png"), "victory": req("moments/victory-banner.png"), "questScroll": req("moments/quest-scroll.png"),
            "questChest": req("moments/quest-chest.png"), "emptyTreasures": req("moments/empty-treasures.png"), "emptyPeace": req("moments/empty-peace.png"),
            "tileConquered": req("moments/tile-conquered.png"),
        },
        "conquered": {t: req(f"moments/tile-conquered-{t}.png") for t in TEAM_COLORS},
        "identity": {"splash": req("identity/splash.png"), "bgPattern": req("identity/bg-pattern.png"), "icon": req("identity/icon.png")},
    }
    plant = [req(f"plant/plant-stage-{i}.png") for i in range(1, 6)]
    missing = [f"{sec}.{k}" for sec, d in sections.items() for k, v in d.items() if v is None] + [f"plant.{i}" for i, v in enumerate(plant) if v is None]
    alt = {r.id: next(i["alt"] for i in json.loads(SPEC.read_text(encoding="utf-8")) if i["id"] == r.id) for r in results}
    lines = [
        "// GENERATED by scripts/process_assets.py - do not edit by hand.",
        "// Metro needs static require() calls, so every image is listed here.",
        "/* eslint-disable */",
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "type Src = ImageSourcePropType | null;",
        "",
        "export const Images = {",
    ]
    for sec, d in sections.items():
        lines.append(f"  {sec}: {{")
        for k, v in d.items():
            lines.append(f"    {k}: {v or 'null'} as Src,")
        lines.append("  },")
    lines.append("  plant: [" + ", ".join(f"{v or 'null'} as Src" for v in plant) + "],")
    lines += ["} as const;", "", "/** Short accessibility labels, by image id. */", "export const ImageAlt: Record<string, string> = " + json.dumps(alt, indent=2) + ";", ""]
    lines += ["/** Images the app expects but that are missing; GameImage shows a fallback for these. */", f"export const MISSING: string[] = {json.dumps(missing)};", ""]
    REGISTRY.write_text("\n".join(lines), encoding="utf-8")


def write_report(results: list[Result], total_bytes: int) -> None:
    rows = ["# Asset processing report", "", f"Total processed image size: **{total_bytes / 1e6:.2f} MB** in `app/assets/images/`.", "",
            "| id | group | in | out | alpha ok | halo fix | islands removed | notes |", "|---|---|---|---|---|---|---|---|"]
    for r in results:
        rows.append(f"| {r.id} | {r.group} | {r.size_in[0]}x{r.size_in[1]} | {'<br>'.join(r.size_out)} | {'yes' if r.alpha_ok else 'NO'} | "
                    f"{'yes' if r.halo_fixed else '-'} | {r.islands_removed} | {'<br>'.join(dict.fromkeys(r.warnings))} |")
    REPORT.write_text("\n".join(rows) + "\n", encoding="utf-8")


def contact_sheet(results: list[Result]) -> None:
    cell, label = 150, 18
    items = [(r.id, f) for r in results for f in r.files if "@" not in f.name]
    cols = 3 * 4
    rows = (len(items) + 3) // 4
    sheet = Image.new("RGB", (cols * cell, rows * (cell + label)), (30, 30, 30))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=11)
    checker = Image.new("RGB", (cell, cell), (200, 200, 200))
    cd = ImageDraw.Draw(checker)
    for y in range(0, cell, 15):
        for x in range(0, cell, 15):
            if (x + y) // 15 % 2:
                cd.rectangle([x, y, x + 14, y + 14], fill=(240, 240, 240))
    for i, (rid, path) in enumerate(items):
        im = Image.open(path).convert("RGBA")
        im.thumbnail((cell - 10, cell - 10))
        x0, y0 = (i % 4) * 3 * cell, (i // 4) * (cell + label)
        for j, bg in enumerate((checker, Image.new("RGB", (cell, cell), (14, 42, 51)), Image.new("RGB", (cell, cell), (243, 227, 195)))):
            tile = bg.copy().convert("RGBA")
            tile.alpha_composite(im, ((cell - im.width) // 2, (cell - im.height) // 2))
            sheet.paste(tile.convert("RGB"), (x0 + j * cell, y0))
        draw.text((x0 + 4, y0 + cell + 2), path.stem, fill=(255, 255, 255), font=font)
    sheet.save(SHEET, optimize=True)
    shots = ROOT / "docs" / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    shutil.copy(SHEET, shots / "contact-sheet.png")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, default=RAW)
    ap.add_argument("--debug", action="store_true", help="save halo before/after crops in asset-source/debug/")
    args = ap.parse_args()
    results = process(args.raw, args.debug)
    total = sum(p.stat().st_size for p in OUT.rglob("*.png"))
    write_registry(results)
    write_report(results, total)
    contact_sheet(results)
    missing = [r.id for r in results if not r.files]
    warn = [r for r in results if r.warnings and not all("aligned" in w or "skipped" in w for w in r.warnings)]
    print(f"processed: {len(results) - len(missing)} / {len(results)}   missing: {missing or 'none'}")
    print(f"files: {len(list(OUT.rglob('*.png')))}   total size: {total / 1e6:.2f} MB")
    for r in warn:
        print(f"  warning {r.id}: {'; '.join(w for w in r.warnings if 'skipped' not in w)}")
    tools = [t for t in ("pngquant", "oxipng") if find_tool(t)]
    print(f"png optimizer: {', '.join(tools) if tools else 'none installed (Pillow optimize only)'}")
    print(f"report: {REPORT.relative_to(ROOT)}   contact sheet: {SHEET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
