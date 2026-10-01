export function isSessionIssuedAfterCutoff(issuedAt: unknown, cutoff: Date): boolean {
  if (typeof issuedAt !== "number" || !Number.isSafeInteger(issuedAt)) return false;
  return issuedAt > Math.floor(cutoff.getTime() / 1000);
}
