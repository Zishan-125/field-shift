"""
The Field model: a farmer's field boundary plus enough metadata for
the scoring engine and rotation planner to reason about it.

Kept intentionally small for the hackathon build — crop_history is a
plain string array rather than its own table, and soil/nutrient data
is looked up live from SoilGrids by field centroid rather than stored
here. Both are reasonable things to normalize into real tables after
the MVP, once you know which fields the ML/rotation logic actually
needs indexed.
"""

import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import ARRAY, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Not a hard foreign key to a `farmers` table yet in the hackathon
    # schema (auth/farmer records may land later in the build) — kept
    # as a plain indexed UUID so fields.py works before that table
    # exists, but structured so `ForeignKey("farmers.id")` is a
    # one-line upgrade once it does.
    farmer_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # SRID 4326 = WGS84 lat/lon, the same coordinate reference system
    # NASA EO products (SMAP, MODIS, GPM, ...) and GeoJSON both use,
    # so no reprojection is needed when clipping rasters to this
    # polygon in the data pipeline.
    boundary: Mapped[Geometry] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326), nullable=False
    )

    # Most recent crop first, e.g. ["maize", "soybean", "maize"].
    # The rotation planner reads this to avoid recommending whatever
    # was just grown and to flag continuous-monoculture risk.
    crop_history: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Backref target for a future ShiftScore model (one field -> many
    # scores over time, one per season/run of the scoring engine).
    shift_scores: Mapped[list["ShiftScore"]] = relationship(
        back_populates="field", cascade="all, delete-orphan", lazy="selectin"
    )


class ShiftScore(Base):
    """
    Minimal forward declaration so `Field.shift_scores` resolves.
    The scoring_engine.py service (later file) is what actually
    populates rows here — full column set belongs with that file,
    not guessed at now.
    """
    __tablename__ = "shift_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"), index=True)
    score: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    field: Mapped["Field"] = relationship(back_populates="shift_scores")