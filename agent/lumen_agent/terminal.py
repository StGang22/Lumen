"""Secure local terminal execution for Lumen agent jobs.

Rules:
- No shell=True by default (argv list only).
- Hard timeout.
- Bounded stdout/stderr capture.
- Never elevates privileges.
"""
from __future__ import annotations

import os
import shlex
import signal
import subprocess
import time
from typing import Any

MAX_OUTPUT_BYTES = 64 * 1024  # 64 KiB per stream
DEFAULT_TIMEOUT = 30
MAX_TIMEOUT = 120


class TerminalError(RuntimeError):
    pass


def _truncate(data: bytes, limit: int = MAX_OUTPUT_BYTES) -> str:
    if len(data) > limit:
        return data[:limit].decode("utf-8", errors="replace") + "\n…[truncated]"
    return data.decode("utf-8", errors="replace")


def parse_command(command: str) -> list[str]:
    command = command.strip()
    if not command:
        raise TerminalError("Empty command.")
    if len(command) > 4000:
        raise TerminalError("Command too long.")
    try:
        argv = shlex.split(command, posix=os.name != "nt")
    except ValueError as exc:
        raise TerminalError(f"Could not parse command: {exc}") from None
    if not argv:
        raise TerminalError("Empty command after parsing.")
    return argv


def run_command(
    command: str,
    *,
    cwd: str | None = None,
    timeout_seconds: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Execute a one-shot command and return structured result."""
    argv = parse_command(command)
    timeout = max(1, min(int(timeout_seconds or DEFAULT_TIMEOUT), MAX_TIMEOUT))

    workdir = None
    if cwd:
        cwd = cwd.strip()
        if cwd and os.path.isdir(cwd) and os.access(cwd, os.R_OK | os.X_OK):
            workdir = cwd

    started = time.monotonic()
    try:
        completed = subprocess.run(
            argv,
            capture_output=True,
            timeout=timeout,
            cwd=workdir,
            shell=False,
            check=False,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        duration_ms = int((time.monotonic() - started) * 1000)
        return {
            "ok": True,
            "exit_code": completed.returncode,
            "stdout": _truncate(completed.stdout or b""),
            "stderr": _truncate(completed.stderr or b""),
            "duration_ms": duration_ms,
            "error_message": None,
        }
    except subprocess.TimeoutExpired as exc:
        duration_ms = int((time.monotonic() - started) * 1000)
        return {
            "ok": False,
            "exit_code": None,
            "stdout": _truncate(exc.stdout or b""),
            "stderr": _truncate(exc.stderr or b""),
            "duration_ms": duration_ms,
            "error_message": f"Timed out after {timeout}s",
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "exit_code": 127,
            "stdout": "",
            "stderr": "",
            "duration_ms": int((time.monotonic() - started) * 1000),
            "error_message": f"Executable not found: {argv[0]}",
        }
    except OSError as exc:
        return {
            "ok": False,
            "exit_code": None,
            "stdout": "",
            "stderr": "",
            "duration_ms": int((time.monotonic() - started) * 1000),
            "error_message": f"OS error: {exc.strerror or str(exc)}"[:500],
        }
