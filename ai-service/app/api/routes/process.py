from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.services.chunking import ChunkingService
from app.services.embedding import EmbeddingService
from app.services.retrieval import RetrievalService

router = APIRouter()


class ProcessFileRequest(BaseModel):
    file_id: str
    user_id: str
    file_path: str
    mime_type: str


class ProcessFileResponse(BaseModel):
    file_id: str
    chunks_count: int
    status: str


class DeleteFileRequest(BaseModel):
    file_id: str


@router.post(
    "/process",
    response_model=ProcessFileResponse,
    status_code=status.HTTP_200_OK,
    tags=["Process"],
)
async def process_file(
    request: ProcessFileRequest,
    session: AsyncSession = Depends(get_session),
) -> ProcessFileResponse:
    chunking_service = ChunkingService()
    embedding_service = EmbeddingService()
    retrieval_service = RetrievalService(session)

    try:
        text = chunking_service.extract_text(request.file_path, request.mime_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract text: {str(e)}",
        )

    chunks = chunking_service.chunk_text(text)

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text content could be extracted from the file",
        )

    texts = [chunk.content for chunk in chunks]
    embeddings = await embedding_service.embed_texts(texts)

    chunks_with_embeddings = [
        (chunk.content, chunk.chunk_index, chunk.token_count, embedding)
        for chunk, embedding in zip(chunks, embeddings)
    ]

    await retrieval_service.delete_chunks_by_file(request.file_id)
    await retrieval_service.store_chunks(
        file_id=request.file_id,
        user_id=request.user_id,
        chunks_with_embeddings=chunks_with_embeddings,
    )

    return ProcessFileResponse(
        file_id=request.file_id,
        chunks_count=len(chunks),
        status="processed",
    )


@router.delete(
    "/process/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Process"],
)
async def delete_file_chunks(
    file_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    retrieval_service = RetrievalService(session)
    await retrieval_service.delete_chunks_by_file(file_id)
