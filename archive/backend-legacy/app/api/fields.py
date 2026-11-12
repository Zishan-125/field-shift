"""
CRUD endpoints for a farmer's field boundaries.

A "field" is the single unit everything else in TerraShift hangs off:
the data pipeline clips NASA rasters to it, the scoring engine scores
it, and the copilot answers questions about it. Getting this contract
right early is what lets the ML and frontend tracks build in parallel
against mock data without waiting on each other.

Design choices worth flagging to the team:
  - Geometry is accepted/returned as GeoJSON (the format both Mapbox
    GL JS and deck.gl already speak on the frontend) and stored as a
    PostGIS geometry column via GeoAlchemy2 — no manual WKT juggling.
  - We validate the polygon is non-self-intersecting and >0 area with
    shapely *before* it ever touches the DB, so bad geometry fails
    fast with a clear 422 instead of a cryptic PostGIS error.
  - farmer_id is taken from the authenticated user in a real deploy;
    for the hackathon demo it's accepted as a query/body field so the
    frontend team isn't blocked on auth being finished first.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.shape import from_shape, to_shape
from pydantic import BaseModel, Field, field_validator
from shapely.geometry import shape, mapping
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.field import Field as FieldModel

router = APIRouter()


# ---------------------------------------------------------------- schemas --

class FieldCreate(BaseModel):
    farmer_id: UUID
    name: str = Field(..., max_length=120, examples=["North plot"])
    geojson_polygon: dict = Field(
        ...,
        description="A GeoJSON Polygon in the field's boundary, e.g. "
                     '{"type": "Polygon", "coordinates": [[[lon, lat], ...]]}',
    )
    crop_history: Optional[list[str]] = Field(
        default=None, description="Most recent crops planted, most recent first"
    )

    @field_validator("geojson_polygon")
    @classmethod
    def polygon_must_be_valid(cls, value: dict) -> dict:
        geom = shape(value)
        if geom.geom_type != "Polygon":
            raise ValueError("geojson_polygon must be a GeoJSON Polygon")
        if not geom.is_valid:
            raise ValueError("polygon geometry is self-intersecting or malformed")
        if geom.area == 0:
            raise ValueError("polygon has zero area")
        return value


class FieldUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    geojson_polygon: Optional[dict] = None
    crop_history: Optional[list[str]] = None


class FieldOut(BaseModel):
    id: UUID
    farmer_id: UUID
    name: str
    geojson_polygon: dict
    crop_history: list[str] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row: FieldModel) -> "FieldOut":
        # PostGIS -> shapely -> GeoJSON dict, so the frontend always
        # receives geometry in the same format it originally sent.
        return cls(
            id=row.id,
            farmer_id=row.farmer_id,
            name=row.name,
            geojson_polygon=mapping(to_shape(row.boundary)),
            crop_history=row.crop_history or [],
        )


# --------------------------------------------------------------- endpoints --

@router.post("", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
async def create_field(payload: FieldCreate, db: AsyncSession = Depends(get_db)):
    """Register a new field boundary for a farmer."""
    geom = shape(payload.geojson_polygon)
    row = FieldModel(
        farmer_id=payload.farmer_id,
        name=payload.name,
        boundary=from_shape(geom, srid=4326),  # WGS84, matches NASA EO products
        crop_history=payload.crop_history or [],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return FieldOut.from_orm_row(row)


@router.get("", response_model=list[FieldOut])
async def list_fields(farmer_id: Optional[UUID] = None, db: AsyncSession = Depends(get_db)):
    """List fields, optionally filtered to one farmer (used by the dashboard's field picker)."""
    query = select(FieldModel)
    if farmer_id is not None:
        query = query.where(FieldModel.farmer_id == farmer_id)
    result = await db.execute(query)
    return [FieldOut.from_orm_row(row) for row in result.scalars().all()]


@router.get("/{field_id}", response_model=FieldOut)
async def get_field(field_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(FieldModel, field_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Field not found")
    return FieldOut.from_orm_row(row)


@router.put("/{field_id}", response_model=FieldOut)
async def update_field(field_id: UUID, payload: FieldUpdate, db: AsyncSession = Depends(get_db)):
    row = await db.get(FieldModel, field_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Field not found")

    if payload.name is not None:
        row.name = payload.name
    if payload.geojson_polygon is not None:
        row.boundary = from_shape(shape(payload.geojson_polygon), srid=4326)
    if payload.crop_history is not None:
        row.crop_history = payload.crop_history

    await db.commit()
    await db.refresh(row)
    return FieldOut.from_orm_row(row)


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field(field_id: UUID, db: AsyncSession = Depends(get_db)):
    row = await db.get(FieldModel, field_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Field not found")
    await db.delete(row)
    await db.commit()