"""
The endpoint the entire pitch hinges on: given a field, return the
Field Shift Score and one plain-language recommendation.

This router deliberately contains almost no logic of its own — it
validates the request, fetches the field, delegates the actual
scoring to `services/scoring_engine.py`, and shapes the response.
Keeping the "what does this mean for the farmer" decision in a
service function (not inline in the route) is what lets the copilot
router (next file) and the SMS webhook reuse the exact same
recommendation logic instead of three teammates writing three
slightly-different versions of it.
"""

from enum import Enum
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PydanticField
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.field import Field as FieldModel
from app.services.scoring_engine import calculate_shift_score

router = APIRouter()


class RecommendationAction(str, Enum):
    CONTINUE = "continue"
    ADJUST_TIMING = "adjust_timing"
    SHIFT_CROP = "shift_crop"
    SHIFT_ROTATION = "shift_rotation"


class SignalBreakdown(BaseModel):
    """One NASA/partner signal's contribution — this is what makes the
    recommendation explainable instead of a black box."""
    source: str  # e.g. "SMAP", "ECOSTRESS"
    label: str  # e.g. "Root-zone soil moisture"
    value: float
    anomaly_pct: Optional[float] = PydanticField(
        default=None, description="% deviation from the multi-year normal for this location/date"
    )
    contribution: str  # short plain-language note, e.g. "40% below normal for 3 weeks"


class ShiftAdviceOut(BaseModel):
    field_id: UUID
    field_shift_score: int = PydanticField(..., ge=0, le=100)
    recommendation: RecommendationAction
    headline: str  # one sentence, safe to show as-is in the UI or an SMS
    signals: list[SignalBreakdown]
    suggested_rotation: Optional[list[str]] = None


@router.get("/{field_id}", response_model=ShiftAdviceOut)
async def get_shift_advice(field_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Compute (or return the latest cached) Field Shift Score for a field.

    Judges/demo note: this is the single endpoint to call live during
    a pitch — point it at a seeded drought-region field and a seeded
    stable-region field back to back to show the score and
    recommendation actually respond to different conditions.
    """
    field = await db.get(FieldModel, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")

    result = await calculate_shift_score(field=field, db=db)

    return ShiftAdviceOut(
        field_id=field.id,
        field_shift_score=result.score,
        recommendation=result.recommendation,
        headline=result.headline,
        signals=[
            SignalBreakdown(
                source=s.source,
                label=s.label,
                value=s.value,
                anomaly_pct=s.anomaly_pct,
                contribution=s.contribution,
            )
            for s in result.signals
        ],
        suggested_rotation=result.suggested_rotation,
    )


@router.post("/{field_id}/recompute", response_model=ShiftAdviceOut)
async def recompute_shift_advice(field_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Force a fresh pull of NASA data + rescoring, bypassing any cache.
    Exposed as its own endpoint (rather than a query param on GET) so
    it can be rate-limited separately — recomputation is the
    expensive path that hits external NASA/GEE APIs.
    """
    field = await db.get(FieldModel, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")

    result = await calculate_shift_score(field=field, db=db, force_refresh=True)

    return ShiftAdviceOut(
        field_id=field.id,
        field_shift_score=result.score,
        recommendation=result.recommendation,
        headline=result.headline,
        signals=[
            SignalBreakdown(**s.__dict__) for s in result.signals
        ],
        suggested_rotation=result.suggested_rotation,
    )