# Fase A — Terminal seguro

## Objetivo

Permitir que el agente local ejecute comandos de terminal **solo después de aprobación humana**,
con sandbox, timeout y auditoría completa.

## Modelo de datos

Tabla `agent_jobs`:

| Campo | Uso |
|-------|-----|
| `command` | Texto del comando (1–4000 chars) |
| `status` | `pending_approval` → `approved`/`rejected` → `running` → `completed`/`failed` |
| `cwd` | Directorio de trabajo opcional |
| `timeout_seconds` | 1–120 (default 30) |
| `stdout` / `stderr` | Salida acotada (≤64 KiB en el agente) |

## Flujo

1. **Proponer** (panel / tRPC): crea job en `pending_approval`
2. **Aprobar o rechazar** (panel): pasa a `approved` o `rejected`
3. **Claim** (agente `POST /api/agent/jobs/claim`): toma un job `approved` → `running`
4. **Ejecutar** localmente sin `shell=True`, con timeout
5. **Result** (`POST /api/agent/jobs/:id/result`): `completed` o `failed`

Cada transición genera un evento en `audit_events`.

## Agente Python

```bash
pip install -e ./agent
lumen-agent pair --server-url https://URL --pairing-code CODIGO
lumen-agent worker --interval 5   # presencia + poll de jobs
lumen-agent once                  # un job y salir
lumen-agent status
```

Capacidades anunciadas: `presence`, `terminal`.

## Migración

```bash
pnpm db:migrate
# o aplicar drizzle/0003_agent_jobs.sql manualmente
```

## Seguridad

- Sin `shell=True` (lista de argumentos vía `shlex`)
- Timeout duro
- Salida truncada
- Sin elevación de privilegios
- Token solo en keyring del SO
- Revocación del dispositivo invalida jobs futuros
