# בדיקות לאכיפת הכללים (נתונים מומצאים בלבד – המאגר ציבורי). הרצה: python3 tests/test_validate.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine"))
import validate

CFG = {"target_min": 420, "target_max": 480, "intro_seconds": 5.0, "outro_seconds": 12.0, "fade": 0.6}
DUR = 900.0
TRANSCRIPT = [
    {"start": 100, "end": 104, "text": "שלום, אפשר לעזור?", "speaker": "B"},
    {"start": 105, "end": 108, "text": "מחפש טלפון", "speaker": "A"},
]


def raw(clips, subs=(), groups=None, markers=None):
    g = groups if groups is not None else [
        {"at": 120, "cards": [{"kind": "keep", "text": f"טוב {i}"} for i in range(4)]},
        {"at": 700, "cards": [{"kind": "fix", "text": f"לשפר {i}"} for i in range(3)]},
    ]
    return {"markers": markers or {"entry_start": 10, "desk_start": 400, "exit_end": 890},
            "clips": [{"start": a, "end": b, "priority": p, "reason": ""} for a, b, p in clips],
            "subtitles": [{"start": a, "end": b, "text": t} for a, b, t in subs], "card_groups": g,
            "summary": {"keep": [], "fix": []}}


def total(plan):
    return validate.film_length(plan, CFG)


def test_must_include_always_present():
    r = raw([(90, 200, 1), (650, 760, 1)])
    plan, _ = validate.build(r, {"must_include": [{"start": 500, "end": 530}]}, TRANSCRIPT, DUR, CFG)
    assert any(c["start"] <= 500 and c["end"] >= 530 for c in plan)


def test_long_film_drops_low_priority_not_required():
    r = raw([(0, 30, 1), (40, 300, 2), (310, 500, 3), (510, 700, 1), (860, 900, 1)])
    plan, warns = validate.build(r, {"must_include": [{"start": 320, "end": 340}]}, TRANSCRIPT, DUR, CFG)
    assert any(c["start"] <= 320 and c["end"] >= 340 for c in plan), "required range removed"
    assert total(plan) <= CFG["target_max"] or warns


def test_required_alone_too_long_warns_not_trims():
    r = raw([(0, 20, 1)])
    job = {"must_include": [{"start": 50, "end": 600}]}
    plan, warns = validate.build(r, job, TRANSCRIPT, DUR, CFG)
    assert any(c["start"] <= 50 and c["end"] >= 600 for c in plan)
    assert any("required ranges alone" in w for w in warns)


def test_overlaps_merge():
    r = raw([(100, 150, 1), (149, 200, 2), (202, 260, 2)])
    plan, _ = validate.build(r, {}, TRANSCRIPT, DUR, CFG)
    assert sum(1 for c in plan if c["start"] < 260 and c["end"] > 100) == 1


def test_subs_only_rep_and_inside_clips():
    r = raw([(95, 130, 1)], subs=[(100, 104, "שלום, אפשר לעזור?"), (105, 108, "מחפש טלפון"), (300, 302, "בחוץ")])
    plan, warns = validate.build(r, {"rep_speaker": "B"}, TRANSCRIPT, DUR, CFG)
    texts = [s["text"] for c in plan for s in c["subs"]]
    assert texts == ["שלום, אפשר לעזור?"], texts
    assert any("subtitles dropped" in w for w in warns)


def test_two_groups_inside_clips_and_capped():
    groups = [{"at": 120, "cards": [{"kind": "keep", "text": str(i)} for i in range(6)]},
              {"at": 300, "cards": [{"kind": "keep", "text": "x"}] * 3},
              {"at": 780, "cards": [{"kind": "fix", "text": "y"}] * 3}]
    r = raw([(90, 200, 1), (650, 800, 1)], groups=groups)
    plan, warns = validate.build(r, {}, TRANSCRIPT, DUR, CFG)
    cards = [c for clip in plan for c in clip["cards"]]
    assert len(cards) == 4 + 3, len(cards)
    for clip in plan:
        for c in clip["cards"]:
            assert clip["start"] <= c["t"] < c["end"] <= clip["end"]
    assert any("card groups" in w for w in warns)


def test_entry_and_exit_added_from_markers():
    r = raw([(300, 500, 1)], markers={"entry_start": 20, "desk_start": 400, "exit_end": 880})
    plan, _ = validate.build(r, {}, TRANSCRIPT, DUR, CFG)
    assert plan[0]["start"] <= 20 and plan[-1]["end"] >= 880


if __name__ == "__main__":
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            try:
                fn(); print("ok  ", name)
            except AssertionError as e:
                fails += 1; print("FAIL", name, e)
    sys.exit(1 if fails else 0)
