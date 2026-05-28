"""
get_physician_data — pure Python filter over physicians.json.
No LLM call. Called directly by the Orchestrator.
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

DATA_PATH = Path(__file__).parent.parent / "data" / "physicians.json"

VOLUME_ORDER = {"low": 0, "high": 1, "very_high": 2}


@lru_cache(maxsize=1)
def _load_all() -> list[dict]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


async def get_physician_data(
    specialty: Optional[str] = None,
    state: Optional[list[str]] = None,
    icd10_codes: Optional[list[str]] = None,
    volume_threshold: Optional[str] = None,
) -> dict:
    """
    Returns {"physicians": [...]} filtered by the supplied parameters.
    All parameters are optional. When icd10_codes is supplied, only physicians
    with at least one claim for any of those codes are returned.
    volume_threshold is inclusive — "high" returns high AND very_high.
    """
    physicians = _load_all()
    results = []

    threshold_rank = VOLUME_ORDER.get(volume_threshold, -1) if volume_threshold else -1

    for p in physicians:
        if specialty and p.get("specialty", "").lower() != specialty.lower():
            continue

        if state:
            states_lower = [s.strip().upper() for s in state]
            if p.get("state", "").upper() not in states_lower:
                continue

        if icd10_codes:
            physician_codes = set(p.get("icd10ClaimVolume", {}).keys())
            if not physician_codes.intersection(set(icd10_codes)):
                continue

        if volume_threshold:
            physician_rank = VOLUME_ORDER.get(p.get("volumeTier", "low"), 0)
            if physician_rank < threshold_rank:
                continue

        results.append(p)

    return {"physicians": results}
