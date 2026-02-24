from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.process import router as process_router
from app.api.routes.chat import router as chat_router
from app.core.config import settings
from app.core.database import engine
from app.models import DocumentChunk  # noqa: F401 — registers model with Base


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup - create tables
    async with engine.begin() as conn:
        await conn.run_sync(DocumentChunk.metadata.create_all)
    
    yield
    # Shutdown
    await engine.dispose()


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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(process_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
