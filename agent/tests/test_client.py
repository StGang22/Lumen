import unittest

from lumen_agent.client import LumenAgentError, validate_server_url


class ServerUrlTests(unittest.TestCase):
    def test_accepts_https_origin(self):
        self.assertEqual(validate_server_url("https://lumen.example/"), "https://lumen.example")

    def test_allows_http_loopback_for_local_development(self):
        self.assertEqual(validate_server_url("http://localhost:3000"), "http://localhost:3000")

    def test_rejects_http_on_public_host(self):
        with self.assertRaises(LumenAgentError):
            validate_server_url("http://lumen.example")

    def test_rejects_credentials_and_query_parameters(self):
        for value in ("https://user:secret@lumen.example", "https://lumen.example/?token=secret"):
            with self.subTest(value=value), self.assertRaises(LumenAgentError):
                validate_server_url(value)

    def test_rejects_api_path(self):
        with self.assertRaises(LumenAgentError):
            validate_server_url("https://lumen.example/api/agent")


if __name__ == "__main__":
    unittest.main()
