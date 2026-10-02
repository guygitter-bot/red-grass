import unittest

from points_tracker.points import points_for_grams, points_from_nutrition, round1


class PointsTest(unittest.TestCase):
    # Same cases as web/src/lib/lib.test.js: the app and the agent must agree.
    def test_formula_matches_app(self):
        self.assertEqual(round1(points_from_nutrition({"protein": 9, "carbs": 55, "fat": 1.2, "fiber": 2})), 6.9)
        self.assertEqual(round1(points_from_nutrition({"protein": 0, "carbs": 0, "fat": 0, "fiber": 10})), 0)
        self.assertEqual(round1(points_for_grams({"protein": 10, "carbs": 50, "fat": 30, "fiber": 5}, 50)), 6.8)

    def test_round_half_up_like_js(self):
        self.assertEqual(round1(0.25), 0.3)
        self.assertEqual(round1(2.45), 2.5)
