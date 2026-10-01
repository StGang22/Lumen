import { randomBytes, randomUUID, createHash } from "node:crypto";
import { and, count, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { agentDevices, agentPairingCodes, approvalRequests, auditEvents, authorizedAssets, memoryNotes } from "../../drizzle/schema";
import type { ApprovalCategory, LumenContext } from "./policy";

const dbOrThrow = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Lumen storage is unavailable." });
  return db;
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function appendAudit(input: {
  ownerId: number;
  context: LumenContext;
  actor: "user" | "agent" | "system";
  event: string;
  summary: string;
  resourceId?: string | null;
}) {
  const db = await dbOrThrow();
  await db.insert(auditEvents).values({
    id: randomUUID(),
    ownerId: input.ownerId,
    context: input.context,
    actor: input.actor,
    event: input.event,
    summary: input.summary.slice(0, 240),
    resourceId: input.resourceId ?? null,
  });
}

export async function expirePendingApprovals(ownerId: number) {
  const db = await dbOrThrow();
  const stale = await db.select({ id: approvalRequests.id, context: approvalRequests.context })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.ownerId, ownerId), eq(approvalRequests.status, "pending"), lte(approvalRequests.expiresAt, sql`CURRENT_TIMESTAMP(3)`)))
    .limit(50);
  if (!stale.length) return;
  await db.transaction(async tx => {
    for (const approval of stale) {
      const result = await tx.update(approvalRequests).set({ status: "expired", decidedAt: null })
        .where(and(eq(approvalRequests.id, approval.id), eq(approvalRequests.ownerId, ownerId), eq(approvalRequests.status, "pending"), lte(approvalRequests.expiresAt, sql`CURRENT_TIMESTAMP(3)`)));
      const changed = affectedRows(result);
      if (changed === 0) continue;
      if (changed !== 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval expiry could not be confirmed." });
      await tx.insert(auditEvents).values({ id: randomUUID(), ownerId, context: approval.context, actor: "system", event: "approval.expired", summary: "Aprobación vencida sin ejecutar acción.", resourceId: approval.id });
    }
  });
}

export async function getOverview(ownerId: number) {
  await expirePendingApprovals(ownerId);
  const db = await dbOrThrow();
  const [pendingRows, deviceRows, assetRows] = await Promise.all([
    db.select({ total: count() }).from(approvalRequests).where(and(eq(approvalRequests.ownerId, ownerId), eq(approvalRequests.status, "pending"), gt(approvalRequests.expiresAt, sql`CURRENT_TIMESTAMP(3)`))),
    db.select({ total: count() }).from(agentDevices).where(and(eq(agentDevices.ownerId, ownerId), eq(agentDevices.status, "active"))),
    db.select({ total: count() }).from(authorizedAssets).where(eq(authorizedAssets.ownerId, ownerId)),
  ]);
  return {
    pendingApprovals: Number(pendingRows[0]?.total ?? 0),
    pairedDevices: Number(deviceRows[0]?.total ?? 0),
    registeredAssets: Number(assetRows[0]?.total ?? 0),
    integrationsConnected: 0,
  };
}

export async function listApprovals(ownerId: number) {
  await expirePendingApprovals(ownerId);
  const db = await dbOrThrow();
  return db.select().from(approvalRequests)
    .where(eq(approvalRequests.ownerId, ownerId))
    .orderBy(desc(approvalRequests.createdAt)).limit(50);
}

export async function createApproval(ownerId: number, input: {
  context: LumenContext;
  category: ApprovalCategory;
  title: string;
  details: string;
  amountCents?: number;
  currency?: string;
}) {
  const db = await dbOrThrow();
  const id = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
  await db.transaction(async tx => {
    await tx.insert(approvalRequests).values({
      id,
      ownerId,
      context: input.context,
      category: input.category,
      title: input.title.trim(),
      details: input.details.trim(),
      amountCents: input.amountCents ?? null,
      currency: input.currency ?? null,
      status: "pending",
      createdAt,
      expiresAt,
    });
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: input.context, actor: "user",
      event: "approval.requested", summary: "Nueva solicitud de aprobación registrada.", resourceId: id,
    });
  });
  const rows = await db.select().from(approvalRequests).where(and(eq(approvalRequests.id, id), eq(approvalRequests.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval request could not be read back." });
  return rows[0];
}

function affectedRows(result: unknown): number | undefined {
  const raw = Array.isArray(result) ? result[0] : result;
  if (raw && typeof raw === "object" && "affectedRows" in raw) {
    const value = Number((raw as { affectedRows: unknown }).affectedRows);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

export async function decideApproval(ownerId: number, id: string, decision: "approved" | "rejected") {
  const db = await dbOrThrow();
  const outcome = await db.transaction(async tx => {
    const rows = await tx.select().from(approvalRequests)
      .where(and(eq(approvalRequests.id, id), eq(approvalRequests.ownerId, ownerId))).limit(1);
    const approval = rows[0];
    if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "Approval request not found." });
    if (approval.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "This request is no longer pending." });

    const now = new Date();
    const result = await tx.update(approvalRequests)
      .set({ status: decision, decidedAt: now })
      .where(and(eq(approvalRequests.id, id), eq(approvalRequests.ownerId, ownerId), eq(approvalRequests.status, "pending"), gt(approvalRequests.expiresAt, sql`CURRENT_TIMESTAMP(3)`)));
    const changed = affectedRows(result);
    if (changed === 0) {
      const expired = await tx.update(approvalRequests).set({ status: "expired", decidedAt: null })
        .where(and(eq(approvalRequests.id, id), eq(approvalRequests.ownerId, ownerId), eq(approvalRequests.status, "pending"), lte(approvalRequests.expiresAt, sql`CURRENT_TIMESTAMP(3)`)));
      const expiredRows = affectedRows(expired);
      if (expiredRows === 1) {
        await tx.insert(auditEvents).values({
          id: randomUUID(), ownerId, context: approval.context, actor: "system",
          event: "approval.expired", summary: "Aprobación vencida sin ejecutar acción.", resourceId: id,
        });
      } else if (expiredRows !== 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval expiry could not be confirmed." });
      }
      return { kind: "conflict" as const };
    }
    if (changed !== 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval decision could not be confirmed." });

    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: approval.context, actor: "user",
      event: `approval.${decision}`,
      summary: `Decisión humana registrada: ${decision}. Ninguna acción externa se ejecutó.`,
      resourceId: id,
    });

    const updated = await tx.select().from(approvalRequests)
      .where(and(eq(approvalRequests.id, id), eq(approvalRequests.ownerId, ownerId))).limit(1);
    if (!updated[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Approval decision could not be read back." });
    return { kind: "success" as const, approval: updated[0] };
  });
  if (outcome.kind === "conflict") {
    throw new TRPCError({ code: "CONFLICT", message: "This request expired or was already resolved." });
  }
  return outcome.approval;
}

export async function listAudit(ownerId: number) {
  const db = await dbOrThrow();
  return db.select({ id: auditEvents.id, context: auditEvents.context, actor: auditEvents.actor, event: auditEvents.event, summary: auditEvents.summary, resourceId: auditEvents.resourceId, createdAt: auditEvents.createdAt })
    .from(auditEvents).where(eq(auditEvents.ownerId, ownerId)).orderBy(desc(auditEvents.createdAt)).limit(40);
}

export async function createPairingCode(ownerId: number) {
  const db = await dbOrThrow();
  const code = randomBytes(24).toString("base64url");
  const id = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000);
  await db.transaction(async tx => {
    await tx.insert(agentPairingCodes).values({ id, ownerId, codeHash: digest(code), createdAt, expiresAt });
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: "personal", actor: "user",
      event: "agent.pairing_code_created", summary: "Código de pareo temporal generado; vence en cinco minutos.", resourceId: id,
    });
  });
  return { pairingCode: code, expiresAt, id };
}

export async function listDevices(ownerId: number) {
  const db = await dbOrThrow();
  return db.select({ id: agentDevices.id, name: agentDevices.name, status: agentDevices.status, lastSeenAt: agentDevices.lastSeenAt, createdAt: agentDevices.createdAt, revokedAt: agentDevices.revokedAt })
    .from(agentDevices).where(eq(agentDevices.ownerId, ownerId)).orderBy(desc(agentDevices.createdAt)).limit(30);
}

export async function revokeDevice(ownerId: number, id: string) {
  const db = await dbOrThrow();
  const rows = await db.select({ id: agentDevices.id, status: agentDevices.status })
    .from(agentDevices).where(and(eq(agentDevices.id, id), eq(agentDevices.ownerId, ownerId))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Device not found." });
  if (rows[0].status === "revoked") return { success: true };
  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(agentDevices).set({ status: "revoked", revokedAt: now })
      .where(and(eq(agentDevices.id, id), eq(agentDevices.ownerId, ownerId), eq(agentDevices.status, "active")));
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: "personal", actor: "user",
      event: "agent.device_revoked", summary: "Credencial local revocada.", resourceId: id,
    });
  });
  return { success: true };
}

export async function listAssets(ownerId: number) {
  const db = await dbOrThrow();
  return db.select({ id: authorizedAssets.id, context: authorizedAssets.context, kind: authorizedAssets.kind, label: authorizedAssets.label, createdAt: authorizedAssets.createdAt })
    .from(authorizedAssets).where(eq(authorizedAssets.ownerId, ownerId)).orderBy(desc(authorizedAssets.createdAt)).limit(100);
}

export async function createAsset(ownerId: number, input: { context: LumenContext; kind: "device" | "network" | "server"; label: string; authorizationConfirmed: true }) {
  const db = await dbOrThrow();
  const id = randomUUID();
  await db.transaction(async tx => {
    await tx.insert(authorizedAssets).values({ id, ownerId, context: input.context, kind: input.kind, label: input.label.trim(), authorizationConfirmed: true });
    await tx.insert(auditEvents).values({
      id: randomUUID(), ownerId, context: input.context, actor: "user",
      event: "security.asset_registered", summary: "Activo declarado como propio o autorizado.", resourceId: id,
    });
  });
  return { id, context: input.context, kind: input.kind, label: input.label.trim(), createdAt: new Date() };
}

export async function authenticateAgentToken(token: string) {
  const db = await dbOrThrow();
  const rows = await db.select({ id: agentDevices.id, ownerId: agentDevices.ownerId, name: agentDevices.name })
    .from(agentDevices).where(and(eq(agentDevices.tokenHash, digest(token)), eq(agentDevices.status, "active"))).limit(1);
  return rows[0] ?? null;
}

export async function revokeAgentToken(token: string) {
  const device = await authenticateAgentToken(token);
  if (!device) return false;
  await revokeDevice(device.ownerId, device.id);
  return true;
}

export async function touchAgent(id: string) {
  const db = await dbOrThrow();
  const now = new Date();
  const result = await db.update(agentDevices).set({ lastSeenAt: now })
    .where(and(eq(agentDevices.id, id), eq(agentDevices.status, "active")));
  return affectedRows(result) === 1 ? now : null;
}

export async function pairAgent(input: { codeHash: string; name: string; tokenHash: string; deviceId: string }) {
  const db = await dbOrThrow();
  const now = new Date();
  const rows = await db.select().from(agentPairingCodes)
    .where(and(eq(agentPairingCodes.codeHash, input.codeHash), isNull(agentPairingCodes.usedAt), gt(agentPairingCodes.expiresAt, sql`CURRENT_TIMESTAMP(3)`))).limit(1);
  const code = rows[0];
  if (!code) return null;
  try {
    return await db.transaction(async tx => {
      const update = await tx.update(agentPairingCodes).set({ usedAt: now })
        .where(and(eq(agentPairingCodes.id, code.id), eq(agentPairingCodes.ownerId, code.ownerId), isNull(agentPairingCodes.usedAt), gt(agentPairingCodes.expiresAt, sql`CURRENT_TIMESTAMP(3)`)));
      if (affectedRows(update) !== 1) return null;
      await tx.insert(agentDevices).values({ id: input.deviceId, ownerId: code.ownerId, name: input.name, tokenHash: input.tokenHash, status: "active", createdAt: now });
      await tx.insert(auditEvents).values({
        id: randomUUID(), ownerId: code.ownerId, context: "personal", actor: "system",
        event: "agent.device_paired", summary: "Agente local emparejado.", resourceId: input.deviceId,
      });
      return { id: input.deviceId, ownerId: code.ownerId, name: input.name };
    });
  } catch (error) {
    // A duplicate/racing claim must fail closed; the one-time code is never reused.
    console.warn("[Lumen] Agent pairing failed.");
    return null;
  }
}

export async function recordAgentPresence(deviceId: string, name: string, at: Date) {
  // Heartbeats are not added to the audit stream; doing so would retain excessive
  // metadata. The current last-seen value is sufficient for liveness display.
  return { deviceId, name, lastSeenAt: at.toISOString(), capabilities: ["presence"] as const };
}


export async function listMemory(ownerId: number) {
  const db = await dbOrThrow();
  return db.select({ id: memoryNotes.id, context: memoryNotes.context, kind: memoryNotes.kind, title: memoryNotes.title, content: memoryNotes.content, createdAt: memoryNotes.createdAt, updatedAt: memoryNotes.updatedAt })
    .from(memoryNotes).where(eq(memoryNotes.ownerId, ownerId)).orderBy(desc(memoryNotes.updatedAt)).limit(100);
}

export async function listMemoryForAssistant(ownerId: number) {
  const db = await dbOrThrow();
  const rows = await db.select({ context: memoryNotes.context, kind: memoryNotes.kind, title: memoryNotes.title, content: memoryNotes.content })
    .from(memoryNotes).where(eq(memoryNotes.ownerId, ownerId)).orderBy(desc(memoryNotes.updatedAt)).limit(12);
  return rows.map(note => ({ ...note, title: note.title.slice(0, 120), content: note.content.slice(0, 600) }));
}

export async function createMemory(ownerId: number, input: { context: LumenContext; kind: "preference" | "pending"; title: string; content: string }) {
  const db = await dbOrThrow();
  const id = randomUUID();
  const now = new Date();
  await db.transaction(async tx => {
    await tx.insert(memoryNotes).values({ id, ownerId, context: input.context, kind: input.kind, title: input.title.trim(), content: input.content.trim(), createdAt: now, updatedAt: now });
    await tx.insert(auditEvents).values({ id: randomUUID(), ownerId, context: input.context, actor: "user", event: "memory.created", summary: `Nota personal creada: ${input.kind}.`, resourceId: id });
  });
  const rows = await db.select({ id: memoryNotes.id, context: memoryNotes.context, kind: memoryNotes.kind, title: memoryNotes.title, content: memoryNotes.content, createdAt: memoryNotes.createdAt, updatedAt: memoryNotes.updatedAt })
    .from(memoryNotes).where(and(eq(memoryNotes.ownerId, ownerId), eq(memoryNotes.id, id))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Memory note could not be read back." });
  return rows[0];
}

export async function updateMemory(ownerId: number, input: { id: string; context: LumenContext; kind: "preference" | "pending"; title: string; content: string }) {
  const db = await dbOrThrow();
  const existing = await db.select({ id: memoryNotes.id }).from(memoryNotes)
    .where(and(eq(memoryNotes.id, input.id), eq(memoryNotes.ownerId, ownerId))).limit(1);
  if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Memory note not found." });
  await db.transaction(async tx => {
    await tx.update(memoryNotes).set({ context: input.context, kind: input.kind, title: input.title.trim(), content: input.content.trim() })
      .where(and(eq(memoryNotes.id, input.id), eq(memoryNotes.ownerId, ownerId)));
    await tx.insert(auditEvents).values({ id: randomUUID(), ownerId, context: input.context, actor: "user", event: "memory.updated", summary: `Nota personal actualizada: ${input.kind}.`, resourceId: input.id });
  });
  const rows = await db.select({ id: memoryNotes.id, context: memoryNotes.context, kind: memoryNotes.kind, title: memoryNotes.title, content: memoryNotes.content, createdAt: memoryNotes.createdAt, updatedAt: memoryNotes.updatedAt })
    .from(memoryNotes).where(and(eq(memoryNotes.ownerId, ownerId), eq(memoryNotes.id, input.id))).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Updated memory note could not be read back." });
  return rows[0];
}

export async function deleteMemory(ownerId: number, id: string) {
  const db = await dbOrThrow();
  const rows = await db.select({ id: memoryNotes.id, context: memoryNotes.context }).from(memoryNotes)
    .where(and(eq(memoryNotes.id, id), eq(memoryNotes.ownerId, ownerId))).limit(1);
  const note = rows[0];
  if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Memory note not found." });
  await db.transaction(async tx => {
    await tx.delete(memoryNotes).where(and(eq(memoryNotes.id, id), eq(memoryNotes.ownerId, ownerId)));
    await tx.insert(auditEvents).values({ id: randomUUID(), ownerId, context: note.context, actor: "user", event: "memory.deleted", summary: "Nota personal eliminada de la memoria de Lumen.", resourceId: id });
  });
  return { success: true };
}
