import unittest

from points_tracker.fixbot import fixbot


class FixbotTests(unittest.TestCase):
    def test_screenshot_url_only_from_our_worker(self):
        body = "טקסט\n<!-- bis-fix-screenshot: https://bis-api.someone.workers.dev/feedback/image?id=abc -->"
        self.assertEqual(fixbot.screenshot_url(body), "https://bis-api.someone.workers.dev/feedback/image?id=abc")
        self.assertIsNone(fixbot.screenshot_url("<!-- bis-fix-screenshot: https://evil.example/feedback/image?id=a -->"))
        self.assertIsNone(fixbot.screenshot_url("<!-- bis-fix-screenshot: http://x.workers.dev/feedback/image -->"))
        self.assertIsNone(fixbot.screenshot_url("<!-- bis-fix-screenshot: https://x.workers.dev/other -->"))
        self.assertIsNone(fixbot.screenshot_url("בלי צילום"))

    def test_decide(self):
        self.assertEqual(fixbot.decide({"status": "fixed"}, ["points_tracker/web/src/App.jsx"]), "fixed")
        self.assertEqual(fixbot.decide({"status": "fixed"}, []), "nochange")
        self.assertEqual(fixbot.decide({"status": "fixed"}, [".github/workflows/x.yml"]), "outside")
        self.assertEqual(fixbot.decide({"status": "question"}, []), "question")
        self.assertEqual(fixbot.decide({}, []), "error")

    def test_conversation_hides_the_screenshot_link(self):
        issue = {"title": "תיקון", "body": "הכפתור קטן\n<!-- bis-fix-screenshot: https://a.workers.dev/feedback/image?id=1 -->"}
        comments = [
            {"user": {"login": "github-actions[bot]"}, "body": "❓ איזה כפתור?"},
            {"user": {"login": "owner"}, "body": "של המועדפים"},
        ]
        text = fixbot.conversation(issue, comments)
        self.assertNotIn("workers.dev", text)
        self.assertIn("Claude (earlier run):\n❓ איזה כפתור?", text)
        self.assertIn("App user:\nשל המועדפים", text)

    def test_messages(self):
        text, label = fixbot.message("fixed", {"summary_he": "הוגדל הכפתור"}, "success", "success", "RUN")
        self.assertEqual((text, label), ("✅ הוגדל הכפתור", "bis-ready"))
        text, label = fixbot.message("fixed", {}, "failure", "skipped", "RUN")
        self.assertEqual(label, "bis-failed")
        self.assertIn("הבדיקות נכשלו", text)
        text, label = fixbot.message("question", {"question_he": "איזה כפתור?"}, "skipped", "skipped", "RUN")
        self.assertEqual((text, label), ("איזה כפתור?", "bis-question"))
        self.assertEqual(fixbot.message("too_big", {"plan_he": "תוכנית"}, "", "", "RUN")[1], "bis-question")
        self.assertEqual(fixbot.message("error", {}, "", "", "RUN")[1], "bis-failed")

    def test_prompt_template_formats(self):
        text = fixbot.PROMPT.read_text(encoding="utf-8").format(issue=5, request="x", screenshot="y")
        self.assertIn('"status": "fixed"', text)


if __name__ == "__main__":
    unittest.main()
