"""Photo storage, EXIF handling, perceptual hashes and generated demo photos."""
from __future__ import annotations

import io
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import imagehash
from PIL import ExifTags, Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat

from .. import config

MAX_SIDE = 1600
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
DEMO_VARIANTS = 8


class PhotoError(ValueError):
    pass


def read_exif_time(img: Image.Image) -> Optional[datetime]:
    """DateTimeOriginal from EXIF, or None when missing (common for web uploads)."""
    try:
        exif = img.getexif()
        raw = exif.get_ifd(ExifTags.IFD.Exif).get(36867) or exif.get(306)  # DateTimeOriginal / DateTime
        if not raw:
            return None
        return datetime.strptime(str(raw).strip(), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def save_upload(data: bytes) -> tuple[str, Image.Image, Optional[datetime]]:
    """Validate, read EXIF time, then save a clean copy (no EXIF/GPS) as JPEG.

    Returns (relative path like "uploads/abc.jpg", the clean image, exif time).
    """
    if not data:
        raise PhotoError("The photo is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise PhotoError("The photo is too big (max 12 MB).")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception as err:
        raise PhotoError("This file is not a photo we can read.") from err
    exif_time = read_exif_time(img)
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    name = f"{uuid.uuid4().hex}.jpg"
    # Saving without the exif argument drops all metadata, including GPS.
    img.save(config.UPLOAD_DIR / name, "JPEG", quality=85)
    return f"uploads/{name}", img, exif_time


def open_relative(rel: str) -> Image.Image:
    path = (config.DATA_DIR / rel).resolve()
    if config.DATA_DIR.resolve() not in path.parents:
        raise PhotoError("Bad photo path")
    return Image.open(path).convert("RGB")


def phash(img: Image.Image) -> str:
    return str(imagehash.phash(img))


def hash_distance(a: str, b: str) -> int:
    return imagehash.hex_to_hash(a) - imagehash.hex_to_hash(b)


# ---------- demo photos ----------

def _demo_scene(seed: int, size=(960, 720)) -> Image.Image:
    """A simple painted stream scene. Clearly labelled DEMO. No real photo."""
    rnd = random.Random(seed)
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    # sky
    for y in range(int(h * 0.47)):
        t = y / (h * 0.47)
        d.line([(0, y), (w, y)], fill=(int(120 + 80 * t), int(170 + 50 * t), int(225 + 20 * t)))
    # far trees
    for _ in range(26):
        x, r = rnd.randint(-40, w + 40), rnd.randint(40, 95)
        g = rnd.randint(90, 140)
        d.ellipse([x - r, h * 0.36 - r, x + r, h * 0.36 + r * 0.8], fill=(40, g, 55))
    # banks
    d.rectangle([0, int(h * 0.45), w, h], fill=(86, 128, 62))
    water_colors = [(70, 130, 160), (110, 120, 95), (80, 125, 90), (90, 140, 170), (120, 105, 80)]
    wc = water_colors[seed % len(water_colors)]
    top_l, top_r = w * 0.38 + rnd.randint(-40, 40), w * 0.62 + rnd.randint(-40, 40)
    d.polygon([(top_l, h * 0.45), (top_r, h * 0.45), (w * 0.95, h), (w * 0.05, h)], fill=wc)
    # ripples
    for i in range(70):
        y = h * 0.47 + (i / 70) ** 1.6 * h * 0.53
        span = (y - h * 0.45) / (h * 0.55)
        cx = w / 2 + rnd.randint(-int(w * 0.3 * span) - 1, int(w * 0.3 * span) + 1)
        lw = 10 + span * 80
        d.arc([cx - lw, y - 3, cx + lw, y + 3], 0, 180, fill=tuple(min(255, c + 45) for c in wc), width=2)
    # foam spots on some variants
    if seed % 3 == 1:
        for _ in range(40):
            x, y = rnd.randint(int(w * 0.2), int(w * 0.8)), rnd.randint(int(h * 0.6), h - 10)
            d.ellipse([x - 6, y - 3, x + 6, y + 3], fill=(235, 235, 225))
    # stones and grass texture
    for _ in range(60):
        x, y = rnd.randint(0, w), rnd.randint(int(h * 0.5), h)
        r = rnd.randint(3, 14)
        shade = rnd.randint(110, 170)
        d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=(shade, shade, shade - 10))
    for _ in range(900):
        x, y = rnd.randint(0, w), rnd.randint(int(h * 0.45), h)
        d.line([(x, y), (x + rnd.randint(-3, 3), y - rnd.randint(4, 12))], fill=(60, rnd.randint(110, 160), 50))
    img = img.filter(ImageFilter.SMOOTH_MORE)
    # label
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([18, 18, 330, 76], radius=12, fill=(14, 42, 51))
    d.text((34, 30), f"DEMO PHOTO #{seed}", fill=(242, 201, 76), font=ImageFont.load_default(size=30))
    return img


def demo_photo_paths() -> list[str]:
    """Real photos in data/demo-photos/ win; otherwise generated scenes are used."""
    real = sorted(
        p for p in config.DEMO_PHOTO_DIR.iterdir() if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
    )
    if real:
        return [f"demo-photos/{p.name}" for p in real]
    out = []
    for i in range(DEMO_VARIANTS):
        path: Path = config.GENERATED_DEMO_DIR / f"demo-{i}.jpg"
        if not path.exists():
            _demo_scene(i).save(path, "JPEG", quality=88)
        out.append(f"demo-photos/generated/{path.name}")
    return out


def pick_demo_photos(rnd: random.Random, n: int = 2) -> list[str]:
    paths = demo_photo_paths()
    return rnd.sample(paths, min(n, len(paths))) if len(paths) >= n else [paths[0]] * n


def blur_score(img: Image.Image) -> float:
    import cv2
    import numpy as np

    small = img.copy()
    small.thumbnail((640, 640))
    gray = cv2.cvtColor(np.asarray(small), cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def brightness(img: Image.Image) -> float:
    return float(ImageStat.Stat(img.convert("L").resize((64, 64))).mean[0])


def lower_half_color(img: Image.Image) -> tuple[float, float, float]:
    w, h = img.size
    crop = img.crop((int(w * 0.2), int(h * 0.55), int(w * 0.8), h)).resize((32, 32))
    r, g, b = ImageStat.Stat(crop).mean[:3]
    return (r, g, b)


def hue_name(rgb: tuple[float, float, float]) -> Optional[str]:
    r, g, b = rgb
    mx, mn = max(rgb), min(rgb)
    if mx < 30 or mx - mn < 18:
        return None  # too dark or grey: no guess
    if r >= g and g > b and r - b > 30:
        return "brown"
    if g > r + 8 and g >= b:
        return "green"
    if b >= g and b > r:
        return "clear"
    return None

