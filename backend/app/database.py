"""
database.py  –  Member 1 (Architecture Lead)
Async SQLite database engine and session factory.
Swap DATABASE_URL to postgresql+asyncpg://... for production.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite+aiosqlite:///./swifttrack.db"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db():
    """FastAPI dependency – yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables on startup (prototype only)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
