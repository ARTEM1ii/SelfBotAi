from openai import AsyncOpenAI
import re

from app.core.config import settings
from app.services.retrieval import RetrievedChunk


class LLMService:
    def __init__(self) -> None:
        if settings.llm_provider == "openrouter":
            self._client = AsyncOpenAI(
                api_key=settings.openrouter_api_key,
                base_url=settings.openrouter_base_url,
            )
        else:
            self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate_response(
        self,
        message: str,
        context_chunks: list[RetrievedChunk],
        conversation_history: list[dict[str, str]] | None = None,
    ) -> str:
        interlocutor_facts = self._extract_interlocutor_facts(
            conversation_history, message
        )
        context = self._build_context(context_chunks)
        messages = self._build_messages(
            message, context, conversation_history, interlocutor_facts
        )

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
            f"{chunk.content}"
            for chunk in chunks
        ]

        return "\n\n".join(parts)

    def _build_messages(
        self,
        message: str,
        context: str,
        history: list[dict[str, str]] | None,
        interlocutor_facts: dict[str, str],
    ) -> list[dict[str, str]]:
        # System prompt: you ARE the owner, responding as them
        system_content = (
            "You are roleplaying as a real person based on their profile documents.\n"
            "You ARE this person — respond exactly as they would: same personality, "
            "same speech style, same interests, same manner.\n\n"
            "CRITICAL RULES:\n"
            "1. You ARE the person described in the documents. This is YOUR identity.\n"
            "2. The person you are chatting WITH is someone else (the interlocutor).\n"
            "3. Remember everything the interlocutor tells you about THEMSELVES "
            "(their name, age, city, etc.) and use it naturally in conversation.\n"
            "4. NEVER confuse YOUR identity (from documents) with the interlocutor's identity.\n"
            "5. Always respond in the same language as the incoming message.\n"
            "6. Be natural — like a real person texting, not an AI assistant."
        )

        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_content}
        ]

        # Inject owner profile from RAG documents
        if context:
            messages.append({
                "role": "system",
                "content": (
                    "YOUR PROFILE (who you are):\n\n"
                    f"{context}"
                ),
            })

        # Inject what the interlocutor told us about themselves
        if interlocutor_facts:
            fact_lines = []
            if "name" in interlocutor_facts:
                fact_lines.append(
                    f"- Their name is: {interlocutor_facts['name']}"
                )
            if "age" in interlocutor_facts:
                fact_lines.append(
                    f"- Their age is: {interlocutor_facts['age']}"
                )
            if "city" in interlocutor_facts:
                fact_lines.append(
                    f"- They live in: {interlocutor_facts['city']}"
                )

            messages.append({
                "role": "system",
                "content": (
                    "FACTS about the person you are chatting WITH "
                    "(they told you this themselves):\n"
                    + "\n".join(fact_lines)
                    + "\nUse their name naturally when talking to them."
                ),
            })

        # Conversation history
        if history:
            messages.extend(history[-20:])

        messages.append({"role": "user", "content": message})

        return messages

    def _extract_interlocutor_facts(
        self,
        history: list[dict[str, str]] | None,
        message: str | None,
    ) -> dict[str, str]:
        """
        Extract facts the interlocutor (the other person) stated about themselves.
        Only scans user-role messages. Iterates oldest→newest so latest wins.
        """
        user_texts: list[str] = []
        if history:
            user_texts.extend(
                m.get("content", "")
                for m in history
                if m.get("role") == "user" and m.get("content")
            )
        if message:
            user_texts.append(message)

        facts: dict[str, str] = {}

        for text in user_texts:
            t = text.strip()

            # Name: "меня зовут X" / "зовут меня X" / "my name is X" / "i'm X"
            m_name = re.search(
                r"(?:меня зовут|зовут меня|my name is|i(?:'m| am)\s+(?:called\s+)?)"
                r"\s*([A-Za-zА-Яа-яЁё\-]{2,40})",
                t,
                flags=re.IGNORECASE,
            )
            if m_name:
                facts["name"] = m_name.group(1).strip().capitalize()

            # Age: "мне X лет" / "i am X years old"
            m_age = re.search(
                r"(?:\bмне\s+(\d{1,3})\s+лет\b|i(?:'m| am)\s+(\d{1,3})\s+years?\s+old)",
                t,
                flags=re.IGNORECASE,
            )
            if m_age:
                facts["age"] = m_age.group(1) or m_age.group(2)

            # City: "я живу в X" / "i live in X"
            m_city = re.search(
                r"(?:я живу в|i live in)\s+([A-Za-zА-Яа-яЁё\- ]{2,60}?)(?:[.,!?]|$)",
                t,
                flags=re.IGNORECASE,
            )
            if m_city:
                facts["city"] = m_city.group(1).strip().capitalize()

        return facts
