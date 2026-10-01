import { describe, expect, it } from "vitest";
import { isTrustedSameOriginMutation } from "./csrf";

describe("same-origin mutation guard", () => {
  it("accepts browser Fetch Metadata from the app origin behind a proxy", () => {
    expect(isTrustedSameOriginMutation({ fetchSite: "same-origin", origin: "https://preview.example", host: "internal:3000" })).toBe(true);
  });

  it("rejects cross-site and same-site requests", () => {
    expect(isTrustedSameOriginMutation({ fetchSite: "cross-site", origin: "https://lumen.example", host: "lumen.example" })).toBe(false);
    expect(isTrustedSameOriginMutation({ fetchSite: "same-site", origin: "https://lumen.example", host: "lumen.example" })).toBe(false);
  });

  it("falls back to matching Origin when Fetch Metadata is absent", () => {
    expect(isTrustedSameOriginMutation({ origin: "https://lumen.example", host: "lumen.example" })).toBe(true);
    expect(isTrustedSameOriginMutation({ origin: "https://lumen.example", host: "attacker.example" })).toBe(false);
  });

  it("supports matching Referer in local development", () => {
    expect(isTrustedSameOriginMutation({ referer: "http://localhost:3000/settings", host: "localhost:3000", protocol: "http" })).toBe(true);
  });

  it("rejects missing, malformed, credentialed, and insecure public origins", () => {
    expect(isTrustedSameOriginMutation({ host: "lumen.example" })).toBe(false);
    expect(isTrustedSameOriginMutation({ origin: "not a URL", host: "lumen.example" })).toBe(false);
    expect(isTrustedSameOriginMutation({ origin: "https://user:pass@lumen.example", host: "lumen.example" })).toBe(false);
    expect(isTrustedSameOriginMutation({ origin: "http://lumen.example", host: "lumen.example", protocol: "http" })).toBe(false);
  });
});
