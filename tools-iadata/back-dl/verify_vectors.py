
import asyncio
from app.services.vector_service import VectorService
from app.services.embedding_service import EmbeddingService
from app.config import settings
import logging
import sys

# Configure logging to stdout
logging.basicConfig(stream=sys.stdout, level=logging.INFO)

async def verify():
    print(f"Checking configuration...")
    print(f"USE_LOCAL_EMBEDDING: {settings.USE_LOCAL_EMBEDDING}")
    print(f"QDRANT_URL: {settings.QDRANT_URL}")
    print(f"OLLAMA_BASE_URL: {settings.OLLAMA_BASE_URL}")
    
    # 1. Check Vector Service
    vs = VectorService()
    if vs.enabled:
        print("\n[VectorService]")
        try:
            vs.ensure_collection()
            print("Collection verified/created.")
            
            # Test Upsert
            import uuid
            test_id = str(uuid.uuid4())
            # create mock 768 dim vector
            mock_vec = [0.1] * 768 
            vs.upsert_vectors([{
                "id": test_id,
                "vector": mock_vec,
                "payload": {"test": "true"}
            }])
            print(f"Upserted test vector {test_id}")
            
            # Test Search
            results = vs.search(mock_vec, limit=1)
            if results and results[0].id == test_id:
                print("Search Verification: SUCCESS")
            else:
                print(f"Search Verification: FAILED (Found {len(results)})")
                if results:
                    print(f"  Expected: {test_id}")
                    print(f"  Found:    {results[0].id} (Score: {results[0].score})")
                
        except Exception as e:
            print(f"VectorService Error: {e}")
    else:
        print("\nVectorService is DISABLED (Expected if USE_LOCAL_EMBEDDING=false)")

    # 2. Check Embedding Service
    es = EmbeddingService()
    if es.enabled:
        print("\n[EmbeddingService]")
        available = await es.ensure_model_available()
        print(f"Model Available: {available}")
        
        if available:
            vecs = await es.generate_embeddings(["Hello world"])
            if vecs and len(vecs) > 0:
                print(f"Embedding Generation: SUCCESS (Dim: {len(vecs[0])})")
            else:
                print("Embedding Generation: FAILED (Empty result)")
    else:
        print("\nEmbeddingService is DISABLED (Expected if USE_LOCAL_EMBEDDING=false)")

if __name__ == "__main__":
    asyncio.run(verify())
