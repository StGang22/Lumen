import { describe, expect, it } from "vitest";
import { isSessionIssuedAfterCutoff } from "./_core/sessionCutoff";

describe("session revocation cutoff", () => {
  const cutoff = new Date("2026-10-01T20:37:22.500Z");

  it("rejects tokens issued before or during the cutoff second", () => {
    expect(isSessionIssuedAfterCutoff(1790887041, cutoff)).toBe(false);
    expect(isSessionIssuedAfterCutoff(1790887042, cutoff)).toBe(false);
  });

  it("accepts a token issued after the cutoff second", () => {
    expect(isSessionIssuedAfterCutoff(1790887043, cutoff)).toBe(true);
  });

  it("fails closed for a missing or malformed JWT issued-at claim", () => {
    expect(isSessionIssuedAfterCutoff(undefined, cutoff)).toBe(false);
    expect(isSessionIssuedAfterCutoff("1790887043", cutoff)).toBe(false);
    expect(isSessionIssuedAfterCutoff(Number.NaN, cutoff)).toBe(false);
  });
});
