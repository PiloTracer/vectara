"""
OCR Service using HuggingFace LightOnOCR model.

Uses the LightOnOCR-2-1B vision-language model for high-quality OCR.
Falls back to Tesseract if the model is unavailable or disabled.

Configuration:
    USE_LOCAL_OCR: Enable/disable LLM-based OCR (default: false)
    LOCAL_OCR_MODEL_NAME: HuggingFace model ID (e.g., "lightonai/LightOnOCR-2-1B")
"""
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class OCRService:
    """
    LLM-based OCR using LightOnOCR from HuggingFace.
    Downloads model automatically on first use.
    Falls back to Tesseract if unavailable.
    """
    
    _model = None
    _processor = None
    _load_attempted = False
    
    def __init__(self):
        self.enabled = settings.USE_LOCAL_OCR and bool(settings.LOCAL_OCR_MODEL_NAME)
        self.model_name = settings.LOCAL_OCR_MODEL_NAME
        
    async def ensure_model_available(self) -> bool:
        """
        Load model from HuggingFace (downloads on first use).
        Model is cached after first load.
        """
        if not self.enabled:
            logger.info("OCR Service disabled - using Tesseract fallback")
            return True
            
        if OCRService._load_attempted:
            return OCRService._model is not None
            
        OCRService._load_attempted = True
        
        try:
            from transformers import AutoProcessor, AutoModelForVision2Seq
            
            logger.info(f"Loading OCR model '{self.model_name}' from HuggingFace...")
            logger.info("This may take several minutes on first run (downloading ~1GB model)...")
            
            OCRService._processor = AutoProcessor.from_pretrained(self.model_name)
            OCRService._model = AutoModelForVision2Seq.from_pretrained(self.model_name)
            
            logger.info(f"OCR model '{self.model_name}' loaded successfully.")
            return True
            
        except ImportError:
            logger.error("transformers library not installed. Run: pip install transformers")
            return False
        except Exception as e:
            logger.error(f"Failed to load OCR model: {e}")
            return False

    async def extract_text(self, image_bytes: bytes) -> Optional[str]:
        """
        Extract text from image using LightOnOCR.
        
        Args:
            image_bytes: Raw bytes of the image file.
            
        Returns:
            Extracted text string, or None to signal fallback to Tesseract.
        """
        if not self.enabled:
            return None
            
        if OCRService._model is None or OCRService._processor is None:
            # Try loading if not already attempted
            if not OCRService._load_attempted:
                await self.ensure_model_available()
            if OCRService._model is None:
                return None
        
        try:
            from PIL import Image
            import io
            
            # Load image
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Process image
            inputs = OCRService._processor(images=image, return_tensors="pt")
            
            # Generate text
            generated_ids = OCRService._model.generate(**inputs, max_new_tokens=2048)
            text = OCRService._processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            result = text.strip()
            if result:
                logger.debug(f"OCR extracted {len(result)} characters")
            return result
            
        except Exception as e:
            logger.warning(f"OCR extraction failed, falling back to Tesseract: {e}")
            return None
