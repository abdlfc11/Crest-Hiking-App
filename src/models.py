# this file is for shared Database models between my legacy flask file (app.py) and my new FastAPI file

# IMPORTS
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Text, Column
from datetime import timezone, datetime
from typing import Optional, List


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
    format: str = Field(max_length=25, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ETA: str = Field(max_length=100, nullable=False)
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

