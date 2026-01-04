import "dotenv/config"
import {lt, gt } from "drizzle-orm";
import { users, events, type User, type InsertUser, type Event, type InsertEvent } from "@shared/schema";
import { db } from "./db";
import { and, eq, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getEvent(id: string): Promise<Event | undefined>;
  getEventsByUserId(userId: string): Promise<Event[]>;
  getEventsByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string) {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByUsername(username: string) {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }

  async getUserByEmail(email: string) {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return u;
  }

  async createUser(user: InsertUser) {
    const [u] = await db.insert(users).values(user).returning();
    return u;
  }

  // Events
  async getEvent(id: string) {
    const [e] = await db.select().from(events).where(eq(events.id, id));
    return e;
  }

  async getEventsByUserId(userId: string) {
    return db.select().from(events).where(eq(events.ownerUserId, userId));
  }

  async getEventsByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date) {
    return db
      .select()
      .from(events)
      .where(
        and(
          eq(events.ownerUserId, userId),
          lt(events.startTime, endDate),
          gt(events.endTime, startDate)
        )
      );
  }

  async createEvent(event: InsertEvent) {
    const [e] = await db.insert(events).values(event).returning();
    return e;
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>) {
    const [e] = await db.update(events).set(updates).where(eq(events.id, id)).returning();
    return e;
  }

  async deleteEvent(id: string) {
    await db.delete(events).where(eq(events.id, id));
    return true;
  }
}

export const storage: IStorage = new DbStorage();


// pobriši vse stare imported shared evente za program/year
async function deleteWiseImportedEventsForSchedule(program: string, year: string) {
  await db
    .delete(events)
    .where(
      and(
        isNull(events.ownerUserId),          // shared
        eq(events.program, program),
        eq(events.year, year),
        eq(events.source, "imported")        // ali "wise" – kar uporabljaš
      )
    );
}

type ParsedEvent = {
  title: string;
  type: "study" | "personal"; // ali kar parseIcsToEvents vrne
  startTime: Date;
  endTime: Date;
  location?: string | null;
  description?: string | null;
};

// insert novih shared eventov
async function insertImportedEventsForSchedule(program: string, year: string, parsedEvents: ParsedEvent[]) {
  if (!parsedEvents.length) return;

  await db.insert(events).values(
    parsedEvents.map((ev) => ({
      ownerUserId: null,          // ✅ shared
      program,
      year,
      title: ev.title,
      type: ev.type ?? "study",
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: ev.location ?? null,
      description: ev.description ?? null,
      source: "imported",
    }))
  );
}

// vrni schedule evente za program/year
async function getWiseScheduleEvents(program: string, year: string) {
  return db
    .select()
    .from(events)
    .where(
      and(
        isNull(events.ownerUserId),
        eq(events.program, program),
        eq(events.year, year)
      )
    );
}



