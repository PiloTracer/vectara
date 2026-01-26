# Document Extraction Services
from .base import BaseExtractor, ExtractedDocument, ExtractorRegistry
from .pdf_extractor import PDFExtractor
from .office_extractor import OfficeExtractor
from .text_extractor import TextExtractor
from .image_extractor import ImageExtractor
from .rtf_extractor import RTFExtractor

__all__ = [
    "BaseExtractor",
    "ExtractedDocument",
    "ExtractorRegistry",
    "PDFExtractor",
    "OfficeExtractor", 
    "TextExtractor",
    "ImageExtractor",
    "RTFExtractor",
]

# Register Extractors
ExtractorRegistry.register(PDFExtractor())
ExtractorRegistry.register(OfficeExtractor())
ExtractorRegistry.register(TextExtractor())
ExtractorRegistry.register(ImageExtractor())
ExtractorRegistry.register(RTFExtractor())
