"""
TAZA AI Service - end-to-end batch analysis orchestration.

This is the endpoint the "Analyze Batch" button in the React app calls
(via the Express backend). It is the ONLY place in the AI service that
chains all three layers together:

    uploaded images
        -> Layer 1 (vision.service)            CV freshness + class dist
        -> Layer 2 (shelf_life.assessment)      RAG-grounded shelf-life
        -> Layer 3 (decision.engine)            deterministic action plan

/decision/agent (the optional "Get AI Insights" explanation) stays a
separate call the frontend makes only when the user asks for it - this
endpoint never calls the LLM-based agent itself, only the deterministic
`decide()`.
"""
import json
import logging
import time
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ValidationError

from ai.api.routes import get_service
from ai.decision.engine import decide
from ai.decision.schema import (
    BatchInfo,
    DecisionEngineError,
    DecisionRequest,
    DecisionResult,
    MarketInfo,
    RouteInfo,
    ShelfLifeInput,
)
from ai.shelf_life.schema import (
    AssessmentError,
    CVAnalysis,
    ShelfLifeAssessment,
    ShelfLifeRequest,
    StorageConditions,
)
from ai.vision.service import batch_prediction_to_cv_analysis, run_cv_on_images

logger = logging.getLogger("taza.analyze")

router = APIRouter()


class AnalyzeBatchResult(BaseModel):
    """Combined response: everything the React dashboard needs for one
    batch in a single round trip."""

    batch_id: str
    cv_analysis: CVAnalysis
    shelf_life: ShelfLifeAssessment
    decision: DecisionResult


def _load_images(files: List[UploadFile]) -> List[Image.Image]:
    images = []
    for f in files:
        raw = f.file.read()
        try:
            images.append(Image.open(BytesIO(raw)))
        except UnidentifiedImageError:
            raise HTTPException(
                status_code=422,
                detail=DecisionEngineError(
                    error="invalid_image",
                    detail=f"Could not decode uploaded file '{f.filename}' as an image.",
                    stage="input_validation",
                ).model_dump(),
            )
    return images


def _parse_json_form_field(raw: Optional[str], field_name: str):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=422,
            detail=DecisionEngineError(
                error="invalid_json",
                detail=f"'{field_name}' must be valid JSON: {e}",
                stage="input_validation",
            ).model_dump(),
        )


@router.post("/analyze-batch", response_model=AnalyzeBatchResult)
def analyze_batch(
    batch_id: str = Form(...),
    produce: str = Form(...),
    quantity_kg: float = Form(...),
    images: List[UploadFile] = File(
    ...,
    media_type="image/*"
),
    harvest_age_days: Optional[float] = Form(None),
    temperature_c: Optional[float] = Form(None),
    humidity_percent: Optional[float] = Form(None),
    storage_duration_hours: Optional[float] = Form(None),
    transport_duration_hours: Optional[float] = Form(None),
    storage_type: Optional[str] = Form(None),
    markets: Optional[str] = Form(None, description="JSON-encoded list of MarketInfo"),
    routes: Optional[str] = Form(None, description="JSON-encoded list of RouteInfo"),
    local_market: Optional[str] = Form(None, description="JSON-encoded MarketInfo"),
):
    if not images:
        raise HTTPException(
            status_code=422,
            detail=DecisionEngineError(
                error="no_images",
                detail="At least one produce image is required.",
                stage="input_validation",
            ).model_dump(),
        )

    t0 = time.monotonic()
    logger.info("[PYTHON] request received (batch_id=%s)", batch_id)

    # ---- Layer 1: CV ----
    logger.info("[PYTHON] CV started")
    pil_images = _load_images(images)
    try:
        batch_prediction = run_cv_on_images(pil_images)
    except Exception as e:  # noqa: BLE001
        logger.exception("Vision inference failed")
        raise HTTPException(
            status_code=502,
            detail=DecisionEngineError(
                error="vision_error", detail=str(e), stage="engine"
            ).model_dump(),
        )
    cv_dict = batch_prediction_to_cv_analysis(batch_prediction)
    logger.info("[PYTHON] CV done (%.2fs elapsed)", time.monotonic() - t0)

    # ---- Layer 2: shelf life (RAG + LLM) ----
    try:
        storage = StorageConditions(
            harvest_age_days=harvest_age_days,
            temperature_c=temperature_c,
            humidity_percent=humidity_percent,
            storage_duration_hours=storage_duration_hours,
            transport_duration_hours=transport_duration_hours,
            storage_type=storage_type,
        )
        sl_request = ShelfLifeRequest(
            produce=produce,
            batch_size_kg=quantity_kg,
            cv_analysis=CVAnalysis(**cv_dict),
            storage=storage,
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=DecisionEngineError(
                error="invalid_request", detail=str(e), stage="input_validation"
            ).model_dump(),
        )

    logger.info("[PYTHON] shelf-life started (%.2fs elapsed)", time.monotonic() - t0)
    sl_service = get_service()
    sl_result = sl_service.assess(sl_request)
    if isinstance(sl_result, AssessmentError):
        status_code = 422 if sl_result.stage in ("input_validation", "output_validation") else 502
        raise HTTPException(status_code=status_code, detail=sl_result.model_dump())
    logger.info("[PYTHON] shelf-life done (%.2fs elapsed)", time.monotonic() - t0)

    # ---- Layer 3: deterministic decision engine ----
    markets_data = _parse_json_form_field(markets, "markets") or []
    routes_data = _parse_json_form_field(routes, "routes") or []
    local_market_data = _parse_json_form_field(local_market, "local_market")

    logger.info("[PYTHON] decision started (%.2fs elapsed)", time.monotonic() - t0)
    try:
        decision_request = DecisionRequest(
            batch=BatchInfo(batch_id=batch_id, produce=produce, quantity_kg=quantity_kg),
            shelf_life_assessment=ShelfLifeInput.from_assessment(sl_result),
            markets=[MarketInfo(**m) for m in markets_data],
            routes=[RouteInfo(**r) for r in routes_data],
            local_market=MarketInfo(**local_market_data) if local_market_data else None,
        )
        decision_result = decide(decision_request)
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=DecisionEngineError(
                error="invalid_request", detail=str(e), stage="input_validation"
            ).model_dump(),
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Decision engine failed")
        raise HTTPException(
            status_code=422,
            detail=DecisionEngineError(
                error="engine_error", detail=str(e), stage="engine"
            ).model_dump(),
        )

    logger.info("[PYTHON] response ready (%.2fs total elapsed)", time.monotonic() - t0)
    return AnalyzeBatchResult(
        batch_id=batch_id,
        cv_analysis=CVAnalysis(**cv_dict),
        shelf_life=sl_result,
        decision=decision_result,
    )