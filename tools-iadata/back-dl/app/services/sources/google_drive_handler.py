"""
Google Drive source handler.
Uses Google Drive API v3 for file listing and download.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from .base import BaseSourceHandler, FileInfo

logger = logging.getLogger(__name__)


class GoogleDriveHandler(BaseSourceHandler):
    """
    Handler for Google Drive data sources.
    Requires OAuth credentials stored in the source config.
    """
    
    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
    
    # Google Workspace MIME types that need export
    EXPORT_MAP = {
        'application/vnd.google-apps.document': ('application/pdf', '.pdf'),
        'application/vnd.google-apps.spreadsheet': (
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
            '.xlsx'
        ),
        'application/vnd.google-apps.presentation': (
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.pptx'
        ),
        'application/vnd.google-apps.drawing': ('image/png', '.png'),
    }
    
    # MIME types that cannot be downloaded
    SKIP_MIME_TYPES = {
        'application/vnd.google-apps.folder',
        'application/vnd.google-apps.shortcut',
        'application/vnd.google-apps.form',
        'application/vnd.google-apps.map',
        'application/vnd.google-apps.site',
    }
    
    def __init__(self, credentials: Dict[str, Any], folder_id: str = "root"):
        """
        Args:
            credentials: OAuth credentials dict (from JSON)
            folder_id: Root folder ID to start from (default: 'root')
        """
        self.credentials_data = credentials
        self.folder_id = folder_id
        self.service = None
    
    async def authenticate(self) -> bool:
        """Initialize the Google Drive API client."""
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            
            creds = Credentials.from_authorized_user_info(
                self.credentials_data, 
                self.SCOPES
            )
            
            self.service = build('drive', 'v3', credentials=creds)
            
            # Test the connection
            self.service.files().get(fileId=self.folder_id).execute()
            return True
            
        except Exception as e:
            logger.error(f"Google Drive authentication failed: {e}")
            return False
    
    async def list_files(self, path: str = "") -> List[FileInfo]:
        """
        List files in a folder.
        
        Args:
            path: Folder ID to list (empty = use configured folder_id)
        """
        if not self.service:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        
        folder_id = path if path else self.folder_id
        results = []
        page_token = None
        
        while True:
            response = self.service.files().list(
                q=f"'{folder_id}' in parents and trashed=false",
                spaces='drive',
                fields='nextPageToken, files(id, name, mimeType, size, modifiedTime)',
                pageToken=page_token,
                pageSize=100
            ).execute()
            
            for file in response.get('files', []):
                mime_type = file.get('mimeType', '')
                
                # Skip unsupported types
                if mime_type in self.SKIP_MIME_TYPES:
                    continue
                
                is_folder = mime_type == 'application/vnd.google-apps.folder'
                
                results.append(FileInfo(
                    id=file['id'],
                    name=file['name'],
                    path=file['id'],  # Use ID as path for Drive
                    mime_type=mime_type,
                    size=int(file.get('size', 0)),
                    modified=self._parse_datetime(file.get('modifiedTime')),
                    is_directory=is_folder
                ))
            
            page_token = response.get('nextPageToken')
            if not page_token:
                break
        
        return results
    
    async def download_file(self, file_info: FileInfo) -> bytes:
        """Download a file's content."""
        if not self.service:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        
        import io
        from googleapiclient.http import MediaIoBaseDownload
        
        mime_type = file_info.mime_type or ''
        
        # Check if this is a Google Workspace file that needs export
        if mime_type in self.EXPORT_MAP:
            export_mime, _ = self.EXPORT_MAP[mime_type]
            request = self.service.files().export_media(
                fileId=file_info.id,
                mimeType=export_mime
            )
        else:
            request = self.service.files().get_media(fileId=file_info.id)
        
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        
        done = False
        while not done:
            _, done = downloader.next_chunk()
        
        return buffer.getvalue()
    
    async def close(self) -> None:
        """Clean up."""
        self.service = None
    
    def _parse_datetime(self, dt_string: Optional[str]) -> Optional[datetime]:
        """Parse Google's datetime format."""
        if not dt_string:
            return None
        try:
            # Google uses ISO 8601 format with Z suffix
            return datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        except ValueError:
            return None
