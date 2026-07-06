# this file is for shared Database models between my legacy flask file (app.py) and my new FastAPI file

# IMPORTS
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Text, Column, func
from datetime import timezone, datetime
from typing import Optional, List
from sqlalchemy.dialects.postgresql import TIMESTAMPTZ


# DB MODELS


# USER TABLE
class User(SQLModel, table=True):

    # name
    __tablename__ = "user"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(max_length=25, index=True, unique=True, nullable=False)
    preferred_name: Optional[str] = Field(max_length=30, default=None)
    password_hashed: str = Field(max_length=200, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # relationships 
    routes: List["Route"] = Relationship(back_populates="user")
    points: List["Point"] = Relationship(back_populates="user")
    settings: List["Settings"] = Relationship(back_populates="user")

# ROUTE TABLE
class Route(SQLModel, table=True):

     # name
    __tablename__ = "route"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True, nullable=False)
    coordinates: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    eta_seconds: int = Field(nullable=False)
    distance_km: Optional[float] = Field(default=None)
    elevation_change: str = Field(max_length=30, nullable=False)

    # relationships
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="routes")

# POINT TABLE
class Point(SQLModel, table=True):

     # name
    __tablename__ = "point"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, unique=True, nullable=False)
    coordinates: str = Field(max_length=1000, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # relationships
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="points")

# SETTINGS TABLE
class Settings(SQLModel, table=True):

     # name
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(nullable=False)
    value: str = Field(nullable=False)

    # relationships
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="settings")

# BETA CODE TABLE
class BetaCode(SQLModel, table=True):
    
    #name
    __tablename__ = "betacode"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True, nullable=False)
    used: bool = Field(nullable=False, default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ERROR LOGGING TABLE
class ActionLog(SQLModel, table=True):
    __tablename__ = "action_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    
    action: str = Field(nullable=False, max_length=100)  # e.g. 'pathfind_request', 'route_export'
    
    outcome: bool = Field(nullable=False) # true = success | false = fail
    
    duration_ms: Optional[int] = Field(default=None, nullable=True) # for measurable statistics 
    
    error_code: Optional[str] = Field(default=None, nullable=True, max_length=50) # for easy identification 
    
    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMPTZ,
            nullable=False,
            server_default=func.now()
        )
    )


