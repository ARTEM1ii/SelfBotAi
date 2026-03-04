import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings
from app.core.database import Base


class ProductEmbedding(Base):
    __tablename__ = "product_embeddings"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    product_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        nullable=False,
        unique=True,
        index=True,
    )

    image_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.clip_embedding_dimensions),
        nullable=True,
    )

    text_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.text_embedding_dimensions),
        nullable=True,
    )

    product_name: Mapped[str] = mapped_column(Text, nullable=False)

    product_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        nullable=False, default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
