from sqlmodel import SQLModel, create_engine, Session
from config import Config

engine = create_engine(
    Config.DATABASE_URI,
    echo=True, # this is set to true for debugging, remove when in prod
    pool_pre_ping=True
)

def get_session():
    with Session(engine) as session:
        yield session