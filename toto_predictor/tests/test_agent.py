import unittest
from types import SimpleNamespace

from toto_predictor import agent


def response(stop_reason, blocks):
    return SimpleNamespace(stop_reason=stop_reason, stop_details=None, content=blocks)


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)


class AgentLoopTest(unittest.TestCase):
    def test_resumes_pause_turn_and_returns_submit_input(self):
        submit = SimpleNamespace(type="tool_use", name="submit_match_research", input={"ok": 1})
        client = FakeClient([
            response("pause_turn", [SimpleNamespace(type="server_tool_use", name="web_search")]),
            response("tool_use", [submit]),
        ])
        out = agent._call_with_submit(client, "sys", "prompt", agent.RESEARCH_TOOL)
        self.assertEqual(out, {"ok": 1})
        self.assertEqual(len(client.calls), 2)
        self.assertEqual(client.calls[1]["messages"][-1]["role"], "assistant")

    def test_nudges_when_model_answers_in_text(self):
        submit = SimpleNamespace(type="tool_use", name="submit_round", input={"x": 2})
        client = FakeClient([
            response("end_turn", [SimpleNamespace(type="text", text="here")]),
            response("tool_use", [submit]),
        ])
        self.assertEqual(agent._call_with_submit(client, None, "p", agent.ROUND_TOOL), {"x": 2})
        self.assertEqual(client.calls[1]["messages"][-1]["role"], "user")

    def test_prompts_format(self):
        match = {"index": 1, "home_he": "מכבי חיפה", "away_he": "הפועל באר שבע",
                 "home_en": "Maccabi Haifa", "away_en": "Hapoel Beer Sheva",
                 "league": "Ligat HaAl", "kickoff": "2026-10-03T19:30:00+03:00"}
        text = agent.RESEARCH_PROMPT.format(today="2026-10-01", round_number="1", **match)
        self.assertIn("מכבי חיפה - הפועל באר שבע", text)
        self.assertIn("football.org.il", agent.RESEARCH_SYSTEM)
        agent.ROUND_PROMPT.format(today="2026-10-01")

    def test_research_all_survives_failures(self):
        calls = {"n": 0}

        def fake(match, round_number, client):
            calls["n"] += 1
            if match["index"] == 2:
                raise RuntimeError("boom")
            return {"i": match["index"]}

        orig = agent.research_match
        agent.research_match = fake
        try:
            out = agent.research_all([{"index": i} for i in (1, 2, 3)], "1", client=object())
        finally:
            agent.research_match = orig
        self.assertEqual(out, [{"i": 1}, None, {"i": 3}])


if __name__ == "__main__":
    unittest.main()
