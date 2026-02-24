from openai import AsyncOpenAI

from app.core.config import settings
from app.services.retrieval import RetrievedChunk


SYSTEM_PROMPT = """You are an AI assistant that responds on behalf of the user.
You have access to the user's personal knowledge base built from their uploaded documents.
Use the provided context to answer questions in the user's style and with their knowledge.
If the context doesn't contain relevant information, respond naturally based on general knowledge.
Always respond in the same language as the incoming message."""


class LLMService:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate_response(
        self,
        message: str,
        context_chunks: list[RetrievedChunk],
        conversation_history: list[dict[str, str]] | None = None,
    ) -> str:
        context = self._build_context(context_chunks)
        messages = self._build_messages(message, context, conversation_history)

        response = await self._client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.7,
            max_tokens=1024,
        )

        return response.choices[0].message.content or ""

    def _build_context(self, chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return ""

        parts = [
            f"[Document excerpt {i + 1} (relevance: {chunk.similarity:.2f})]:\n{chunk.content}"
            for i, chunk in enumerate(chunks)
        ]

        return "\n\n".join(parts)

    def _build_messages(
        self,
        message: str,
        context: str,
        history: list[dict[str, str]] | None,
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

        if context:
            messages.append(
                {
                    "role": "system",
                    "content": f"Relevant context from user's knowledge base:\n\n{context}",
                }
            )

        if history:
            messages.extend(history[-10:])  # last 10 messages for context window

        messages.append({"role": "user", "content": message})

        return messages
