import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite"; // setupVite + serveStatic odstranjeno (frontend disabled)
// import { setupVite, serveStatic, log } from "./vite";
import { chromium } from "playwright";
import { storage } from "./storage";
import { db } from "./db";
import { events } from "@shared/schema";
import { and, eq, isNull } from "drizzle-orm";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

app.use((req, _res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});

  async function parseIcsToEvents(icsText: string) {
    const mod: any = await import("node-ical");
    const ical = mod?.default ?? mod; // ✅ dela v ESM + CJS

    const parsed = ical.parseICS(icsText);

    const events: Array<{
      title: string;
      startTime: Date;
      endTime: Date;
      location: string | null;
      description: string | null;
    }> = [];

    for (const k in parsed) {
      const ev: any = parsed[k];
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
    
app.get("/api/ping", (_req, res) => {
  console.log("PING HIT /api/ping");
  res.json({ ok: true });
});



const wiseImportLocks = new Map<string, boolean>();

app.post("/api/import/wise", async (req, res) => {
  console.log("✅ HIT /api/import/wise", req.body);

  const { programValue, yearValue } = req.body ?? {};
  if (!programValue || !yearValue) {
    return res.status(400).json({ message: "Missing programValue / yearValue" });
  }

  const program = String(programValue); // label ali value
  const year = String(yearValue);       // "1" | "2" | "3"
  const lockKey = `${program}||${year}`;

  if (wiseImportLocks.get(lockKey)) {
    return res.status(409).json({
      status: "busy",
      message: "WISE import že teče za ta program/letnik.",
    });
  }
  wiseImportLocks.set(lockKey, true);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  const lastReq: Array<{ method: string; url: string }> = [];
  const lastResp: Array<{ status: number; url: string; ct?: string; cd?: string }> = [];

  page.on("console", (msg) => console.log("🟡 PAGE console:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("🔴 PAGE error:", err.message));
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

  page.on("requestfailed", (r) => console.log("❌ REQ FAILED:", r.url(), r.failure()?.errorText));

  const dumpSelect = async (css: string) => {
    const data = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLSelectElement | null;
      if (!el) return { exists: false };
      return {
        exists: true,
        value: el.value,
        selectedText: el.selectedOptions[0]?.text ?? null,
        optionsCount: el.options.length,
      };
    }, css);
  };

    const byId = (id: string) => page.locator(`[id="${id}"]`);
    const pickPrimefacesSelectOneMenuByText = async (wrapperId: string, expectedText: string) => {
      const wrapper = byId(wrapperId);
      await wrapper.waitFor({ state: "visible", timeout: 30000 });

      const trigger = wrapper.locator(".ui-selectonemenu-trigger");
      const panel = byId(`${wrapperId}_panel`);

      await trigger.click();
      await panel.waitFor({ state: "visible", timeout: 30000 });

      // PrimeFaces items are <li class="ui-selectonemenu-item" data-label="...">
      const byDataLabel = panel.locator(`li.ui-selectonemenu-item[data-label="${expectedText}"]`).first();
      if (await byDataLabel.count()) {
        await byDataLabel.click();
      } else {
        await panel.locator("li.ui-selectonemenu-item").filter({ hasText: expectedText }).first().click();
      }

      // wait label update
      await page.waitForFunction(
        ({ id, text }) => {
          const el = document.getElementById(id + "_label");
          return !!el && (el.textContent ?? "").trim() === text;
        },
        { id: wrapperId, text: expectedText },
        { timeout: 30000 }
      );

      await page.waitForLoadState("networkidle").catch(() => null);
      await page.waitForTimeout(300);

  };

  try {
    console.log("🌍 goto WISE");
    await page.goto("https://wise-tt.com/wtt_um_feri/index.jsp", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("🎓 selecting program", program);

    const programSelectCss = 'select[id="form:j_idt183_input"]';
    await page.locator(programSelectCss).waitFor({ state: "attached", timeout: 30000 });

    let programLabel = program;
    if (/^\d+$/.test(program)) {
      programLabel = await page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        if (!el) return val;
        const opt = Array.from(el.options).find(o => o.value === val);
        return opt?.text ?? val;
      }, { sel: programSelectCss, val: program });
    }

    await pickPrimefacesSelectOneMenuByText("form:j_idt183", programLabel);
    await dumpSelect(programSelectCss);

    // ===== LETNIK =====
    console.log("📅 selecting year (PrimeFaces)", year);

    const yearSelectCss = 'select[id="form:j_idt187_input"]';
    await page.locator(yearSelectCss).waitFor({ state: "attached", timeout: 30000 });

    await pickPrimefacesSelectOneMenuByText("form:j_idt187", year);

    // must reflect in hidden <select>
    await page.waitForFunction(
      ({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        return !!el && el.value === val;
      },
      { sel: yearSelectCss, val: year },
      { timeout: 30000 }
    );
    await dumpSelect(yearSelectCss);

    const dirSelectCss = 'select[id="form:j_idt191_input"]';
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        return !!el && el.options.length >= 2;
      },
      dirSelectCss,
      { timeout: 30000 }
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
    if (await icalLink.count()) await icalLink.waitFor({ state: "visible", timeout: 30000 });
    else await icalBtn.waitFor({ state: "visible", timeout: 30000 });

    const downloadP = page.waitForEvent("download", { timeout: 90000 }).catch(() => null);
    const attachRespP = page.waitForResponse(
      (r) => {
        const h = r.headers();
        return (
          (h["content-type"] ?? "").toLowerCase().includes("calendar") ||
          (h["content-disposition"] ?? "").toLowerCase().includes("attachment") ||
          r.url().toLowerCase().includes("ical")
        );
      },
      { timeout: 90000 }
    ).catch(() => null);

    console.log("🖱️ clicking iCal-vse");
    if (await icalLink.count()) await icalLink.click();
    else await icalBtn.click();

    const download = await downloadP;
    const attachResp = await attachRespP;

    let icsText: string | null = null;

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
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? String(e) });
  } finally {
    wiseImportLocks.delete(lockKey);
    await context.close();
    await browser.close();
  }
});

async function deleteWiseImportedEventsForSchedule(program: string, year: string) {
  await db
    .delete(events)
    .where(
      and(
        isNull(events.ownerUserId),         
        eq(events.program, program),
        eq(events.year, year),
        eq(events.source, "imported")        
      )
    );
}

type ParsedEvent = {
  title: string;
  type?: "study" | "personal"; 
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


function normStr(s: any) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function toIso(v: any) {
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function eventKeyLikeDb(program: string, year: string, ev: {
  title: any;
  type?: any;
  startTime: any;
  endTime: any;
  location?: any;
  description?: any;
}) {
  // isti “shape” kot v insertu
  const title = normStr(ev.title);
  const type = normStr(ev.type ?? "study");
  const startTime = toIso(ev.startTime);
  const endTime = toIso(ev.endTime);
  const location = normStr(ev.location ?? "");
  const description = normStr(ev.description ?? "");

  // program/year vključimo, da je ključ vezan na urnik
  return [
    normStr(program),
    normStr(year),
    title,
    type,
    startTime,
    endTime,
    location,
    description,
  ].join("||");
}

function sameEventSet(
  program: string,
  year: string,
  incoming: ParsedEvent[],
  existing: Array<{
    title: string;
    type: string;
    startTime: string | Date;
    endTime: string | Date;
    location?: string | null;
    description?: string | null;
    source?: string | null;     // ✅ allow null
    program?: string | null;    // (optional, če select vrača null)
    year?: string | null;       // (optional)
  }>
) {
  const a = new Set(incoming.map((ev) => eventKeyLikeDb(program, year, ev)));

  // primerjaj samo imported
  const importedOnly = existing.filter((e) => (e.source ?? "") === "imported");

  const b = new Set(
    importedOnly.map((e) =>
      eventKeyLikeDb(program, year, {
        title: e.title,
        type: e.type,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location ?? null,
        description: e.description ?? null,
      })
    )
  );
  if (a.size !== b.size) return false;
  return Array.from(a).every((k) => b.has(k));
}




// API logger (pusti tako)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // ✅ FRONTEND DISABLED: nič vite, nič static

  // ✅ API-only 404: Postman nikoli več ne dobi index.html
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
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();

async function insertImportedEvents(
  userId: string,
  parsedEvents: Array<{
    title: string;
    startTime: Date;
    endTime: Date;
    location: string | null;
    description: string | null;
  }>
) {
  for (const ev of parsedEvents) {
    await storage.createEvent({
      userId,
      title: ev.title,
      type: "study",
      startTime: new Date(ev.startTime),
      endTime: new Date(ev.endTime),
      location: ev.location ?? null,
      description: ev.description ?? null,
      source: "wise",
    } as any);
  }
}




  