#!/usr/bin/env python3
"""Stage PhotoHarvest downloads as unapproved VahanaIQ catalogue review candidates.

This script NEVER crawls a URL, calls a network service, changes the catalogue,
or exports the Photo Studio publication format. It only inspects local files.
PhotoHarvest does not currently log the original URL per saved image: this
missing provenance is explicit in the generated manifest.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import urlsplit

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError as exc:
    raise SystemExit("Pillow is required. Install it in a virtual environment: python -m pip install Pillow") from exc

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = ROOT / "data" / "catalogue.json"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif", "AVIF": ".avif"}
MAX_PIXEL_COUNT = 40_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXEL_COUNT


class ImportErrorSafe(ValueError):
    """A candidate or bundle does not meet the local import contract."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dhash(image: Image.Image) -> str:
    """64-bit difference hash for curator duplicate hints, not publication decisions."""
    grey = ImageOps.exif_transpose(image).convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(grey.getdata())
    value = 0
    for row in range(8):
        for column in range(8):
            value = (value << 1) | int(pixels[row * 9 + column] > pixels[row * 9 + column + 1])
    return f"{value:016x}"


def hamming_distance(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def validate_seed_url(url: str) -> str:
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.port not in (None, 443) or any(ch.isspace() for ch in url)):
        raise ImportErrorSafe("--source-page must be an HTTPS URL with no credentials or nonstandard port.")
    return url


def catalogue_model(model_id: str, catalogue: Path = CATALOGUE) -> dict:
    if not model_id or not all(char.isascii() and (char.islower() or char.isdigit() or char == "-")
                                   for char in model_id):
        raise ImportErrorSafe("--model-id must be a lowercase catalogue identifier.")
    with catalogue.open("r", encoding="utf-8") as stream:
        models = json.load(stream).get("models", [])
    model = next((model for model in models if model.get("id") == model_id), None)
    if model is None:
        raise ImportErrorSafe(f"No VahanaIQ catalogue entry matches '{model_id}'.")
    return model


def inspect_image(file: Path, min_width: int, min_height: int, max_bytes: int) -> dict:
    size = file.stat().st_size
    if size < 1024 or size > max_bytes:
        raise ImportErrorSafe(f"Image size must be between 1 KB and {max_bytes // 1048576} MiB.")
    try:
        with Image.open(file) as image:
            if image.format not in FORMATS:
                raise ImportErrorSafe("Unsupported decoded image format.")
            image_format = image.format
            width, height = ImageOps.exif_transpose(image).size
            if width * height > MAX_PIXEL_COUNT:
                raise ImportErrorSafe("Too many decoded image pixels.")
            if width < min_width or height < min_height:
                raise ImportErrorSafe(f"Below {min_width}x{min_height} pixel minimum.")
            if getattr(image, "n_frames", 1) > 1:
                raise ImportErrorSafe("Animated images are not suitable as catalogue photos.")
            perceptual = dhash(image)
            image.load()  # Require a fully decodable file, not just a recognisable header.
    except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        if isinstance(exc, ImportErrorSafe):
            raise
        raise ImportErrorSafe("Invalid, corrupt or unsupported image.") from exc
    return {
        "width": width, "height": height, "bytes": size,
        "sha256": sha256_file(file), "dhash": perceptual,
        "extension": FORMATS[image_format],
    }


def build_review(input_dir: Path, model: dict, source_page: str,
                 min_width: int = 1000, min_height: int = 700,
                 max_bytes: int = 12 * 1024 * 1024, max_images: int = 80,
                 created_at: str | None = None) -> dict:
    """Pure preparation: no file writes, and absolutely no network requests."""
    if min_width < 240 or min_height < 120 or max_images < 1 or max_images > 200:
        raise ImportErrorSafe("Image dimensions or --max-images fall outside allowed limits.")
    if not input_dir.is_dir():
        raise ImportErrorSafe(f"PhotoHarvest output directory does not exist: {input_dir}")
    validate_seed_url(source_page)
    candidates = []
    skipped = []
    exact = {}
    for file in sorted(input_dir.iterdir(), key=lambda item: (item.name.lower(), item.name)):
        if file.name.startswith("."):
            continue
        if file.is_symlink():
            skipped.append({"file": file.name, "reason": "Symbolic links are not imported."})
            continue
        if not file.is_file() or file.suffix.lower() not in EXTENSIONS:
            continue
        if len(candidates) >= max_images:
            skipped.append({"file": file.name, "reason": "Candidate count limit reached."})
            continue
        try:
            info = inspect_image(file, min_width, min_height, max_bytes)
        except ImportErrorSafe as exc:
            skipped.append({"file": file.name, "reason": str(exc)})
            continue
        if info["sha256"] in exact:
            skipped.append({"file": file.name, "reason": "Exact duplicate of " + exact[info["sha256"]]})
            continue
        exact[info["sha256"]] = file.name
        near = next((candidate["id"] for candidate in candidates
                     if hamming_distance(info["dhash"], candidate["dhash"]) <= 4), None)
        image_id = info["sha256"][:24]
        candidates.append({
            "id": image_id,
            "file": "images/" + image_id + info["extension"],
            "originalFileName": file.name,
            "sourceImageUrl": None,
            "originPageUrl": None,
            "width": info["width"], "height": info["height"],
            "bytes": info["bytes"], "sha256": info["sha256"],
            "dhash": info["dhash"], "possibleDuplicateOf": near,
            "modelMatchStatus": "unverified",
            "rightsStatus": "unverified",
            "reviewStatus": "pending",
        })
    if not candidates:
        raise ImportErrorSafe("No qualifying candidate photos; review PhotoHarvest output and thresholds.")
    return {
        "schemaVersion": 1,
        "kind": "vahanaiq-photoharvest-review",
        "createdAt": created_at or datetime.now(timezone.utc).isoformat(),
        "catalogueModelId": model["id"],
        "catalogueName": model.get("name", model["id"]),
        "catalogueMake": model.get("make", ""),
        "crawlSeedUrl": source_page,
        "sourcePagePerImageCaptured": False,
        "sourceImageUrlPerImageCaptured": False,
        "sourceTool": {"name": "PhotoHarvest", "repository": "https://github.com/akila-w/PhotoHarvest"},
        "publicationAllowed": False,
        "notice": ("PhotoHarvest does not record the original image URLs. "
                   "Source identity, vehicle match and publication rights require independent verification."),
        "candidates": candidates,
        "skipped": skipped,
    }


def validate_paths(input_dir: Path, output_dir: Path) -> tuple[Path, Path]:
    source = input_dir.expanduser().resolve(strict=True)
    destination = output_dir.expanduser().resolve(strict=False)
    if not source.is_dir():
        raise ImportErrorSafe("PhotoHarvest input must be an existing directory.")
    if destination == ROOT or ROOT in destination.parents:
        raise ImportErrorSafe("Review bundles must be stored outside the VahanaIQ repository.")
    if destination == source or source in destination.parents:
        raise ImportErrorSafe("Review output cannot be inside the PhotoHarvest input folder.")
    if os.path.lexists(destination):
        raise ImportErrorSafe(f"Refusing to overwrite an existing review bundle: {destination}")
    if not destination.parent.is_dir():
        raise ImportErrorSafe("The output parent directory must exist.")
    return source, destination


def export_bundle(review: dict, source: Path, destination: Path) -> None:
    """Write to private staging first; never overwrite an existing review."""
    staging = Path(tempfile.mkdtemp(prefix=".photoharvest-staging-", dir=destination.parent))
    try:
        (staging / "images").mkdir()
        for candidate in review["candidates"]:
            original = source / candidate["originalFileName"]
            # Recheck before reading; generated paths are content-hash basenames.
            if original.is_symlink() or not original.is_file():
                raise ImportErrorSafe(f"Input changed while staging: {original.name}")
            target = staging / candidate["file"]
            shutil.copyfile(original, target)
            if sha256_file(target) != candidate["sha256"]:
                raise ImportErrorSafe(f"Input changed during copy: {original.name}")
        (staging / "review-manifest.json").write_text(
            json.dumps(review, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        if os.path.lexists(destination):
            raise ImportErrorSafe("Review destination appeared during staging; refusing to overwrite.")
        staging.rename(destination)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-id", required=True, help="Exact ID in data/catalogue.json")
    parser.add_argument("--input-dir", required=True, type=Path, help="Existing PhotoHarvest Downloads folder")
    parser.add_argument("--source-page", required=True, help="HTTPS page entered into PhotoHarvest (context only)")
    parser.add_argument("--output-dir", type=Path, help="New review folder; must be outside the repository")
    parser.add_argument("--min-width", type=int, default=1000)
    parser.add_argument("--min-height", type=int, default=700)
    parser.add_argument("--max-images", type=int, default=80)
    parser.add_argument("--dry-run", action="store_true", help="Validate and summarise; write nothing")
    args = parser.parse_args(argv)
    try:
        model = catalogue_model(args.model_id)
        source = args.input_dir.expanduser().resolve(strict=True)
        if args.output_dir:
            desired = args.output_dir
        else:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            desired = Path.home() / "Downloads" / "VahanaIQ-PhotoHarvest-review" / f"{model['id']}-{timestamp}"
            if not desired.parent.exists() and not args.dry_run:
                # Create a single controlled review root outside the repository.
                desired.parent.mkdir(parents=True, exist_ok=True)
        if not desired.parent.expanduser().exists() and args.dry_run:
            # Validate dry-run without creating the default parent.
            desired = Path(tempfile.gettempdir()) / desired.name
        source, destination = validate_paths(source, desired)
        review = build_review(source, model, args.source_page, args.min_width,
                              args.min_height, max_images=args.max_images)
        print(f"Model: {model['id']} | accepted: {len(review['candidates'])} | skipped: {len(review['skipped'])}")
        print("All candidates remain pending; original image URLs and rights are NOT verified.")
        if args.dry_run:
            print("Dry run: no files written.")
        else:
            export_bundle(review, source, destination)
            print(f"Review bundle created: {destination}")
        return 0
    except (ImportErrorSafe, OSError, json.JSONDecodeError) as exc:
        print(f"PhotoHarvest import refused: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
