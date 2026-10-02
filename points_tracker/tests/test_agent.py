import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from points_tracker import agent, db, run_agent


def response(stop_reason, blocks):
    return SimpleNamespace(stop_reason=stop_reason, stop_details=None, content=blocks, usage=None)


def submit(name, data):
    return SimpleNamespace(type="tool_use", name=name, input=data)


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)


BAMBA = {
    "found": True,
    "name": "במבה אסם",
    "aliases": ["במבה"],
    "serving_desc": "שקית 25 ג'",
    "serving_grams": 25,
    "per100": {"kcal": 534, "protein": 15, "carbs": 41, "fat": 35, "fiber": 4},
    "published_points": 4,
    "sources": ["https://www.osem.co.il/bamba"],
    "confidence": "high",
    "notes_he": "",
}


class AgentLoopTest(unittest.TestCase):
    def test_resumes_pause_turn_and_returns_submit_input(self):
        client = FakeClient([
            response("pause_turn", [SimpleNamespace(type="server_tool_use", name="web_search")]),
            response("tool_use", [submit("submit_food", {"ok": 1})]),
        ])
        self.assertEqual(agent.research_food("x", client), {"ok": 1})
        self.assertEqual(len(client.calls), 2)
        self.assertEqual(client.calls[1]["messages"][-1]["role"], "assistant")
        self.assertEqual(client.calls[0]["fallbacks"], "default")

    def test_nudges_when_model_answers_in_text(self):
        client = FakeClient([
            response("end_turn", [SimpleNamespace(type="text", text="here")]),
            response("tool_use", [submit("submit_food", {"x": 2})]),
        ])
        self.assertEqual(agent.research_food("x", client), {"x": 2})
        self.assertIn("submit_food", client.calls[1]["messages"][-1]["content"])

    def test_db_entry_uses_formula_for_points(self):
        entry = agent.to_db_entry(BAMBA)
        self.assertEqual(entry["name"], "במבה אסם (שקית 25 ג')")
        self.assertEqual(entry["points"], 3.6)
        self.assertEqual(entry["published_points"], 4)
        self.assertIsNone(agent.to_db_entry({**BAMBA, "found": False}))

    def test_db_entry_name_has_no_nested_parentheses(self):
        entry = agent.to_db_entry({**BAMBA, "name": "במבה (נוגט)", "serving_desc": "חופן / מנה (כ-30 גרם)"})
        self.assertEqual(entry["name"], "במבה נוגט (חופן / מנה כ-30 גרם)")


class RunAgentTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()) / "foods.json"
        self.tmp.write_text(json.dumps({"version": 1, "foods": [{"name": "פיתה רגילה", "points": 6}]}), encoding="utf-8")

    def test_issue_title_prefix_is_removed(self):
        self.assertEqual(run_agent.issue_food_name("ניקוד: במבה נוגט"), "במבה נוגט")
        self.assertEqual(run_agent.issue_food_name("במבה"), "במבה")

    def test_process_adds_new_and_skips_existing(self):
        data = db.load(self.tmp)
        client = FakeClient([response("tool_use", [submit("submit_food", BAMBA)])])
        reports = run_agent.process(data, [{"name": "פיתה רגילה", "issue": 1}, {"name": "במבה", "issue": 2}], client)
        status = {r["name"]: r["status"] for r in reports}
        self.assertEqual(status, {"פיתה רגילה": "exists", "במבה": "added"})
        db.save(data, self.tmp)
        names = [f["name"] for f in db.load(self.tmp)["foods"]]
        self.assertEqual(names, ["פיתה רגילה", "במבה אסם (שקית 25 ג')"])
        self.assertIn("3.6", run_agent.issue_comment(reports[1]))

    def test_main_answers_issues_and_saves(self):
        issues = [{"number": 7, "title": "ניקוד: במבה", "author": {"login": "me"}}]
        with mock.patch.object(db, "DB_PATH", self.tmp), \
             mock.patch.object(run_agent, "open_issues", return_value=issues), \
             mock.patch.object(run_agent, "answer_issue") as answer, \
             mock.patch.object(agent, "research_food", return_value=BAMBA), \
             mock.patch.dict("os.environ", {"FOODS": "", "GITHUB_STEP_SUMMARY": ""}):
            run_agent.main(["--issues"])
        answer.assert_called_once()
        self.assertEqual(answer.call_args.args[0], 7)
        self.assertTrue(answer.call_args.kwargs["close"])
        self.assertEqual(len(json.loads(self.tmp.read_text(encoding="utf-8"))["foods"]), 2)


if __name__ == "__main__":
    unittest.main()
