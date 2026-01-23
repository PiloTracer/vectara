"""
Base classes for data source handlers.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, AsyncIterator
from datetime import datetime


@dataclass
class FileInfo:
    """Information about a file in a data source."""
    id: str
    name: str
    path: str  # Relative path within the source
    mime_type: Optional[str] = None
    size: int = 0
    modified: Optional[datetime] = None
    is_directory: bool = False
    
    @property
    def extension(self) -> str:
        """Get file extension."""
        if '.' in self.name:
            return '.' + self.name.rsplit('.', 1)[-1]
        return ''


class BaseSourceHandler(ABC):
    """
    Abstract base class for data source handlers.
    Defines the interface for listing and downloading files from various sources.
    """
    
    @abstractmethod
    async def authenticate(self) -> bool:
        """
        Authenticate with the data source.
        Returns True if authentication succeeded.
        """
        pass
    
    @abstractmethod
    async def list_files(self, path: str = "") -> List[FileInfo]:
        """
        List files in a directory/folder.
        
        Args:
            path: Path within the source (empty for root)
            
        Returns:
            List of FileInfo objects
        """
        pass
    
    @abstractmethod
    async def download_file(self, file_info: FileInfo) -> bytes:
        """
        Download a file's content.
        
        Args:
            file_info: FileInfo object from list_files
            
        Returns:
            File content as bytes
        """
        pass
    
    async def walk(self, path: str = "") -> AsyncIterator[FileInfo]:
        """
        Recursively iterate through all files in the source.
        
        Args:
            path: Starting path (empty for root)
            
        Yields:
            FileInfo objects for each file (not directories)
        """
        items = await self.list_files(path)
        
        for item in items:
            if item.is_directory:
                # Recursively walk subdirectories
                async for sub_item in self.walk(item.path):
                    yield sub_item
            else:
                yield item
    
    async def close(self) -> None:
        """Clean up resources. Override if needed."""
        pass
