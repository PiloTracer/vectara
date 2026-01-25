"""
Base classes for document extraction.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import mimetypes


@dataclass
class ExtractedDocument:
    """Result of document extraction."""
    content: str
    metadata: Dict = field(default_factory=dict)
    pages: Optional[int] = None
    word_count: Optional[int] = None
    language: Optional[str] = None
    
    def __post_init__(self):
        if self.word_count is None and self.content:
            self.word_count = len(self.content.split())


class BaseExtractor(ABC):
    """Abstract base class for document extractors."""
    
    @abstractmethod
    async def extract(self, file_bytes: bytes, filename: str) -> ExtractedDocument:
        """
        Extract text content from a document.
        
        Args:
            file_bytes: Raw file content
            filename: Original filename (used for extension detection)
            
        Returns:
            ExtractedDocument with content and metadata
        """
        pass
    
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """Return list of supported file extensions (e.g., ['.pdf', '.PDF'])."""
        pass
    
    def can_handle(self, filename: str) -> bool:
        """Check if this extractor can handle the given file."""
        ext = self._get_extension(filename)
        return ext.lower() in [e.lower() for e in self.supported_extensions()]
    
    def _get_extension(self, filename: str) -> str:
        """Extract file extension from filename."""
        if '.' in filename:
            return '.' + filename.rsplit('.', 1)[-1]
        return ''
    
    def _get_mime_type(self, filename: str) -> Optional[str]:
        """Get MIME type from filename."""
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type


class ExtractorRegistry:
    """
    Registry for document extractors.
    Provides automatic extractor selection based on file type.
    """
    _extractors: List[BaseExtractor] = []
    
    @classmethod
    def register(cls, extractor: BaseExtractor) -> None:
        """Register an extractor instance."""
        cls._extractors.append(extractor)
    
    @classmethod
    def get_extractor(cls, filename: str) -> Optional[BaseExtractor]:
        """Get the appropriate extractor for a file."""
        for extractor in cls._extractors:
            if extractor.can_handle(filename):
                return extractor
        return None
    
    @classmethod
    async def extract(cls, file_bytes: bytes, filename: str) -> Optional[ExtractedDocument]:
        """Extract content from a file using the appropriate extractor."""
        extractor = cls.get_extractor(filename)
        if extractor:
            return await extractor.extract(file_bytes, filename)
        return None
    
    @classmethod
    def supported_extensions(cls) -> List[str]:
        """Get all supported extensions across all extractors."""
        extensions = []
        for extractor in cls._extractors:
            extensions.extend(extractor.supported_extensions())
        return list(set(extensions))
