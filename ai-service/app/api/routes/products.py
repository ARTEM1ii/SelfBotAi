import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.services.clip_service import CLIPService
from app.services.local_embedding import LocalEmbeddingService
from app.services.product_retrieval import ProductRetrievalService

logger = logging.getLogger(__name__)

router = APIRouter()

clip_service = CLIPService()
local_embedding_service = LocalEmbeddingService()


class ProductSearchResponse(BaseModel):
    product_id: str
    product_name: str
    product_description: str | None
    similarity: float


class EmbedResponse(BaseModel):
    status: str
    product_id: str


class TextSearchRequest(BaseModel):
    query: str
    top_k: int = 3


async def _embed_and_store(
    product_id: str,
    name: str,
    description: str,
    image: UploadFile | None,
    session: AsyncSession,
) -> EmbedResponse:
    """Shared logic for creating/updating product embeddings."""
    retrieval = ProductRetrievalService(session)

    image_embedding = None
    if image and image.filename:
        image_bytes = await image.read()
        if image_bytes:
            image_embedding = clip_service.embed_image(image_bytes)

    # Repeat name to give it more weight in the embedding vs the long description
    text_for_embedding = f"{name}. {name}. {description}".strip()
    text_embedding = local_embedding_service.embed_text(text_for_embedding)

    await retrieval.store_embeddings(
        product_id=product_id,
        name=name,
        description=description or None,
        image_embedding=image_embedding,
        text_embedding=text_embedding,
    )

    return EmbedResponse(status="ok", product_id=product_id)


@router.post(
    "/products/embed",
    response_model=EmbedResponse,
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
async def embed_product(
    product_id: str = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    image: UploadFile | None = File(None),
    session: AsyncSession = Depends(get_session),
) -> EmbedResponse:
    return await _embed_and_store(product_id, name, description, image, session)


@router.put(
    "/products/embed/{product_id}",
    response_model=EmbedResponse,
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
async def update_product_embedding(
    product_id: str,
    name: str = Form(...),
    description: str = Form(""),
    image: UploadFile | None = File(None),
    session: AsyncSession = Depends(get_session),
) -> EmbedResponse:
    return await _embed_and_store(product_id, name, description, image, session)


@router.delete(
    "/products/embed/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Products"],
)
async def delete_product_embedding(
    product_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    retrieval = ProductRetrievalService(session)
    await retrieval.delete_embeddings(product_id)


@router.post(
    "/products/search-by-image",
    response_model=list[ProductSearchResponse],
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
async def search_by_image(
    image: UploadFile = File(...),
    top_k: int = Form(3),
    session: AsyncSession = Depends(get_session),
) -> list[ProductSearchResponse]:
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image file",
        )

    image_embedding = clip_service.embed_image(image_bytes)
    retrieval = ProductRetrievalService(session)
    results = await retrieval.search_by_image(image_embedding, top_k=top_k)

    return [
        ProductSearchResponse(
            product_id=r.product_id,
            product_name=r.product_name,
            product_description=r.product_description,
            similarity=r.similarity,
        )
        for r in results
    ]


@router.post(
    "/products/search-by-text",
    response_model=list[ProductSearchResponse],
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
async def search_by_text(
    request: TextSearchRequest,
    session: AsyncSession = Depends(get_session),
) -> list[ProductSearchResponse]:
    text_embedding = local_embedding_service.embed_text(request.query)
    retrieval = ProductRetrievalService(session)
    results = await retrieval.search_by_text(text_embedding, top_k=request.top_k)

    return [
        ProductSearchResponse(
            product_id=r.product_id,
            product_name=r.product_name,
            product_description=r.product_description,
            similarity=r.similarity,
        )
        for r in results
    ]


class ReembedResponse(BaseModel):
    updated: int


@router.post(
    "/products/reembed-text",
    response_model=ReembedResponse,
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
async def reembed_all_text(
    session: AsyncSession = Depends(get_session),
) -> ReembedResponse:
    """Re-compute text embeddings for all products using the current model."""
    retrieval = ProductRetrievalService(session)
    all_products = await retrieval.get_all()
    count = 0
    for product in all_products:
        text = f"{product.product_name}. {product.product_name}. {product.product_description or ''}".strip()
        new_embedding = local_embedding_service.embed_text(text)
        await retrieval.update_text_embedding(
            product_id=product.product_id,
            name=product.product_name,
            description=product.product_description,
            text_embedding=new_embedding,
        )
        count += 1
    return ReembedResponse(updated=count)
