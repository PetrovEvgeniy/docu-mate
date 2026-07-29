from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/documate")

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    future=True,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=20,
    max_overflow=0,
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# Dependency for FastAPI endpoints
async def get_db():
    """
    FastAPI dependency that provides a database session.
    Usage: async def endpoint(db: AsyncSession = Depends(get_db))
    """
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


# Function to create all tables (for development/testing)
async def create_tables():
    """
    Create all tables in the database.
    In production, use Alembic migrations instead.
    """
    from models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Function to drop all tables (for development/testing)
async def drop_tables():
    """
    Drop all tables in the database.
    Use with caution!
    """
    from models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
