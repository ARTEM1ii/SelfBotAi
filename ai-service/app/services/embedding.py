import httpx

from app.core.config import settings


class EmbeddingService:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=60.0)

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        # Use HuggingFace free inference API
        batch_size = 10
        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            
            response = await self._client.post(
                "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
                headers={"Authorization": f"Bearer {settings.huggingface_api_key}" if settings.huggingface_api_key else ""},
                json={"inputs": batch, "options":{"wait_for_model":True}},
            )
            
            if response.status_code == 200:
                embeddings = response.json()
                if isinstance(embeddings[0], list):
                    all_embeddings.extend(embeddings)
                else:
                    all_embeddings.append(embeddings)
            else:
                # Fallback to zeros if API fails
                all_embeddings.extend([[0.0] * 384 for _ in batch])

        return all_embeddings

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed_texts([text])
        return results[0] if results else [0.0] * 384
