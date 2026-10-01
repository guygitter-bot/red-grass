import json
import tempfile
import unittest
from pathlib import Path

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
