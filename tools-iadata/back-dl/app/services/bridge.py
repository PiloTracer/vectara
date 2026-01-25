import httpx
import logging
from typing import List, Dict, Optional, Generator, Union
import os
import base64

logger = logging.getLogger(__name__)

class FileBridgeClient:
    def __init__(self, base_url: str = "http://host.docker.internal:3737/api"):
        self.base_url = base_url.rstrip("/")
        # In a real scenario, use a shared single client or context manager
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.client.aclose()

    async def list_directory(self, path_id: str, relative_path: Optional[str] = None) -> List[Dict]:
        """
        List files in a directory via the bridge.
        """
        url = f"{self.base_url}/file/list"
        payload = {
            "path_id": path_id,
            "relative_path": relative_path
        }
        
        try:
            resp = await self.client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            
            if not data.get("success"):
                raise Exception(data.get("error", "Unknown error from bridge"))
                
            return data.get("files", [])
        except Exception as e:
            logger.error(f"Bridge list_directory failed: {e}")
            raise

    async def read_file(self, path_id: str, relative_path: str) -> bytes:
        """
        Read file content via the bridge. Returns bytes (binary content).
        """
        url = f"{self.base_url}/file/read"
        payload = {
            "path_id": path_id,
            "relative_path": relative_path
        }
        
        try:
            resp = await self.client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            
            if not data.get("success"):
                raise Exception(data.get("error", "Unknown error from bridge"))
            
            content = data.get("content", "")
            is_binary = data.get("is_binary", False)
            
            if is_binary:
                # Decode base64 for binary files
                return base64.b64decode(content)
            else:
                # Text files - encode to bytes
                return content.encode("utf-8")
        except Exception as e:
            logger.error(f"Bridge read_file failed: {e}")
            raise

    async def walk(self, path_id: str, base_relative: str = "") -> List[Dict]:
        """
        Recursively list all files. A helper that mimics os.walk but returns a flat list of files.
        """
        all_files = []
        try:
            entries = await self.list_directory(path_id, base_relative)
            
            for entry in entries:
                rel_path = os.path.join(base_relative, entry["name"]) if base_relative else entry["name"]
                
                if entry["is_dir"]:
                    # Recurse
                    sub_files = await self.walk(path_id, rel_path)
                    all_files.extend(sub_files)
                else:
                    entry["relative_path"] = rel_path
                    all_files.append(entry)
                    
            return all_files
        except Exception as e:
            logger.error(f"Bridge walk failed at {base_relative}: {e}")
            # Decide whether to partial fail or full fail. partial fail is better for traversal.
            return all_files
