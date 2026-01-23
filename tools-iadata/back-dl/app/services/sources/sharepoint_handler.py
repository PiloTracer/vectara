"""
Microsoft SharePoint source handler.
Uses Microsoft Graph API for file listing and download.
Implements App-Only authentication (client credentials flow).
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from .base import BaseSourceHandler, FileInfo

logger = logging.getLogger(__name__)


class SharePointHandler(BaseSourceHandler):
    """
    Handler for SharePoint Online data sources.
    Uses App-Only (client credentials) authentication via MSAL.
    """
    
    GRAPH_API = "https://graph.microsoft.com/v1.0"
    
    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        site_url: str,
        folder_path: str = ""
    ):
        """
        Args:
            tenant_id: Azure AD tenant ID
            client_id: App registration client ID
            client_secret: App registration client secret
            site_url: SharePoint site URL (e.g., 'contoso.sharepoint.com:/sites/team')
            folder_path: Path within the site's document library (optional)
        """
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.site_url = site_url
        self.folder_path = folder_path
        
        self.site_id: Optional[str] = None
        self.drive_id: Optional[str] = None
        self._token: Optional[str] = None
    
    async def authenticate(self) -> bool:
        """Authenticate using MSAL and get site/drive IDs."""
        try:
            from msal import ConfidentialClientApplication
            
            app = ConfidentialClientApplication(
                self.client_id,
                authority=f"https://login.microsoftonline.com/{self.tenant_id}",
                client_credential=self.client_secret
            )
            
            result = app.acquire_token_for_client(
                scopes=["https://graph.microsoft.com/.default"]
            )
            
            if "access_token" not in result:
                logger.error(f"MSAL auth failed: {result.get('error_description')}")
                return False
            
            self._token = result["access_token"]
            
            # Get site ID
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.GRAPH_API}/sites/{self.site_url}",
                    headers={"Authorization": f"Bearer {self._token}"}
                )
                
                if resp.status_code != 200:
                    logger.error(f"Failed to get site: {resp.text}")
                    return False
                
                site_data = resp.json()
                self.site_id = site_data["id"]
                
                # Get default drive ID
                resp = await client.get(
                    f"{self.GRAPH_API}/sites/{self.site_id}/drive",
                    headers={"Authorization": f"Bearer {self._token}"}
                )
                
                if resp.status_code == 200:
                    self.drive_id = resp.json()["id"]
            
            return True
            
        except ImportError:
            logger.error("MSAL library required. Install with: pip install msal")
            return False
        except Exception as e:
            logger.error(f"SharePoint authentication failed: {e}")
            return False
    
    async def list_files(self, path: str = "") -> List[FileInfo]:
        """List files in a folder."""
        if not self._token or not self.site_id:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        
        import httpx
        
        # Determine the path to query
        folder_path = path if path else self.folder_path
        
        if folder_path:
            url = f"{self.GRAPH_API}/sites/{self.site_id}/drive/root:/{folder_path}:/children"
        else:
            url = f"{self.GRAPH_API}/sites/{self.site_id}/drive/root/children"
        
        results = []
        
        async with httpx.AsyncClient() as client:
            while url:
                resp = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self._token}"}
                )
                
                if resp.status_code != 200:
                    logger.error(f"Failed to list files: {resp.text}")
                    break
                
                data = resp.json()
                
                for item in data.get('value', []):
                    is_folder = 'folder' in item
                    
                    # Build path
                    parent_ref = item.get('parentReference', {})
                    parent_path = parent_ref.get('path', '').split('root:')[-1].lstrip('/')
                    item_path = f"{parent_path}/{item['name']}" if parent_path else item['name']
                    
                    results.append(FileInfo(
                        id=item['id'],
                        name=item['name'],
                        path=item_path,
                        mime_type=item.get('file', {}).get('mimeType'),
                        size=item.get('size', 0),
                        modified=self._parse_datetime(item.get('lastModifiedDateTime')),
                        is_directory=is_folder
                    ))
                
                # Handle pagination
                url = data.get('@odata.nextLink')
        
        return results
    
    async def download_file(self, file_info: FileInfo) -> bytes:
        """Download a file's content."""
        if not self._token or not self.site_id:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        
        import httpx
        
        async with httpx.AsyncClient() as client:
            # Get download URL
            resp = await client.get(
                f"{self.GRAPH_API}/sites/{self.site_id}/drive/items/{file_info.id}/content",
                headers={"Authorization": f"Bearer {self._token}"},
                follow_redirects=True
            )
            
            if resp.status_code != 200:
                raise Exception(f"Download failed: {resp.status_code} - {resp.text}")
            
            return resp.content
    
    async def close(self) -> None:
        """Clean up."""
        self._token = None
        self.site_id = None
        self.drive_id = None
    
    def _parse_datetime(self, dt_string: Optional[str]) -> Optional[datetime]:
        """Parse Microsoft's datetime format."""
        if not dt_string:
            return None
        try:
            return datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        except ValueError:
            return None
