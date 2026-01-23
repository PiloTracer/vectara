"""
Local filesystem source handler.
Handles LOCAL (Docker volume) and LOCAL_BRIDGE (Desktop app bridge) sources.
"""
import os
import logging
from typing import List, Optional
from datetime import datetime
from .base import BaseSourceHandler, FileInfo

logger = logging.getLogger(__name__)


class LocalSourceHandler(BaseSourceHandler):
    """
    Handler for local filesystem sources.
    Used for Docker volume-mounted directories.
    """
    
    def __init__(self, base_path: str):
        """
        Args:
            base_path: Absolute path to the source directory
        """
        self.base_path = os.path.abspath(base_path)
    
    async def authenticate(self) -> bool:
        """Check if the path exists and is readable."""
        return os.path.isdir(self.base_path) and os.access(self.base_path, os.R_OK)
    
    async def list_files(self, path: str = "") -> List[FileInfo]:
        """List files in a directory."""
        full_path = os.path.join(self.base_path, path) if path else self.base_path
        
        if not os.path.isdir(full_path):
            logger.warning(f"Path is not a directory: {full_path}")
            return []
        
        result = []
        try:
            for entry in os.scandir(full_path):
                try:
                    stat = entry.stat()
                    rel_path = os.path.join(path, entry.name) if path else entry.name
                    
                    result.append(FileInfo(
                        id=rel_path,  # Use relative path as ID
                        name=entry.name,
                        path=rel_path,
                        mime_type=self._guess_mime_type(entry.name),
                        size=stat.st_size if not entry.is_dir() else 0,
                        modified=datetime.fromtimestamp(stat.st_mtime),
                        is_directory=entry.is_dir()
                    ))
                except (OSError, PermissionError) as e:
                    logger.warning(f"Could not stat {entry.path}: {e}")
                    
        except (OSError, PermissionError) as e:
            logger.error(f"Could not list directory {full_path}: {e}")
            
        return result
    
    async def download_file(self, file_info: FileInfo) -> bytes:
        """Read file content."""
        full_path = os.path.join(self.base_path, file_info.path)
        
        with open(full_path, "rb") as f:
            return f.read()
    
    def _guess_mime_type(self, filename: str) -> Optional[str]:
        """Guess MIME type from filename."""
        import mimetypes
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type
