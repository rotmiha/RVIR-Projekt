console.log("[SCHEMA LOADED FROM]", import.meta.url);

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  program: text("program"),
  year: text("year"),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // ✅ če je NULL => shared schedule event
  // ✅ če je nastavljen => user-specific (personal/manual)
  ownerUserId: varchar("owner_user_id"),
  // za shared schedule
  program: text("program"),
  year: text("year"),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'study' | 'personal'
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  description: text("description"),
  source: text("source").default("manual"), // 'manual' | 'imported'
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertEventSchema = createInsertSchema(events)
  .omit({ id: true })
  .extend({
    type: z.enum(["study", "personal"]),
    source: z.enum(["manual", "imported"]).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });


export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
