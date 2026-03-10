import { type User, type InsertUser, type LnAuthChallenge, type Session, type LnurlWithdrawal, type InsertPageEvent, type PageEvent, type CheckpointCompletion, type Donation, type UserProgress, type InsertFeedback, type Feedback, users, lnAuthChallenges, sessions, lnurlWithdrawals, pageEvents, checkpointCompletions, donations, userProgress, feedback } from "@shared/schema";
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
  deleteSessionsByUserId(userId: string): Promise<void>;
  getUserBySessionToken(token: string): Promise<User | undefined>;
  setRewardClaimed(userId: string): Promise<void>;
  setUserEmailVerified(userId: string, emailVerified: boolean): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string, displayName?: string | null): Promise<void>;
  updateUserLightningAddress(userId: string, lightningAddress: string | null): Promise<void>;
  setVerificationToken(userId: string, token: string, expiry: Date): Promise<void>;
  verifyEmail(token: string): Promise<User | undefined>;
  createChallenge(k1: string): Promise<LnAuthChallenge>;
  getChallenge(k1: string): Promise<LnAuthChallenge | undefined>;
  completeChallenge(k1: string, pubkey: string, sessionToken: string): Promise<void>;
  createWithdrawal(k1: string, userId: string, amountMsats: string, checkpointId?: string): Promise<LnurlWithdrawal>;
  getWithdrawalByK1(k1: string): Promise<LnurlWithdrawal | undefined>;
  markWithdrawalClaimed(k1: string, bolt11Invoice: string): Promise<void>;
  markWithdrawalPaid(k1: string, paymentIndex: string): Promise<void>;
  markWithdrawalFailed(k1: string, reason: string): Promise<void>;
  markWithdrawalExpired(k1: string): Promise<void>;
  getWithdrawalsByUserId(userId: string): Promise<LnurlWithdrawal[]>;
  getRecentWithdrawals(limit: number): Promise<LnurlWithdrawal[]>;
  cancelPendingWithdrawals(userId: string): Promise<void>;
  hasCompletedCheckpoint(userId: string, checkpointId: string): Promise<boolean>;
  markCheckpointCompleted(userId: string, checkpointId: string): Promise<void>;
  deleteCheckpointCompletion(userId: string, checkpointId: string): Promise<void>;
  deleteAllCheckpointCompletions(userId: string): Promise<void>;
  deleteWithdrawalsForCheckpoint(userId: string, checkpointId: string): Promise<void>;
  resetUserLaunchState(userId: string): Promise<void>;
  getCompletedCheckpoints(userId: string): Promise<{ checkpointId: string; amountSats: number; paidAt: string }[]>;
  getPaidWithdrawalForCheckpoint(userId: string, checkpointId: string): Promise<LnurlWithdrawal | undefined>;
  cancelPendingWithdrawalsForCheckpoint(userId: string, checkpointId: string): Promise<void>;
  createPageEvent(event: InsertPageEvent): Promise<PageEvent>;
  getPageEventById(id: number): Promise<PageEvent | undefined>;
  updatePageEventDuration(id: number, duration: number): Promise<void>;
  getPageViewStats(): Promise<{ page: string; views: number; avgDuration: number }[]>;
  getRecentPageEvents(limit: number): Promise<PageEvent[]>;
  getTotalPageViews(): Promise<number>;
  createDonation(paymentIndex: string, amountSats: number, donorName: string, message: string | null): Promise<Donation>;
  getRecentDonations(limit: number): Promise<Donation[]>;
  markDonationSpam(id: string): Promise<void>;
  getUserProgress(userId: string): Promise<Record<string, string>>;
  setUserProgress(userId: string, key: string, value: string): Promise<void>;
  deleteAllUserProgress(userId: string): Promise<void>;
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  setFeedbackGithubUrl(id: string, url: string): Promise<void>;
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

  async deleteSessionsByUserId(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
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

  async setUserEmailVerified(userId: string, emailVerified: boolean): Promise<void> {
    await db.update(users)
      .set({
        emailVerified,
        verificationToken: null,
        verificationExpiry: null,
      })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, passwordHash: string, displayName?: string | null): Promise<void> {
    const values: { passwordHash: string; displayName?: string | null } = { passwordHash };
    if (displayName !== undefined) {
      values.displayName = displayName;
    }
    await db.update(users).set(values).where(eq(users.id, userId));
  }

  async updateUserLightningAddress(userId: string, lightningAddress: string | null): Promise<void> {
    await db.update(users).set({ lightningAddress }).where(eq(users.id, userId));
  }

  async setVerificationToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db.update(users).set({ verificationToken: token, verificationExpiry: expiry }).where(eq(users.id, userId));
  }

  async verifyEmail(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    if (!user) return undefined;
    if (user.verificationExpiry && user.verificationExpiry < new Date()) return undefined;
    await db.update(users).set({ emailVerified: true, verificationToken: null, verificationExpiry: null }).where(eq(users.id, user.id));
    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    return updated;
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

  async createWithdrawal(k1: string, userId: string, amountMsats: string, checkpointId?: string): Promise<LnurlWithdrawal> {
    const values: any = { k1, userId, amountMsats };
    if (checkpointId) values.checkpointId = checkpointId;
    const [withdrawal] = await db.insert(lnurlWithdrawals).values(values).returning();
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

  async hasCompletedCheckpoint(userId: string, checkpointId: string): Promise<boolean> {
    const [row] = await db.select().from(checkpointCompletions)
      .where(and(eq(checkpointCompletions.userId, userId), eq(checkpointCompletions.checkpointId, checkpointId)));
    return !!row;
  }

  async markCheckpointCompleted(userId: string, checkpointId: string): Promise<void> {
    await db.insert(checkpointCompletions)
      .values({ userId, checkpointId })
      .onConflictDoNothing({ target: [checkpointCompletions.userId, checkpointCompletions.checkpointId] });
  }

  async deleteCheckpointCompletion(userId: string, checkpointId: string): Promise<void> {
    await db.delete(checkpointCompletions)
      .where(and(eq(checkpointCompletions.userId, userId), eq(checkpointCompletions.checkpointId, checkpointId)));
  }

  async deleteAllCheckpointCompletions(userId: string): Promise<void> {
    await db.delete(checkpointCompletions)
      .where(eq(checkpointCompletions.userId, userId));
  }

  async deleteWithdrawalsForCheckpoint(userId: string, checkpointId: string): Promise<void> {
    await db.delete(lnurlWithdrawals)
      .where(
        and(
          eq(lnurlWithdrawals.userId, userId),
          eq(lnurlWithdrawals.checkpointId, checkpointId)
        )
      );
  }

  async resetUserLaunchState(userId: string): Promise<void> {
    await Promise.all([
      db.delete(checkpointCompletions).where(eq(checkpointCompletions.userId, userId)),
      db.delete(userProgress).where(eq(userProgress.userId, userId)),
      db.delete(lnurlWithdrawals).where(eq(lnurlWithdrawals.userId, userId)),
      db.delete(sessions).where(eq(sessions.userId, userId)),
      db.update(users)
        .set({
          rewardClaimed: false,
          lightningAddress: null,
        })
        .where(eq(users.id, userId)),
    ]);
  }

  async getCompletedCheckpoints(userId: string): Promise<{ checkpointId: string; amountSats: number; paidAt: string }[]> {
    // Get all completions from the checkpointCompletions table
    const completions = await db.select({
      checkpointId: checkpointCompletions.checkpointId,
      createdAt: checkpointCompletions.createdAt,
    })
      .from(checkpointCompletions)
      .where(eq(checkpointCompletions.userId, userId));

    // Get paid withdrawals for reward info
    const withdrawals = await db.select({
      checkpointId: lnurlWithdrawals.checkpointId,
      amountMsats: lnurlWithdrawals.amountMsats,
      paidAt: lnurlWithdrawals.paidAt,
    })
      .from(lnurlWithdrawals)
      .where(
        and(
          eq(lnurlWithdrawals.userId, userId),
          eq(lnurlWithdrawals.status, "paid"),
          sql`${lnurlWithdrawals.checkpointId} IS NOT NULL`
        )
      );

    // Build a map of paid withdrawals by checkpointId
    const paidMap = new Map<string, { amountSats: number; paidAt: string }>();
    for (const w of withdrawals) {
      if (w.checkpointId && w.paidAt) {
        paidMap.set(w.checkpointId, {
          amountSats: Math.round(parseInt(w.amountMsats, 10) / 1000),
          paidAt: w.paidAt.toISOString(),
        });
      }
    }

    // Merge: completions table is the source of truth for "completed",
    // withdrawals table provides amountSats/paidAt when claimed
    const seen = new Set<string>();
    const results: { checkpointId: string; amountSats: number; paidAt: string }[] = [];

    for (const c of completions) {
      seen.add(c.checkpointId);
      const paid = paidMap.get(c.checkpointId);
      results.push({
        checkpointId: c.checkpointId,
        amountSats: paid?.amountSats ?? 0,
        paidAt: paid?.paidAt ?? c.createdAt.toISOString(),
      });
    }

    return results;
  }

  async getPaidWithdrawalForCheckpoint(userId: string, checkpointId: string): Promise<LnurlWithdrawal | undefined> {
    const [row] = await db.select().from(lnurlWithdrawals)
      .where(
        and(
          eq(lnurlWithdrawals.userId, userId),
          eq(lnurlWithdrawals.checkpointId, checkpointId),
          eq(lnurlWithdrawals.status, "paid")
        )
      );
    return row;
  }

  async cancelPendingWithdrawalsForCheckpoint(userId: string, checkpointId: string): Promise<void> {
    await db.update(lnurlWithdrawals)
      .set({ status: "expired" })
      .where(
        and(
          eq(lnurlWithdrawals.userId, userId),
          eq(lnurlWithdrawals.checkpointId, checkpointId),
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

  async getAllUsers(): Promise<Omit<User, "passwordHash">[]> {
    const rows = await db.select({
      id: users.id,
      pubkey: users.pubkey,
      email: users.email,
      displayName: users.displayName,
      rewardClaimed: users.rewardClaimed,
      lightningAddress: users.lightningAddress,
    }).from(users);
    return rows as Omit<User, "passwordHash">[];
  }

  async getUserCount(): Promise<number> {
    const [result] = await db.select({ total: count(users.id) }).from(users);
    return Number(result.total);
  }

  async getAllCheckpointCompletions(): Promise<CheckpointCompletion[]> {
    return db.select().from(checkpointCompletions).orderBy(desc(checkpointCompletions.createdAt));
  }

  async createDonation(paymentIndex: string, amountSats: number, donorName: string, message: string | null): Promise<Donation> {
    const [donation] = await db.insert(donations).values({
      paymentIndex,
      amountSats,
      donorName: donorName || "Anon",
      message,
    }).returning();
    return donation;
  }

  async getRecentDonations(limit: number): Promise<Donation[]> {
    return db.select().from(donations).orderBy(desc(donations.createdAt)).limit(limit);
  }

  async markDonationSpam(id: string): Promise<void> {
    await db.update(donations).set({ message: "\u26A1\u26A1\u26A1", donorName: "Anon" }).where(eq(donations.id, id));
  }

  async getUserProgress(userId: string): Promise<Record<string, string>> {
    const rows = await db.select().from(userProgress).where(eq(userProgress.userId, userId));
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async setUserProgress(userId: string, key: string, value: string): Promise<void> {
    await db.insert(userProgress)
      .values({ userId, key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.key],
        set: { value, updatedAt: new Date() },
      });
  }

  async deleteAllUserProgress(userId: string): Promise<void> {
    await db.delete(userProgress).where(eq(userProgress.userId, userId));
  }

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [row] = await db.insert(feedback).values(data).returning();
    return row;
  }

  async setFeedbackGithubUrl(id: string, url: string): Promise<void> {
    await db.update(feedback).set({ githubIssueUrl: url }).where(eq(feedback.id, id));
  }

  async getRecentFeedback(limit: number) {
    return db.select({
      id: feedback.id,
      userId: feedback.userId,
      category: feedback.category,
      message: feedback.message,
      pageUrl: feedback.pageUrl,
      chapterTitle: feedback.chapterTitle,
      exerciseId: feedback.exerciseId,
      githubIssueUrl: feedback.githubIssueUrl,
      createdAt: feedback.createdAt,
    }).from(feedback).orderBy(desc(feedback.createdAt)).limit(limit);
  }
}

export const storage = new DatabaseStorage();
