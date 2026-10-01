"""Choose which matches get a double or a triple, within the budget.

Objective: maximise P(16) - the probability that every one of the 16
matches is covered by the ticket. Each match's coverage is the summed
probability of the outcomes it covers:

    single -> top outcome, double -> top two, triple -> all three (1.0)

For every (doubles, triples) shape whose column count fits the budget we
pick the exact best assignment of matches to shapes with a small dynamic
program, then keep the shape with the highest P(16).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

OUTCOMES = ("1", "X", "2")


@dataclass
class Shape:
    doubles: int
    triples: int

    @property
    def columns(self) -> int:
        return 2**self.doubles * 3**self.triples


@dataclass
class Ticket:
    shape: Shape
    covers: list[list[str]]  # per match, the covered outcomes in 1/X/2 order
    p16: float
    column_price: float

    @property
    def columns(self) -> int:
        return self.shape.columns

    @property
    def cost(self) -> float:
        return self.columns * self.column_price


def ranked_outcomes(prob: dict[str, float]) -> list[str]:
    """Outcomes ordered from most to least likely (ties keep 1/X/2 order)."""
    return sorted(OUTCOMES, key=lambda o: -prob[o])


def coverage(prob: dict[str, float], size: int) -> float:
    ranked = ranked_outcomes(prob)
    return min(1.0, sum(prob[o] for o in ranked[:size]))


def feasible_shapes(max_columns: int, match_count: int) -> list[Shape]:
    """Shapes that fit the budget and are not dominated by a bigger one.

    A shape is dominated when one more double still fits: adding coverage
    never lowers P(16), so the smaller shape can only tie.
    """
    shapes = []
    triples = 0
    while 3**triples <= max_columns and triples <= match_count:
        doubles = 0
        while (
            2 ** (doubles + 1) * 3**triples <= max_columns
            and doubles + 1 + triples <= match_count
        ):
            doubles += 1
        shapes.append(Shape(doubles, triples))
        triples += 1
    return shapes


def _best_assignment(probs: list[dict[str, float]], shape: Shape):
    """Exact DP: maximise sum(log coverage) using exactly the shape's counts."""
    neg_inf = float("-inf")
    # dp[(d, t)] = (score, choices) after processing a prefix of matches.
    dp = {(0, 0): (0.0, [])}
    for prob in probs:
        logs = {
            size: math.log(max(coverage(prob, size), 1e-12)) for size in (1, 2, 3)
        }
        nxt: dict[tuple[int, int], tuple[float, list[int]]] = {}
        for (d, t), (score, choices) in dp.items():
            for size, nd, nt in ((1, d, t), (2, d + 1, t), (3, d, t + 1)):
                if nd > shape.doubles or nt > shape.triples:
                    continue
                cand = score + logs[size]
                if cand > nxt.get((nd, nt), (neg_inf, None))[0]:
                    nxt[(nd, nt)] = (cand, choices + [size])
        dp = nxt
    score, choices = dp.get((shape.doubles, shape.triples), (neg_inf, None))
    if choices is None:
        return None
    return math.exp(score), choices


def build_ticket(
    probs: list[dict[str, float]],
    max_columns: int,
    column_price: float,
    tie_tolerance: float = 0.05,
) -> tuple[Ticket, list[Ticket]]:
    """Return the recommended ticket and the best ticket for every shape.

    When two shapes are within ``tie_tolerance`` (relative) of each other,
    the cheaper one wins.
    """
    candidates = []
    for shape in feasible_shapes(max_columns, len(probs)):
        result = _best_assignment(probs, shape)
        if result is None:
            continue
        p16, sizes = result
        covers = []
        for prob, size in zip(probs, sizes):
            chosen = set(ranked_outcomes(prob)[:size])
            covers.append([o for o in OUTCOMES if o in chosen])
        candidates.append(Ticket(shape, covers, p16, column_price))
    if not candidates:
        raise ValueError("No ticket fits the budget")

    best_p16 = max(t.p16 for t in candidates)
    near_best = [t for t in candidates if t.p16 >= best_p16 * (1 - tie_tolerance)]
    recommended = min(near_best, key=lambda t: (t.columns, -t.p16))
    candidates.sort(key=lambda t: -t.p16)
    return recommended, candidates
