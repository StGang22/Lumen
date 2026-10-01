from __future__ import annotations

import json
import importlib
import platform
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

SERVICE_NAME = "lumen-agent"
KEY_NAME = "paired-device"
TIMEOUT_SECONDS = 12


class LumenAgentError(RuntimeError):
    """A sanitized local-agent error safe to show in a terminal."""


def validate_server_url(value: str) -> str:
    parsed = urlsplit(value.strip())
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}):
        raise LumenAgentError("Use HTTPS for the Lumen server (HTTP is allowed only on localhost).")
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise LumenAgentError("The server URL must not contain credentials, query parameters, or a fragment.")
    path = parsed.path.rstrip("/")
    if path and path != "":
        raise LumenAgentError("Use the site's base URL without an API path.")
    return urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))


def _request_json(url: str, *, method: str, payload: dict | None = None, token: str | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read(128 * 1024)
    except HTTPError as error:
        # Do not include response bodies, which could contain server data or secrets.
        raise LumenAgentError(f"Lumen returned HTTP {error.code}.") from None
    except (URLError, TimeoutError, OSError):
        raise LumenAgentError("Could not reach Lumen. Check the URL and network connection.") from None
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise LumenAgentError("Lumen returned an unreadable response.") from None
    if not isinstance(parsed, dict):
        raise LumenAgentError("Lumen returned an unexpected response.")
    return parsed


def pair(server_url: str, pairing_code: str, device_name: str | None = None) -> dict:
    base = validate_server_url(server_url)
    code = pairing_code.strip()
    if not 20 <= len(code) <= 80:
        raise LumenAgentError("The pairing code has an invalid format.")
    response = _request_json(
        f"{base}/api/agent/pair",
        method="POST",
        payload={"pairingCode": code, "deviceName": (device_name or platform.node() or "Lumen device")[:80]},
    )
    token = response.get("deviceToken")
    device_id = response.get("deviceId")
    if not isinstance(token, str) or not isinstance(device_id, str):
        raise LumenAgentError("Pairing did not return a usable device credential.")

    # Fail closed if the operating system does not provide a secure credential store.
    keyring = None
    try:
        keyring = importlib.import_module("keyring")
        keyring.set_password(SERVICE_NAME, KEY_NAME, json.dumps({"server": base, "token": token, "device_id": device_id}))
    except Exception:
        if keyring is not None:
            try:
                keyring.delete_password(SERVICE_NAME, KEY_NAME)
            except Exception:
                pass
        try:
            revoked = _request_json(f"{base}/api/agent/unpair", method="POST", token=token)
            if revoked.get("success") is not True:
                raise LumenAgentError("Remote revocation was not confirmed.")
        except LumenAgentError:
            raise LumenAgentError("No se pudo guardar la credencial ni confirmar su revocación. Revoca el dispositivo desde el panel antes de volver a parear.") from None
        raise LumenAgentError("El llavero seguro no está disponible; la credencial remota fue revocada y este equipo no quedó pareado.") from None
    return {"device_id": device_id, "device_name": response.get("deviceName", "Lumen device")}


def load_credentials() -> dict:
    try:
        keyring = importlib.import_module("keyring")
        value = keyring.get_password(SERVICE_NAME, KEY_NAME)
    except Exception:
        raise LumenAgentError("The operating-system credential store is unavailable.") from None
    if not value:
        raise LumenAgentError("This computer is not paired. Run `lumen-agent pair` first.")
    try:
        credentials = json.loads(value)
    except json.JSONDecodeError:
        raise LumenAgentError("The saved device credential is unreadable.") from None
    if not isinstance(credentials, dict) or not all(isinstance(credentials.get(key), str) for key in ("server", "token", "device_id")):
        raise LumenAgentError("The saved device credential is incomplete.")
    credentials["server"] = validate_server_url(credentials["server"])
    return credentials


def heartbeat() -> dict:
    credentials = load_credentials()
    response = _request_json(
        f"{credentials['server']}/api/agent/status",
        method="GET",
        token=credentials["token"],
    )
    if response.get("deviceId") != credentials["device_id"]:
        raise LumenAgentError("The server returned a different device identity.")
    if response.get("capabilities") != ["presence"]:
        raise LumenAgentError("The server returned an unsupported capability set.")
    return {"device_name": response.get("name", "Lumen device"), "last_seen": response.get("lastSeenAt")}


def run_presence_loop(interval_seconds: int) -> None:
    if interval_seconds < 10 or interval_seconds > 3600:
        raise LumenAgentError("The heartbeat interval must be between 10 and 3600 seconds.")
    while True:
        heartbeat()
        time.sleep(interval_seconds)
