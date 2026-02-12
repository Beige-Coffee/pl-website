import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pubkey: text("pubkey").notNull().unique(),
  displayName: text("display_name"),
});

export const lnAuthChallenges = pgTable("ln_auth_challenges", {
  k1: varchar("k1", { length: 64 }).primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  used: boolean("used").default(false).notNull(),
  pubkey: text("pubkey"),
  sessionToken: text("session_token"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  pubkey: true,
  displayName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LnAuthChallenge = typeof lnAuthChallenges.$inferSelect;
