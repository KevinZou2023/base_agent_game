"""image_generation_tool — call 通义万相 (DashScope ImageSynthesis) to render the artwork."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import dashscope
from dashscope import ImageSynthesis
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.utils.logger import logger


@dataclass(frozen=True)
class ImageGenerationResult:
    image_url: str
    model: str
    request_id: str | None
    prompt_used: str
    raw_meta: dict[str, Any]
    status: str = "done"


class ImageGenerationError(RuntimeError):
    pass


_TURBO_SIZE = "1024*1024"  # the wanx-v1/v2 model accepts 1024*1024, 720*1280, etc.


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=15),
    stop=stop_after_attempt(2),
    reraise=True,
)
def _call_image_synthesis(prompt: str, negative_prompt: str, model: str, n: int, size: str):
    """Single attempt at the synchronous DashScope ImageSynthesis call.

    Some Wanxiang models (e.g. wanx-v1) accept the sync API and will block for
    up to ~60 seconds. tenacity wraps the call so we get 2 attempts max.
    """
    return ImageSynthesis.call(
        api_key=settings.dashscope_api_key,
        model=model,
        prompt=prompt,
        negative_prompt=negative_prompt,
        n=n,
        size=size,
    )


def generate_image(
    prompt: str,
    *,
    negative_prompt: str = "",
    model: str | None = None,
    n: int = 1,
    size: str = _TURBO_SIZE,
) -> ImageGenerationResult:
    """Generate one or more images via 通义万相. Returns the first one."""

    chosen_model = model or settings.image_model
    if not settings.dashscope_api_key:
        raise ImageGenerationError("DASHSCOPE_API_KEY is not set")

    logger.info(
        "Calling 通义万相 model={} n={} size={} prompt_len={}",
        chosen_model,
        n,
        size,
        len(prompt),
    )
    start = time.time()
    resp = _call_image_synthesis(prompt, negative_prompt, chosen_model, n, size)
    elapsed = time.time() - start

    if resp.status_code != 200:
        logger.error(
            "Image generation failed: status={} code={} msg={}",
            resp.status_code,
            getattr(resp, "code", "?"),
            getattr(resp, "message", "?"),
        )
        raise ImageGenerationError(
            f"DashScope image gen failed: {getattr(resp, 'message', resp.status_code)}"
        )

    output = resp.output or {}
    results = output.get("results") or []
    if not results:
        raise ImageGenerationError(f"Image gen returned no results: {output}")

    first_url = results[0].get("url")
    if not first_url:
        raise ImageGenerationError(f"Image gen result missing URL: {results[0]}")

    logger.info("通义万相 ok in {:.1f}s → {}", elapsed, first_url[:80])

    return ImageGenerationResult(
        image_url=first_url,
        model=chosen_model,
        request_id=getattr(resp, "request_id", None),
        prompt_used=prompt,
        raw_meta={
            "elapsed_seconds": round(elapsed, 2),
            "result_count": len(results),
            "usage": getattr(resp, "usage", None),
        },
    )


__all__ = ["ImageGenerationResult", "ImageGenerationError", "generate_image"]
