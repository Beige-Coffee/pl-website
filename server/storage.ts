import { type User, type InsertUser, type LnAuthChallenge, type Session, users, lnAuthChallenges, sessions } from "@shared/schema";
import { eq } from "drizzle-orm";
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
  createSession(userId: string): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  getUserBySessionToken(token: string): Promise<User | undefined>;
  setRewardClaimed(userId: string): Promise<void>;
  createChallenge(k1: string): Promise<LnAuthChallenge>;
  getChallenge(k1: string): Promise<LnAuthChallenge | undefined>;
  completeChallenge(k1: string, pubkey: string, sessionToken: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();
