var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { z as z2 } from "zod";
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  events: () => events,
  insertEventSchema: () => insertEventSchema,
  insertUserSchema: () => insertUserSchema,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
console.log("[SCHEMA LOADED FROM]", import.meta.url);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  program: text("program"),
  year: text("year")
});
var events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // ✅ če je NULL => shared schedule event
  // ✅ če je nastavljen => user-specific (personal/manual)
  ownerUserId: varchar("owner_user_id"),
  // za shared schedule
  program: text("program"),
  year: text("year"),
  title: text("title").notNull(),
  type: text("type").notNull(),
  // 'study' | 'personal'
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  description: text("description"),
  source: text("source").default("manual")
  // 'manual' | 'imported'
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true
});
var insertEventSchema = createInsertSchema(events).omit({ id: true }).extend({
  type: z.enum(["study", "personal"]),
  source: z.enum(["manual", "imported"]).optional(),
  // ✅ KLJUČNO: sprejmi JSON (string/number) in pretvori v Date
  startTime: z.coerce.date(),
  endTime: z.coerce.date()
}).refine((d) => d.endTime > d.startTime, {
  message: "endTime must be after startTime",
  path: ["endTime"]
});

// server/routes.ts
import multer from "multer";

// server/services/email.ts
var EmailService = class {
  apiKey;
  senderEmail;
  senderName;
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || "";
    this.senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@scheduleapp.com";
    this.senderName = process.env.BREVO_SENDER_NAME || "Schedule Manager";
  }
  async sendEmail({ to, subject, htmlContent }) {
    if (!this.apiKey) {
      console.warn("Brevo API key not configured. Email not sent.");
      return false;
    }
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": this.apiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: {
            name: this.senderName,
            email: this.senderEmail
          },
          to: [{ email: to }],
          subject,
          htmlContent
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Brevo API error:", errorText);
        return false;
      }
      console.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }
  async sendConflictNotification({ to, event1, event2 }) {
    const formatTime = (date) => {
      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    };
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
            .event { background-color: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.9em; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>\u26A0\uFE0F Schedule Conflict Detected</h1>
            </div>
            <div class="content">
              <p>We've detected a scheduling conflict between the following events:</p>
              
              <div class="event">
                <h3>${event1.title}</h3>
                <p><strong>Time:</strong> ${formatTime(event1.startTime)} - ${formatTime(event1.endTime)}</p>
                ${event1.location ? `<p><strong>Location:</strong> ${event1.location}</p>` : ""}
              </div>

              <div class="event">
                <h3>${event2.title}</h3>
                <p><strong>Time:</strong> ${formatTime(event2.startTime)} - ${formatTime(event2.endTime)}</p>
                ${event2.location ? `<p><strong>Location:</strong> ${event2.location}</p>` : ""}
              </div>

              <p><strong>Note:</strong> If one of these is a study event, it will automatically take priority over personal activities.</p>
              <p>Please review your schedule and resolve this conflict.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from Schedule Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to,
      subject: "\u26A0\uFE0F Schedule Conflict Detected",
      htmlContent
    });
  }
  async sendUpcomingEventNotification({
    to,
    eventTitle,
    startTime,
    endTime,
    location,
    minutesBefore
  }) {
    const formatTime = (date) => {
      return date.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
    };
    const formatDate = (date) => {
      return date.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
      });
    };
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
            .event-details { background-color: white; padding: 20px; margin: 15px 0; border-radius: 8px; }
            .time { font-size: 1.5em; font-weight: bold; color: #3b82f6; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.9em; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>\u{1F4C5} Upcoming Event Reminder</h1>
            </div>
            <div class="content">
              <p>Your event starts in <strong>${minutesBefore} minutes</strong>!</p>
              
              <div class="event-details">
                <h2>${eventTitle}</h2>
                <p class="time">${formatTime(startTime)} - ${formatTime(endTime)}</p>
                <p>${formatDate(startTime)}</p>
                ${location ? `<p><strong>\u{1F4CD} Location:</strong> ${location}</p>` : ""}
              </div>

              <p>Make sure you're prepared and on your way!</p>
            </div>
            <div class="footer">
              <p>This is an automated reminder from Schedule Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to,
      subject: `\u{1F4C5} Reminder: ${eventTitle} starts in ${minutesBefore} minutes`,
      htmlContent
    });
  }
  async sendDailyDigest(to, events2) {
    if (events2.length === 0) {
      return true;
    }
    const formatTime = (date) => {
      return date.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
    };
    const eventsList = events2.map((event) => {
      const typeColor = event.type === "study" ? "#3b82f6" : "#8b5cf6";
      return `
          <div style="background-color: white; border-left: 4px solid ${typeColor}; padding: 15px; margin: 10px 0;">
            <h3 style="margin: 0 0 10px 0;">${event.title}</h3>
            <p style="margin: 5px 0;"><strong>\u23F0 Time:</strong> ${formatTime(event.startTime)} - ${formatTime(event.endTime)}</p>
            ${event.location ? `<p style="margin: 5px 0;"><strong>\u{1F4CD} Location:</strong> ${event.location}</p>` : ""}
            <p style="margin: 5px 0;"><strong>Type:</strong> ${event.type === "study" ? "\u{1F4DA} Study" : "\u2B50 Personal"}</p>
          </div>
        `;
    }).join("");
    const today = (/* @__PURE__ */ new Date()).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.9em; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>\u{1F4C5} Your Daily Schedule</h1>
              <p style="margin: 10px 0 0 0;">${today}</p>
            </div>
            <div class="content">
              <p>Good morning! Here's your schedule for today:</p>
              <p><strong>${events2.length} ${events2.length === 1 ? "event" : "events"} scheduled</strong></p>
              ${eventsList}
            </div>
            <div class="footer">
              <p>Have a productive day!</p>
              <p>This is an automated digest from Schedule Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to,
      subject: `\u{1F4C5} Your Schedule for ${today}`,
      htmlContent
    });
  }
  async sendTestEmail(to) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>\u2705 Email Configuration Test</h1>
            </div>
            <div class="content">
              <h2>Success!</h2>
              <p>Your email notifications are properly configured.</p>
              <p>You will now receive notifications for:</p>
              <ul style="text-align: left; display: inline-block;">
                <li>Scheduling conflicts</li>
                <li>Upcoming events</li>
                <li>Daily schedule digests</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to,
      subject: "\u2705 Schedule Manager - Test Email",
      htmlContent
    });
  }
};
var emailService = new EmailService();

// server/routes.ts
import bcrypt from "bcryptjs";

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
var ssss = "postgresql://neondb_owner:npg_LQx9fhs3cwtn@ep-calm-pond-agmcrmms-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
if (!ssss) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: ssss });
var db = drizzle({ client: pool, schema: schema_exports });
console.log("SCHEMA KEYS:", Object.keys(schema_exports));
console.log("EVENTS TABLE:", events);

// server/routes.ts
import { and as and2, or, eq as eq2, sql as sql2 } from "drizzle-orm";

// server/storage.ts
import "dotenv/config";
import { lt, gt } from "drizzle-orm";
import { and, eq, isNull } from "drizzle-orm";
var DbStorage = class {
  // Users
  async getUser(id) {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }
  async getUserByUsername(username) {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }
  async getUserByEmail(email) {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return u;
  }
  async createUser(user) {
    const [u] = await db.insert(users).values(user).returning();
    return u;
  }
  // Events
  async getEvent(id) {
    const [e] = await db.select().from(events).where(eq(events.id, id));
    return e;
  }
  async getEventsByUserId(userId) {
    return db.select().from(events).where(eq(events.ownerUserId, userId));
  }
  async getEventsByUserIdAndDateRange(userId, startDate, endDate) {
    return db.select().from(events).where(
      and(
        eq(events.ownerUserId, userId),
        lt(events.startTime, endDate),
        gt(events.endTime, startDate)
      )
    );
  }
  async createEvent(event) {
    const [e] = await db.insert(events).values(event).returning();
    return e;
  }
  async updateEvent(id, updates) {
    const [e] = await db.update(events).set(updates).where(eq(events.id, id)).returning();
    return e;
  }
  async deleteEvent(id) {
    await db.delete(events).where(eq(events.id, id));
    return true;
  }
};
var storage = new DbStorage();

// server/routes.ts
var upload = multer({ storage: multer.memoryStorage() });
async function registerRoutes(app2) {
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const getEventsForUser = async (req, res) => {
    try {
      const userId = String(req.query.userId ?? "");
      if (!userId) return res.status(400).json({ message: "Missing userId" });
      const events2 = await storage.getEventsByUserId(userId);
      return res.json({ events: events2 });
    } catch (e) {
      console.error("GET /api/events error:", e);
      return res.status(500).json({ message: e?.message ?? String(e) });
    }
  };
  app2.get("/api/events", getEventsForUser);
  app2.get("/api/events/range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      const events2 = await storage.getEventsByUserIdAndDateRange(
        "default-user-id",
        start,
        end
      );
      res.json(events2);
    } catch (error) {
      console.error("Error fetching events by range:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });
  app2.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });
  async function parseIcsToEvents2(icsText) {
    const ical = await import("node-ical");
    const parsed = ical.parseICS(icsText);
    const events2 = [];
    for (const k in parsed) {
      const ev = parsed[k];
      if (ev?.type === "VEVENT") {
        events2.push({
          title: ev.summary || "Untitled Event",
          startTime: ev.start,
          endTime: ev.end,
          location: ev.location || null,
          description: ev.description || null
        });
      }
    }
    return events2;
  }
  async function deleteWiseImportedEvents(userId) {
    const all = await storage.getEventsByUserId(userId);
    const wiseOnes = all.filter((e) => e.source === "wise");
    await Promise.all(wiseOnes.map((e) => storage.deleteEvent(e.id)));
  }
  app2.post("/api/import/wise", async (req, res) => {
    console.log("\u2705 HIT /api/import/wise", req.body);
    const { programValue, yearValue } = req.body ?? {};
    const userId = "default-user-id";
    if (!programValue || !yearValue) {
      return res.status(400).json({
        message: "Missing programValue / yearValue"
      });
    }
    const { chromium: chromium2 } = await import("playwright");
    const browser = await chromium2.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    try {
      await page.goto("https://wise-tt.com/wtt_um_feri/index.jsp", {
        waitUntil: "domcontentloaded",
        timeout: 6e4
      });
      await page.selectOption('select[id="form:j_idt175_input"]', String(programValue));
      await page.waitForLoadState("networkidle");
      await page.selectOption('select[id="form:j_idt179_input"]', String(yearValue));
      await page.waitForLoadState("networkidle");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator('button:has-text("iCal-vse")').first().click()
      ]);
      const path2 = await download.path();
      if (!path2) throw new Error("No download path");
      const fs = await import("node:fs/promises");
      const icsText = await fs.readFile(path2, "utf8");
      const parsedEvents = await parseIcsToEvents2(icsText);
      await deleteWiseImportedEvents(userId);
      const importedEvents = [];
      for (const ev of parsedEvents) {
        const validatedData = insertEventSchema.parse({
          userId,
          title: ev.title,
          type: "study",
          // ali mapiraj po potrebi
          startTime: new Date(ev.startTime),
          endTime: new Date(ev.endTime),
          location: ev.location,
          description: ev.description,
          source: "wise"
        });
        const created = await storage.createEvent(validatedData);
        importedEvents.push(created);
      }
      res.setHeader("X-WISE-ICAL", "1");
      return res.json({
        success: true,
        imported: importedEvents.length
      });
    } catch (e) {
      console.error("\u274C WISE IMPORT ERROR:", e);
      return res.status(500).json({ message: e?.message ?? String(e) });
    } finally {
      await context.close();
      await browser.close();
    }
  });
  app2.put("/api/events/:id", async (req, res) => {
    try {
      const { userId, source, ...updateData } = req.body;
      const updates = {};
      if (updateData.title !== void 0) updates.title = updateData.title;
      if (updateData.type !== void 0) {
        if (updateData.type !== "study" && updateData.type !== "personal") {
          return res.status(400).json({ error: "Invalid event type" });
        }
        updates.type = updateData.type;
      }
      if (updateData.location !== void 0) updates.location = updateData.location;
      if (updateData.description !== void 0) updates.description = updateData.description;
      if (updateData.startTime) {
        const startTime = new Date(updateData.startTime);
        if (isNaN(startTime.getTime())) {
          return res.status(400).json({ error: "Invalid startTime format" });
        }
        updates.startTime = startTime;
      }
      if (updateData.endTime) {
        const endTime = new Date(updateData.endTime);
        if (isNaN(endTime.getTime())) {
          return res.status(400).json({ error: "Invalid endTime format" });
        }
        updates.endTime = endTime;
      }
      const existingEvent = await storage.getEvent(req.params.id);
      if (!existingEvent) {
        return res.status(404).json({ error: "Event not found" });
      }
      const finalStartTime = updates.startTime || existingEvent.startTime;
      const finalEndTime = updates.endTime || existingEvent.endTime;
      if (finalStartTime >= finalEndTime) {
        return res.status(400).json({ error: "Event end time must be after start time" });
      }
      const event = await storage.updateEvent(req.params.id, updates);
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });
  app2.delete("/api/events/:id", async (req, res) => {
    try {
      const success = await storage.deleteEvent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });
  app2.get("/api/conflicts", async (_req, res) => {
    try {
      const events2 = await storage.getEventsByUserId("default-user-id");
      const conflicts = [];
      for (let i = 0; i < events2.length; i++) {
        for (let j = i + 1; j < events2.length; j++) {
          const event1 = events2[i];
          const event2 = events2[j];
          if (event1.startTime < event2.endTime && event1.endTime > event2.startTime) {
            const priority = event1.type === "study" ? event1 : event2;
            const deprioritized = event1.type === "study" ? event2 : event1;
            conflicts.push({
              id: `${event1.id}-${event2.id}`,
              event1,
              event2,
              priority: priority.id,
              resolution: priority.type === "study" ? "Study event takes priority. Personal event will be skipped." : "Both events have same priority. Manual resolution required."
            });
          }
        }
      }
      res.json(conflicts);
    } catch (error) {
      console.error("Error detecting conflicts:", error);
      res.status(500).json({ error: "Failed to detect conflicts" });
    }
  });
  const uploadLimited = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    // 5MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "text/calendar" || file.originalname.endsWith(".ics")) {
        cb(null, true);
      } else {
        cb(new Error("Only .ics calendar files are allowed"));
      }
    }
  });
  app2.post("/api/import/ics", uploadLimited.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const ical = await import("node-ical");
      const fileContent = req.file.buffer.toString("utf-8");
      const parsed = ical.parseICS(fileContent);
      const events2 = [];
      for (const k in parsed) {
        const event = parsed[k];
        if (event.type === "VEVENT") {
          events2.push({
            title: event.summary || "Untitled Event",
            startTime: event.start,
            endTime: event.end,
            location: event.location || null,
            description: event.description || null
          });
        }
      }
      res.json({
        success: true,
        eventsFound: events2.length,
        events: events2
      });
    } catch (error) {
      console.error("Error parsing ICS file:", error);
      res.status(500).json({ error: "Failed to parse ICS file" });
    }
  });
  app2.post("/api/notifications/test", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      const success = await emailService.sendTestEmail(email);
      if (success) {
        res.json({ success: true, message: "Test email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send test email. Check server logs." });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });
  app2.post("/api/notifications/conflict", async (req, res) => {
    try {
      const { email, event1Id, event2Id } = req.body;
      if (!email || !event1Id || !event2Id) {
        return res.status(400).json({ error: "Email, event1Id, and event2Id are required" });
      }
      const event1 = await storage.getEvent(event1Id);
      const event2 = await storage.getEvent(event2Id);
      if (!event1 || !event2) {
        return res.status(404).json({ error: "One or both events not found" });
      }
      const success = await emailService.sendConflictNotification({
        to: email,
        event1: {
          title: event1.title,
          startTime: event1.startTime,
          endTime: event1.endTime,
          location: event1.location
        },
        event2: {
          title: event2.title,
          startTime: event2.startTime,
          endTime: event2.endTime,
          location: event2.location
        }
      });
      if (success) {
        res.json({ success: true, message: "Conflict notification sent" });
      } else {
        res.status(500).json({ error: "Failed to send notification" });
      }
    } catch (error) {
      console.error("Error sending conflict notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });
  const createEventRequestSchema = z2.object({
    userId: z2.string().min(1),
    title: z2.string().min(1),
    type: z2.enum(["study", "personal"]),
    startTime: z2.coerce.date(),
    // sprejme number/string
    endTime: z2.coerce.date(),
    location: z2.string().optional().nullable(),
    description: z2.string().optional().nullable()
  });
  app2.post("/api/events", async (req, res) => {
    try {
      const body = createEventRequestSchema.parse(req.body);
      const validated = insertEventSchema.parse({
        ownerUserId: body.userId,
        // ✅ map
        program: null,
        year: null,
        title: body.title,
        type: body.type,
        startTime: body.startTime,
        endTime: body.endTime,
        location: body.location ?? null,
        description: body.description ?? null,
        source: "manual"
      });
      const created = await storage.createEvent(validated);
      return res.status(201).json(created);
    } catch (e) {
      console.error("POST /api/events error:", e);
      return res.status(400).json({ message: e?.message ?? String(e) });
    }
  });
  app2.get("/api/calendar-events", async (req, res) => {
    try {
      const userId = String(req.query.userId ?? "");
      const program = String(req.query.program ?? "");
      const year = String(req.query.year ?? "");
      console.log("\u2705 HIT /api/calendar-events", { userId, program, year });
      if (!userId) return res.status(400).json({ message: "Missing userId" });
      if (!program || !year) return res.status(400).json({ message: "Missing program/year" });
      const query = db.select().from(events).where(
        or(
          and2(
            sql2`${events.ownerUserId} IS NULL`,
            eq2(events.program, program),
            eq2(events.year, year)
          ),
          eq2(events.ownerUserId, userId)
        )
      );
      const { sql: text2, params } = query.toSQL();
      const rows = await query;
      return res.json(rows);
    } catch (e) {
      console.error("calendar-events error:", e);
      return res.status(500).json({
        message: e?.message ?? String(e),
        code: e?.code,
        position: e?.position,
        detail: e?.detail,
        hint: e?.hint
      });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { z: z3 } = await import("zod");
      const body = z3.object({
        username: z3.string().min(1),
        email: z3.string().email(),
        password: z3.string().min(1),
        program: z3.string().optional().nullable(),
        year: z3.string().optional().nullable()
      }).parse(req.body);
      const cleanEmail = body.email.trim().toLowerCase();
      const cleanUsername = body.username.trim();
      console.log("ZOD LOADED:", typeof z3);
      const existing = await storage.getUserByEmail(cleanEmail);
      if (existing) return res.status(409).json({ message: "Email je \u017Ee registriran" });
      const hash = await bcrypt.hash(body.password, 10);
      const created = await storage.createUser({
        username: cleanUsername,
        email: cleanEmail,
        password: hash,
        program: body.program ?? null,
        year: body.year ?? null
      });
      return res.status(201).json({
        user: {
          id: created.id,
          username: created.username,
          email: created.email,
          program: created.program ?? null,
          year: created.year ?? null
        }
      });
    } catch (e) {
      return res.status(400).json({ message: e?.message ?? String(e) });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const body = z2.object({
        email: z2.string().email(),
        password: z2.string().min(1)
      }).parse(req.body);
      const cleanEmail = body.email.trim().toLowerCase();
      const user = await storage.getUserByEmail(cleanEmail);
      if (!user) return res.status(401).json({ message: "Napa\u010Den email ali geslo" });
      const ok = await bcrypt.compare(body.password, user.password);
      if (!ok) return res.status(401).json({ message: "Napa\u010Den email ali geslo" });
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          program: user.program ?? null,
          year: user.year ?? null
        }
      });
    } catch (e) {
      return res.status(400).json({ message: e?.message ?? String(e) });
    }
  });
  app2.post("/api/notifications/digest", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const events2 = await storage.getEventsByUserIdAndDateRange(
        "default-user-id",
        today,
        tomorrow
      );
      const success = await emailService.sendDailyDigest(email, events2);
      if (success) {
        res.json({ success: true, message: "Daily digest sent", eventCount: events2.length });
      } else {
        res.status(500).json({ error: "Failed to send digest" });
      }
    } catch (error) {
      console.error("Error sending daily digest:", error);
      res.status(500).json({ error: "Failed to send digest" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// server/index.ts
import { chromium } from "playwright";
import { and as and3, eq as eq3, isNull as isNull3 } from "drizzle-orm";
var app = express2();
app.use(
  express2.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express2.urlencoded({ extended: false }));
app.use((req, _res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});
async function parseIcsToEvents(icsText) {
  const mod = await import("node-ical");
  const ical = mod?.default ?? mod;
  const parsed = ical.parseICS(icsText);
  const events2 = [];
  for (const k in parsed) {
    const ev = parsed[k];
    if (ev?.type === "VEVENT") {
      events2.push({
        title: ev.summary || "Untitled Event",
        startTime: ev.start,
        endTime: ev.end,
        location: ev.location || null,
        description: ev.description || null
      });
    }
  }
  return events2;
}
app.get("/api/ping", (_req, res) => {
  console.log("PING HIT /api/ping");
  res.json({ ok: true });
});
var wiseImportLocks = /* @__PURE__ */ new Map();
app.post("/api/import/wise", async (req, res) => {
  console.log("\u2705 HIT /api/import/wise", req.body);
  const { programValue, yearValue } = req.body ?? {};
  if (!programValue || !yearValue) {
    return res.status(400).json({ message: "Missing programValue / yearValue" });
  }
  const program = String(programValue);
  const year = String(yearValue);
  const lockKey = `${program}||${year}`;
  if (wiseImportLocks.get(lockKey)) {
    return res.status(409).json({
      status: "busy",
      message: "WISE import \u017Ee te\u010De za ta program/letnik."
    });
  }
  wiseImportLocks.set(lockKey, true);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const lastReq = [];
  const lastResp = [];
  page.on(
    "console",
    (msg) => console.log("\u{1F7E1} PAGE console:", msg.type(), msg.text())
  );
  page.on("pageerror", (err) => console.log("\u{1F534} PAGE error:", err.message));
  page.on("request", (r) => {
    const entry = { method: r.method(), url: r.url() };
    lastReq.push(entry);
    if (lastReq.length > 50) lastReq.shift();
    console.log("\u27A1\uFE0F REQ:", entry.method, entry.url);
  });
  page.on("response", (r) => {
    const h = r.headers();
    const entry = {
      status: r.status(),
      url: r.url(),
      ct: h["content-type"],
      cd: h["content-disposition"]
    };
    lastResp.push(entry);
    if (lastResp.length > 50) lastResp.shift();
    const ct = (entry.ct ?? "").toLowerCase();
    const cd = (entry.cd ?? "").toLowerCase();
    const url = entry.url.toLowerCase();
    if (ct.includes("calendar") || cd.includes("attachment") || cd.includes(".ics") || url.includes("dynamiccontent") || url.includes("ical")) {
      console.log(
        "\u2B05\uFE0F RESP IMPORTANT:",
        entry.status,
        entry.url,
        "CT=",
        entry.ct,
        "CD=",
        entry.cd
      );
    }
  });
  page.on(
    "requestfailed",
    (r) => console.log("\u274C REQ FAILED:", r.url(), r.failure()?.errorText)
  );
  try {
    console.log("\u{1F30D} goto WISE");
    await page.goto("https://wise-tt.com/wtt_um_feri/index.jsp", {
      waitUntil: "domcontentloaded",
      timeout: 6e4
    });
    console.log("\u2705 page loaded");
    console.log("\u{1F393} selecting program", programValue);
    const programSel = page.locator('select[id="form:j_idt175_input"]');
    await programSel.waitFor({ state: "visible", timeout: 3e4 });
    await programSel.selectOption(String(programValue));
    await programSel.dispatchEvent("change");
    await page.waitForTimeout(700);
    console.log("\u{1F4C5} selecting year", yearValue);
    const yearSel = page.locator('select[id="form:j_idt179_input"]');
    await yearSel.waitFor({ state: "visible", timeout: 3e4 });
    await yearSel.selectOption(String(yearValue));
    await yearSel.dispatchEvent("change");
    await page.waitForTimeout(700);
    const btn = page.locator('button:has-text("iCal-vse")').first();
    console.log("\u{1F518} waiting for iCal button");
    await btn.waitFor({ state: "visible", timeout: 3e4 });
    console.log("\u{1F5B1}\uFE0F clicking iCal-vse");
    const downloadP = page.waitForEvent("download", { timeout: 9e4 }).catch(() => null);
    const attachRespP = page.waitForResponse(
      (r) => {
        const h = r.headers();
        const ct = (h["content-type"] ?? "").toLowerCase();
        const cd = (h["content-disposition"] ?? "").toLowerCase();
        const url = r.url().toLowerCase();
        return ct.includes("calendar") || cd.includes("attachment") || cd.includes(".ics") || url.includes("ical");
      },
      { timeout: 9e4 }
    ).catch(() => null);
    const ajaxHomeP = page.waitForResponse(
      (r) => r.url().includes("/pages/home.jsf") && r.request().method() === "POST",
      { timeout: 3e4 }
    ).catch(() => null);
    await btn.click();
    console.log("\u23F3 waiting for download/attachment/ajax...");
    const download = await downloadP;
    const attachResp = await attachRespP;
    let icsText = null;
    if (download) {
      console.log("\u2705 GOT DOWNLOAD EVENT:", await download.suggestedFilename());
      const path2 = await download.path();
      if (!path2) throw new Error("Download had no path");
      const fs = await import("node:fs/promises");
      icsText = await fs.readFile(path2, "utf8");
    }
    if (!icsText && attachResp) {
      console.log(
        "\u2705 GOT ATTACHMENT RESPONSE:",
        attachResp.status(),
        attachResp.url()
      );
      icsText = await attachResp.text();
    }
    if (!icsText) {
      const ajaxResp = await ajaxHomeP;
      if (ajaxResp) {
        const ajaxText = await ajaxResp.text();
        console.log("\u{1F9E9} AJAX home.jsf preview:", ajaxText.slice(0, 500));
        const m = ajaxText.match(
          /(\/wtt_um_feri\/javax\.faces\.resource\/dynamiccontent\.xhtml[^"'<>\s]+)/i
        ) || ajaxText.match(
          /(\/javax\.faces\.resource\/dynamiccontent\.xhtml[^"'<>\s]+)/i
        );
        if (m?.[1]) {
          const dynUrl = new URL(m[1], "https://wise-tt.com").toString();
          console.log("\u{1F3AF} FOUND dynamiccontent:", dynUrl);
          const r = await context.request.get(dynUrl);
          const t = await r.text();
          console.log("\u{1F4C4} dynamiccontent CT:", r.headers()["content-type"]);
          console.log("\u{1F4C4} dynamiccontent preview:", t.slice(0, 200));
          icsText = t;
        } else {
          console.log("\u2757 No dynamiccontent link found in AJAX response.");
        }
      } else {
        console.log("\u2757 No AJAX /pages/home.jsf response captured (timeout).");
      }
    }
    if (!icsText) {
      console.log("\u{1F9EF} LAST 20 REQ:", lastReq.slice(-20));
      console.log("\u{1F9EF} LAST 20 RESP:", lastResp.slice(-20));
      throw new Error(
        "No ICS detected (no download event, no attachment response, no dynamiccontent)."
      );
    }
    console.log("\u{1F4C4} ICS length:", icsText.length);
    console.log("\u{1F4C4} ICS preview:", icsText.slice(0, 250));
    if (!icsText.includes("BEGIN:VCALENDAR")) {
      console.log("\u{1F4C4} NOT ICS START:", icsText.slice(0, 300));
      throw new Error("Received content but it's not ICS (missing BEGIN:VCALENDAR)");
    }
    const parsedEvents = await parseIcsToEvents(icsText);
    console.log("\u{1F4CA} parsed events:", parsedEvents.length);
    const program2 = String(programValue);
    const year2 = String(yearValue);
    const existing = await getWiseScheduleEvents(program2, year2);
    if (sameEventSet(program2, year2, parsedEvents, existing)) {
      res.setHeader("X-WISE-ICAL", "1");
      return res.json({
        status: "unchanged",
        message: "Urnik je \u017Ee posodobljen (ni sprememb).",
        imported: 0,
        events: existing
      });
    }
    await deleteWiseImportedEventsForSchedule(program2, year2);
    await insertImportedEventsForSchedule(program2, year2, parsedEvents);
    const wiseEvents = await getWiseScheduleEvents(program2, year2);
    res.setHeader("X-WISE-ICAL", "1");
    return res.json({
      status: "updated",
      message: "Urnik posodobljen.",
      imported: parsedEvents.length,
      events: wiseEvents
    });
  } catch (e) {
    console.error("\u274C WISE IMPORT ERROR:", e);
    return res.status(500).json({
      message: e?.message ?? String(e)
    });
  } finally {
    await context.close();
    await browser.close();
  }
});
async function deleteWiseImportedEventsForSchedule(program, year) {
  await db.delete(events).where(
    and3(
      isNull3(events.ownerUserId),
      // shared
      eq3(events.program, program),
      eq3(events.year, year),
      eq3(events.source, "imported")
      // ali "wise" – kar uporabljaš
    )
  );
}
async function insertImportedEventsForSchedule(program, year, parsedEvents) {
  if (!parsedEvents.length) return;
  await db.insert(events).values(
    parsedEvents.map((ev) => ({
      ownerUserId: null,
      // ✅ shared
      program,
      year,
      title: ev.title,
      type: ev.type ?? "study",
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: ev.location ?? null,
      description: ev.description ?? null,
      source: "imported"
    }))
  );
}
async function getWiseScheduleEvents(program, year) {
  return db.select().from(events).where(
    and3(
      isNull3(events.ownerUserId),
      eq3(events.program, program),
      eq3(events.year, year)
    )
  );
}
function normStr(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}
function toIso(v) {
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}
function eventKeyLikeDb(program, year, ev) {
  const title = normStr(ev.title);
  const type = normStr(ev.type ?? "study");
  const startTime = toIso(ev.startTime);
  const endTime = toIso(ev.endTime);
  const location = normStr(ev.location ?? "");
  const description = normStr(ev.description ?? "");
  return [
    normStr(program),
    normStr(year),
    title,
    type,
    startTime,
    endTime,
    location,
    description
  ].join("||");
}
function sameEventSet(program, year, incoming, existing) {
  const a = new Set(incoming.map((ev) => eventKeyLikeDb(program, year, ev)));
  const importedOnly = existing.filter((e) => (e.source ?? "") === "imported");
  const b = new Set(
    importedOnly.map(
      (e) => eventKeyLikeDb(program, year, {
        title: e.title,
        type: e.type,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location ?? null,
        description: e.description ?? null
      })
    )
  );
  if (a.size !== b.size) return false;
  return Array.from(a).every((k) => b.has(k));
}
app.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
  app.use((req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "API route not found" });
    }
    return res.status(404).json({ message: "Frontend disabled (API only)" });
  });
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
