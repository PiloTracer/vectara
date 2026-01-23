"""
Tests for source handlers.
"""
import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.sources import (
    BaseSourceHandler,
    FileInfo,
    LocalSourceHandler,
    GoogleDriveHandler,
    SharePointHandler,
)


class TestFileInfo:
    """Tests for FileInfo dataclass."""
    
    def test_create_file_info(self):
        """Test creating a FileInfo."""
        info = FileInfo(
            id="123",
            name="test.pdf",
            path="/documents/test.pdf",
            mime_type="application/pdf",
            size=1024
        )
        assert info.id == "123"
        assert info.name == "test.pdf"
        assert info.extension == ".pdf"
    
    def test_extension_no_dot(self):
        """Test extension for file without extension."""
        info = FileInfo(id="1", name="README", path="/README")
        assert info.extension == ""
    
    def test_directory_file_info(self):
        """Test directory FileInfo."""
        info = FileInfo(
            id="dir1",
            name="Documents",
            path="/Documents",
            is_directory=True
        )
        assert info.is_directory is True


class TestLocalSourceHandler:
    """Tests for LocalSourceHandler."""
    
    @pytest.fixture
    def handler(self, tmp_path):
        return LocalSourceHandler(str(tmp_path))
    
    @pytest.mark.asyncio
    async def test_authenticate_valid_path(self, handler, tmp_path):
        """Test authentication with valid directory."""
        result = await handler.authenticate()
        assert result is True
    
    @pytest.mark.asyncio
    async def test_authenticate_invalid_path(self, tmp_path):
        """Test authentication with non-existent directory."""
        handler = LocalSourceHandler("/nonexistent/path/12345")
        result = await handler.authenticate()
        assert result is False
    
    @pytest.mark.asyncio
    async def test_list_files_empty(self, handler):
        """Test listing empty directory."""
        files = await handler.list_files()
        assert files == []
    
    @pytest.mark.asyncio
    async def test_list_files_with_content(self, tmp_path):
        """Test listing directory with files."""
        # Create test files
        (tmp_path / "file1.txt").write_text("content1")
        (tmp_path / "file2.pdf").write_bytes(b"pdf content")
        (tmp_path / "subdir").mkdir()
        
        handler = LocalSourceHandler(str(tmp_path))
        files = await handler.list_files()
        
        assert len(files) == 3
        
        names = {f.name for f in files}
        assert "file1.txt" in names
        assert "file2.pdf" in names
        assert "subdir" in names
    
    @pytest.mark.asyncio
    async def test_download_file(self, tmp_path):
        """Test downloading file content."""
        test_content = b"Hello, World!"
        (tmp_path / "test.txt").write_bytes(test_content)
        
        handler = LocalSourceHandler(str(tmp_path))
        files = await handler.list_files()
        
        file_info = next(f for f in files if f.name == "test.txt")
        content = await handler.download_file(file_info)
        
        assert content == test_content
    
    @pytest.mark.asyncio
    async def test_walk_recursive(self, tmp_path):
        """Test recursive walking."""
        # Create nested structure
        (tmp_path / "doc1.txt").write_text("doc1")
        subdir = tmp_path / "subdir"
        subdir.mkdir()
        (subdir / "doc2.txt").write_text("doc2")
        
        handler = LocalSourceHandler(str(tmp_path))
        
        files = []
        async for f in handler.walk():
            files.append(f)
        
        assert len(files) == 2
        paths = {f.path for f in files}
        assert "doc1.txt" in paths
        assert "subdir/doc2.txt" in paths


class TestGoogleDriveHandler:
    """Tests for GoogleDriveHandler."""
    
    def test_export_map_defined(self):
        """Test Google Docs export map is configured."""
        assert 'application/vnd.google-apps.document' in GoogleDriveHandler.EXPORT_MAP
        assert 'application/vnd.google-apps.spreadsheet' in GoogleDriveHandler.EXPORT_MAP
        assert 'application/vnd.google-apps.presentation' in GoogleDriveHandler.EXPORT_MAP
    
    def test_skip_mime_types_defined(self):
        """Test unsupported MIME types are configured."""
        assert 'application/vnd.google-apps.folder' in GoogleDriveHandler.SKIP_MIME_TYPES
        assert 'application/vnd.google-apps.shortcut' in GoogleDriveHandler.SKIP_MIME_TYPES


class TestSharePointHandler:
    """Tests for SharePointHandler."""
    
    def test_graph_api_url(self):
        """Test Graph API URL is correctly set."""
        assert SharePointHandler.GRAPH_API == "https://graph.microsoft.com/v1.0"
    
    def test_handler_initialization(self):
        """Test handler can be initialized with required params."""
        handler = SharePointHandler(
            tenant_id="test-tenant",
            client_id="test-client",
            client_secret="test-secret",
            site_url="contoso.sharepoint.com:/sites/test"
        )
        
        assert handler.tenant_id == "test-tenant"
        assert handler.client_id == "test-client"
        assert handler.site_url == "contoso.sharepoint.com:/sites/test"
        assert handler.folder_path == ""
