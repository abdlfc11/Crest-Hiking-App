# this file is for shared Database models between my legacy flask file (app.py) and my new FastAPI file

# IMPORTS
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Text, Column, func, DateTime, BigInteger, UniqueConstraint, Index
from datetime import timezone, datetime
from typing import Optional, List
from sqlalchemy.dialects.postgresql import TIMESTAMP


# DB MODELS


# USER TABLE
class User(SQLModel, table=True):

    # name
    __tablename__ = "user"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(max_length=25, index=True, unique=True, nullable=False)
    preferred_name: Optional[str] = Field(max_length=30, default=None)
    password_hashed: str = Field(max_length=200, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False,
        },
    )

    # relationships 
    routes: List["Route"] = Relationship(back_populates="user")
    points: List["Point"] = Relationship(back_populates="user")
    settings: List["Settings"] = Relationship(back_populates="user")
    session_table: List["SessionTable"] = Relationship(back_populates="user")

# ROUTE TABLE
class Route(SQLModel, table=True):

     # name
    __tablename__ = "route"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, nullable=False)
    coordinates: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False,
        },
    )
    eta_seconds: int = Field(nullable=False)
    distance_km: Optional[float] = Field(default=None)
    elevation_change: str = Field(max_length=30, nullable=False)

    # relationships
    user_id: Optional[int] = Field(
        default=None,
        foreign_key="user.id",
        ondelete="CASCADE",
    )
    user: Optional[User] = Relationship(back_populates="routes")

    # table arguments
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="user_route_name"),
    )

# POINT TABLE
class Point(SQLModel, table=True):

     # name
    __tablename__ = "point"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, nullable=False)
    coordinates: str = Field(max_length=1000, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False,
        },
    )

    # relationships
    user_id: Optional[int] = Field(
        default=None,
        foreign_key="user.id",
        ondelete="CASCADE",
    )
    user: Optional[User] = Relationship(back_populates="points")

    # table arguments
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="user_point_name"),
    )

# SETTINGS TABLE
class Settings(SQLModel, table=True):

     # name
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(nullable=False)
    value: str = Field(nullable=False)

    # relationships
    user_id: Optional[int] = Field(
        default=None,
        foreign_key="user.id",
        ondelete="CASCADE",
    )
    user: Optional[User] = Relationship(back_populates="settings")

# ERROR LOGGING TABLE
class ActionLog(SQLModel, table=True):
    __tablename__ = "action_log"

    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        sa_type=BigInteger,
    )
    
    action: str = Field(nullable=False, max_length=100)  # e.g. 'pathfind_request', 'route_export'

    info: str = Field(nullable=True) # e.g Exceptions within try/catch statements 
    
    outcome: bool = Field(nullable=False) # true = success | false = fail
    
    duration_ms: Optional[int] = Field(default=None, nullable=True) # for measurable statistics 
    
    error_code: Optional[str] = Field(default=None, nullable=True, max_length=50) # for easy identification 
    
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False,
        },
    )     

    __table_args__ = (
        Index("index_action_log_action_created", "action", "created_at"),
    )

# ISSUE REPORT TABLE
class Issues(SQLModel, table=True):
    __tablename__ = "issues"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(nullable=False, max_length=100)
    description: str = Field(nullable=False, max_length=1000)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False,
        },
    )

# SESSIONS TABLE (used for auth)
class SessionTable(SQLModel, table=True):
    __tablename__ = "session_table"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(unique=True, index=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": func.now(),
            "nullable": False,
        },
    )
    expires_at: datetime = Field(
        nullable=False,
        sa_type=DateTime(timezone=True),
    )

    # relationships
    user_id: int = Field(foreign_key="user.id", nullable=False, ondelete="CASCADE")
    user: Optional[User] = Relationship(back_populates="session_table")