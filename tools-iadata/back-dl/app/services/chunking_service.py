from typing import List

class ChunkingService:
    """
    Service to split text into chunks for embedding.
    Uses Recursive Character Splitting logic.
    """
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", " ", ""]

    def split_text(self, text: str) -> List[str]:
        """Split text into chunks."""
        if not text:
            return []
            
        final_chunks = []
        self._split_recursive(text, self.separators, final_chunks)
        return final_chunks
        
    def _split_recursive(self, text: str, separators: List[str], final_chunks: List[str]):
        """Recursive splitting helper."""
        # Find best separator
        separator = separators[-1]
        new_separators = []
        for i, sep in enumerate(separators):
            if sep == "":
                separator = ""
                break
            if sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break
                
        # Split
        if separator:
            splits = text.split(separator)
        else:
            splits = list(text) # Character split as last resort
            
        # Merge small splits into chunks
        good_splits = []
        current_chunk = ""
        
        for s in splits:
            if not s.strip():
                continue
                
            if len(current_chunk) + len(s) + len(separator) < self.chunk_size:
                current_chunk += (separator if current_chunk else "") + s
            else:
                if current_chunk:
                    good_splits.append(current_chunk)
                current_chunk = s
                
        if current_chunk:
            good_splits.append(current_chunk)
            
        # If chunks are still too big and we have separators left, recurse
        for chunk in good_splits:
            if len(chunk) > self.chunk_size and new_separators:
                self._split_recursive(chunk, new_separators, final_chunks)
            else:
                final_chunks.append(chunk)
                # TODO: Implement overlap logic if strictly needed, 
                # for now simple recursion gives decent breaks.
