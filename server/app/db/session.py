from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    pool_size=_settings.db_pool_size,
    max_overflow=_settings.db_max_overflow,
    pool_pre_ping=True, 
    pool_recycle=_settings.db_pool_recycle_seconds,  
    connect_args={
        "ssl": _settings.db_ssl,
        "timeout": _settings.db_connect_timeout_seconds,
        "server_settings": {"statement_timeout": str(_settings.db_statement_timeout_ms)},
    },
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
