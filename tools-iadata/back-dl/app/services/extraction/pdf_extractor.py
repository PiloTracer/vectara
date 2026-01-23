"""
PDF document extractor with optional OCR support.
Uses PyMuPDF for text extraction and Tesseract for OCR fallback.
"""
import logging
from typing import List
from .base import BaseExtractor, ExtractedDocument

logger = logging.getLogger(__name__)


class PDFExtractor(BaseExtractor):
    """
    Extract text from PDF documents.
    Falls back to OCR if text extraction yields little content.
    """
    
    def __init__(self, use_ocr: bool = True, ocr_threshold: int = 50):
        """
        Args:
            use_ocr: Whether to use OCR for image-based PDFs
            ocr_threshold: Minimum characters per page before triggering OCR
        """
        self.use_ocr = use_ocr
        self.ocr_threshold = ocr_threshold
    
    def supported_extensions(self) -> List[str]:
        return [".pdf", ".PDF"]
    
    async def extract(self, file_bytes: bytes, filename: str) -> ExtractedDocument:
        try:
            import fitz  # PyMuPDF
        except ImportError:
            raise ImportError("PyMuPDF (fitz) is required for PDF extraction. Install with: pip install pymupdf")
        
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_parts = []
        ocr_used = False
        
        for page_num, page in enumerate(doc):
            text = page.get_text()
            
            # If page has very little text and OCR is enabled, try OCR
            if self.use_ocr and len(text.strip()) < self.ocr_threshold:
                ocr_text = self._ocr_page(page)
                if ocr_text and len(ocr_text.strip()) > len(text.strip()):
                    text = ocr_text
                    ocr_used = True
                    logger.debug(f"Used OCR for page {page_num + 1}")
            
            text_parts.append(text)
        
        content = "\n\n".join(text_parts)
        
        # Extract metadata
        metadata = {
            "filename": filename,
            "type": "pdf",
            "ocr_used": ocr_used,
        }
        
        # Try to get PDF metadata
        try:
            pdf_metadata = doc.metadata
            if pdf_metadata:
                if pdf_metadata.get("title"):
                    metadata["title"] = pdf_metadata["title"]
                if pdf_metadata.get("author"):
                    metadata["author"] = pdf_metadata["author"]
        except Exception:
            pass
        
        doc.close()
        
        return ExtractedDocument(
            content=content.strip(),
            metadata=metadata,
            pages=len(doc)
        )
    
    def _ocr_page(self, page) -> str:
        """Perform OCR on a PDF page."""
        try:
            import pytesseract
            from PIL import Image
            import io
            
            # Render page to image at 150 DPI (balance quality/speed)
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            
            # Run OCR
            text = pytesseract.image_to_string(img)
            return text
            
        except ImportError:
            logger.warning("pytesseract or PIL not available for OCR")
            return ""
        except Exception as e:
            logger.warning(f"OCR failed: {e}")
            return ""
