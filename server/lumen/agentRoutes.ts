import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { pairAgent, authenticateAgentToken, revokeAgentToken, touchAgent, recordAgentPresence } from "./store";

const PairBody = z.object({
  pairingCode: z.string().min(20).max(80),
  deviceName: z.string().trim().min(1).max(80),
}).strict();
const rateByAddress = new Map<string, { start: number; count: number }>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PAIRS_PER_ADDRESS = 20;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function allowPairAttempt(address: string): boolean {
  const now = Date.now();
  const current = rateByAddress.get(address);
  if (!current || now - current.start > RATE_WINDOW_MS) {
    rateByAddress.set(address, { start: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_PAIRS_PER_ADDRESS) return false;
  current.count += 1;
  return true;
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(header);
  return match?.[1] ?? null;
}

function sendUnavailable(res: Response) {
  res.status(503).json({ error: "Lumen agent service is temporarily unavailable." });
}

export function registerAgentRoutes(app: Express) {
  app.post("/api/agent/pair", async (req, res) => {
    const address = req.ip || req.socket.remoteAddress || "unknown";
    if (!allowPairAttempt(address)) {
      res.status(429).json({ error: "Too many pairing attempts. Try again later." });
      return;
    }

    const parsed = PairBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid pairing request." });
      return;
    }

    const deviceToken = randomBytes(32).toString("base64url");
    const deviceId = randomUUID();
    let paired: Awaited<ReturnType<typeof pairAgent>>;
    try {
      paired = await pairAgent({
        codeHash: hash(parsed.data.pairingCode),
        name: parsed.data.deviceName,
        tokenHash: hash(deviceToken),
        deviceId,
      });
    } catch {
      sendUnavailable(res);
      return;
    }
    if (!paired) {
      res.status(401).json({ error: "Pairing code is invalid, expired, or already used." });
      return;
    }

    // The bearer token is returned once. Only its SHA-256 digest is retained.
    res.set("Cache-Control", "no-store").set("Pragma", "no-cache").status(201).json({ deviceId, deviceToken, deviceName: paired.name });
  });

  app.get("/api/agent/status", async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: "A valid device credential is required." });
      return;
    }
    try {
      const device = await authenticateAgentToken(token);
      if (!device) {
        res.status(401).json({ error: "Device credential is invalid or revoked." });
        return;
      }
      const lastSeenAt = await touchAgent(device.id);
      if (!lastSeenAt) {
        res.status(401).json({ error: "Device credential is invalid or revoked." });
        return;
      }
      res.set("Cache-Control", "no-store").json(await recordAgentPresence(device.id, device.name, lastSeenAt));
    } catch {
      sendUnavailable(res);
    }
  });

  app.post("/api/agent/unpair", async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).set("Cache-Control", "no-store").json({ error: "A valid device credential is required." });
      return;
    }
    try {
      if (!await revokeAgentToken(token)) {
        res.status(401).set("Cache-Control", "no-store").json({ error: "Device credential is invalid or revoked." });
        return;
      }
      res.set("Cache-Control", "no-store").json({ success: true });
    } catch {
      sendUnavailable(res);
    }
  });
}
