import unittest

from toto_predictor import model


class ModelTest(unittest.TestCase):
    def test_devig(self):
        p = model.implied_from_odds({"1": 2.0, "X": 3.4, "2": 3.8})
        self.assertAlmostEqual(sum(p.values()), 1.0)
        self.assertGreater(p["1"], p["2"])

    def test_empty_research_uses_fallback(self):
        out = model.predict({})
        self.assertEqual(out["base_source"], "fallback")
        self.assertAlmostEqual(sum(out["prob"].values()), 1.0, places=3)

    def test_home_absences_shift_towards_away(self):
        base = {"agent_estimate": {"1": 0.45, "X": 0.3, "2": 0.25}}
        hurt = {**base, "absences": [{"team": "home", "importance": 1.0}] * 2}
        self.assertLess(model.predict(hurt)["prob"]["1"], model.predict(base)["prob"]["1"])

    def test_doubtful_counts_half(self):
        out = {"absences": [{"team": "home", "status": "out", "importance": 1.0}]}
        doubtful = {"absences": [{"team": "home", "status": "doubtful", "importance": 1.0}]}
        self.assertAlmostEqual(
            model.adjustments(doubtful)["absences"], model.adjustments(out)["absences"] / 2
        )

    def test_rotation_risk_shifts_against_rotating_team(self):
        adj = model.adjustments({"rotation_risk": {"home": "high", "away": "none"}})
        self.assertLess(adj["rotation"], 0)

    def test_loosely_typed_research_does_not_crash(self):
        messy = {
            "odds": "n/a", "agent_estimate": {"1": "0.5", "X": "0.3", "2": "0.2"},
            "absences": ["x", {"team": "home", "importance": "high"}],
            "fatigue": {"home_rest_days": "2", "away_rest_days": None, "home_matches_14d": "?"},
            "internationals": None, "venue": "Bloomfield", "h2h": {"home_wins": "3", "draws": 1},
            "history": {"league_draw_rate": "0.3", "home_team_home_ppg": "x"},
            "weather": {"temperature_c": "31"}, "rotation_risk": "high",
        }
        out = model.predict(messy)
        self.assertEqual(out["base_source"], "agent")
        self.assertAlmostEqual(sum(out["prob"].values()), 1.0, places=3)
        self.assertLess(out["adjustments"]["fatigue"], 0)  # "2" rest days parsed

    def test_fan_ban_reduces_home_edge(self):
        base = {"agent_estimate": {"1": 0.5, "X": 0.25, "2": 0.25}}
        ban = {**base, "venue": {"home_fan_ban": True}}
        self.assertLess(model.predict(ban)["prob"]["1"], model.predict(base)["prob"]["1"])

    def test_adjustments_damped_with_odds(self):
        tired = {"fatigue": {"home_rest_days": 2, "away_rest_days": 6}}
        agent_only = {"agent_estimate": {"1": 0.4, "X": 0.3, "2": 0.3}, **tired}
        odds_only = {"odds": {"1": 2.5, "X": 3.33, "2": 3.33}, **tired}
        self.assertAlmostEqual(
            model.predict(odds_only)["adjustments"]["fatigue"],
            model.predict(agent_only)["adjustments"]["fatigue"] / 2,
        )


if __name__ == "__main__":
    unittest.main()
