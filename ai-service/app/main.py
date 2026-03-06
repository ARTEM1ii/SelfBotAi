import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.process import router as process_router
from app.api.routes.chat import router as chat_router
from app.api.routes.products import router as products_router
from app.core.config import settings
from app.core.database import engine
from app.models import DocumentChunk, ProductEmbedding  # noqa: F401 — registers models with Base

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup - create tables
    async with engine.begin() as conn:
        await conn.run_sync(DocumentChunk.metadata.create_all)
    logger.info("Database tables initialized")

    yield
    # Shutdown
    await engine.dispose()
    logger.info("Database engine disposed")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="RAG-based AI service for TelegramLLM",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(process_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(products_router, prefix="/api")
