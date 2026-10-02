"""Paths and environment settings."""
from __future__ import annotations

import os
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("STREAMREALM_DATA_DIR", SERVER_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DEMO_PHOTO_DIR = DATA_DIR / "demo-photos"
GENERATED_DEMO_DIR = DEMO_PHOTO_DIR / "generated"
TILES_DIR = DATA_DIR / "tiles"
EXPERIMENT_DIR = DATA_DIR / "experiment"
CITIES_FILE = DATA_DIR / "cities.json"
DB_URL = os.environ.get("STREAMREALM_DB_URL", f"sqlite:///{(DATA_DIR / 'streamrealm.db').as_posix()}")
DEFAULT_CITY = os.environ.get("STREAMREALM_CITY", "coimbra")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
# Default from the claude-api skill's current model table (2026-10). Override with ANTHROPIC_MODEL,
# e.g. ANTHROPIC_MODEL=claude-haiku-4-5 for a cheaper, faster check.
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5").strip()
AI_TIMEOUT_S = float(os.environ.get("AI_TIMEOUT_S", "8"))

# Set to "0" to start with an empty world (no bots).
SEED_DEMO = os.environ.get("STREAMREALM_SEED_DEMO", "1") != "0"

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

for d in (UPLOAD_DIR, GENERATED_DEMO_DIR, EXPERIMENT_DIR):
    d.mkdir(parents=True, exist_ok=True)
