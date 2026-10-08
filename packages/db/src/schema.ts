import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

const privateSchema = pgSchema("app_private");
export const superadmins = privateSchema.table("superadmins", {
  authSubject: text("auth_subject").primaryKey(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("active"),
  role: text("role").notNull().default("superadmin"),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const superadminInvites = privateSchema.table("superadmin_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  authSubject: text("auth_subject"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
