import itertools
import math
import unittest

from toto_predictor import optimizer


def brute_force(probs, shape):
    best = 0.0
    n = len(probs)
    for triples in itertools.combinations(range(n), shape.triples):
        rest = [i for i in range(n) if i not in triples]
        for doubles in itertools.combinations(rest, shape.doubles):
            p = 1.0
            for i, prob in enumerate(probs):
                size = 3 if i in triples else 2 if i in doubles else 1
                p *= optimizer.coverage(prob, size)
            best = max(best, p)
    return best


def make_probs(n, seed=1):
    import random
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        a, b, c = rng.random(), rng.random(), rng.random()
        s = a + b + c
        out.append({"1": a / s, "X": b / s, "2": c / s})
    return out


class OptimizerTest(unittest.TestCase):
    def test_feasible_shapes_for_40_columns(self):
        shapes = {(s.doubles, s.triples) for s in optimizer.feasible_shapes(40, 16)}
        self.assertEqual(shapes, {(5, 0), (3, 1), (2, 2), (0, 3)})
        for s in optimizer.feasible_shapes(40, 16):
            self.assertLessEqual(s.columns, 40)

    def test_dp_matches_brute_force(self):
        probs = make_probs(8, seed=3)
        for shape in optimizer.feasible_shapes(40, 8):
            p, _ = optimizer._best_assignment(probs, shape)
            self.assertTrue(math.isclose(p, brute_force(probs, shape), rel_tol=1e-9))

    def test_ticket_within_budget_and_consistent(self):
        probs = make_probs(16, seed=7)
        ticket, alts = optimizer.build_ticket(probs, 40, 3.0)
        self.assertLessEqual(ticket.cost, 120)
        sizes = [len(c) for c in ticket.covers]
        self.assertEqual(sizes.count(2), ticket.shape.doubles)
        self.assertEqual(sizes.count(3), ticket.shape.triples)
        p = 1.0
        for prob, cover in zip(probs, ticket.covers):
            p *= sum(prob[o] for o in cover)
        self.assertAlmostEqual(p, ticket.p16)
        self.assertEqual(len(alts), 4)

    def test_most_uncertain_match_gets_triple(self):
        probs = [{"1": 0.8, "X": 0.15, "2": 0.05}] * 15 + [{"1": 0.34, "X": 0.33, "2": 0.33}]
        ticket, _ = optimizer.build_ticket(probs, 40, 3.0)
        self.assertEqual(ticket.covers[-1], ["1", "X", "2"])


if __name__ == "__main__":
    unittest.main()
