import asyncio
import json
import os
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="DocNexus API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

MIME_TYPES = {
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class Preferences(BaseModel):
    icd10_codes: list[str] = []
    states: list[str] = []
    volume_tier: Optional[str] = None  # "low" | "high" | "very_high" | None


class QueryRequest(BaseModel):
    query: str
    preferences: Preferences = Preferences()


# ─── Health check ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ─── POST /query ─────────────────────────────────────────────────────────────

@app.post("/query")
async def run_query(request: QueryRequest):
    """
    Accepts a natural-language query + user preferences.
    Returns an SSE stream of agent trace events + final results.
    """
    from agents.orchestrator import run_orchestrator

    queue: asyncio.Queue = asyncio.Queue()

    async def event_generator():
        asyncio.create_task(
            run_orchestrator(request.query, request.preferences.model_dump(), queue)
        )
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") == "done" or event.get("type") == "error":
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ─── GET /physicians ─────────────────────────────────────────────────────────

@app.get("/physicians")
async def get_physicians(
    specialty: Optional[str] = Query(None),
    state: Optional[list[str]] = Query(None),
    icd10_codes: Optional[list[str]] = Query(None),
    volume_threshold: Optional[str] = Query(None, enum=["low", "high", "very_high"]),
):
    """
    Returns filtered physician list.
    Used by the frontend preference panel for previewing matching records.
    """
    from tools.physician_data import get_physician_data

    result = await get_physician_data(
        specialty=specialty,
        state=state,
        icd10_codes=icd10_codes,
        volume_threshold=volume_threshold,
    )
    return result


# ─── GET /artifacts/{artifact_id} ────────────────────────────────────────────

@app.get("/artifacts/{artifact_id}")
async def download_artifact(artifact_id: str):
    """
    Serves a generated artifact file (.pptx, .xlsx, .docx) for download.
    artifact_id must be a UUID; extension is resolved from the artifacts directory.
    """
    for ext in (".pptx", ".xlsx", ".docx"):
        candidate = ARTIFACTS_DIR / f"{artifact_id}{ext}"
        if candidate.exists():
            return FileResponse(
                path=str(candidate),
                media_type=MIME_TYPES[ext],
                filename=f"docnexus_{artifact_id[:8]}{ext}",
                headers={"Content-Disposition": f'attachment; filename="docnexus_{artifact_id[:8]}{ext}"'},
            )

    raise HTTPException(status_code=404, detail=f"Artifact '{artifact_id}' not found.")
