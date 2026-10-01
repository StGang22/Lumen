import subprocess
import sys
import unittest


class AgentCliTests(unittest.TestCase):
    def test_rejects_too_frequent_heartbeat_without_network_access(self):
        result = subprocess.run(
            [sys.executable, "-m", "lumen_agent.cli", "run", "--interval", "1"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("El intervalo de presencia debe estar entre 10 y 3600 segundos", result.stderr)


if __name__ == "__main__":
    unittest.main()
