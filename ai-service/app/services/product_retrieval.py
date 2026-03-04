from dataclasses import dataclass

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product_embedding import ProductEmbedding


@dataclass
class ProductSearchResult:
    product_id: str
    product_name: str
    product_description: str | None
    similarity: float


class ProductRetrievalService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search_by_image(
        self, image_embedding: list[float], top_k: int = 3
    ) -> list[ProductSearchResult]:
        result = await self._session.execute(
            select(
                ProductEmbedding.product_id,
                ProductEmbedding.product_name,
                ProductEmbedding.product_description,
                (
                    1 - ProductEmbedding.image_embedding.cosine_distance(image_embedding)
                ).label("similarity"),
            )
            .where(ProductEmbedding.image_embedding.is_not(None))
            .order_by(
                ProductEmbedding.image_embedding.cosine_distance(image_embedding)
            )
            .limit(top_k)
        )
        rows = result.fetchall()
        return [
            ProductSearchResult(
                product_id=row.product_id,
                product_name=row.product_name,
                product_description=row.product_description,
                similarity=float(row.similarity),
            )
            for row in rows
        ]

    async def search_by_text(
        self, text_embedding: list[float], top_k: int = 3
    ) -> list[ProductSearchResult]:
        result = await self._session.execute(
            select(
                ProductEmbedding.product_id,
                ProductEmbedding.product_name,
                ProductEmbedding.product_description,
                (
                    1 - ProductEmbedding.text_embedding.cosine_distance(text_embedding)
                ).label("similarity"),
            )
            .where(ProductEmbedding.text_embedding.is_not(None))
            .order_by(
                ProductEmbedding.text_embedding.cosine_distance(text_embedding)
            )
            .limit(top_k)
        )
        rows = result.fetchall()
        return [
            ProductSearchResult(
                product_id=row.product_id,
                product_name=row.product_name,
                product_description=row.product_description,
                similarity=float(row.similarity),
            )
            for row in rows
        ]

    async def store_embeddings(
        self,
        product_id: str,
        name: str,
        description: str | None,
        image_embedding: list[float] | None,
        text_embedding: list[float] | None,
    ) -> None:
        existing = await self._session.execute(
            select(ProductEmbedding).where(
                ProductEmbedding.product_id == product_id
            )
        )
        row = existing.scalar_one_or_none()

        if row:
            row.product_name = name
            row.product_description = description
            if image_embedding is not None:
                row.image_embedding = image_embedding
            if text_embedding is not None:
                row.text_embedding = text_embedding
        else:
            self._session.add(
                ProductEmbedding(
                    product_id=product_id,
                    product_name=name,
                    product_description=description,
                    image_embedding=image_embedding,
                    text_embedding=text_embedding,
                )
            )

        await self._session.commit()

    async def delete_embeddings(self, product_id: str) -> None:
        await self._session.execute(
            delete(ProductEmbedding).where(
                ProductEmbedding.product_id == product_id
            )
        )
        await self._session.commit()

    async def update_text_embedding(
        self,
        product_id: str,
        name: str,
        description: str | None,
        text_embedding: list[float],
    ) -> None:
        existing = await self._session.execute(
            select(ProductEmbedding).where(
                ProductEmbedding.product_id == product_id
            )
        )
        row = existing.scalar_one_or_none()

        if row:
            row.product_name = name
            row.product_description = description
            row.text_embedding = text_embedding
            await self._session.commit()
