import logging

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class LocalEmbeddingService:
    _model: SentenceTransformer | None = None

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            LocalEmbeddingService._model = SentenceTransformer(
                "sentence-transformers/all-MiniLM-L6-v2"
            )
        return self._model

    def embed_text(self, text: str) -> list[float]:
        model = self._get_model()
        embedding = model.encode(text)
        return embedding.tolist()

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        model = self._get_model()
        embeddings = model.encode(texts)
        return [e.tolist() for e in embeddings]
