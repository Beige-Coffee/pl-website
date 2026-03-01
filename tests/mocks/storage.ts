import type {
  User,
  InsertUser,
  Session,
  LnAuthChallenge,
  LnurlWithdrawal,
  InsertPageEvent,
  PageEvent,
  CheckpointCompletion,
  Donation,
  InsertFeedback,
  Feedback,
} from "@shared/schema";
import type { IStorage } from "../../server/storage";
import { randomBytes, randomUUID } from "crypto";

/**
 * In-memory implementation of IStorage for testing.
 * Also includes extra methods used by routes.ts beyond the IStorage interface.
 */
export class MockStorage implements IStorage {
  users = new Map<string, User>();
  sessions = new Map<string, Session>();
  challenges = new Map<string, LnAuthChallenge>();
  withdrawals = new Map<string, LnurlWithdrawal>();
  checkpoints = new Map<string, CheckpointCompletion>();
  donations = new Map<string, Donation>();
  pageEvents = new Map<number, PageEvent>();
  progress = new Map<string, Map<string, string>>();
  feedbackRecords = new Map<string, Feedback>();

  private nextPageEventId = 1;

  reset() {
    this.users.clear();
    this.sessions.clear();
    this.challenges.clear();
    this.withdrawals.clear();
    this.checkpoints.clear();
    this.donations.clear();
    this.pageEvents.clear();
    this.progress.clear();
    this.feedbackRecords.clear();
    this.nextPageEventId = 1;
  }

  // ── Users ──

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByPubkey(pubkey: string): Promise<User | undefined> {
    for (const u of this.users.values()) {
      if (u.pubkey === pubkey) return u;
    }
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser: User = {
      id,
      pubkey: user.pubkey ?? null,
      email: user.email ?? null,
      passwordHash: null,
      displayName: user.displayName ?? null,
      rewardClaimed: false,
      lightningAddress: null,
      emailVerified: false,
      verificationToken: null,
      verificationExpiry: null,
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async createUserWithPassword(email: string, passwordHash: string, displayName: string): Promise<User> {
    const id = randomUUID();
    const newUser: User = {
      id,
      pubkey: null,
      email,
      passwordHash,
      displayName,
      rewardClaimed: false,
      lightningAddress: null,
      emailVerified: false,
      verificationToken: null,
      verificationExpiry: null,
    };
    this.users.set(id, newUser);
    return newUser;
  }

  // ── Sessions ──

  async createSession(userId: string): Promise<Session> {
    const token = randomBytes(32).toString("hex");
    const session: Session = {
      token,
      userId,
      createdAt: new Date(),
    };
    this.sessions.set(token, session);
    return session;
  }

  async getSession(token: string): Promise<Session | undefined> {
    return this.sessions.get(token);
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async getUserBySessionToken(token: string): Promise<User | undefined> {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    return this.users.get(session.userId);
  }

  // ── User state ──

  async setRewardClaimed(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, rewardClaimed: true });
    }
  }

  async updateUserLightningAddress(userId: string, lightningAddress: string | null): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, lightningAddress });
    }
  }

  async setVerificationToken(userId: string, token: string, expiry: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, verificationToken: token, verificationExpiry: expiry });
    }
  }

  async verifyEmail(token: string): Promise<User | undefined> {
    for (const [id, user] of this.users) {
      if (user.verificationToken === token) {
        if (user.verificationExpiry && user.verificationExpiry < new Date()) return undefined;
        const updated: User = {
          ...user,
          emailVerified: true,
          verificationToken: null,
          verificationExpiry: null,
        };
        this.users.set(id, updated);
        return updated;
      }
    }
    return undefined;
  }

  // ── Lightning Auth Challenges ──

  async createChallenge(k1: string): Promise<LnAuthChallenge> {
    const challenge: LnAuthChallenge = {
      k1,
      createdAt: new Date(),
      used: false,
      pubkey: null,
      sessionToken: null,
    };
    this.challenges.set(k1, challenge);
    return challenge;
  }

  async getChallenge(k1: string): Promise<LnAuthChallenge | undefined> {
    return this.challenges.get(k1);
  }

  async completeChallenge(k1: string, pubkey: string, sessionToken: string): Promise<void> {
    const challenge = this.challenges.get(k1);
    if (challenge) {
      this.challenges.set(k1, { ...challenge, used: true, pubkey, sessionToken });
    }
  }

  // ── LNURL Withdrawals ──

  async createWithdrawal(k1: string, userId: string, amountMsats: string, checkpointId?: string): Promise<LnurlWithdrawal> {
    const id = randomUUID();
    const withdrawal: LnurlWithdrawal = {
      id,
      k1,
      userId,
      amountMsats,
      status: "pending",
      bolt11Invoice: null,
      paymentIndex: null,
      errorReason: null,
      checkpointId: checkpointId ?? null,
      createdAt: new Date(),
      claimedAt: null,
      paidAt: null,
    };
    this.withdrawals.set(k1, withdrawal);
    return withdrawal;
  }

  async getWithdrawalByK1(k1: string): Promise<LnurlWithdrawal | undefined> {
    return this.withdrawals.get(k1);
  }

  async markWithdrawalClaimed(k1: string, bolt11Invoice: string): Promise<void> {
    const w = this.withdrawals.get(k1);
    if (w) {
      this.withdrawals.set(k1, { ...w, status: "claimed", bolt11Invoice, claimedAt: new Date() });
    }
  }

  async markWithdrawalPaid(k1: string, paymentIndex: string): Promise<void> {
    const w = this.withdrawals.get(k1);
    if (w) {
      this.withdrawals.set(k1, { ...w, status: "paid", paymentIndex, paidAt: new Date() });
    }
  }

  async markWithdrawalFailed(k1: string, reason: string): Promise<void> {
    const w = this.withdrawals.get(k1);
    if (w) {
      this.withdrawals.set(k1, { ...w, status: "failed", errorReason: reason });
    }
  }

  async markWithdrawalExpired(k1: string): Promise<void> {
    const w = this.withdrawals.get(k1);
    if (w) {
      this.withdrawals.set(k1, { ...w, status: "expired" });
    }
  }

  async getWithdrawalsByUserId(userId: string): Promise<LnurlWithdrawal[]> {
    const results: LnurlWithdrawal[] = [];
    for (const w of this.withdrawals.values()) {
      if (w.userId === userId) results.push(w);
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRecentWithdrawals(limit: number): Promise<LnurlWithdrawal[]> {
    return [...this.withdrawals.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async cancelPendingWithdrawals(userId: string): Promise<void> {
    for (const [k1, w] of this.withdrawals) {
      if (w.userId === userId && (w.status === "pending" || w.status === "claimed")) {
        this.withdrawals.set(k1, { ...w, status: "expired" });
      }
    }
  }

  // ── Checkpoint completions ──

  async hasCompletedCheckpoint(userId: string, checkpointId: string): Promise<boolean> {
    const key = `${userId}:${checkpointId}`;
    return this.checkpoints.has(key);
  }

  async markCheckpointCompleted(userId: string, checkpointId: string): Promise<void> {
    const key = `${userId}:${checkpointId}`;
    if (!this.checkpoints.has(key)) {
      this.checkpoints.set(key, {
        id: randomUUID(),
        userId,
        checkpointId,
        createdAt: new Date(),
      });
    }
  }

  async getCompletedCheckpoints(userId: string): Promise<{ checkpointId: string; amountSats: number; paidAt: string }[]> {
    const results: { checkpointId: string; amountSats: number; paidAt: string }[] = [];
    for (const cp of this.checkpoints.values()) {
      if (cp.userId === userId) {
        // Check for paid withdrawal
        let amountSats = 0;
        let paidAt = cp.createdAt.toISOString();
        for (const w of this.withdrawals.values()) {
          if (w.userId === userId && w.checkpointId === cp.checkpointId && w.status === "paid") {
            amountSats = Math.round(parseInt(w.amountMsats, 10) / 1000);
            paidAt = w.paidAt?.toISOString() ?? paidAt;
            break;
          }
        }
        results.push({ checkpointId: cp.checkpointId, amountSats, paidAt });
      }
    }
    return results;
  }

  async getPaidWithdrawalForCheckpoint(userId: string, checkpointId: string): Promise<LnurlWithdrawal | undefined> {
    for (const w of this.withdrawals.values()) {
      if (w.userId === userId && w.checkpointId === checkpointId && w.status === "paid") {
        return w;
      }
    }
    return undefined;
  }

  async cancelPendingWithdrawalsForCheckpoint(userId: string, checkpointId: string): Promise<void> {
    for (const [k1, w] of this.withdrawals) {
      if (w.userId === userId && w.checkpointId === checkpointId && (w.status === "pending" || w.status === "claimed")) {
        this.withdrawals.set(k1, { ...w, status: "expired" });
      }
    }
  }

  // ── Page events ──

  async createPageEvent(event: InsertPageEvent): Promise<PageEvent> {
    const id = this.nextPageEventId++;
    const pageEvent: PageEvent = {
      id,
      userId: event.userId ?? null,
      sessionId: event.sessionId ?? null,
      page: event.page,
      referrer: event.referrer ?? null,
      duration: event.duration ?? null,
      createdAt: new Date(),
    };
    this.pageEvents.set(id, pageEvent);
    return pageEvent;
  }

  async getPageEventById(id: number): Promise<PageEvent | undefined> {
    return this.pageEvents.get(id);
  }

  async updatePageEventDuration(id: number, duration: number): Promise<void> {
    const event = this.pageEvents.get(id);
    if (event) {
      this.pageEvents.set(id, { ...event, duration });
    }
  }

  async getPageViewStats(): Promise<{ page: string; views: number; avgDuration: number }[]> {
    const stats = new Map<string, { views: number; totalDuration: number; durationCount: number }>();
    for (const e of this.pageEvents.values()) {
      const s = stats.get(e.page) || { views: 0, totalDuration: 0, durationCount: 0 };
      s.views++;
      if (e.duration != null) {
        s.totalDuration += e.duration;
        s.durationCount++;
      }
      stats.set(e.page, s);
    }
    return [...stats.entries()]
      .map(([page, s]) => ({
        page,
        views: s.views,
        avgDuration: s.durationCount > 0 ? Math.round(s.totalDuration / s.durationCount) : 0,
      }))
      .sort((a, b) => b.views - a.views);
  }

  async getRecentPageEvents(limit: number): Promise<PageEvent[]> {
    return [...this.pageEvents.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getTotalPageViews(): Promise<number> {
    return this.pageEvents.size;
  }

  // ── Donations ──

  async createDonation(paymentIndex: string, amountSats: number, donorName: string, message: string | null): Promise<Donation> {
    // Check for duplicate payment_index
    for (const d of this.donations.values()) {
      if (d.paymentIndex === paymentIndex) {
        const err: any = new Error("Duplicate payment_index");
        err.code = "23505";
        throw err;
      }
    }
    const id = randomUUID();
    const donation: Donation = {
      id,
      paymentIndex,
      amountSats,
      donorName: donorName || "Anon",
      message,
      createdAt: new Date(),
    };
    this.donations.set(id, donation);
    return donation;
  }

  async getRecentDonations(limit: number): Promise<Donation[]> {
    return [...this.donations.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async markDonationSpam(id: string): Promise<void> {
    const d = this.donations.get(id);
    if (d) {
      this.donations.set(id, { ...d, message: "\u26A1\u26A1\u26A1", donorName: "Anon" });
    }
  }

  // ── User progress ──

  async getUserProgress(userId: string): Promise<Record<string, string>> {
    const userMap = this.progress.get(userId);
    if (!userMap) return {};
    return Object.fromEntries(userMap);
  }

  async setUserProgress(userId: string, key: string, value: string): Promise<void> {
    let userMap = this.progress.get(userId);
    if (!userMap) {
      userMap = new Map();
      this.progress.set(userId, userMap);
    }
    userMap.set(key, value);
  }

  // ── Feedback ──

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const id = randomUUID();
    const record: Feedback = {
      id,
      userId: data.userId ?? null,
      category: data.category,
      message: data.message,
      pageUrl: data.pageUrl,
      chapterTitle: data.chapterTitle ?? null,
      exerciseId: data.exerciseId ?? null,
      userAgent: data.userAgent ?? null,
      githubIssueUrl: null,
      createdAt: new Date(),
    };
    this.feedbackRecords.set(id, record);
    return record;
  }

  async setFeedbackGithubUrl(id: string, url: string): Promise<void> {
    const record = this.feedbackRecords.get(id);
    if (record) {
      this.feedbackRecords.set(id, { ...record, githubIssueUrl: url });
    }
  }

  // ── Extra methods used by routes.ts (not in IStorage interface) ──

  async getAllUsers(): Promise<Omit<User, "passwordHash">[]> {
    return [...this.users.values()].map(({ passwordHash: _, ...rest }) => rest);
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async getAllCheckpointCompletions(): Promise<CheckpointCompletion[]> {
    return [...this.checkpoints.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRecentFeedback(limit: number) {
    return [...this.feedbackRecords.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(({ userAgent: _, ...rest }) => rest);
  }
}
