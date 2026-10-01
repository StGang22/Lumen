import { describe, expect, it } from "vitest";
import { canMonitorAsset, isExpired, requiresHumanApproval } from "./policy";

describe("Lumen safety policy", () => {
  it.each(["financial", "home", "business", "security"] as const)("requires a human decision for %s", category => {
    expect(requiresHumanApproval(category)).toBe(true);
  });

  it("allows inventory only after explicit authorization for an authenticated owner", () => {
    expect(canMonitorAsset({ authorizationConfirmed: true, ownerId: 12 })).toBe(true);
    expect(canMonitorAsset({ authorizationConfirmed: false, ownerId: 12 })).toBe(false);
    expect(canMonitorAsset({ authorizationConfirmed: true, ownerId: 0 })).toBe(false);
    expect(canMonitorAsset({ authorizationConfirmed: true, ownerId: -1 })).toBe(false);
  });

  it("treats the expiry instant as expired and a future decision as live", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(isExpired(new Date(now.getTime() - 1), now)).toBe(true);
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(new Date(now.getTime() + 1), now)).toBe(false);
  });
});
