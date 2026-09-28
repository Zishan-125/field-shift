"""
Tests for api/fields.py. This is the first file to actually use the
conftest.py harness — if these fail with a connection error rather
than an assertion error, the problem is almost certainly the test
database (see conftest.py's docstring), not this code.

These intentionally test behavior through the real HTTP layer (via
the `client` fixture) rather than calling router functions directly,
so a mistake in request/response schemas gets caught here too, not
just in manual Postman/Swagger checks during the hackathon.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_field_returns_the_polygon_back(client: AsyncClient, sample_field_payload: dict):
    response = await client.post("/api/v1/fields", json=sample_field_payload)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == sample_field_payload["name"]
    assert body["crop_history"] == ["maize"]
    # geometry should round-trip through PostGIS unchanged in shape
    assert body["geojson_polygon"]["type"] == "Polygon"
    assert "id" in body


async def test_create_field_rejects_self_intersecting_polygon(client: AsyncClient, sample_field_payload: dict):
    bowtie = dict(sample_field_payload)
    bowtie["geojson_polygon"] = {
        "type": "Polygon",
        "coordinates": [[
            [36.80, -1.30],
            [36.81, -1.29],
            [36.81, -1.30],
            [36.80, -1.29],
            [36.80, -1.30],
        ]],
    }

    response = await client.post("/api/v1/fields", json=bowtie)

    # caught by the pydantic validator in fields.py, before it ever
    # reaches PostGIS
    assert response.status_code == 422


async def test_get_field_after_create(client: AsyncClient, sample_field_payload: dict):
    created = (await client.post("/api/v1/fields", json=sample_field_payload)).json()

    response = await client.get(f"/api/v1/fields/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


async def test_get_field_that_does_not_exist_returns_404(client: AsyncClient):
    response = await client.get("/api/v1/fields/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404


async def test_list_fields_filters_by_farmer_id(client: AsyncClient, sample_field_payload: dict):
    await client.post("/api/v1/fields", json=sample_field_payload)

    other_farmer_payload = dict(sample_field_payload)
    other_farmer_payload["farmer_id"] = "22222222-2222-2222-2222-222222222222"
    other_farmer_payload["name"] = "Someone Else's Plot"
    await client.post("/api/v1/fields", json=other_farmer_payload)

    response = await client.get(
        "/api/v1/fields", params={"farmer_id": sample_field_payload["farmer_id"]}
    )

    assert response.status_code == 200
    names = [f["name"] for f in response.json()]
    assert sample_field_payload["name"] in names
    assert "Someone Else's Plot" not in names


async def test_update_field_name_and_crop_history(client: AsyncClient, sample_field_payload: dict):
    created = (await client.post("/api/v1/fields", json=sample_field_payload)).json()

    response = await client.put(
        f"/api/v1/fields/{created['id']}",
        json={"name": "Renamed Plot", "crop_history": ["cowpea", "maize"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed Plot"
    assert body["crop_history"] == ["cowpea", "maize"]


async def test_delete_field_then_get_returns_404(client: AsyncClient, sample_field_payload: dict):
    created = (await client.post("/api/v1/fields", json=sample_field_payload)).json()

    delete_response = await client.delete(f"/api/v1/fields/{created['id']}")
    get_response = await client.get(f"/api/v1/fields/{created['id']}")

    assert delete_response.status_code == 204
    assert get_response.status_code == 404