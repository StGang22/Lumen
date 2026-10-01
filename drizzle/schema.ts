import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sessionRevocationPolicy = mysqlTable("session_revocation_policy", {
  id: int("id").primaryKey(),
  invalidatedBefore: timestamp("invalidated_before", { fsp: 3 }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const approvalRequests = mysqlTable("approval_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  context: mysqlEnum("context", ["personal", "home", "business"]).notNull(),
  category: mysqlEnum("category", ["financial", "home", "business", "security"]).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  details: text("details").notNull(),
  amountCents: int("amount_cents"),
  currency: varchar("currency", { length: 3 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  decidedAt: timestamp("decided_at"),
});

export const auditEvents = mysqlTable("audit_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  context: mysqlEnum("context", ["personal", "home", "business"]).notNull(),
  actor: mysqlEnum("actor", ["user", "agent", "system"]).notNull(),
  event: varchar("event", { length: 64 }).notNull(),
  summary: varchar("summary", { length: 240 }).notNull(),
  resourceId: varchar("resource_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentPairingCodes = mysqlTable("agent_pairing_codes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentDevices = mysqlTable("agent_devices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const authorizedAssets = mysqlTable("authorized_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  context: mysqlEnum("context", ["personal", "home", "business"]).notNull(),
  kind: mysqlEnum("kind", ["device", "network", "server"]).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  authorizationConfirmed: boolean("authorization_confirmed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memoryNotes = mysqlTable("memory_notes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  context: mysqlEnum("context", ["personal", "home", "business"]).notNull(),
  kind: mysqlEnum("kind", ["preference", "pending"]).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
