"""Database tables (SQLModel + SQLite)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite may hand back naive datetimes; treat them as UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    dt = aware(dt)
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def new_id() -> str:
    return uuid.uuid4().hex[:12]


class Player(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    nickname: str = Field(index=True)
    avatar: str = "otter"
    team: str = Field(index=True)  # otters | frogs | kingfishers
    is_bot: bool = False
    points: int = 0
    streak: int = 0
    last_active_day: Optional[str] = None  # YYYY-MM-DD of last scoring check
    created_at: datetime = Field(default_factory=utcnow)


class Tile(SQLModel, table=True):
    id: str = Field(primary_key=True)
    city: str = Field(index=True)
    stream_name: str
    waterway: str = "stream"
    length_m: float = 0
    geometry_json: str  # GeoJSON LineString coordinates
    center_lat: float
    center_lon: float
    unsafe: bool = False

    @property
    def coords(self) -> list[list[float]]:
        return json.loads(self.geometry_json)


class TileState(SQLModel, table=True):
    tile_id: str = Field(primary_key=True, foreign_key="tile.id")
    owner_team: Optional[str] = None
    last_check_at: Optional[datetime] = None
    last_observation_id: Optional[str] = None
    state: str = "fog"  # cached; always recomputed from time on read
    dispute_open: bool = False
    dispute_obs_a: Optional[str] = None  # defender's observation
    dispute_obs_b: Optional[str] = None  # attacker's observation
    health_score: Optional[int] = None
    health_bonus: int = 0  # from fixed treasures / cleanup events, cleared by the next check


class Observation(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    tile_id: str = Field(index=True, foreign_key="tile.id")
    player_id: str = Field(index=True, foreign_key="player.id")
    team: str = ""
    created_at: datetime = Field(default_factory=utcnow, index=True)
    answers_json: str = "{}"
    original_answers_json: str = "{}"  # answers before the player looked at AI suggestions
    photo_up: Optional[str] = None
    photo_down: Optional[str] = None
    health_score: int = 0
    ai_result_json: str = "{}"
    ai_choices_json: str = "{}"  # question -> "accepted" | "kept"
    # draft -> (pending | confirmed | disputed | rejected)
    status: str = Field(default="draft", index=True)
    action: Optional[str] = None  # explore | claim_neutral | refresh | attack | confirm_dispute
    points: int = 0
    points_breakdown_json: str = "[]"
    confirmed_by_observation_id: Optional[str] = None
    client_lat: Optional[float] = None
    client_lon: Optional[float] = None
    distance_m: Optional[float] = None
    is_demo: bool = False

    def answers(self) -> dict[str, Any]:
        return json.loads(self.answers_json or "{}")


class Photo(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    filename: str
    phash: Optional[str] = Field(default=None, index=True)
    observation_id: Optional[str] = Field(default=None, index=True)
    is_demo: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class Treasure(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    observation_id: str = Field(index=True, foreign_key="observation.id")
    tile_id: str = Field(index=True)
    type: str  # pipe | trash | wildlife | plant | algae
    photo: Optional[str] = None
    status: str = Field(default="open", index=True)  # open | reviewed | needs_action | fixed
    note: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class Quest(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    description: str
    kind: str  # daily | weekly_team | storm
    metric: str
    target: int
    reward: int
    icon: str = "star"


class QuestProgress(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    quest_id: str = Field(index=True)
    player_id: str = Field(index=True)
    period: str  # YYYY-MM-DD (daily) or YYYY-Www (weekly)
    claimed_at: datetime = Field(default_factory=utcnow)
    reward: int = 0


class Event(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: str
    payload_json: str = "{}"
    created_at: datetime = Field(default_factory=utcnow, index=True)
