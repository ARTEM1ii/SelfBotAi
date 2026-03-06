import logging
from io import BytesIO

from PIL import Image
from sentence_transformers import SentenceTransformer

from app.core.config import settings

logger = logging.getLogger(__name__)


class CLIPService:
    _model: SentenceTransformer | None = None

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            CLIPService._model = SentenceTransformer(settings.clip_model_name)
        return self._model

    def embed_image(self, image_bytes: bytes) -> list[float]:
        model = self._get_model()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        embedding = model.encode(image)
        return embedding.tolist()

    def embed_text(self, text: str) -> list[float]:
        model = self._get_model()
        embedding = model.encode(text)
        return embedding.tolist()
