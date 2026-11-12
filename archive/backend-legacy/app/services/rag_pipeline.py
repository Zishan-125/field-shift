"""
The retrieval-augmented generation logic behind api/copilot.py.

Two deliberately simple choices for a 48-hour build, both flagged so
the team doesn't mistake "simple" for "accidental":

1. Retrieval is plain keyword overlap over a small, hand-curated
   knowledge base (agronomy_docs.py-style content, inlined below for
   now) — not a vector database. A handful of well-written reference
   passages beats a half-tuned embedding index you don't have time to
   evaluate. Swap in FAISS/pgvector post-MVP once the knowledge base
   outgrows what keyword search can handle.
2. Generation calls a **local Ollama model** by default (see
   LLM_PROVIDER in config.py) specifically so the live demo works
   with no internet dependency in the room — a judge's wifi should
   never be a single point of failure for your pitch.

Every answer is grounded in two kinds of context: the field's own
current NASA signals (from scoring_engine, reused rather than
recomputed — the copilot should never show a different score than the
dashboard) and the retrieved agronomy/NASA reference text.
"""

from dataclasses import dataclass

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.field import Field as FieldModel
from app.services.scoring_engine import calculate_shift_score

# A small, hand-picked reference set. In a real build this grows into
# its own data file (or several, per crop/region) — kept inline here
# so this module is runnable and readable standalone during the
# hackathon's early hours.
KNOWLEDGE_BASE: list[dict] = [
    {
        "id": "smap-basics",
        "label": "What SMAP soil moisture measures",
        "text": (
            "NASA's SMAP satellite estimates moisture in the top and root "
            "zone of the soil using microwave radar. A negative anomaly "
            "means the soil is drier than the multi-year normal for that "
            "location and time of year, which raises drought and "
            "crop-stress risk if it persists for more than a few weeks."
        ),
    },
    {
        "id": "ndvi-basics",
        "label": "What NDVI tells you about crop health",
        "text": (
            "NDVI (Normalized Difference Vegetation Index) from MODIS "
            "compares reflected red and near-infrared light to estimate "
            "how green and dense vegetation is. A declining NDVI trend "
            "during the growing season usually lags soil-moisture stress "
            "by one to two weeks, confirming rather than predicting it."
        ),
    },
    {
        "id": "rotation-legumes",
        "label": "Why legumes help after a stressed season",
        "text": (
            "Legume crops (cowpea, groundnut, soybean) fix atmospheric "
            "nitrogen in the soil via root-nodule bacteria, which can "
            "restore soil fertility after a cereal crop under drought "
            "stress and typically requires less irrigation than maize "
            "or rice."
        ),
    },
    {
        "id": "grace-groundwater",
        "label": "What GRACE-FO groundwater trends mean for irrigation",
        "text": (
            "GRACE-FO tracks tiny changes in Earth's gravity field to "
            "estimate total water storage, including groundwater, over "
            "large areas. A sustained multi-month decline suggests "
            "aquifer depletion, which is a signal to reduce reliance on "
            "groundwater irrigation rather than a single season's rainfall."
        ),
    },
]


@dataclass
class CitedSourceData:
    label: str
    kind: str  # "nasa_signal" | "agronomy_doc"


@dataclass
class RagAnswer:
    reply: str
    cited_sources: list[CitedSourceData]
    model_used: str


def _retrieve(question: str, top_k: int = 2) -> list[dict]:
    """Keyword-overlap retrieval: cheap, explainable, good enough for
    a knowledge base this size. Replace scoring with embeddings if/when
    KNOWLEDGE_BASE grows past ~50-100 entries."""
    question_words = set(question.lower().split())
    scored = []
    for doc in KNOWLEDGE_BASE:
        doc_words = set(doc["text"].lower().split())
        overlap = len(question_words & doc_words)
        if overlap > 0:
            scored.append((overlap, doc))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [doc for _, doc in scored[:top_k]]


def _build_prompt(field: FieldModel, score_headline: str, signal_lines: list[str],
                   retrieved: list[dict], question: str, language: str) -> str:
    context_block = "\n".join(f"- {line}" for line in signal_lines)
    docs_block = "\n\n".join(f"[{doc['label']}]\n{doc['text']}" for doc in retrieved)
    return (
        f"You are TerraShift's farming copilot. Answer the farmer's question "
        f"about their field \"{field.name}\" in {language}, in plain, "
        f"non-technical language, in 3 sentences or fewer.\n\n"
        f"Current field status: {score_headline}\n"
        f"Underlying NASA signals:\n{context_block}\n\n"
        f"Reference material:\n{docs_block}\n\n"
        f"Farmer's question: {question}\n"
        f"Answer:"
    )


async def _call_ollama(prompt: str) -> str:
    async with httpx.AsyncClient(base_url=settings.OLLAMA_BASE_URL, timeout=30.0) as client:
        response = await client.post(
            "/api/generate",
            json={"model": settings.LLM_MODEL_NAME, "prompt": prompt, "stream": False},
        )
        response.raise_for_status()
        return response.json()["response"].strip()


async def answer_question(
    field: FieldModel, question: str, language: str, db: AsyncSession
) -> RagAnswer:
    # Reuse the exact same scoring path the dashboard and SMS use, so
    # the copilot can never contradict the score shown elsewhere.
    score_result = await calculate_shift_score(field=field, db=db)
    signal_lines = [f"{s.source}: {s.contribution}" for s in score_result.signals]

    retrieved_docs = _retrieve(question)
    prompt = _build_prompt(field, score_result.headline, signal_lines, retrieved_docs, question, language)

    if settings.LLM_PROVIDER == "ollama":
        reply = await _call_ollama(prompt)
    else:
        raise NotImplementedError(
            f"LLM_PROVIDER={settings.LLM_PROVIDER!r} not wired up yet — "
            f"add a branch here when adding a hosted-model option."
        )

    cited = [CitedSourceData(label=f"{s.source} (current reading)", kind="nasa_signal")
             for s in score_result.signals if s.contribution]
    cited += [CitedSourceData(label=doc["label"], kind="agronomy_doc") for doc in retrieved_docs]

    return RagAnswer(reply=reply, cited_sources=cited, model_used=settings.LLM_MODEL_NAME)