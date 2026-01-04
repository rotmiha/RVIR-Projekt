import { z } from "zod";
import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { insertEventSchema } from "@shared/schema";
import multer from "multer";
import { emailService } from "./services/email";
import bcrypt from "bcryptjs";

import { events } from "../shared/schema";
import { db } from "./db";
import { and, or, eq, isNull, sql } from "drizzle-orm";
import { storage } from "./storage";
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });


const getEventsForUser: RequestHandler = async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "");
    if (!userId) return res.status(400).json({ message: "Missing userId" });

    const events = await storage.getEventsByUserId(userId);
    return res.json({ events });
  } catch (e: any) {
    console.error("GET /api/events error:", e);
    return res.status(500).json({ message: e?.message ?? String(e) });
  }
};

app.get("/api/events", getEventsForUser);


  // Get events within a date range
  app.get("/api/events/range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const events = await storage.getEventsByUserIdAndDateRange(
        "default-user-id",
        start,
        end
      );
      res.json(events);
    } catch (error) {
      console.error("Error fetching events by range:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Get a single event by ID
  app.get("/api/events/:id", async (req, res) => {
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



    async function parseIcsToEvents(icsText: string) {
      const ical = await import("node-ical");
      const parsed = ical.parseICS(icsText);

      const events: Array<{
        title: string;
        startTime: Date;
        endTime: Date;
        location: string | null;
        description: string | null;
      }> = [];

      for (const k in parsed) {
        const ev: any = (parsed as any)[k];
        if (ev?.type === "VEVENT") {
          events.push({
            title: ev.summary || "Untitled Event",
            startTime: ev.start,
            endTime: ev.end,
            location: ev.location || null,
            description: ev.description || null,
          });
        }
      }

      return events;
    }


    async function deleteWiseImportedEvents(userId: string) {
      const all = await storage.getEventsByUserId(userId);
      const wiseOnes = all.filter((e: any) => e.source === "wise");
      await Promise.all(wiseOnes.map((e: any) => storage.deleteEvent(e.id)));
    }

    app.post("/api/import/wise", async (req, res) => {
      console.log("✅ HIT /api/import/wise", req.body);

      const { programValue, yearValue } = req.body ?? {};
      const userId = "default-user-id"; // ker tvoj app povsod uporablja default-user-id :contentReference[oaicite:2]{index=2}

      if (!programValue || !yearValue) {
        return res.status(400).json({
          message: "Missing programValue / yearValue",
        });
      }

      // Playwright
      const { chromium } = await import("playwright");

      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();

      try {
        await page.goto("https://wise-tt.com/wtt_um_feri/index.jsp", {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        // program
        await page.selectOption('select[id="form:j_idt175_input"]', String(programValue));
        await page.waitForLoadState("networkidle");

        // letnik
        await page.selectOption('select[id="form:j_idt179_input"]', String(yearValue));
        await page.waitForLoadState("networkidle");

        // download iCal
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.locator('button:has-text("iCal-vse")').first().click(),
        ]);

        const path = await download.path();
        if (!path) throw new Error("No download path");

        const fs = await import("node:fs/promises");
        const icsText = await fs.readFile(path, "utf8");

        // parse ICS -> events
        const parsedEvents = await parseIcsToEvents(icsText);

        // (priporočeno) pobriši stare WISE uvoze
        await deleteWiseImportedEvents(userId);

        // insert v DB (enako kot /api/import/events)
        const importedEvents = [];
        for (const ev of parsedEvents) {
          const validatedData = insertEventSchema.parse({
            userId,
            title: ev.title,
            type: "study", // ali mapiraj po potrebi
            startTime: new Date(ev.startTime),
            endTime: new Date(ev.endTime),
            location: ev.location,
            description: ev.description,
            source: "wise",
          });

          const created = await storage.createEvent(validatedData);
          importedEvents.push(created);
        }

        res.setHeader("X-WISE-ICAL", "1");
        return res.json({
          success: true,
          imported: importedEvents.length,
        });
      } catch (e: any) {
        console.error("❌ WISE IMPORT ERROR:", e);
        return res.status(500).json({ message: e?.message ?? String(e) });
      } finally {
        await context.close();
        await browser.close();
      }
    });

  // Update an event
  app.put("/api/events/:id", async (req, res) => {
    try {
      // Prevent updating immutable fields
      const { userId, source, ...updateData } = req.body;
      
      // Build update object with validated dates
      const updates: any = {};
      
      if (updateData.title !== undefined) updates.title = updateData.title;
      if (updateData.type !== undefined) {
        if (updateData.type !== 'study' && updateData.type !== 'personal') {
          return res.status(400).json({ error: "Invalid event type" });
        }
        updates.type = updateData.type;
      }
      if (updateData.location !== undefined) updates.location = updateData.location;
      if (updateData.description !== undefined) updates.description = updateData.description;
      
      // Validate and convert dates
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

      // Get existing event to check temporal validity
      const existingEvent = await storage.getEvent(req.params.id);
      if (!existingEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Validate that startTime < endTime
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

  // Delete an event
  app.delete("/api/events/:id", async (req, res) => {
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

  // Get conflicts for the default user
  app.get("/api/conflicts", async (_req, res) => {
    try {
      const events = await storage.getEventsByUserId("default-user-id");
      
      // Find overlapping events
      const conflicts: any[] = [];
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const event1 = events[i];
          const event2 = events[j];
          
          // Check if events overlap
          if (event1.startTime < event2.endTime && event1.endTime > event2.startTime) {
            // Determine which event takes priority (study > personal)
            const priority = event1.type === 'study' ? event1 : event2;
            const deprioritized = event1.type === 'study' ? event2 : event1;
            
            conflicts.push({
              id: `${event1.id}-${event2.id}`,
              event1,
              event2,
              priority: priority.id,
              resolution: priority.type === 'study' 
                ? "Study event takes priority. Personal event will be skipped."
                : "Both events have same priority. Manual resolution required.",
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

  // Upload and parse ICS file (limit to 5MB)
  const uploadLimited = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'text/calendar' || file.originalname.endsWith('.ics')) {
        cb(null, true);
      } else {
        cb(new Error('Only .ics calendar files are allowed'));
      }
    }
  });

  app.post("/api/import/ics", uploadLimited.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ical = await import('node-ical');
      const fileContent = req.file.buffer.toString('utf-8');
      const parsed = ical.parseICS(fileContent);

      const events: any[] = [];
      for (const k in parsed) {
        const event = parsed[k];
        if (event.type === 'VEVENT') {
          events.push({
            title: event.summary || 'Untitled Event',
            startTime: event.start,
            endTime: event.end,
            location: event.location || null,
            description: event.description || null,
          });
        }
      }

      res.json({ 
        success: true, 
        eventsFound: events.length,
        events 
      });
    } catch (error) {
      console.error("Error parsing ICS file:", error);
      res.status(500).json({ error: "Failed to parse ICS file" });
    }
  });


  // Send test email
  app.post("/api/notifications/test", async (req, res) => {
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

  // Send conflict notification
  app.post("/api/notifications/conflict", async (req, res) => {
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
          location: event1.location,
        },
        event2: {
          title: event2.title,
          startTime: event2.startTime,
          endTime: event2.endTime,
          location: event2.location,
        },
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


    const createEventRequestSchema = z.object({
      userId: z.string().min(1),
      title: z.string().min(1),
      type: z.enum(["study", "personal"]),
      startTime: z.coerce.date(), // sprejme number/string
      endTime: z.coerce.date(),
      location: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    });

    app.post("/api/events", async (req, res) => {
      try {
        const body = createEventRequestSchema.parse(req.body);

        const validated = insertEventSchema.parse({
          ownerUserId: body.userId,          // ✅ map
          program: null,
          year: null,
          title: body.title,
          type: body.type,
          startTime: body.startTime,
          endTime: body.endTime,
          location: body.location ?? null,
          description: body.description ?? null,
          source: "manual",
        });

        const created = await storage.createEvent(validated);
        return res.status(201).json(created);
      } catch (e: any) {
        console.error("POST /api/events error:", e);
        return res.status(400).json({ message: e?.message ?? String(e) });
      }
    });


app.get("/api/calendar-events", async (req, res) => {
  try {

    const userId = String(req.query.userId ?? "");
    const program = String(req.query.program ?? "");
    const year = String(req.query.year ?? "");
    console.log("✅ HIT /api/calendar-events", { userId, program, year });

    if (!userId) return res.status(400).json({ message: "Missing userId" });
    if (!program || !year) return res.status(400).json({ message: "Missing program/year" });

    const query = db
      .select()
      .from(events)
      .where(
        or(
          and(
            sql<boolean>`${events.ownerUserId} IS NULL`,
            eq(events.program, program),
            eq(events.year, year)
          ),
          eq(events.ownerUserId, userId)
        )
      );

    const { sql: text, params } = query.toSQL();
  

    const rows = await query; // ✅ execute the SAME query you logged

    return res.json(rows);
  } catch (e: any) {
    // ✅ log the *full* error object (Postgres often includes position/code/detail)
    console.error("calendar-events error:", e);
    return res.status(500).json({
      message: e?.message ?? String(e),
      code: e?.code,
      position: e?.position,
      detail: e?.detail,
      hint: e?.hint,
    });
  }
});

  // REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {

    const { z } = await import("zod"); // ✅ tukaj


    const body = z.object({
      username: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(1),
      program: z.string().optional().nullable(),
      year: z.string().optional().nullable(),
    }).parse(req.body);

    const cleanEmail = body.email.trim().toLowerCase();
    const cleanUsername = body.username.trim();
    console.log("ZOD LOADED:", typeof z);

    // (opcijsko) preveri, če email že obstaja
    const existing = await storage.getUserByEmail(cleanEmail);
    if (existing) return res.status(409).json({ message: "Email je že registriran" });

    const hash = await bcrypt.hash(body.password, 10);

    const created = await storage.createUser({
      username: cleanUsername,
      email: cleanEmail,
      password: hash,
      program: body.program ?? null,
      year: body.year ?? null,
    } as any);

    return res.status(201).json({
      user: {
        id: created.id,
        username: created.username,
        email: created.email,
        program: (created as any).program ?? null,
        year: (created as any).year ?? null,
      },
    });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message ?? String(e) });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const cleanEmail = body.email.trim().toLowerCase();
    const user = await storage.getUserByEmail(cleanEmail);
    if (!user) return res.status(401).json({ message: "Napačen email ali geslo" });

    const ok = await bcrypt.compare(body.password, (user as any).password);
    if (!ok) return res.status(401).json({ message: "Napačen email ali geslo" });

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        program: (user as any).program ?? null,
        year: (user as any).year ?? null,
      },
    });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message ?? String(e) });
  }
});



  // Send daily digest
  app.post("/api/notifications/digest", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      // Get today's events
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const events = await storage.getEventsByUserIdAndDateRange(
        "default-user-id",
        today,
        tomorrow
      );

      const success = await emailService.sendDailyDigest(email, events);

      if (success) {
        res.json({ success: true, message: "Daily digest sent", eventCount: events.length });
      } else {
        res.status(500).json({ error: "Failed to send digest" });
      }
    } catch (error) {
      console.error("Error sending daily digest:", error);
      res.status(500).json({ error: "Failed to send digest" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
