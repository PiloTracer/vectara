from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from . import models  # noqa: F401 - registers all models with Base metadata
from .models import Base
from .config import settings

DATABASE_URL = settings.DB_URL

# Optimization: Connection Pooling for Concurrency
engine = create_async_engine(
    DATABASE_URL, 
    echo=False, # Reduce IO overhead in production-like test
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
    class_=AsyncSession
)

async def run_sql_scripts(conn):
    """Executes all .sql files in app/sql/ sorted by name."""
    from sqlalchemy import text
    import logging
    
    # Path to SQL directory relative to this file
    sql_dir = os.path.join(os.path.dirname(__file__), "sql")
    if not os.path.exists(sql_dir):
        return

    files = sorted([f for f in os.listdir(sql_dir) if f.endswith(".sql")])
    
    for f in files:
        print(f"Executing SQL script: {f}")
        file_path = os.path.join(sql_dir, f)
        with open(file_path, "r") as sql_file:
            sql_content = sql_file.read()
            # Fix: asyncpg cannot execute multiple statements at once.
            # We must split by semicolon.
            statements = [s.strip() for s in sql_content.split(';') if s.strip()]
            
            for statement in statements:
                # print(f"Executing statement: {statement[:50]}...")
                await conn.execute(text(statement))

async def init_db():
    """
    Idempotent database initialization.
    Creates tables + Runs SQL scripts.
    NO ALEMBIC used here.
    """
    try:
        async with engine.begin() as conn:
            # 1. Create Schema (Idempotent)
            await conn.run_sync(Base.metadata.create_all)
            
            # Check if data exists
            from sqlalchemy import text
            try:
                result = await conn.execute(text("SELECT count(*) FROM environments"))
                count = result.scalar()
                if count and count > 0:
                    print(f"Database already contains {count} environments. Skipping seed scripts.")
                    return
            except Exception as e:
                print(f"Error checking data existence: {e}. Proceeding with seed.")

            # 2. Run SQL Scripts (Idempotent data population)
            await run_sql_scripts(conn)
            
    except Exception as e:
        print(f"Database Initialization Error: {e}")
        raise e

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
