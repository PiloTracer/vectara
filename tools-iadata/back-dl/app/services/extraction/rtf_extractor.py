"""
Rich Text Format (RTF) document extractor.
Extracts plain text content from .rtf files.
"""
import logging
from typing import List
from .base import BaseExtractor, ExtractedDocument

logger = logging.getLogger(__name__)


class RTFExtractor(BaseExtractor):
    """
    Extract text from Rich Text Format (RTF) documents.
    Uses striprtf library to parse RTF and extract plain text.
    """
    
    def supported_extensions(self) -> List[str]:
        return [".rtf", ".RTF"]
    
    async def extract(self, file_bytes: bytes, filename: str) -> ExtractedDocument:
        try:
            from striprtf.striprtf import rtf_to_text
        except ImportError:
            raise ImportError("striprtf is required for RTF extraction. Install with: pip install striprtf")
        
        # Try to decode RTF content
        content = self._decode_bytes(file_bytes)
        
        # Extract plain text from RTF
        try:
            text = rtf_to_text(content)
        except Exception as e:
            logger.warning(f"RTF parsing failed for {filename}: {e}, attempting fallback")
            # Fallback: try to extract raw text between markers
            text = self._fallback_extract(content)
        
        return ExtractedDocument(
            content=text.strip(),
            metadata={"filename": filename, "type": "rtf"}
        )
    
    def _decode_bytes(self, file_bytes: bytes) -> str:
        """Attempt to decode bytes with various encodings common in RTF."""
        encodings = ["utf-8", "latin-1", "cp1252", "ascii"]
        
        for encoding in encodings:
            try:
                return file_bytes.decode(encoding)
            except (UnicodeDecodeError, LookupError):
                continue
        
        # Last resort: decode with errors replaced
        return file_bytes.decode("utf-8", errors="replace")
    
    def _fallback_extract(self, rtf_content: str) -> str:
        """
        Fallback extraction for malformed RTF.
        Attempts to extract readable text portions.
        """
        import re
        
        # Remove RTF control words and groups
        # This is a simplified fallback - won't handle complex RTF
        text = rtf_content
        
        # Remove {\..} groups
        text = re.sub(r'\{[^{}]*\}', '', text)
        
        # Remove RTF control words (\word or \word123)
        text = re.sub(r'\\[a-z]+\d*\s?', ' ', text)
        
        # Remove backslash escapes
        text = text.replace('\\\\', '\\').replace('\\{', '{').replace('\\}', '}')
        
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
