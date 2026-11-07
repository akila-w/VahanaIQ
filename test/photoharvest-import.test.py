#!/usr/bin/env python3
"""Offline fixture tests for the PhotoHarvest review-bundle importer."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "import-photoharvest.py"
spec = importlib.util.spec_from_file_location("photo_import", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.source = self.base / "source"
        self.source.mkdir()
        self.model = {"id": "test-car", "name": "Test Car", "make": "Test"}
        self.page = "https://example.org/model"

    def image(self, name, colour="red", size=(1024, 720)):
        p = self.source / name
        Image.new("RGB", size, colour).save(p)
        return p

    def test_candidate_and_provenance_defaults(self):
        self.image("001_hero.jpg")
        review = module.build_review(self.source, self.model, self.page, created_at="2026-10-30T00:00:00+00:00")
        self.assertEqual(len(review["candidates"]), 1)
        candidate = review["candidates"][0]
        self.assertEqual(candidate["rightsStatus"], "unverified")
        self.assertEqual(candidate["modelMatchStatus"], "unverified")
        self.assertEqual(candidate["reviewStatus"], "pending")
        self.assertIsNone(candidate["sourceImageUrl"])
        self.assertFalse(review["publicationAllowed"])
        self.assertEqual(candidate["width"], 1024)
        self.assertEqual(candidate["height"], 720)
        self.assertEqual(len(candidate["sha256"]), 64)
        self.assertEqual(len(candidate["dhash"]), 16)

    def test_duplicates_bad_and_too_small(self):
        first = self.image("first.jpg")
        (self.source / "second.jpg").write_bytes(first.read_bytes())
        self.image("tiny.jpg", size=(200, 150))
        (self.source / "broken.png").write_bytes(b"not an image" * 100)
        review = module.build_review(self.source, self.model, self.page)
        self.assertEqual(len(review["candidates"]), 1)
        self.assertEqual(len(review["skipped"]), 3)
        reasons = [item["reason"] for item in review["skipped"]]
        self.assertTrue(any("Exact duplicate" in reason for reason in reasons))
        self.assertTrue(any("minimum" in reason for reason in reasons))
        self.assertTrue(any("Invalid" in reason for reason in reasons))

    def test_rejects_non_https_or_embedded_credentials(self):
        self.image("photo.jpg")
        for url in ["http://example.org/car", "https://user:pass@example.org/car", "file:///etc/passwd",
                    "https://example.org:8080/car"]:
            with self.subTest(url=url), self.assertRaises(module.ImportErrorSafe):
                module.build_review(self.source, self.model, url)

    def test_missing_catalogue_id(self):
        fixture = self.base / "catalogue.json"
        fixture.write_text(json.dumps({"models": [self.model]}))
        self.assertEqual(module.catalogue_model("test-car", fixture)["name"], "Test Car")
        with self.assertRaises(module.ImportErrorSafe):
            module.catalogue_model("../test-car", fixture)
        with self.assertRaises(module.ImportErrorSafe):
            module.catalogue_model("unknown", fixture)

    def test_export_is_isolated_and_refuses_overwrite(self):
        self.image("hero.jpg")
        review = module.build_review(self.source, self.model, self.page)
        destination = self.base / "staged"
        src, out = module.validate_paths(self.source, destination)
        module.export_bundle(review, src, out)
        self.assertTrue((out / "review-manifest.json").exists())
        self.assertEqual(len(list((out / "images").iterdir())), 1)
        saved = json.loads((out / "review-manifest.json").read_text())
        self.assertEqual(saved["catalogueModelId"], "test-car")
        with self.assertRaises(module.ImportErrorSafe):
            module.validate_paths(self.source, destination)

    def test_symlinks_are_skipped(self):
        self.image("good.jpg")
        (self.source / "linked.jpg").symlink_to(self.source / "good.jpg")
        review = module.build_review(self.source, self.model, self.page)
        self.assertEqual(len(review["candidates"]), 1)
        self.assertTrue(any("Symbolic links" in x["reason"] for x in review["skipped"]))


    def write_provenance(self, files=None, status="completed", seed=None):
        from datetime import datetime
        files = files if files is not None else [x for x in self.source.iterdir() if x.is_file()]
        records = []
        for file in files:
            with Image.open(file) as picture:
                width, height = picture.size
            records.append({
                "filename": file.name,
                "sha256": module.sha256_file(file),
                "bytes": file.stat().st_size,
                "width": width, "height": height,
                "sourcePageUrl": "https://example.org/observed",
                "requestedImageUrl": "https://cdn.example.org/requested.jpg",
                "resolvedImageUrl": "https://cdn.example.org/final.jpg",
                "sourceKind": "web-url",
                "deliveryMethod": "playwright-request",
                "acquiredAt": "2026-10-30T02:54:00Z",
                "contentType": "image/jpeg",
                "reviewStatus": "pending",
                "rightsStatus": "unverified",
            })
        document = {
            "manifestVersion": 1, "kind": "photoharvest-acquisition",
            "tool": "PhotoHarvest", "seedUrl": seed or self.page,
            "status": status, "images": records,
        }
        (self.source / module.PROVENANCE_NAME).write_text(json.dumps(document))
        return document

    def test_provenance_verified_and_transferred(self):
        original = self.image("001_front.jpg")
        self.write_provenance()
        acquisition = module.load_provenance(self.source, self.page)
        review = module.build_review(self.source, self.model, self.page, provenance=acquisition)
        self.assertEqual(review["acquisitionManifest"]["version"], 1)
        self.assertTrue(review["sourcePagePerImageCaptured"])
        self.assertTrue(review["sourceImageUrlPerImageCaptured"])
        candidate = review["candidates"][0]
        self.assertEqual(candidate["originPageUrl"], "https://example.org/observed")
        self.assertEqual(candidate["resolvedImageUrl"], "https://cdn.example.org/final.jpg")
        self.assertEqual(candidate["sourceImageUrl"], "https://cdn.example.org/requested.jpg")
        self.assertEqual(candidate["sha256"], module.sha256_file(original))
        self.assertFalse(review["publicationAllowed"])
        self.assertEqual(candidate["rightsStatus"], "unverified")

    def test_reject_tampered_image(self):
        original = self.image("001_front.jpg")
        self.write_provenance()
        original.write_bytes(original.read_bytes() + b"tampered")
        manifest = module.load_provenance(self.source)
        with self.assertRaises(module.ImportErrorSafe):
            module.build_review(self.source, self.model, self.page, provenance=manifest)

    def test_reject_manifest_unsafe_names_and_repeated_names(self):
        self.image("001_front.jpg")
        document = self.write_provenance()
        for filename in ("../outside.jpg", "nested/image.jpg", "001_front.jpg"):
            altered = json.loads(json.dumps(document))
            altered["images"][0]["filename"] = filename
            if filename == "001_front.jpg":
                altered["images"].append(altered["images"][0].copy())
            (self.source / module.PROVENANCE_NAME).write_text(json.dumps(altered))
            with self.subTest(filename=filename), self.assertRaises(module.ImportErrorSafe):
                module.load_provenance(self.source)

    def test_reject_wrong_seed_and_incomplete(self):
        self.image("001_front.jpg")
        self.write_provenance(status="in-progress")
        with self.assertRaises(module.ImportErrorSafe):
            module.load_provenance(self.source)
        self.assertEqual(module.load_provenance(self.source, allow_incomplete=True)["status"], "in-progress")
        with self.assertRaises(module.ImportErrorSafe):
            module.load_provenance(self.source, source_page="https://another.example/page")

    def test_manifest_does_not_promote_unrecorded_images(self):
        a = self.image("001_front.jpg")
        self.write_provenance(files=[a])
        self.image("unlisted.jpg", colour="blue")
        provenance = module.load_provenance(self.source)
        review = module.build_review(self.source, self.model, self.page, provenance=provenance)
        self.assertEqual(len(review["candidates"]), 1)
        self.assertTrue(any("Not listed" in item["reason"] for item in review["skipped"]))

    def test_reject_invalid_manifest_hash_and_claims(self):
        self.image("001_front.jpg")
        manifest = self.write_provenance()
        for field, value in [("sha256", "invalid"), ("rightsStatus", "approved"),
                             ("reviewStatus", "approved"), ("sourcePageUrl", "file:///tmp/a")]:
            modified = json.loads(json.dumps(manifest))
            modified["images"][0][field] = value
            (self.source / module.PROVENANCE_NAME).write_text(json.dumps(modified))
            with self.subTest(field=field), self.assertRaises(module.ImportErrorSafe):
                module.load_provenance(self.source)


if __name__ == "__main__":
    unittest.main()
