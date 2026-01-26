"""
OCR Service using HuggingFace LightOnOCR model.

Uses the LightOnOCR-2-1B vision-language model for high-quality OCR.
Falls back to Tesseract if the model is unavailable or disabled.

Configuration:
    USE_LOCAL_OCR: Enable/disable LLM-based OCR (default: false)
    LOCAL_OCR_MODEL_NAME: HuggingFace model ID (e.g., "lightonai/LightOnOCR-2-1B")
    
Requirements:
    pip install git+https://github.com/huggingface/transformers
    pip install pillow
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
    _device = None
    _dtype = None
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
            import torch
            from transformers import LightOnOcrForConditionalGeneration, LightOnOcrProcessor
            
            # Determine device and dtype
            if torch.cuda.is_available():
                OCRService._device = "cuda"
                OCRService._dtype = torch.bfloat16
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                OCRService._device = "mps"
                OCRService._dtype = torch.float32
            else:
                OCRService._device = "cpu"
                OCRService._dtype = torch.float32
            
            logger.info(f"Loading OCR model '{self.model_name}' from HuggingFace...")
            logger.info(f"Using device: {OCRService._device}, dtype: {OCRService._dtype}")
            logger.info("This may take several minutes on first run (downloading model)...")
            
            OCRService._model = LightOnOcrForConditionalGeneration.from_pretrained(
                self.model_name,
                torch_dtype=OCRService._dtype
            ).to(OCRService._device)
            
            OCRService._processor = LightOnOcrProcessor.from_pretrained(self.model_name)
            
            logger.info(f"OCR model '{self.model_name}' loaded successfully.")
            return True
            
        except ImportError as e:
            logger.error(f"LightOnOCR requires transformers from source. Run: pip install git+https://github.com/huggingface/transformers - Error: {e}")
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
            import torch
            from PIL import Image
            import io
            
            # Load image
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Create conversation format as required by LightOnOCR
            conversation = [{
                "role": "user",
                "content": [{"type": "image", "image": image}]
            }]
            
            # Process with apply_chat_template
            inputs = OCRService._processor.apply_chat_template(
                conversation,
                add_generation_prompt=True,
                tokenize=True,
                return_dict=True,
                return_tensors="pt",
            )
            
            # Move to device with proper dtype
            inputs = {
                k: v.to(device=OCRService._device, dtype=OCRService._dtype) 
                   if v.is_floating_point() else v.to(OCRService._device) 
                for k, v in inputs.items()
            }
            
            # Generate text
            with torch.no_grad():
                output_ids = OCRService._model.generate(**inputs, max_new_tokens=2048)
            
            # Extract only the generated part (exclude input tokens)
            generated_ids = output_ids[0, inputs["input_ids"].shape[1]:]
            text = OCRService._processor.decode(generated_ids, skip_special_tokens=True)
            
            result = text.strip()
            if result:
                logger.debug(f"OCR extracted {len(result)} characters")
            return result
            
        except Exception as e:
            logger.warning(f"OCR extraction failed, falling back to Tesseract: {e}")
            return None
