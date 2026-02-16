import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pubkey: text("pubkey").unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name"),
  rewardClaimed: boolean("reward_claimed").default(false).notNull(),
});

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lnAuthChallenges = pgTable("ln_auth_challenges", {
  k1: varchar("k1", { length: 64 }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  used: boolean("used").default(false).notNull(),
  pubkey: text("pubkey"),
  sessionToken: text("session_token"),
});

export const lnurlWithdrawals = pgTable("lnurl_withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  k1: varchar("k1", { length: 64 }).notNull().unique(),
  userId: varchar("user_id").notNull(),
  amountMsats: text("amount_msats").notNull(),
  status: text("status").notNull().default("pending"),
  bolt11Invoice: text("bolt11_invoice"),
  paymentIndex: text("payment_index"),
  errorReason: text("error_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  claimedAt: timestamp("claimed_at"),
  paidAt: timestamp("paid_at"),
});

export const pageEvents = pgTable("page_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  sessionId: text("session_id"),
  page: text("page").notNull(),
  referrer: text("referrer"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPageEventSchema = createInsertSchema(pageEvents).omit({ id: true, createdAt: true });
export type InsertPageEvent = z.infer<typeof insertPageEventSchema>;
export type PageEvent = typeof pageEvents.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  pubkey: true,
  email: true,
  displayName: true,
});

export const emailAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type LnAuthChallenge = typeof lnAuthChallenges.$inferSelect;
export type LnurlWithdrawal = typeof lnurlWithdrawals.$inferSelect;
