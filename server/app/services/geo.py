"""Small geometry helpers in metres (local equirectangular projection)."""
from __future__ import annotations

import math

from shapely.geometry import LineString, Point


def _scale(lat0: float) -> tuple[float, float]:
    return 111_320.0 * math.cos(math.radians(lat0)), 110_540.0


def distance_to_line_m(lat: float, lon: float, coords: list[list[float]]) -> float:
    """Shortest distance in metres from a point to a [lon, lat] polyline."""
    kx, ky = _scale(lat)
    line = LineString([(x * kx, y * ky) for x, y in coords])
    return float(line.distance(Point(lon * kx, lat * ky)))


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
