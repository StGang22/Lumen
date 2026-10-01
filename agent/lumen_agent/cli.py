from __future__ import annotations

import argparse
import sys
import time

from .client import LumenAgentError, heartbeat, pair


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lumen-agent", description="Agente local mínimo de Lumen. Solo informa presencia; no ejecuta comandos remotos.")
    sub = parser.add_subparsers(dest="command", required=True)

    pairing = sub.add_parser("pair", help="Emparejar este equipo con un código temporal de Lumen.")
    pairing.add_argument("--server-url", required=True, help="URL base HTTPS del panel Lumen.")
    pairing.add_argument("--pairing-code", required=True, help="Código de pareo temporal de un solo uso.")
    pairing.add_argument("--device-name", default=None, help="Nombre visible del equipo.")

    sub.add_parser("status", help="Enviar una comprobación de presencia y mostrar el estado.")
    run = sub.add_parser("run", help="Enviar una señal de presencia periódica.")
    run.add_argument("--interval", type=int, default=60, help="Intervalo en segundos (10–3600, predeterminado: 60).")
    return parser


def main() -> None:
    args = _parser().parse_args()
    try:
        if args.command == "pair":
            device = pair(args.server_url, args.pairing_code, args.device_name)
            print(f"Equipo emparejado: {device['device_name']} ({device['device_id']}).")
            print("La credencial se guardó en el almacén seguro del sistema operativo.")
            return
        if args.command == "status":
            status = heartbeat()
            print(f"Lumen ve el dispositivo {status['device_name']} como activo; señal: {status['last_seen']}.")
            return
        if args.command == "run":
            if args.interval < 10 or args.interval > 3600:
                raise LumenAgentError("El intervalo de presencia debe estar entre 10 y 3600 segundos.")
            print("Agente de presencia activo. Pulsa Ctrl+C para detenerlo; no se ejecutan acciones remotas.")
            while True:
                status = heartbeat()
                print(f"Presencia actualizada: {status['last_seen']}")
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print("Agente detenido.")
    except LumenAgentError as error:
        print(f"Lumen Agent: {error}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
