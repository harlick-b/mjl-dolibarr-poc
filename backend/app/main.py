from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import database_url as read_database_url
from app.database import make_engine
from app.health import router


def create_app(database_url: str | None = None) -> FastAPI:
    url = read_database_url(database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.engine = make_engine(url)
        try:
            yield
        finally:
            app.state.engine.dispose()

    app = FastAPI(title="MJL Foundation", version="0.1.0", lifespan=lifespan)
    app.include_router(router)
    return app
