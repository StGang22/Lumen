export type LumenContext = "personal" | "home" | "business";
export type ApprovalCategory = "financial" | "home" | "business" | "security";

/**
 * Lumen currently records approval decisions but does not execute the underlying
 * payment, home, business, or security action. Every request in these categories
 * is treated as important and requires a human decision.
 */
export function requiresHumanApproval(category: ApprovalCategory): true {
  switch (category) {
    case "financial":
    case "home":
    case "business":
    case "security":
      return true;
  }
}

export function canMonitorAsset(input: {
  authorizationConfirmed: boolean;
  ownerId: number;
}): boolean {
  return input.authorizationConfirmed === true && Number.isInteger(input.ownerId) && input.ownerId > 0;
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
