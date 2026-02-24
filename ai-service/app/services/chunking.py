import re
from dataclasses import dataclass
from pathlib import Path

import tiktoken

from app.core.config import settings


@dataclass
class TextChunk:
    content: str
    chunk_index: int
    token_count: int


class ChunkingService:
    def __init__(self) -> None:
        self._encoder = tiktoken.get_encoding("cl100k_base")

    def chunk_text(self, text: str) -> list[TextChunk]:
        text = self._clean_text(text)
        tokens = self._encoder.encode(text)

        chunks: list[TextChunk] = []
        start = 0
        index = 0

        while start < len(tokens):
            end = start + settings.chunk_size
            chunk_tokens = tokens[start:end]
            chunk_text = self._encoder.decode(chunk_tokens)

            chunks.append(
                TextChunk(
                    content=chunk_text.strip(),
                    chunk_index=index,
                    token_count=len(chunk_tokens),
                )
            )

            start += settings.chunk_size - settings.chunk_overlap
            index += 1

        return [c for c in chunks if c.content]

    def extract_text(self, file_path: str, mime_type: str) -> str:
        path = Path(file_path)

        extractors = {
            "text/plain": self._extract_txt,
            "text/markdown": self._extract_txt,
            "text/x-markdown": self._extract_txt,
            "application/pdf": self._extract_pdf,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": self._extract_docx,
        }

        extractor = extractors.get(mime_type)
        if extractor is None:
            raise ValueError(f"Unsupported mime type: {mime_type}")

        return extractor(path)

    def _extract_txt(self, path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="replace")

    def _extract_pdf(self, path: Path) -> str:
        import PyPDF2

        text_parts: list[str] = []

        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

        return "\n".join(text_parts)

    def _extract_docx(self, path: Path) -> str:
        from docx import Document

        doc = Document(str(path))
        return "\n".join(
            paragraph.text
            for paragraph in doc.paragraphs
            if paragraph.text.strip()
        )

    def _clean_text(self, text: str) -> str:
        text = re.sub(r"\r\n|\r", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]{2,}", " ", text)
        return text.strip()
