from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime
from app.db import get_db
from app.models.chat import ChatSession, ChatMessage

router = APIRouter(
    prefix="/sessions",
    tags=["sessions"]
)

# --- Pydantic Models ---

class ChatSessionOut(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    user_id: str

    class Config:
        from_attributes = True

class ChatMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionDetail(ChatSessionOut):
    messages: List[ChatMessageOut]

    class Config:
        from_attributes = True

class RenameSessionRequest(BaseModel):
    title: str

# --- Endpoints ---

@router.get("/", response_model=List[ChatSessionOut])
async def list_sessions(
    limit: int = 20,
    offset: int = 0,
    user_id: str = "default_user", # TODO: Get from auth
    db: AsyncSession = Depends(get_db)
):
    """List chat sessions for the current user."""
    stmt = (
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(desc(ChatSession.updated_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return sessions

@router.get("/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific session with its messages."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Ensure messages are loaded (though relationship might be lazy, async requires explicit loading or joinedload)
    # Since we defined lazy='select' (default), accessing .messages might fail in async context without eager loading option
    # Let's verify relationship definition. For async, it's safer to use selectinload
    
    from sqlalchemy.orm import selectinload
    stmt = select(ChatSession).options(selectinload(ChatSession.messages)).where(ChatSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
         raise HTTPException(status_code=404, detail="Session not found")

    return session

@router.delete("/{session_id}")
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a session."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    await db.commit()
    return {"status": "success", "deleted_id": str(session_id)}

@router.patch("/{session_id}", response_model=ChatSessionOut)
async def rename_session(
    session_id: uuid.UUID,
    request: RenameSessionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Rename a session."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.title = request.title
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    return session
