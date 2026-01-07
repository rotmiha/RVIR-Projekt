import { z } from "zod";
import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { insertEventSchema } from "@shared/schema";
import multer from "multer";
import { emailService } from "./services/email";
import bcrypt from "bcryptjs";

import { events as eventsTable } from "../shared/schema";
import { events } from "../shared/schema";
import { db } from "./db";
import { and, or, eq, isNull, sql, asc  } from "drizzle-orm";
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


// GET /api/events/personal-or-manual?userId=...
app.get("/api/events/personal-or-manual", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "");
    if (!userId) return res.status(400).json({ message: "Missing userId" });

    // samo eventi od userja
    // + filter: type=personal OR source=manual (source null tretiramo kot manual)
    const rows = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.ownerUserId, userId),
          or(
            eq(eventsTable.type, "personal"),
            eq(eventsTable.source, "manual"),
            isNull(eventsTable.source)
          )
        )
      )
      .orderBy(asc(eventsTable.startTime));

    return res.json({ events: rows });
  } catch (e: any) {
    console.error("GET /api/events/personal-or-manual error:", e);
    return res.status(500).json({ message: e?.message ?? String(e) });
  }
});





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



// Get conflicts for a user (personal-personal AND personal-study; skip study-study)
app.get("/api/conflicts", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "");
    const program = String(req.query.program ?? "");
    const year = String(req.query.year ?? "");

    if (!userId) {
      return res.status(400).json({ message: "Manjka userId" });
    }

    // ✅ zberi evente:
    // - vsi userjevi eventi (ownerUserId = userId)  => osebni
    // - + (opcijsko) shared schedule eventi (ownerUserId IS NULL) za program/year => študijski/import
    const rows = await db
      .select()
      .from(events)
      .where(
        program && year
          ? or(
              eq(events.ownerUserId, userId),
              and(
                isNull(events.ownerUserId),
                eq(events.program, program),
                eq(events.year, year)
              )
            )
          : eq(events.ownerUserId, userId)
      )
      .orderBy(asc(events.startTime));

    const conflicts: any[] = [];
    const active: any[] = [];

    for (const cur of rows) {
      // odstrani vse, ki so se že končali
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].endTime <= cur.startTime) active.splice(i, 1);
      }

      for (const prev of active) {
        // overlap check
        if (!(prev.startTime < cur.endTime && prev.endTime > cur.startTime)) continue;

        const a = prev;
        const b = cur;

        const aStudy = a.type === "study";
        const bStudy = b.type === "study";

        // ❌ ignoriraj študijsko ↔ študijsko
        if (aStudy && bStudy) continue;

        // določimo tip konflikta
        const pairType: "personal-study" | "personal-personal" =
          aStudy !== bStudy ? "personal-study" : "personal-personal";

        let manualEvent: any;
        let importedEvent: any;

        let priorityId: string | null = null;
        let action: "import" | "manual" = "manual";
        let resolution = "Ročna razrešitev je potrebna.";

        if (pairType === "personal-study") {
          // osebni = manualEvent, študijski = importedEvent (ne glede na vrstni red)
          manualEvent = aStudy ? b : a;
          importedEvent = aStudy ? a : b;

          priorityId = importedEvent.id;
          action = "import";
          resolution = "Prekrivanje osebnega in študijskega dogodka. Študiijski dogodek ima prednost.";
        } else {
          // personal-personal
          manualEvent = a;
          importedEvent = b; // (UI trenutno pričakuje 2 eventa)
          priorityId = null;
          action = "manual";
          resolution = "Prekrivanje dveh osebnih dogodkov. Ročna razrešitev je potrebna.";
        }

        conflicts.push({
          id: `${a.id}-${b.id}`,
          pairType,   // "personal-study" | "personal-personal"
          action,     // "import" | "manual"
          manualEvent,
          importedEvent,
          priority: priorityId,
          resolution,
        });
      }

      active.push(cur);
    }

    return res.json({ conflicts });
  } catch (error) {
    console.error("Napaka pri zaznavi konfliktov:", error);
    return res.status(500).json({ error: "Zaznava konfliktov ni uspela" });
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
    console.log("REGISTER HIT", req.headers.origin, req.body);
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


  const httpServer = createServer(app);
  return httpServer;
}
