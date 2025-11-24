// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  users;
  events;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.events = /* @__PURE__ */ new Map();
    const defaultUser = {
      id: "default-user-id",
      username: "admin",
      email: "admin@scheduleapp.com",
      password: "hashed_password"
    };
    this.users.set(defaultUser.id, defaultUser);
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async getEvent(id) {
    return this.events.get(id);
  }
  async getEventsByUserId(userId) {
    return Array.from(this.events.values()).filter(
      (event) => event.userId === userId
    );
  }
  async getEventsByUserIdAndDateRange(userId, startDate, endDate) {
    return Array.from(this.events.values()).filter(
      (event) => event.userId === userId && event.startTime < endDate && event.endTime > startDate
    );
  }
  async createEvent(insertEvent) {
    const id = randomUUID();
    const event = {
      id,
      ...insertEvent,
      location: insertEvent.location ?? null,
      description: insertEvent.description ?? null,
      source: insertEvent.source || "manual"
    };
    this.events.set(id, event);
    return event;
  }
  async updateEvent(id, updates) {
    const event = this.events.get(id);
    if (!event) return void 0;
    const updatedEvent = { ...event, ...updates };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }
  async deleteEvent(id) {
    return this.events.delete(id);
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull()
});
var events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  // 'study' or 'personal'
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  description: text("description"),
  source: text("source").default("manual")
  // 'manual' or 'imported'
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true
});
var insertEventSchema = createInsertSchema(events).omit({
  id: true
}).extend({
  type: z.enum(["study", "personal"]),
  source: z.enum(["manual", "imported"]).optional()
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
var upload = multer({ storage: multer.memoryStorage() });
async function registerRoutes(app2) {
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/api/events", async (_req, res) => {
    try {
      const events2 = await storage.getEventsByUserId("default-user-id");
      res.json(events2);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });
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
  app2.post("/api/events", async (req, res) => {
    try {
      const startTime = new Date(req.body.startTime);
      const endTime = new Date(req.body.endTime);
      if (isNaN(startTime.getTime())) {
        return res.status(400).json({ error: "Invalid startTime format" });
      }
      if (isNaN(endTime.getTime())) {
        return res.status(400).json({ error: "Invalid endTime format" });
      }
      if (startTime >= endTime) {
        return res.status(400).json({ error: "Event end time must be after start time" });
      }
      const validatedData = insertEventSchema.parse({
        ...req.body,
        userId: "default-user-id",
        startTime,
        endTime
      });
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create event" });
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
  app2.post("/api/import/events", async (req, res) => {
    try {
      const { events: events2 } = req.body;
      if (!Array.isArray(events2)) {
        return res.status(400).json({ error: "Events must be an array" });
      }
      const importedEvents = [];
      for (const eventData of events2) {
        const validatedData = insertEventSchema.parse({
          userId: "default-user-id",
          title: eventData.title,
          type: eventData.type || "study",
          // Default to study for imported events
          startTime: new Date(eventData.startTime),
          endTime: new Date(eventData.endTime),
          location: eventData.location,
          description: eventData.description,
          source: "imported"
        });
        const event = await storage.createEvent(validatedData);
        importedEvents.push(event);
      }
      res.status(201).json({
        success: true,
        imported: importedEvents.length,
        events: importedEvents
      });
    } catch (error) {
      console.error("Error importing events:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to import events" });
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
import fs from "fs";
import path2 from "path";
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
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
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
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
