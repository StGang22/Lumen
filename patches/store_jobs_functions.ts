// --- agent job helpers (append / integrate into server/lumen/store.ts) ---
// Requires: agentJobs imported from schema, and existing helpers (dbOrThrow, appendAudit, affectedRows, digest)

import { agentJobs } from "../../drizzle/schema";
// also ensure agentDevices is already imported

const MAX_COMMAND_LEN = 4000;
const DEFAULT_JOB_TIMEOUT = 30;
const MAX_JOB_TIMEOUT = 120;

export async function createTerminalJob(ownerId: number, input: {
  deviceId: string;
  command: string;
  context?: "personal" | "home" | "business";
  cwd?: string;
  timeoutSeconds?: number;
}) {
  const db = await dbOrThrow();
  const command = input.command.trim();
  if (!command || command.length > MAX_COMMAND_LEN) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Command must be 1–4000 characters." });
  }
  const devices = await db.select({ id: agentDevices.id, status: agentDevices.status })
    .from(agentDevices)
    .where(and(eq(agentDevices.id, input.deviceId), eq(agentDevices.ownerId, ownerId)))
    .limit(1);
  if (!devices[0] || devices[0].status !== "active") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Active device not found." });
  }
  const timeout = Math.max(1, Math.min(input.timeoutSeconds ?? DEFAULT_JOB_TIMEOUT, MAX_JOB_TIMEOUT));
  const id = randomUUID();
  const context = input.context ?? "personal";
  await db.transaction(async tx => {
    await tx.insert(agentJobs).values({
      id,
      ownerId,
      deviceId: input.deviceId,
      context,
      command,
      cwd: input.cwd?.trim() || null,
      timeoutSeconds: timeout,
      status: "pending_approval",
    });
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context, actor: "user",
      event: "terminal.job_requested",
      summary: `Comando de terminal propuesto: ${command.slice(0, 80)}`,
      resourceId: id,
    });
  });
  const rows = await db.select().from(agentJobs).where(and(eq(agentJobs.id, id), eq(agentJobs.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Job could not be read back." });
  return rows[0];
}

export async function listTerminalJobs(ownerId: number) {
  const db = await dbOrThrow();
  return db.select().from(agentJobs)
    .where(eq(agentJobs.ownerId, ownerId))
    .orderBy(desc(agentJobs.createdAt))
    .limit(50);
}

export async function decideTerminalJob(ownerId: number, id: string, decision: "approved" | "rejected") {
  const db = await dbOrThrow();
  return db.transaction(async tx => {
    const rows = await tx.select().from(agentJobs)
      .where(and(eq(agentJobs.id, id), eq(agentJobs.ownerId, ownerId))).limit(1);
    const job = rows[0];
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
    if (job.status !== "pending_approval") {
      throw new TRPCError({ code: "CONFLICT", message: "Job is no longer awaiting approval." });
    }
    const now = new Date();
    const nextStatus = decision === "approved" ? "approved" : "rejected";
    const result = await tx.update(agentJobs)
      .set({ status: nextStatus, approvedAt: decision === "approved" ? now : null })
      .where(and(eq(agentJobs.id, id), eq(agentJobs.ownerId, ownerId), eq(agentJobs.status, "pending_approval")));
    if (affectedRows(result) !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "Job approval race; try again." });
    }
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: job.context, actor: "user",
      event: `terminal.job_${decision}`,
      summary: decision === "approved"
        ? "Comando de terminal aprobado para ejecución local."
        : "Comando de terminal rechazado; no se ejecutará.",
      resourceId: id,
    });
    const updated = await tx.select().from(agentJobs)
      .where(and(eq(agentJobs.id, id), eq(agentJobs.ownerId, ownerId))).limit(1);
    if (!updated[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Job decision could not be read back." });
    return updated[0];
  });
}

/** Agent-facing: claim one approved job for this device. */
export async function claimAgentJob(deviceId: string, ownerId: number) {
  const db = await dbOrThrow();
  return db.transaction(async tx => {
    const rows = await tx.select().from(agentJobs)
      .where(and(
        eq(agentJobs.deviceId, deviceId),
        eq(agentJobs.ownerId, ownerId),
        eq(agentJobs.status, "approved"),
      ))
      .orderBy(agentJobs.createdAt)
      .limit(1);
    const job = rows[0];
    if (!job) return null;
    const now = new Date();
    const result = await tx.update(agentJobs)
      .set({ status: "running", startedAt: now })
      .where(and(eq(agentJobs.id, job.id), eq(agentJobs.status, "approved")));
    if (affectedRows(result) !== 1) return null;
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: job.context, actor: "agent",
      event: "terminal.job_started",
      summary: "Agente local inició ejecución del comando aprobado.",
      resourceId: job.id,
    });
    return {
      id: job.id,
      command: job.command,
      cwd: job.cwd,
      timeoutSeconds: job.timeoutSeconds,
    };
  });
}

export async function completeAgentJob(deviceId: string, ownerId: number, jobId: string, input: {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorMessage?: string | null;
  ok: boolean;
}) {
  const db = await dbOrThrow();
  return db.transaction(async tx => {
    const rows = await tx.select().from(agentJobs)
      .where(and(
        eq(agentJobs.id, jobId),
        eq(agentJobs.deviceId, deviceId),
        eq(agentJobs.ownerId, ownerId),
        eq(agentJobs.status, "running"),
      )).limit(1);
    const job = rows[0];
    if (!job) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Running job not found for this device." });
    }
    const now = new Date();
    const status = input.ok ? "completed" : "failed";
    await tx.update(agentJobs).set({
      status,
      exitCode: input.exitCode,
      stdout: (input.stdout || "").slice(0, 65535),
      stderr: (input.stderr || "").slice(0, 65535),
      errorMessage: input.errorMessage ? input.errorMessage.slice(0, 500) : null,
      finishedAt: now,
    }).where(eq(agentJobs.id, jobId));
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: job.context, actor: "agent",
      event: `terminal.job_${status}`,
      summary: input.ok
        ? `Comando completado (exit ${input.exitCode ?? "?"}).`
        : `Comando falló: ${(input.errorMessage || "error").slice(0, 120)}`,
      resourceId: jobId,
    });
    return { success: true };
  });
}
