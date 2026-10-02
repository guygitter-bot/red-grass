import json
import os
import unittest
from unittest import mock

from toto_predictor import notify


class FakeResponse:
    def __init__(self, body):
        self.body = body
        self.status = 200

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class TelegramTest(unittest.TestCase):
    def test_skipped_without_config(self):
        with mock.patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "", "TELEGRAM_CHAT_ID": ""}):
            self.assertFalse(notify.send_telegram("hi"))

    def test_sends_message(self):
        env = {"TELEGRAM_BOT_TOKEN": "123:abc", "TELEGRAM_CHAT_ID": "42"}
        with mock.patch.dict(os.environ, env), mock.patch.object(
            notify.urllib.request, "urlopen", return_value=FakeResponse(b'{"ok": true}')
        ) as urlopen:
            self.assertTrue(notify.send_telegram("שלום"))
        req = urlopen.call_args[0][0]
        self.assertEqual(req.full_url, "https://api.telegram.org/bot123:abc/sendMessage")
        self.assertEqual(json.loads(req.data)["chat_id"], "42")
        self.assertEqual(json.loads(req.data)["text"], "שלום")

    def test_api_error(self):
        env = {"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "1"}
        with mock.patch.dict(os.environ, env), mock.patch.object(
            notify.urllib.request, "urlopen", return_value=FakeResponse(b'{"ok": false}')
        ):
            self.assertFalse(notify.send_telegram("x"))

    def test_send_all_continues_after_failure(self):
        with mock.patch.object(notify, "send_whatsapp", side_effect=OSError("down")), \
                mock.patch.object(notify, "send_telegram", return_value=True) as tg, \
                mock.patch.object(notify, "send_email", return_value=True) as mail:
            notify.send_all("s", "t", "<p>t</p>")
        tg.assert_called_once()
        mail.assert_called_once()


if __name__ == "__main__":
    unittest.main()
