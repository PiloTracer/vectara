"""
Image extractor using Tesseract OCR.
Handles common image formats (PNG, JPG, TIFF, BMP, GIF, WebP).
"""
import logging
from pathlib import Path
from typing import Optional
from .base import BaseExtractor, ExtractedDocument, ExtractorRegistry

logger = logging.getLogger(__name__)


class ImageExtractor(BaseExtractor):
    """
    Extractor for image files using Tesseract OCR.
    """
    
    SUPPORTED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp'}
    
    def __init__(self, lang: str = "eng+spa"):
        """
        Args:
            lang: Tesseract language codes (default: English + Spanish)
        """
        self.lang = lang
        self._tesseract_available: Optional[bool] = None
    
    @property
    def supported_extensions(self) -> set:
        return self.SUPPORTED_EXTENSIONS
    
    def _check_tesseract(self) -> bool:
        """Check if Tesseract is available."""
        if self._tesseract_available is not None:
            return self._tesseract_available
        
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self._tesseract_available = True
        except Exception:
            self._tesseract_available = False
            logger.warning("Tesseract OCR is not available")
        
        return self._tesseract_available
    
    async def extract(self, file_path: Path, content: Optional[bytes] = None) -> ExtractedDocument:
        """
        Extract text from an image using OCR.
        
        Strategy:
            1. Try LLM-based OCR first (if enabled) for high-quality extraction
            2. Fall back to Tesseract OCR if LLM unavailable or fails
        
        Args:
            file_path: Path to the image file
            content: Optional pre-loaded image bytes
            
        Returns:
            ExtractedDocument with OCR text
        """
        from PIL import Image
        import io
        
        # Load image bytes if not provided
        if content is None:
            with open(file_path, 'rb') as f:
                content = f.read()
        
        # 1. Try LLM-based OCR first
        try:
            from app.services.ocr_service import OCRService
            ocr_service = OCRService()
            llm_text = await ocr_service.extract_text(content)
            
            if llm_text:
                # LLM OCR succeeded
                image = Image.open(io.BytesIO(content))
                width, height = image.size
                
                return ExtractedDocument(
                    content=llm_text,
                    metadata={
                        "source": str(file_path),
                        "type": "image",
                        "format": image.format or file_path.suffix.upper().lstrip('.'),
                        "dimensions": f"{width}x{height}",
                        "ocr_method": "llm_vision"
                    }
                )
        except Exception as e:
            logger.debug(f"LLM OCR not available, using Tesseract: {e}")
        
        # 2. Fall back to Tesseract
        if not self._check_tesseract():
            return ExtractedDocument(
                content="",
                metadata={
                    "source": str(file_path),
                    "type": "image",
                    "error": "No OCR method available"
                }
            )
        
        try:
            import pytesseract
            
            image = Image.open(io.BytesIO(content))
            
            # Convert to RGB if necessary (for RGBA/P mode images)
            if image.mode in ('RGBA', 'P'):
                image = image.convert('RGB')
            
            # Perform Tesseract OCR
            text = pytesseract.image_to_string(image, lang=self.lang)
            
            # Get image metadata
            width, height = image.size
            
            return ExtractedDocument(
                content=text.strip(),
                metadata={
                    "source": str(file_path),
                    "type": "image",
                    "format": image.format or file_path.suffix.upper().lstrip('.'),
                    "dimensions": f"{width}x{height}",
                    "mode": image.mode,
                    "ocr_method": "tesseract",
                    "ocr_language": self.lang
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to extract text from image {file_path}: {e}")
            return ExtractedDocument(
                content="",
                metadata={
                    "source": str(file_path),
                    "type": "image",
                    "error": str(e)
                }
            )



