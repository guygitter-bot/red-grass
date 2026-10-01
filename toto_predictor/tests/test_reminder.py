import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from toto_predictor import reminder


class ReminderTest(unittest.TestCase):
    def test_last_run_cost(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "latest.json"
            self.assertIsNone(reminder.last_run_cost(path))
            path.write_text(json.dumps({"usage": {"estimated_cost_usd": 10.48}}))
            self.assertEqual(reminder.last_run_cost(path), 10.48)
            path.write_text(json.dumps({"usage": None}))
            self.assertIsNone(reminder.last_run_cost(path))

    def test_text(self):
        text = reminder.reminder_text(10.48, "empty")
        self.assertIn("10.48$", text)
        self.assertIn("נגמר הקרדיט", text)
        self.assertIn(reminder.BILLING_URL, text)
        self.assertNotIn("\n\n\n", reminder.reminder_text(None, "skipped"))

    def test_probe_skipped_without_key(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
            self.assertEqual(reminder.probe_credit(), "skipped")


if __name__ == "__main__":
    unittest.main()
