"""
Plain text and markdown document extractor.
"""
import logging
from typing import List
from .base import BaseExtractor, ExtractedDocument

logger = logging.getLogger(__name__)


class TextExtractor(BaseExtractor):
    """
    Extract text from plain text files.
    Supports TXT, MD, RST, and other text-based formats.
    """
    
    def __init__(self, default_encoding: str = "utf-8"):
        self.default_encoding = default_encoding
    
    def supported_extensions(self) -> List[str]:
        return [
            ".txt", ".TXT",
            ".md", ".MD", ".markdown",
            ".rst", ".RST",
            ".csv", ".CSV",
            ".json", ".JSON",
            ".yaml", ".yml", ".YAML", ".YML",
            ".xml", ".XML",
            ".html", ".htm", ".HTML", ".HTM",
            ".log", ".LOG",
            ".py", ".js", ".ts", ".jsx", ".tsx",  # Source code
            ".sh", ".bash",
            ".sql", ".SQL",
        ]
    
    async def extract(self, file_bytes: bytes, filename: str) -> ExtractedDocument:
        ext = self._get_extension(filename).lower()
        
        # Handle HTML specially - strip tags
        if ext in [".html", ".htm"]:
            return await self._extract_html(file_bytes, filename)
        
        # Try to decode with common encodings
        content = self._decode_bytes(file_bytes)
        
        return ExtractedDocument(
            content=content,
            metadata={"filename": filename, "type": ext.lstrip(".")}
        )
    
    def _decode_bytes(self, file_bytes: bytes) -> str:
        """Attempt to decode bytes with various encodings."""
        encodings = [self.default_encoding, "utf-8", "latin-1", "cp1252"]
        
        for encoding in encodings:
            try:
                return file_bytes.decode(encoding)
            except (UnicodeDecodeError, LookupError):
                continue
        
        # Last resort: decode with errors replaced
        return file_bytes.decode("utf-8", errors="replace")
    
    async def _extract_html(self, file_bytes: bytes, filename: str) -> ExtractedDocument:
        """Extract text from HTML, stripping tags."""
        try:
            from bs4 import BeautifulSoup
            
            content = self._decode_bytes(file_bytes)
            soup = BeautifulSoup(content, "html.parser")
            
            # Remove script and style elements
            for element in soup(["script", "style", "head", "meta", "link"]):
                element.decompose()
            
            # Get text with some structure preserved
            text = soup.get_text(separator="\n", strip=True)
            
            return ExtractedDocument(
                content=text,
                metadata={"filename": filename, "type": "html"}
            )
            
        except ImportError:
            logger.warning("BeautifulSoup not available, returning raw HTML")
            content = self._decode_bytes(file_bytes)
            return ExtractedDocument(
                content=content,
                metadata={"filename": filename, "type": "html", "raw": True}
            )
