"""Local file storage for generated artwork images.

Downloads an image URL (returned by 通义万相) to a local path under
`storage/images/` and exposes a static URL that the FastAPI server
mounts at `/static/images/...`.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.utils.logger import logger


@dataclass(frozen=True)
class StoredImage:
    artwork_id: str
    local_path: Path
    static_url: str       # e.g. /static/images/art_001.png
    original_url: str
    size_bytes: int

    @property
    def filename(self) -> str:
        return self.local_path.name


@retry(
    wait=wait_exponential(multiplier=1, min=1, max=8),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _download(url: str, dst: Path, timeout: float = 60.0) -> int:
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            written = 0
            with dst.open("wb") as f:
                for chunk in resp.iter_bytes():
                    f.write(chunk)
                    written += len(chunk)
            return written


def _infer_extension(url: str, default: str = ".png") -> str:
    """Pick a file extension from the URL path, defaulting to .png."""
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return suffix
    return default


def save_remote_image(artwork_id: str, remote_url: str) -> StoredImage:
    """Download `remote_url` and persist to storage/images/{artwork_id}.{ext}."""

    settings.image_path.mkdir(parents=True, exist_ok=True)
    ext = _infer_extension(remote_url)
    safe_id = artwork_id.replace("/", "_").replace("\\", "_")
    local_path = settings.image_path / f"{safe_id}{ext}"

    logger.info("Downloading image for {} → {}", artwork_id, local_path)
    size = _download(remote_url, local_path)
    static_url = f"/static/images/{local_path.name}"
    logger.info("Saved {} bytes for {}", size, artwork_id)

    return StoredImage(
        artwork_id=artwork_id,
        local_path=local_path,
        static_url=static_url,
        original_url=remote_url,
        size_bytes=size,
    )


def resolve_static_path(filename: str) -> Path | None:
    """Resolve a `/static/images/{filename}` request to a local path on disk."""
    candidate = (settings.image_path / filename).resolve()
    if not str(candidate).startswith(str(settings.image_path.resolve())):
        return None  # path traversal attempt
    if not candidate.exists():
        return None
    return candidate


__all__ = ["StoredImage", "save_remote_image", "resolve_static_path"]
