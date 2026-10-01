import type { NextFunction, Request, Response } from "express";

type OriginFacts = {
  fetchSite?: string;
  origin?: string;
  referer?: string;
  forwardedHost?: string;
  host?: string;
  forwardedProto?: string;
  protocol?: string;
};

export function isTrustedSameOriginMutation(facts: OriginFacts): boolean {
  const fetchSite = facts.fetchSite?.trim().toLowerCase();
  if (fetchSite) return fetchSite === "same-origin";

  const candidate = facts.origin || facts.referer;
  const requestHost = (facts.forwardedHost || facts.host || "").split(",")[0].trim();
  if (!candidate || !requestHost) return false;

  try {
    const source = new URL(candidate);
    if (source.username || source.password) return false;
    const isLoopbackHttp = source.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(source.hostname.toLowerCase());
    if (source.protocol !== "https:" && !isLoopbackHttp) return false;

    const expectedProtocol = (facts.forwardedProto || facts.protocol || "").split(",")[0].trim().toLowerCase();
    if (expectedProtocol && `${source.protocol.slice(0, -1)}` !== expectedProtocol) return false;

    const target = new URL(`${source.protocol}//${requestHost}`);
    return source.origin.toLowerCase() === target.origin.toLowerCase();
  } catch {
    return false;
  }
}

export function guardTrpcMutations(req: Request, res: Response, next: NextFunction) {
  if (req.method.toUpperCase() !== "POST") {
    next();
    return;
  }

  const allowed = isTrustedSameOriginMutation({
    fetchSite: req.get("sec-fetch-site"),
    origin: req.get("origin"),
    referer: req.get("referer"),
    forwardedHost: req.get("x-forwarded-host"),
    host: req.get("host"),
    forwardedProto: req.get("x-forwarded-proto"),
    protocol: req.protocol,
  });
  if (!allowed) {
    res.set("Cache-Control", "no-store").status(403).json({ error: "Cross-origin request rejected." });
    return;
  }
  next();
}
