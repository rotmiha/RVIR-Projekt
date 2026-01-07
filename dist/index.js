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
  startTime: z.coerce.date(),
  endTime: z.coerce.date()
}).refine((d) => d.endTime > d.startTime, {
  message: "endTime must be after startTime",
  path: ["endTime"]
});

// server/routes.ts
import multer from "multer";
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

// server/routes.ts
import { and as and2, or, eq as eq2, isNull as isNull2, sql as sql2, asc } from "drizzle-orm";

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
  app2.get("/api/events/personal-or-manual", async (req, res) => {
    try {
      const userId = String(req.query.userId ?? "");
      if (!userId) return res.status(400).json({ message: "Missing userId" });
      const rows = await db.select().from(events).where(
        and2(
          eq2(events.ownerUserId, userId),
          or(
            eq2(events.type, "personal"),
            eq2(events.source, "manual"),
            isNull2(events.source)
          )
        )
      ).orderBy(asc(events.startTime));
      return res.json({ events: rows });
    } catch (e) {
      console.error("GET /api/events/personal-or-manual error:", e);
      return res.status(500).json({ message: e?.message ?? String(e) });
    }
  });
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
  app2.get("/api/conflicts", async (req, res) => {
    try {
      const userId = String(req.query.userId ?? "");
      const program = String(req.query.program ?? "");
      const year = String(req.query.year ?? "");
      if (!userId) {
        return res.status(400).json({ message: "Manjka userId" });
      }
      const rows = await db.select().from(events).where(
        program && year ? or(
          eq2(events.ownerUserId, userId),
          and2(
            isNull2(events.ownerUserId),
            eq2(events.program, program),
            eq2(events.year, year)
          )
        ) : eq2(events.ownerUserId, userId)
      ).orderBy(asc(events.startTime));
      const conflicts = [];
      const active = [];
      for (const cur of rows) {
        for (let i = active.length - 1; i >= 0; i--) {
          if (active[i].endTime <= cur.startTime) active.splice(i, 1);
        }
        for (const prev of active) {
          if (!(prev.startTime < cur.endTime && prev.endTime > cur.startTime)) continue;
          const a = prev;
          const b = cur;
          const aStudy = a.type === "study";
          const bStudy = b.type === "study";
          if (aStudy && bStudy) continue;
          const pairType = aStudy !== bStudy ? "personal-study" : "personal-personal";
          let manualEvent;
          let importedEvent;
          let priorityId = null;
          let action = "manual";
          let resolution = "Ro\u010Dna razre\u0161itev je potrebna.";
          if (pairType === "personal-study") {
            manualEvent = aStudy ? b : a;
            importedEvent = aStudy ? a : b;
            priorityId = importedEvent.id;
            action = "import";
            resolution = "Prekrivanje osebnega in \u0161tudijskega dogodka. \u0160tudiijski dogodek ima prednost.";
          } else {
            manualEvent = a;
            importedEvent = b;
            priorityId = null;
            action = "manual";
            resolution = "Prekrivanje dveh osebnih dogodkov. Ro\u010Dna razre\u0161itev je potrebna.";
          }
          conflicts.push({
            id: `${a.id}-${b.id}`,
            pairType,
            // "personal-study" | "personal-personal"
            action,
            // "import" | "manual"
            manualEvent,
            importedEvent,
            priority: priorityId,
            resolution
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
      console.log("REGISTER HIT", req.headers.origin, req.body);
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
  page.on("console", (msg) => console.log("\u{1F7E1} PAGE console:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("\u{1F534} PAGE error:", err.message));
  page.on("request", (r) => {
    lastReq.push({ method: r.method(), url: r.url() });
    if (lastReq.length > 50) lastReq.shift();
  });
  page.on("response", (r) => {
    const h = r.headers();
    const entry = { status: r.status(), url: r.url(), ct: h["content-type"], cd: h["content-disposition"] };
    lastResp.push(entry);
    if (lastResp.length > 50) lastResp.shift();
    const ct = (entry.ct ?? "").toLowerCase();
    const cd = (entry.cd ?? "").toLowerCase();
    const url = entry.url.toLowerCase();
  });
  page.on("requestfailed", (r) => console.log("\u274C REQ FAILED:", r.url(), r.failure()?.errorText));
  const dumpSelect = async (css) => {
    const data = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { exists: false };
      return {
        exists: true,
        value: el.value,
        selectedText: el.selectedOptions[0]?.text ?? null,
        optionsCount: el.options.length
      };
    }, css);
  };
  const byId = (id) => page.locator(`[id="${id}"]`);
  const pickPrimefacesSelectOneMenuByText = async (wrapperId, expectedText) => {
    const wrapper = byId(wrapperId);
    await wrapper.waitFor({ state: "visible", timeout: 3e4 });
    const trigger = wrapper.locator(".ui-selectonemenu-trigger");
    const panel = byId(`${wrapperId}_panel`);
    await trigger.click();
    await panel.waitFor({ state: "visible", timeout: 3e4 });
    const byDataLabel = panel.locator(`li.ui-selectonemenu-item[data-label="${expectedText}"]`).first();
    if (await byDataLabel.count()) {
      await byDataLabel.click();
    } else {
      await panel.locator("li.ui-selectonemenu-item").filter({ hasText: expectedText }).first().click();
    }
    await page.waitForFunction(
      ({ id, text: text2 }) => {
        const el = document.getElementById(id + "_label");
        return !!el && (el.textContent ?? "").trim() === text2;
      },
      { id: wrapperId, text: expectedText },
      { timeout: 3e4 }
    );
    await page.waitForLoadState("networkidle").catch(() => null);
    await page.waitForTimeout(300);
  };
  try {
    console.log("\u{1F30D} goto WISE");
    await page.goto("https://wise-tt.com/wtt_um_feri/index.jsp", {
      waitUntil: "domcontentloaded",
      timeout: 6e4
    });
    console.log("\u{1F393} selecting program", program);
    const programSelectCss = 'select[id="form:j_idt183_input"]';
    await page.locator(programSelectCss).waitFor({ state: "attached", timeout: 3e4 });
    let programLabel = program;
    if (/^\d+$/.test(program)) {
      programLabel = await page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel);
        if (!el) return val;
        const opt = Array.from(el.options).find((o) => o.value === val);
        return opt?.text ?? val;
      }, { sel: programSelectCss, val: program });
    }
    await pickPrimefacesSelectOneMenuByText("form:j_idt183", programLabel);
    await dumpSelect(programSelectCss);
    console.log("\u{1F4C5} selecting year (PrimeFaces)", year);
    const yearSelectCss = 'select[id="form:j_idt187_input"]';
    await page.locator(yearSelectCss).waitFor({ state: "attached", timeout: 3e4 });
    await pickPrimefacesSelectOneMenuByText("form:j_idt187", year);
    await page.waitForFunction(
      ({ sel, val }) => {
        const el = document.querySelector(sel);
        return !!el && el.value === val;
      },
      { sel: yearSelectCss, val: year },
      { timeout: 3e4 }
    );
    await dumpSelect(yearSelectCss);
    const dirSelectCss = 'select[id="form:j_idt191_input"]';
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return !!el && el.options.length >= 2;
      },
      dirSelectCss,
      { timeout: 3e4 }
    );
    await dumpSelect(dirSelectCss);
    await page.waitForTimeout(500);
    const firstGroup = page.locator('[id="form:groupVar_data"] tr.ui-datatable-selectable').first();
    if (await firstGroup.count()) {
      await firstGroup.click().catch(() => null);
      await page.waitForTimeout(300);
    }
    const icalLink = page.locator('a:has(button:has-text("iCal-vse"))').first();
    const icalBtn = page.locator('button:has-text("iCal-vse")').first();
    if (await icalLink.count()) await icalLink.waitFor({ state: "visible", timeout: 3e4 });
    else await icalBtn.waitFor({ state: "visible", timeout: 3e4 });
    const downloadP = page.waitForEvent("download", { timeout: 9e4 }).catch(() => null);
    const attachRespP = page.waitForResponse(
      (r) => {
        const h = r.headers();
        return (h["content-type"] ?? "").toLowerCase().includes("calendar") || (h["content-disposition"] ?? "").toLowerCase().includes("attachment") || r.url().toLowerCase().includes("ical");
      },
      { timeout: 9e4 }
    ).catch(() => null);
    console.log("\u{1F5B1}\uFE0F clicking iCal-vse");
    if (await icalLink.count()) await icalLink.click();
    else await icalBtn.click();
    const download = await downloadP;
    const attachResp = await attachRespP;
    let icsText = null;
    if (download) {
      const p = await download.path();
      if (!p) throw new Error("Download had no path");
      const fs = await import("node:fs/promises");
      icsText = await fs.readFile(p, "utf8");
    } else if (attachResp) {
      icsText = await attachResp.text();
    }
    if (!icsText) {
      throw new Error("No ICS detected");
    }
    if (!icsText.includes("BEGIN:VCALENDAR")) {
      throw new Error("Downloaded content is not ICS");
    }
    const parsedEvents = await parseIcsToEvents(icsText);
    const existing = await getWiseScheduleEvents(programLabel, year);
    if (sameEventSet(programLabel, year, parsedEvents, existing)) {
      res.setHeader("X-WISE-ICAL", "1");
      return res.json({ status: "unchanged", imported: 0, events: existing });
    }
    await deleteWiseImportedEventsForSchedule(programLabel, year);
    await insertImportedEventsForSchedule(programLabel, year, parsedEvents);
    const wiseEvents = await getWiseScheduleEvents(programLabel, year);
    res.setHeader("X-WISE-ICAL", "1");
    return res.json({ status: "updated", imported: parsedEvents.length, events: wiseEvents });
  } catch (e) {
    return res.status(500).json({ message: e?.message ?? String(e) });
  } finally {
    wiseImportLocks.delete(lockKey);
    await context.close();
    await browser.close();
  }
});
async function deleteWiseImportedEventsForSchedule(program, year) {
  await db.delete(events).where(
    and3(
      isNull3(events.ownerUserId),
      eq3(events.program, program),
      eq3(events.year, year),
      eq3(events.source, "imported")
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
