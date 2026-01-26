"""
Service for handling asynchronous ingestion tasks.
"""
import logging
import uuid
import os
import json
from datetime import datetime
from pathlib import Path
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models.resources import DataSource, SystemJob, OAuthToken
from app.services.extraction import ExtractorRegistry

logger = logging.getLogger(__name__)

async def process_ingestion_task(job_id: uuid.UUID, source_id: uuid.UUID):
    """
    Background task to process data source ingestion.
    Updates SystemJob status and progress.
    """
    # Initialize Services
    from app.services.embedding_service import EmbeddingService
    from app.services.vector_service import VectorService
    from app.services.chunking_service import ChunkingService
    
    embed_service = EmbeddingService()
    vector_service = VectorService()
    chunker = ChunkingService()
    
    # 0. Ensure Model & Collection (One-time check per job for simplicity)
    if embed_service.enabled:
        await embed_service.ensure_model_available()
        vector_service.ensure_collection()
        
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch Job and Source
            result = await db.execute(select(SystemJob).where(SystemJob.id == job_id))
            job = result.scalars().first()
            
            result = await db.execute(select(DataSource).where(DataSource.id == source_id))
            source = result.scalars().first()
            
            if not job or not source:
                logger.error(f"Job {job_id} or Source {source_id} not found")
                return

            # Update status to RUNNING
            job.status = "RUNNING"
            await db.commit()
            
            processed_files = []
            errors = []
            
            # 2. Perform Ingestion based on Type
            try:
                if source.type == "LOCAL":
                    from app.services.sources import LocalSourceHandler
                    
                    path = source.config.get("path", "")
                    handler = LocalSourceHandler(path)
                    
                    if not await handler.authenticate():
                        raise Exception(f"Cannot access path: {path}")
                    
                    async for file_info in handler.walk():
                        try:
                            extractor = ExtractorRegistry.get_extractor(file_info.extension)
                            if extractor:
                                content = await handler.download_file(file_info)
                                doc = await extractor.extract(Path(file_info.path), content)
                                
                                # Process Vectors
                                if embed_service.enabled:
                                    chunks = chunker.split_text(doc.content)
                                    if chunks:
                                        embeddings = await embed_service.generate_embeddings(chunks)
                                        
                                        points = []
                                        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
                                            points.append({
                                                "id": uuid.uuid4(),
                                                "vector": vector,
                                                "payload": {
                                                    "source_id": str(source.id),
                                                    "job_id": str(job.id),
                                                    "path": file_info.path,
                                                    "text": chunk,
                                                    "chunk_index": i,
                                                    "metadata": doc.metadata
                                                }
                                            })
                                        
                                        if points:
                                            vector_service.upsert_vectors(points)
                                
                                processed_files.append({
                                    "path": file_info.path,
                                    "chars": len(doc.content),
                                    "chunks": len(chunks) if embed_service.enabled else 0,
                                    "type": doc.metadata.get("type", "unknown")
                                })
                        except Exception as e:
                            errors.append({"path": file_info.path, "error": str(e)})

                elif source.type == "LOCAL_BRIDGE":
                    from app.services.bridge import FileBridgeClient
                    
                    path_id = source.config.get("bridge_id")
                    if not path_id:
                        raise Exception("Missing bridge_id in source config")
                    
                    client = FileBridgeClient()
                    try:
                        files = await client.walk(path_id)
                        for f in files:
                            try:
                                ext = Path(f['relative_path']).suffix.lower()
                                extractor = ExtractorRegistry.get_extractor(ext)
                                if extractor:
                                    content = await client.read_file(path_id, f['relative_path'])
                                    file_bytes = content if isinstance(content, bytes) else content.encode()
                                    doc = await extractor.extract(file_bytes, f['relative_path'])
                                    
                                    # Process Vectors
                                    if embed_service.enabled:
                                        chunks = chunker.split_text(doc.content)
                                        if chunks:
                                            # Create metadata chunk for document discovery
                                            title = doc.metadata.get('title', '') or Path(f['relative_path']).stem
                                            author = doc.metadata.get('author', '')
                                            doc_type = doc.metadata.get('type', 'document')
                                            metadata_text = f"Document: {f['relative_path']}. Title: {title}. Author: {author}. Type: {doc_type}. This is an available book/document in the collection."
                                            
                                            # Add metadata chunk first, then regular chunks
                                            all_chunks = [metadata_text] + chunks
                                            embeddings = await embed_service.generate_embeddings(all_chunks)
                                            
                                            points = []
                                            for i, (chunk, vector) in enumerate(zip(all_chunks, embeddings)):
                                                points.append({
                                                    "id": uuid.uuid4(),
                                                    "vector": vector,
                                                    "payload": {
                                                        "source_id": str(source.id),
                                                        "job_id": str(job.id),
                                                        "path": f['relative_path'],
                                                        "text": chunk,
                                                        "chunk_index": i - 1 if i > 0 else -1,  # -1 for metadata chunk
                                                        "is_metadata_chunk": i == 0,
                                                        "metadata": doc.metadata
                                                    }
                                                })
                                            vector_service.upsert_vectors(points)
                                    
                                    processed_files.append({
                                        "path": f['relative_path'],
                                        "chars": len(doc.content),
                                        "chunks": len(chunks) if embed_service.enabled else 0,
                                        "type": doc.metadata.get("type", "unknown")
                                    })
                            except Exception as e:
                                errors.append({"path": f['relative_path'], "error": str(e)})
                    finally:
                        await client.close()

                elif source.type == "GOOGLE_DRIVE":
                    from app.services.sources import GoogleDriveHandler
                    
                    # Get OAuth token
                    token_result = await db.execute(
                        select(OAuthToken).where(OAuthToken.source_id == source_id)
                    )
                    oauth_token = token_result.scalars().first()
                    
                    if not oauth_token:
                        raise Exception("Google Drive not connected. Please authenticate first.")
                    
                    credentials = {
                        "token": oauth_token.access_token,
                        "refresh_token": oauth_token.refresh_token,
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    }
                    
                    folder_id = source.config.get("folder_id", "root")
                    handler = GoogleDriveHandler(credentials, folder_id)
                    
                    if not await handler.authenticate():
                        raise Exception("Failed to authenticate with Google Drive")
                    
                    try:
                        async for file_info in handler.walk():
                            try:
                                ext = file_info.extension
                                if file_info.mime_type in handler.EXPORT_MAP:
                                    _, ext = handler.EXPORT_MAP[file_info.mime_type]
                                
                                extractor = ExtractorRegistry.get_extractor(ext)
                                if extractor:
                                    content = await handler.download_file(file_info)
                                    doc = await extractor.extract(Path(file_info.name), content)
                                    
                                    # Process Vectors
                                    if embed_service.enabled:
                                        chunks = chunker.split_text(doc.content)
                                        if chunks:
                                            embeddings = await embed_service.generate_embeddings(chunks)
                                            points = []
                                            for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
                                                points.append({
                                                    "id": uuid.uuid4(),
                                                    "vector": vector,
                                                    "payload": {
                                                        "source_id": str(source.id),
                                                        "job_id": str(job.id),
                                                        "path": file_info.name,
                                                        "text": chunk,
                                                        "chunk_index": i,
                                                        "metadata": doc.metadata
                                                    }
                                                })
                                            vector_service.upsert_vectors(points)

                                    processed_files.append({
                                        "path": file_info.name,
                                        "chars": len(doc.content),
                                        "chunks": len(chunks) if embed_service.enabled else 0,
                                        "type": doc.metadata.get("type", "unknown")
                                    })
                            except Exception as e:
                                errors.append({"path": file_info.name, "error": str(e)})
                    finally:
                        await handler.close()

                elif source.type == "SHAREPOINT":
                    from app.services.sources import SharePointHandler
                    
                    handler = SharePointHandler(
                        tenant_id=os.getenv("MS_TENANT_ID", ""),
                        client_id=os.getenv("MS_CLIENT_ID", ""),
                        client_secret=os.getenv("MS_CLIENT_SECRET", ""),
                        site_url=source.config.get("site_url", ""),
                        folder_path=source.config.get("folder", "")
                    )
                    
                    if not await handler.authenticate():
                        raise Exception("Failed to authenticate with SharePoint")
                    
                    try:
                        async for file_info in handler.walk():
                            try:
                                extractor = ExtractorRegistry.get_extractor(file_info.extension)
                                if extractor:
                                    content = await handler.download_file(file_info)
                                    doc = await extractor.extract(Path(file_info.name), content)
                                    
                                    # Process Vectors
                                    if embed_service.enabled:
                                        chunks = chunker.split_text(doc.content)
                                        if chunks:
                                            embeddings = await embed_service.generate_embeddings(chunks)
                                            points = []
                                            for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
                                                points.append({
                                                    "id": uuid.uuid4(),
                                                    "vector": vector,
                                                    "payload": {
                                                        "source_id": str(source.id),
                                                        "job_id": str(job.id),
                                                        "path": file_info.path,
                                                        "text": chunk,
                                                        "chunk_index": i,
                                                        "metadata": doc.metadata
                                                    }
                                                })
                                            vector_service.upsert_vectors(points)

                                    processed_files.append({
                                        "path": file_info.path,
                                        "chars": len(doc.content),
                                        "chunks": len(chunks) if embed_service.enabled else 0,
                                        "type": doc.metadata.get("type", "unknown")
                                    })
                            except Exception as e:
                                errors.append({"path": file_info.path, "error": str(e)})
                    finally:
                        await handler.close()
                else:
                     raise Exception(f"Ingestion not implemented for type {source.type}")

                # 3. Update Job Success
                job.status = "COMPLETED"
                job.progress = {
                    "total": len(processed_files) + len(errors),
                    "processed": len(processed_files),
                    "errors_count": len(errors),
                    "files": processed_files[:50], # Limit stored history
                    "errors": errors[:20]
                }
                logger.info(f"Job {job_id} completed: {len(processed_files)} processed")

            except Exception as e:
                logger.exception(f"Ingestion logic failed for job {job_id}")
                job.status = "FAILED"
                job.error = str(e)
            
            await db.commit()
            
        except Exception as e:
            logger.critical(f"Critical failure in ingestion task {job_id}: {e}")
            # Try to mark as failed if possible
            try:
                job.status = "FAILED"
                job.error = f"Critical Error: {str(e)}"
                await db.commit()
            except:
                pass
