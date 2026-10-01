import datetime as dt
import unittest

from toto_predictor import model, run_weekly, weather
from toto_predictor.closing import ISRAEL


def fake_fetch(params):
    fake_fetch.params = params
    return {"hourly": {
        "time": ["2026-10-03T13:00", "2026-10-03T14:00", "2026-10-03T15:00"],
        "temperature_2m": [30.0, 32.0, 28.0],
        "precipitation": [0.0, 0.0, 0.0],
        "wind_speed_10m": [10.0, 14.0, 20.0],
    }}


class WeatherTest(unittest.TestCase):
    def test_kickoff_hour_average(self):
        kickoff = dt.datetime(2026, 10, 3, 13, 30, tzinfo=ISRAEL)
        out = weather.kickoff_weather(32.8, 35.0, kickoff, fetch=fake_fetch)
        self.assertEqual(out["temperature_c"], 31.0)
        self.assertEqual(out["wind_kmh"], 12.0)
        self.assertEqual(fake_fetch.params["timezone"], "Asia/Jerusalem")

    def test_missing_hour(self):
        kickoff = dt.datetime(2026, 10, 3, 21, 0, tzinfo=ISRAEL)
        self.assertIsNone(weather.kickoff_weather(32.8, 35.0, kickoff, fetch=fake_fetch))

    def test_add_weather_skips_missing_coordinates(self):
        matches = [{"index": 1, "kickoff": "2026-10-03T13:00:00+03:00"},
                   {"index": 2, "kickoff": "2026-10-03T13:00:00+03:00"}]
        research = [{"venue": {"latitude": 32.8, "longitude": 35.0}}, {"venue": {}}]
        run_weekly.add_weather(matches, research, fetch=fake_fetch)
        self.assertEqual(research[0]["weather"]["temperature_c"], 31.0)
        self.assertNotIn("weather", research[1])

    def test_heat_and_draw_rate_raise_draw(self):
        base = {"agent_estimate": {"1": 0.45, "X": 0.27, "2": 0.28}}
        hot = {**base, "weather": {"temperature_c": 33}, "history": {"league_draw_rate": 0.32}}
        self.assertGreater(model.predict(hot)["prob"]["X"], model.predict(base)["prob"]["X"])

    def test_history_ppg_gap(self):
        strong_home = {"history": {"home_team_home_ppg": 2.4, "away_team_away_ppg": 0.8}}
        self.assertGreater(model.adjustments(strong_home)["history"], 0)


if __name__ == "__main__":
    unittest.main()
