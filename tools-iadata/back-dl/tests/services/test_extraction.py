"""
Tests for document extraction services.
"""
import pytest
from pathlib import Path
from io import BytesIO
import sys

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.extraction import (
    BaseExtractor,
    ExtractedDocument,
    ExtractorRegistry,
    PDFExtractor,
    OfficeExtractor,
    TextExtractor,
    ImageExtractor,
)


class TestExtractedDocument:
    """Tests for ExtractedDocument dataclass."""
    
    def test_create_document(self):
        """Test creating an ExtractedDocument."""
        doc = ExtractedDocument(
            content="Test content",
            metadata={"source": "test.txt", "type": "text"}
        )
        assert doc.content == "Test content"
        assert doc.metadata["source"] == "test.txt"
    
    def test_empty_document(self):
        """Test creating an empty document."""
        doc = ExtractedDocument(content="", metadata={})
        assert doc.content == ""
        assert doc.metadata == {}


class TestExtractorRegistry:
    """Tests for ExtractorRegistry."""
    
    def test_pdf_extractor_registered(self):
        """Test PDFExtractor is registered for .pdf."""
        extractor = ExtractorRegistry.get_extractor(".pdf")
        assert extractor is not None
        assert isinstance(extractor, PDFExtractor)
    
    def test_office_extractors_registered(self):
        """Test Office extractors are registered."""
        docx = ExtractorRegistry.get_extractor(".docx")
        xlsx = ExtractorRegistry.get_extractor(".xlsx")
        pptx = ExtractorRegistry.get_extractor(".pptx")
        
        assert isinstance(docx, OfficeExtractor)
        assert isinstance(xlsx, OfficeExtractor)
        assert isinstance(pptx, OfficeExtractor)
    
    def test_text_extractors_registered(self):
        """Test TextExtractor is registered for text files."""
        txt = ExtractorRegistry.get_extractor(".txt")
        md = ExtractorRegistry.get_extractor(".md")
        html = ExtractorRegistry.get_extractor(".html")
        
        assert isinstance(txt, TextExtractor)
        assert isinstance(md, TextExtractor)
        assert isinstance(html, TextExtractor)
    
    def test_image_extractors_registered(self):
        """Test ImageExtractor is registered for image files."""
        png = ExtractorRegistry.get_extractor(".png")
        jpg = ExtractorRegistry.get_extractor(".jpg")
        
        assert isinstance(png, ImageExtractor)
        assert isinstance(jpg, ImageExtractor)
    
    def test_unknown_extension(self):
        """Test unknown extension returns None."""
        extractor = ExtractorRegistry.get_extractor(".unknown")
        assert extractor is None


class TestTextExtractor:
    """Tests for TextExtractor."""
    
    @pytest.fixture
    def extractor(self):
        return TextExtractor()
    
    @pytest.mark.asyncio
    async def test_extract_text_from_bytes(self, extractor, tmp_path, sample_text):
        """Test extracting text from bytes content."""
        file_path = tmp_path / "test.txt"
        file_path.write_text(sample_text)
        
        result = await extractor.extract(file_path)
        
        assert sample_text in result.content
        assert result.metadata["type"] == "text"
    
    @pytest.mark.asyncio
    async def test_extract_html(self, extractor, tmp_path, sample_html):
        """Test extracting text from HTML."""
        file_path = tmp_path / "test.html"
        file_path.write_text(sample_html)
        
        result = await extractor.extract(file_path)
        
        assert "Test Heading" in result.content
        assert "This is a paragraph" in result.content
        assert "console.log" not in result.content  # Script should be removed
    
    @pytest.mark.asyncio
    async def test_supported_extensions(self, extractor):
        """Test supported extensions."""
        assert ".txt" in extractor.supported_extensions
        assert ".md" in extractor.supported_extensions
        assert ".html" in extractor.supported_extensions
        assert ".py" in extractor.supported_extensions


class TestPDFExtractor:
    """Tests for PDFExtractor."""
    
    @pytest.fixture
    def extractor(self):
        return PDFExtractor()
    
    def test_supported_extensions(self, extractor):
        """Test PDF extractor only supports .pdf."""
        assert ".pdf" in extractor.supported_extensions
        assert len(extractor.supported_extensions) == 1
    
    @pytest.mark.asyncio
    async def test_extract_missing_file(self, extractor, tmp_path):
        """Test handling of missing file."""
        result = await extractor.extract(tmp_path / "nonexistent.pdf")
        
        assert result.content == ""
        assert "error" in result.metadata


class TestOfficeExtractor:
    """Tests for OfficeExtractor."""
    
    @pytest.fixture
    def extractor(self):
        return OfficeExtractor()
    
    def test_supported_extensions(self, extractor):
        """Test Office extractor supports DOCX, XLSX, PPTX."""
        assert ".docx" in extractor.supported_extensions
        assert ".xlsx" in extractor.supported_extensions
        assert ".pptx" in extractor.supported_extensions


class TestImageExtractor:
    """Tests for ImageExtractor."""
    
    @pytest.fixture
    def extractor(self):
        return ImageExtractor()
    
    def test_supported_extensions(self, extractor):
        """Test Image extractor supports common formats."""
        assert ".png" in extractor.supported_extensions
        assert ".jpg" in extractor.supported_extensions
        assert ".jpeg" in extractor.supported_extensions
        assert ".tiff" in extractor.supported_extensions
        assert ".webp" in extractor.supported_extensions
