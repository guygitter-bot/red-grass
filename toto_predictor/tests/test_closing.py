import datetime as dt
import unittest

from toto_predictor import closing


class ClosingTest(unittest.TestCase):
    def test_six_minutes_before_first_kickoff(self):
        matches = [
            {"kickoff": "2026-10-03T20:00:00+03:00"},
            {"kickoff": "2026-10-03T17:30:00+03:00"},
            {"kickoff": "unknown"},
        ]
        when, source = closing.close_time(matches)
        self.assertEqual(source, "first_kickoff")
        self.assertEqual(when, dt.datetime(2026, 10, 3, 17, 24, tzinfo=dt.timezone(dt.timedelta(hours=3))))

    def test_naive_kickoff_is_israel_time(self):
        when, _ = closing.close_time([{"kickoff": "2026-12-05T15:00"}])
        self.assertEqual(when.utcoffset(), dt.timedelta(hours=2))  # winter time
        self.assertEqual(closing.format_he(when), "יום שבת 05.12 בשעה 14:54")

    def test_earlier_published_close_wins(self):
        when, source = closing.close_time(
            [{"kickoff": "2026-10-03T20:00:00+03:00"}], "2026-10-03T18:00:00+03:00"
        )
        self.assertEqual(source, "form")
        self.assertEqual(when.hour, 18)

    def test_unknown(self):
        self.assertEqual(closing.close_time([{"kickoff": "?"}], "בשבת"), (None, "unknown"))
        self.assertEqual(closing.format_he(None), "לא ידוע")


if __name__ == "__main__":
    unittest.main()
