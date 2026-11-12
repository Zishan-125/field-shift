"""
The "ask anything" endpoint. A farmer (or an NGO agronomist on their
behalf) asks a question in plain language about a specific field, and
gets back an answer grounded in that field's actual NASA-derived
signals plus agronomy reference material — not a generic LLM guess.

Like shift_advice.py, this router stays thin: it fetches the field
context, hands the real work to services/rag_pipeline.py, and shapes
the response. The RAG pipeline is the piece that does retrieval
(pulling relevant chunks of NASA documentation + this field's own
score history) and generation (the actual LLM call) — kept separate
so it can be swapped from local Ollama to a hosted model with a
one-file change, per the LLM_PROVIDER setting in config.py.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PydanticField
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.field import Field as FieldModel
from app.services.rag_pipeline import answer_question

router = APIRouter()


class CopilotQuery(BaseModel):
    field_id: UUID
    message: str = PydanticField(..., min_length=1, max_length=1000)
    # ISO 639-1 code (e.g. "en", "sw", "bn"). The pipeline uses this to
    # both retrieve in the right language where translated agronomy
    # docs exist, and to instruct the LLM to reply in it.
    language: str = PydanticField(default="en", max_length=8)


class CitedSource(BaseModel):
    label: str          # e.g. "SMAP soil moisture, last 14 days"
    kind: str            # "nasa_signal" | "agronomy_doc"


class CopilotResponse(BaseModel):
    reply: str
    cited_sources: list[CitedSource]
    # Surfaced so the frontend can show a small "answered by local
    # model" vs "answered by hosted model" badge if useful for judges.
    model_used: Optional[str] = None


@router.post("/chat", response_model=CopilotResponse)
async def chat(payload: CopilotQuery, db: AsyncSession = Depends(get_db)):
    """
    Answer a farmer's free-text question about one of their fields.

    Kept stateless on purpose for the MVP — each call is independent,
    no server-side conversation history. If multi-turn memory turns
    out to matter in user testing, that's a `conversation_id` +
    a small table away, not a redesign of this endpoint.
    """
    field = await db.get(FieldModel, payload.field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")

    result = await answer_question(
        field=field,
        question=payload.message,
        language=payload.language,
        db=db,
    )

    return CopilotResponse(
        reply=result.reply,
        cited_sources=[
            CitedSource(label=s.label, kind=s.kind) for s in result.cited_sources
        ],
        model_used=result.model_used,
    )