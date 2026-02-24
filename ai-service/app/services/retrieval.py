from dataclasses import dataclass

from pgvector.sqlalchemy import Vector
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chunk import DocumentChunk
from app.services.embedding import EmbeddingService


@dataclass
class RetrievedChunk:
    content: str
    file_id: str
    chunk_index: int
    similarity: float


class RetrievalService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._embedding_service = EmbeddingService()

    async def similarity_search(
        self,
        query: str,
        user_id: str,
        top_k: int | None = None,
    ) -> list[RetrievedChunk]:
        k = top_k or settings.top_k_results
        query_embedding = await self._embedding_service.embed_query(query)

        result = await self._session.execute(
            select(
                DocumentChunk.content,
                DocumentChunk.file_id,
                DocumentChunk.chunk_index,
                (
                    1 - DocumentChunk.embedding.cosine_distance(query_embedding)
                ).label("similarity"),
            )
            .where(DocumentChunk.user_id == user_id)
            .where(DocumentChunk.embedding.is_not(None))
            .order_by(
                DocumentChunk.embedding.cosine_distance(query_embedding)
            )
            .limit(k)
        )

        rows = result.fetchall()

        return [
            RetrievedChunk(
                content=row.content,
                file_id=row.file_id,
                chunk_index=row.chunk_index,
                similarity=float(row.similarity),
            )
            for row in rows
        ]

    async def store_chunks(
        self,
        file_id: str,
        user_id: str,
        chunks_with_embeddings: list[tuple[str, int, int, list[float]]],
    ) -> None:
        """
        chunks_with_embeddings: list of (content, chunk_index, token_count, embedding)
        """
        objects = [
            DocumentChunk(
                file_id=file_id,
                user_id=user_id,
                content=content,
                chunk_index=chunk_index,
                token_count=token_count,
                embedding=embedding,
            )
            for content, chunk_index, token_count, embedding in chunks_with_embeddings
        ]

        self._session.add_all(objects)
        await self._session.commit()

    async def delete_chunks_by_file(self, file_id: str) -> None:
        await self._session.execute(
            text("DELETE FROM document_chunks WHERE file_id = :file_id"),
            {"file_id": file_id},
        )
        await self._session.commit()
