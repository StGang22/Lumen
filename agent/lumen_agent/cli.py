from __future__ import annotations

import argparse
import sys
import time

from .client import LumenAgentError, heartbeat, pair, process_one_job, run_worker_loop


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lumen-agent",
        description="Agente local de Lumen: presencia y ejecución de terminal con aprobación humana.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    pairing = sub.add_parser("pair", help="Emparejar este equipo con un código temporal de Lumen.")
    pairing.add_argument("--server-url", required=True, help="URL base HTTPS del panel Lumen.")
    pairing.add_argument("--pairing-code", required=True, help="Código de pareo temporal de un solo uso.")
    pairing.add_argument("--device-name", default=None, help="Nombre visible del equipo.")

    sub.add_parser("status", help="Enviar una comprobación de presencia y mostrar el estado.")

    run = sub.add_parser("run", help="Presencia periódica (sin ejecutar jobs de terminal).")
    run.add_argument("--interval", type=int, default=60, help="Intervalo en segundos (10–3600, predeterminado: 60).")

    worker = sub.add_parser("worker", help="Presencia + polling de jobs de terminal aprobados.")
    worker.add_argument("--interval", type=int, default=5, help="Intervalo de poll en segundos (2–120, predeterminado: 5).")

    sub.add_parser("once", help="Procesar como máximo un job aprobado y salir.")

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
            caps = ", ".join(status.get("capabilities") or [])
            print(f"Lumen ve el dispositivo {status['device_name']} como activo; señal: {status['last_seen']}.")
            print(f"Capacidades: {caps}")
            return
        if args.command == "run":
            if args.interval < 10 or args.interval > 3600:
                raise LumenAgentError("El intervalo de presencia debe estar entre 10 y 3600 segundos.")
            print("Agente de presencia activo. Pulsa Ctrl+C para detenerlo.")
            while True:
                status = heartbeat()
                print(f"Presencia actualizada: {status['last_seen']}")
                time.sleep(args.interval)
        if args.command == "worker":
            run_worker_loop(args.interval)
            return
        if args.command == "once":
            heartbeat()
            if process_one_job():
                print("Un job procesado.")
            else:
                print("No hay jobs aprobados pendientes.")
            return
    except KeyboardInterrupt:
        print("Agente detenido.")
    except LumenAgentError as error:
        print(f"Lumen Agent: {error}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
