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


if __name__ == "__main__":
    unittest.main()
