"""
The channel that makes TerraShift reach farmers a pretty dashboard
never will: plain SMS, on any phone, with no data plan required.

This webhook is intentionally minimal in what it accepts — a field
identifier in the message body — because the hackathon build doesn't
yet have a phone-number-to-farmer/field registry. That registry (an
inbound SMS -> look up farmer by From-number -> their most recent
field) is the natural next step once there's time; flagged below
rather than half-built.

Security note for the team: Twilio signs every webhook request. We
verify that signature before doing anything else, so this endpoint
can't be spoofed into sending arbitrary SMS replies or spamming your
NASA/GEE quota.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

from app.core.config import settings
from app.core.database import get_db
from app.models.field import Field as FieldModel
from app.services.scoring_engine import calculate_shift_score

router = APIRouter()

_validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)


async def _verify_twilio_signature(request: Request) -> None:
    signature = request.headers.get("X-Twilio-Signature", "")
    form = await request.form()
    is_valid = _validator.validate(str(request.url), dict(form), signature)
    if not is_valid and settings.ENVIRONMENT != "local":
        # Only enforced outside local dev, since local tunnels (ngrok
        # etc.) commonly rewrite the URL Twilio signed against.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")


@router.post("/inbound", response_class=Response)
async def inbound_sms(
    request: Request,
    Body: str = Form(...),
    From: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio calls this on every inbound SMS. Expected message format
    for the hackathon demo: the farmer (or, more realistically, a
    field agent on their behalf) texts the field's short ID, e.g.
    "STATUS 3f2a9c1e". A real deployment replaces this parsing step
    with a From-number -> farmer -> default field lookup so the
    farmer never has to remember or type an ID at all.
    """
    await _verify_twilio_signature(request)

    reply_text = _handle_command(Body)
    if reply_text is None:
        reply_text, field_id = _parse_status_command(Body)
        if field_id is None:
            twiml = _build_reply(
                "Text STATUS followed by your field ID to get your latest Field Shift Score."
            )
            return Response(content=str(twiml), media_type="application/xml")

        field = await db.get(FieldModel, field_id)
        if field is None:
            twiml = _build_reply("We couldn't find a field with that ID. Please check and resend.")
            return Response(content=str(twiml), media_type="application/xml")

        result = await calculate_shift_score(field=field, db=db)
        # SMS is capped at 160 chars/segment — keep the reply to one
        # segment so it's a single low-cost message for the farmer.
        reply_text = f"{field.name}: Shift Score {result.score}/100. {result.headline}"[:158]

    twiml = _build_reply(reply_text)
    return Response(content=str(twiml), media_type="application/xml")


def _handle_command(body: str) -> str | None:
    """Placeholder for simple non-status commands (HELP, STOP, etc.)
    Kept separate from the STATUS flow so adding new keywords later
    doesn't tangle with the scoring lookup."""
    normalized = body.strip().upper()
    if normalized in ("HELP", "MENU"):
        return "TerraShift: text STATUS <field ID> for your latest score, or STOP to opt out."
    return None


def _parse_status_command(body: str) -> tuple[str | None, UUID | None]:
    parts = body.strip().split()
    if len(parts) < 2 or parts[0].upper() != "STATUS":
        return None, None
    try:
        field_id = UUID(parts[1])
    except ValueError:
        return None, None
    return None, field_id


def _build_reply(message: str) -> MessagingResponse:
    twiml = MessagingResponse()
    twiml.message(message)
    return twiml