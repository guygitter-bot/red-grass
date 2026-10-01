import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from toto_predictor import demo, notify, run_weekly


class RunWeeklyTest(unittest.TestCase):
    def test_demo_pipeline(self):
        round_info = demo.find_round()
        research = demo.research_all(round_info["matches"], "demo")
        research[3] = None  # one failed match
        result = run_weekly.build_result(round_info, research)
        self.assertLessEqual(result["ticket"]["cost"], 120)
        self.assertEqual(len(result["matches"]), 16)
        self.assertFalse(result["matches"][3]["researched"])
        with tempfile.TemporaryDirectory() as tmp:
            path = run_weekly.save(result, Path(tmp))
            self.assertTrue(path.exists())
            self.assertEqual(json.loads((Path(tmp) / "index.json").read_text()), ["demo"])
        text = notify.ticket_text(result)
        self.assertIn("מחזור demo", text)
        self.assertIn("⚠️", text)

    def test_manual_round_close_time(self):
        lines = ";".join(f"קבוצה {i} - יריבה {i}" for i in range(16))
        env = {"MANUAL_MATCHES": lines, "MANUAL_FIRST_KICKOFF": "2026-10-03T19:30"}
        with mock.patch.dict(os.environ, env):
            info = run_weekly.get_round(agent=None)
        self.assertEqual(info["close_time"], "2026-10-03T19:24:00+03:00")

    def test_closed_form_is_not_sent(self):
        round_info = demo.find_round()
        round_info["matches"][0]["kickoff"] = "2020-01-01T12:00:00+02:00"
        with mock.patch.object(demo, "find_round", return_value=round_info), \
                mock.patch.object(run_weekly, "save"), \
                mock.patch.object(run_weekly.notify, "notify") as sent, \
                mock.patch.dict(os.environ, {"DEMO": "1"}):
            self.assertEqual(run_weekly.main(), 1)
        sent.assert_not_called()

    def test_parse_manual_matches(self):
        lines = "\n".join(f"קבוצה {i} - יריבה {i}" for i in range(16))
        matches = run_weekly.parse_manual_matches(lines)
        self.assertEqual(matches[0]["home_he"], "קבוצה 0")
        self.assertEqual(matches[15]["index"], 16)
        self.assertEqual(run_weekly.parse_manual_matches(lines.replace("\n", ";")), matches)
        with self.assertRaises(ValueError):
            run_weekly.parse_manual_matches("א - ב")


if __name__ == "__main__":
    unittest.main()
