"""
The table that closes the gap between what your ML models were
trained on and what the live API previously had available.

Every time calculate_shift_score() fetches fresh NASA signals for a
field, it now writes one row per signal here too (see
scoring_engine.py's _record_signal_readings). Over time — helped
along by dags/refresh_daily.py running nightly — this becomes a real
history the ML scorer can compute genuine rolling means and trends
from, instead of faking them from a single point-in-time reading.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SignalReading(Base):
    __tablename__ = "signal_readings"
    __table_args__ = (
        # The ML feature builder always queries "last N readings for
        # this field, this source, most recent first" — this composite
        # index is what keeps that query fast as history grows.
        Index("ix_signal_readings_field_source_time", "field_id", "source", "recorded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # "SMAP" | "MODIS" | "GPM" | "ECOSTRESS" | "GRACE-FO"
    value: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )