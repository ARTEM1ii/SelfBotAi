from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.services.llm import LLMService
from app.services.retrieval import RetrievalService

router = APIRouter()


class ConversationMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    user_id: str
    conversation_history: list[ConversationMessage] | None = None
    top_k: int | None = None


class ChatResponse(BaseModel):
    reply: str
    sources_count: int


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    tags=["Chat"],
)
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session),
) -> ChatResponse:
    retrieval_service = RetrievalService(session)
    llm_service = LLMService()

    try:
        chunks = await retrieval_service.similarity_search(
            query=request.message,
            user_id=request.user_id,
            top_k=request.top_k,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retrieval failed: {str(e)}",
        )

    history = (
        [{"role": m.role, "content": m.content} for m in request.conversation_history]
        if request.conversation_history
        else None
    )

    try:
        reply = await llm_service.generate_response(
            message=request.message,
            context_chunks=chunks,
            conversation_history=history,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM generation failed: {str(e)}",
        )

    return ChatResponse(reply=reply, sources_count=len(chunks))
