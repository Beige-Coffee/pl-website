import { type User, type InsertUser, type LnAuthChallenge, type Session, type LnurlWithdrawal, type InsertPageEvent, type PageEvent, users, lnAuthChallenges, sessions, lnurlWithdrawals, pageEvents } from "@shared/schema";
import { eq, desc, inArray, and, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByPubkey(pubkey: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithPassword(email: string, passwordHash: string, displayName: string): Promise<User>;
  createSession(userId: string): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  getUserBySessionToken(token: string): Promise<User | undefined>;
  setRewardClaimed(userId: string): Promise<void>;
  createChallenge(k1: string): Promise<LnAuthChallenge>;
  getChallenge(k1: string): Promise<LnAuthChallenge | undefined>;
  completeChallenge(k1: string, pubkey: string, sessionToken: string): Promise<void>;
  createWithdrawal(k1: string, userId: string, amountMsats: string): Promise<LnurlWithdrawal>;
  getWithdrawalByK1(k1: string): Promise<LnurlWithdrawal | undefined>;
  markWithdrawalClaimed(k1: string, bolt11Invoice: string): Promise<void>;
  markWithdrawalPaid(k1: string, paymentIndex: string): Promise<void>;
  markWithdrawalFailed(k1: string, reason: string): Promise<void>;
  markWithdrawalExpired(k1: string): Promise<void>;
  getWithdrawalsByUserId(userId: string): Promise<LnurlWithdrawal[]>;
  getRecentWithdrawals(limit: number): Promise<LnurlWithdrawal[]>;
  cancelPendingWithdrawals(userId: string): Promise<void>;
  createPageEvent(event: InsertPageEvent): Promise<PageEvent>;
  getPageEventById(id: number): Promise<PageEvent | undefined>;
  updatePageEventDuration(id: number, duration: number): Promise<void>;
  getPageViewStats(): Promise<{ page: string; views: number; avgDuration: number }[]>;
  getRecentPageEvents(limit: number): Promise<PageEvent[]>;
  getTotalPageViews(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPubkey(pubkey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.pubkey, pubkey));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createUserWithPassword(email: string, passwordHash: string, displayName: string): Promise<User> {
    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      displayName,
    }).returning();
    return user;
  }

  async createSession(userId: string): Promise<Session> {
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const [session] = await db.insert(sessions).values({ token, userId }).returning();
    return session;
  }

  async getSession(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session;
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  async getUserBySessionToken(token: string): Promise<User | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    if (!session) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    return user;
  }

  async setRewardClaimed(userId: string): Promise<void> {
    await db.update(users).set({ rewardClaimed: true }).where(eq(users.id, userId));
  }

  async createChallenge(k1: string): Promise<LnAuthChallenge> {
    const [challenge] = await db.insert(lnAuthChallenges).values({ k1 }).returning();
    return challenge;
  }

  async getChallenge(k1: string): Promise<LnAuthChallenge | undefined> {
    const [challenge] = await db.select().from(lnAuthChallenges).where(eq(lnAuthChallenges.k1, k1));
    return challenge;
  }

  async completeChallenge(k1: string, pubkey: string, sessionToken: string): Promise<void> {
    await db.update(lnAuthChallenges)
      .set({ used: true, pubkey, sessionToken })
      .where(eq(lnAuthChallenges.k1, k1));
  }

  async createWithdrawal(k1: string, userId: string, amountMsats: string): Promise<LnurlWithdrawal> {
    const [withdrawal] = await db.insert(lnurlWithdrawals).values({ k1, userId, amountMsats }).returning();
    return withdrawal;
  }

  async getWithdrawalByK1(k1: string): Promise<LnurlWithdrawal | undefined> {
    const [withdrawal] = await db.select().from(lnurlWithdrawals).where(eq(lnurlWithdrawals.k1, k1));
    return withdrawal;
  }

  async markWithdrawalClaimed(k1: string, bolt11Invoice: string): Promise<void> {
    await db.update(lnurlWithdrawals)
      .set({ status: "claimed", bolt11Invoice, claimedAt: new Date() })
      .where(eq(lnurlWithdrawals.k1, k1));
  }

  async markWithdrawalPaid(k1: string, paymentIndex: string): Promise<void> {
    await db.update(lnurlWithdrawals)
      .set({ status: "paid", paymentIndex, paidAt: new Date() })
      .where(eq(lnurlWithdrawals.k1, k1));
  }

  async markWithdrawalFailed(k1: string, reason: string): Promise<void> {
    await db.update(lnurlWithdrawals)
      .set({ status: "failed", errorReason: reason })
      .where(eq(lnurlWithdrawals.k1, k1));
  }

  async markWithdrawalExpired(k1: string): Promise<void> {
    await db.update(lnurlWithdrawals)
      .set({ status: "expired" })
      .where(eq(lnurlWithdrawals.k1, k1));
  }

  async getWithdrawalsByUserId(userId: string): Promise<LnurlWithdrawal[]> {
    return db.select().from(lnurlWithdrawals)
      .where(eq(lnurlWithdrawals.userId, userId))
      .orderBy(desc(lnurlWithdrawals.createdAt));
  }

  async getRecentWithdrawals(limit: number): Promise<LnurlWithdrawal[]> {
    return db.select().from(lnurlWithdrawals)
      .orderBy(desc(lnurlWithdrawals.createdAt))
      .limit(limit);
  }

  async cancelPendingWithdrawals(userId: string): Promise<void> {
    await db.update(lnurlWithdrawals)
      .set({ status: "expired" })
      .where(
        and(
          eq(lnurlWithdrawals.userId, userId),
          inArray(lnurlWithdrawals.status, ["pending", "claimed"])
        )
      );
  }

  async createPageEvent(event: InsertPageEvent): Promise<PageEvent> {
    const [pageEvent] = await db.insert(pageEvents).values(event).returning();
    return pageEvent;
  }

  async getPageEventById(id: number): Promise<PageEvent | undefined> {
    const [event] = await db.select().from(pageEvents).where(eq(pageEvents.id, id));
    return event;
  }

  async updatePageEventDuration(id: number, duration: number): Promise<void> {
    await db.update(pageEvents).set({ duration }).where(eq(pageEvents.id, id));
  }

  async getPageViewStats(): Promise<{ page: string; views: number; avgDuration: number }[]> {
    const result = await db.select({
      page: pageEvents.page,
      views: count(pageEvents.id),
      avgDuration: sql<number>`coalesce(avg(${pageEvents.duration})::int, 0)`,
    }).from(pageEvents).groupBy(pageEvents.page).orderBy(desc(count(pageEvents.id)));
    return result.map(r => ({ page: r.page, views: Number(r.views), avgDuration: Number(r.avgDuration) }));
  }

  async getRecentPageEvents(limit: number): Promise<PageEvent[]> {
    return db.select().from(pageEvents).orderBy(desc(pageEvents.createdAt)).limit(limit);
  }

  async getTotalPageViews(): Promise<number> {
    const [result] = await db.select({ total: count(pageEvents.id) }).from(pageEvents);
    return Number(result.total);
  }
}

export const storage = new DatabaseStorage();
