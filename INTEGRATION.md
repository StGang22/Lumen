# Cómo integrar la Fase A en Lumen

Copia los archivos de este ZIP sobre el repositorio respetando las rutas.

## 1. Archivos que reemplazan por completo

| Ruta en el ZIP | Acción |
|----------------|--------|
| `drizzle/schema.ts` | Reemplazar el existente |
| `drizzle/0003_agent_jobs.sql` | Añadir (migración nueva) |
| `server/lumen/agentRoutes.ts` | Reemplazar el existente |
| `agent/lumen_agent/terminal.py` | Añadir (módulo nuevo) |
| `agent/lumen_agent/client.py` | Reemplazar el existente |
| `agent/lumen_agent/cli.py` | Reemplazar el existente |
| `docs/phase-a-terminal.md` | Añadir |

## 2. Cambios manuales en `server/lumen/store.ts`

### 2.1 Importar la tabla

En el import de schema, añade `agentJobs`:

```ts
import {
  agentDevices,
  agentPairingCodes,
  agentJobs,          // <-- nuevo
  approvalRequests,
  auditEvents,
  authorizedAssets,
  memoryNotes,
} from "../../drizzle/schema";
```

### 2.2 Cambiar capabilities en `recordAgentPresence`

Sustituye la línea que devuelve solo `presence` por:

```ts
return {
  deviceId,
  name,
  lastSeenAt: at.toISOString(),
  capabilities: ["presence", "terminal"] as const,
};
```

### 2.3 Añadir las funciones de jobs

Al final del archivo (antes del cierre), pega el contenido de
`patches/store_jobs_functions.ts` (incluido en este ZIP).

## 3. Cambios manuales en `server/lumen/router.ts`

Dentro de `lumenRouter`, añade el router de terminal (después de `agent`):

```ts
terminal: router({
  jobs: router({
    list: protectedProcedure.query(({ ctx }) => store.listTerminalJobs(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        deviceId: z.string().uuid(),
        command: z.string().trim().min(1).max(4000),
        context: contextSchema.optional(),
        cwd: z.string().trim().max(500).optional(),
        timeoutSeconds: z.number().int().min(1).max(120).optional(),
      }).strict())
      .mutation(({ ctx, input }) => store.createTerminalJob(ctx.user.id, input)),
    decide: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
      }).strict())
      .mutation(({ ctx, input }) => store.decideTerminalJob(ctx.user.id, input.id, input.decision)),
  }),
}),
```

## 4. Aplicar migración

```bash
pnpm db:migrate
# o ejecuta a mano el SQL de drizzle/0003_agent_jobs.sql
```

## 5. Verificar

```bash
pnpm check
pnpm test
cd agent && python -m unittest discover -s tests
```

## 6. Probar el agente

```bash
lumen-agent pair --server-url https://TU-URL --pairing-code CODIGO
lumen-agent worker --interval 5
```

Desde el panel (cuando exista UI, o vía tRPC):
1. Crear job con un comando inocuo (`echo hola`)
2. Aprobarlo
3. Ver cómo el worker lo ejecuta y reporta resultado
