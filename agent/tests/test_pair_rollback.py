import sys
import unittest
from types import ModuleType
from unittest.mock import Mock, patch

from lumen_agent import client
from lumen_agent.client import LumenAgentError


class PairRollbackTests(unittest.TestCase):
    def test_keyring_failure_triggers_remote_revoke_and_local_cleanup(self):
        keyring = ModuleType("keyring")
        setattr(keyring, "set_password", Mock(side_effect=RuntimeError("credential store unavailable")))
        setattr(keyring, "delete_password", Mock())
        token = "t" * 43
        requests = []

        def request(url, *, method, payload=None, token=None):
            requests.append({"url": url, "method": method, "payload": payload, "token": token})
            if url.endswith("/api/agent/pair"):
                return {"deviceId": "device-1", "deviceToken": "t" * 43, "deviceName": "test-host"}
            if url.endswith("/api/agent/unpair"):
                return {"success": True}
            raise AssertionError("Unexpected endpoint")

        with patch.dict(sys.modules, {"keyring": keyring}), patch.object(client, "_request_json", side_effect=request):
            with self.assertRaisesRegex(LumenAgentError, "credencial remota fue revocada"):
                client.pair("https://lumen.example", "c" * 24)

        self.assertEqual(requests[1]["url"], "https://lumen.example/api/agent/unpair")
        self.assertEqual(requests[1]["method"], "POST")
        self.assertEqual(requests[1]["token"], token)
        getattr(keyring, "delete_password").assert_called_once_with(client.SERVICE_NAME, client.KEY_NAME)


if __name__ == "__main__":
    unittest.main()
