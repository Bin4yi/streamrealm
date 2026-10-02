"""Tests for scripts/process_assets.py with small synthetic RGBA images."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import process_assets as pa  # noqa: E402


def blob(size=200, box=(60, 50, 140, 170), color=(200, 40, 40, 255)) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).rectangle(box, fill=color)
    return img


def test_trim_and_padding_square():
    out = pa.trim_pad(blob(), pad=0.06)
    w, h = 81, 121  # box is inclusive
    pad = round(max(w, h) * 0.06)
    assert out.size == (max(w, h) + 2 * pad,) * 2
    bbox = out.getchannel("A").getbbox()
    assert bbox[1] == pad and out.height - bbox[3] == pad  # tight on the long side
    assert abs(bbox[0] - (out.width - bbox[2])) <= 1  # centred


def test_trim_keeps_aspect_when_not_square():
    out = pa.trim_pad(blob(), pad=0.06, square=False)
    assert out.width < out.height


def test_clean_alpha_removes_noise_and_islands():
    img = blob()
    a = np.array(img)
    a[5, 5] = (255, 255, 255, 4)        # faint noise
    a[190, 190] = (255, 255, 255, 255)  # one-pixel island (far below 0.1% of the area)
    cleaned, removed = pa.clean_alpha(Image.fromarray(a, "RGBA"))
    c = np.array(cleaned)
    assert c[5, 5, 3] == 0 and c[190, 190, 3] == 0
    assert removed >= 1
    assert c[100, 100, 3] == 255  # the real shape stays


def test_halo_fix_keeps_alpha_and_removes_light_fringe():
    img = blob(color=(200, 40, 40, 255))
    a = np.array(img)
    a[49, 60:141] = (255, 255, 255, 90)  # white, half-transparent fringe above the shape
    fixed = np.array(pa.fix_halo(Image.fromarray(a, "RGBA")))
    assert (fixed[..., 3] == a[..., 3]).all()  # alpha untouched
    fringe = fixed[49, 100, :3].astype(int)
    assert fringe[0] > fringe[1] + 60  # pulled towards the red of the shape, no longer white


def test_plant_stages_share_baseline_and_pot_scale():
    stages = []
    for i, (pot_w, plant_h) in enumerate([(80, 40), (120, 120), (100, 200)]):
        img = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        top = 380 - 90
        d.rectangle((200 - pot_w // 2, top, 200 + pot_w // 2, 380), fill=(180, 90, 40, 255))  # pot
        d.rectangle((195, top - plant_h, 205, top), fill=(40, 160, 60, 255))  # stem
        stages.append(img)
    out = pa.align_on_baseline(stages)
    assert len({im.size for im in out}) == 1
    bottoms = [im.getchannel("A").getbbox()[3] for im in out]
    assert max(bottoms) - min(bottoms) <= 1
    widths = [pa.pot_width(im)[0] for im in out]
    assert max(widths) - min(widths) <= 3


def test_tint_keeps_pole_colour():
    img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((10, 10, 20, 90), fill=(120, 70, 30, 255))   # brown pole
    d.rectangle((21, 10, 80, 50), fill=(250, 250, 248, 255))  # white cloth
    out, share = pa.tint_near_white(img, (47, 128, 237))
    o = np.array(out)
    assert tuple(o[50, 15, :3]) == (120, 70, 30)
    cloth = o[30, 50, :3].astype(int)
    assert cloth[2] > cloth[0] + 100  # now blue
    assert 0.4 < share < 0.9


def test_locked_badge_is_gray_and_faded():
    out = np.array(pa.locked(blob(color=(30, 120, 220, 255))))
    px = out[100, 100]
    assert px[0] == px[1] == px[2]
    assert px[3] == int(255 * 0.45)


def test_resize_never_darkens_edges():
    img = pa.trim_pad(blob(color=(255, 255, 0, 255)))
    small = np.array(pa.resize(img, 40))
    edge = small[small[..., 3] > 0]
    assert edge[:, 2].max() < 80  # no dark/blue bleed from transparent black pixels
    assert edge[:, 0].min() > 180
