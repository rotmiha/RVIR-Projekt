import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite"; // setupVite + serveStatic odstranjeno (frontend disabled)
// import { setupVite, serveStatic, log } from "./vite";
import { chromium } from "playwright";
import { storage } from "./storage";

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





app.post("/api/import/wise", async (req, res) => {
  console.log("✅ HIT /api/import/wise", req.body);

  const { userId, programValue, yearValue } = req.body ?? {};
  if (!userId || !programValue || !yearValue) {
    return res.status(400).json({
      message: "Missing userId / programValue / yearValue",
    });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // 🔍 DEBUG: store last N network events
  const lastReq: Array<{ method: string; url: string }> = [];
  const lastResp: Array<{
    status: number;
    url: string;
    ct?: string;
    cd?: string;
  }> = [];

  // 🔍 GLOBAL DEBUG HOOKS
  page.on("console", (msg) =>
    console.log("🟡 PAGE console:", msg.type(), msg.text())
  );
  page.on("pageerror", (err) => console.log("🔴 PAGE error:", err.message));
  page.on("request", (r) => {
    const entry = { method: r.method(), url: r.url() };
    lastReq.push(entry);
    if (lastReq.length > 50) lastReq.shift();
    console.log("➡️ REQ:", entry.method, entry.url);
  });
  page.on("response", (r) => {
    const h = r.headers();
    const entry = {
      status: r.status(),
      url: r.url(),
      ct: h["content-type"],
      cd: h["content-disposition"],
    };
    lastResp.push(entry);
    if (lastResp.length > 50) lastResp.shift();

    const ct = (entry.ct ?? "").toLowerCase();
    const cd = (entry.cd ?? "").toLowerCase();
    const url = entry.url.toLowerCase();

    // log only interesting responses
    if (
      ct.includes("calendar") ||
      cd.includes("attachment") ||
      cd.includes(".ics") ||
      url.includes("dynamiccontent") ||
      url.includes("ical")
    ) {
      console.log(
        "⬅️ RESP IMPORTANT:",
        entry.status,
        entry.url,
        "CT=",
        entry.ct,
        "CD=",
        entry.cd
      );
    }
  });
  page.on("requestfailed", (r) =>
    console.log("❌ REQ FAILED:", r.url(), r.failure()?.errorText)
  );

  try {
    console.log("🌍 goto WISE");
    await page.goto("https://wise-tt.com/wtt_um_feri/index.jsp", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log("✅ page loaded");

    // PROGRAM
    console.log("🎓 selecting program", programValue);
    const programSel = page.locator('select[id="form:j_idt175_input"]');
    await programSel.waitFor({ state: "visible", timeout: 30000 });
    await programSel.selectOption(String(programValue));
    await programSel.dispatchEvent("change");
    await page.waitForTimeout(700);

    // LETNIK
    console.log("📅 selecting year", yearValue);
    const yearSel = page.locator('select[id="form:j_idt179_input"]');
    await yearSel.waitFor({ state: "visible", timeout: 30000 });
    await yearSel.selectOption(String(yearValue));
    await yearSel.dispatchEvent("change");
    await page.waitForTimeout(700);

    // BUTTON
    const btn = page.locator('button:has-text("iCal-vse")').first();
    console.log("🔘 waiting for iCal button");
    await btn.waitFor({ state: "visible", timeout: 30000 });

    console.log("🖱️ clicking iCal-vse");

    // (A) classic download event
    const downloadP = page
      .waitForEvent("download", { timeout: 90000 })
      .catch(() => null);

    // (B) direct response with attachment / text/calendar
    const attachRespP = page
      .waitForResponse(
        (r) => {
          const h = r.headers();
          const ct = (h["content-type"] ?? "").toLowerCase();
          const cd = (h["content-disposition"] ?? "").toLowerCase();
          const url = r.url().toLowerCase();
          return (
            ct.includes("calendar") ||
            cd.includes("attachment") ||
            cd.includes(".ics") ||
            url.includes("ical")
          );
        },
        { timeout: 90000 }
      )
      .catch(() => null);

    // (C) PrimeFaces AJAX response (often contains dynamiccontent URL)
    const ajaxHomeP = page
      .waitForResponse(
        (r) =>
          r.url().includes("/pages/home.jsf") && r.request().method() === "POST",
        { timeout: 30000 }
      )
      .catch(() => null);

    await btn.click();

    console.log("⏳ waiting for download/attachment/ajax...");

    const download = await downloadP;
    const attachResp = await attachRespP;

    let icsText: string | null = null;

    // A) download event path -> file
    if (download) {
      console.log("✅ GOT DOWNLOAD EVENT:", await download.suggestedFilename());
      const path = await download.path();
      if (!path) throw new Error("Download had no path");

      const fs = await import("node:fs/promises");
      icsText = await fs.readFile(path, "utf8");
    }

    // B) attachment/calendar response -> body
    if (!icsText && attachResp) {
      console.log(
        "✅ GOT ATTACHMENT RESPONSE:",
        attachResp.status(),
        attachResp.url()
      );
      icsText = await attachResp.text();
    }

    // C) ajax response -> find dynamiccontent link -> fetch it with same session
    if (!icsText) {
      const ajaxResp = await ajaxHomeP;
      if (ajaxResp) {
        const ajaxText = await ajaxResp.text();
        console.log("🧩 AJAX home.jsf preview:", ajaxText.slice(0, 500));

        // try to find PrimeFaces dynamiccontent URL
        const m =
          ajaxText.match(
            /(\/wtt_um_feri\/javax\.faces\.resource\/dynamiccontent\.xhtml[^"'<>\s]+)/i
          ) ||
          ajaxText.match(
            /(\/javax\.faces\.resource\/dynamiccontent\.xhtml[^"'<>\s]+)/i
          );

        if (m?.[1]) {
          const dynUrl = new URL(m[1], "https://wise-tt.com").toString();
          console.log("🎯 FOUND dynamiccontent:", dynUrl);

          const r = await context.request.get(dynUrl);
          const t = await r.text();

          console.log("📄 dynamiccontent CT:", r.headers()["content-type"]);
          console.log("📄 dynamiccontent preview:", t.slice(0, 200));

          icsText = t;
        } else {
          console.log("❗ No dynamiccontent link found in AJAX response.");
        }
      } else {
        console.log("❗ No AJAX /pages/home.jsf response captured (timeout).");
      }
    }

    // If still nothing -> dump last network
    if (!icsText) {
      console.log("🧯 LAST 20 REQ:", lastReq.slice(-20));
      console.log("🧯 LAST 20 RESP:", lastResp.slice(-20));
      throw new Error(
        "No ICS detected (no download event, no attachment response, no dynamiccontent)."
      );
    }

    console.log("📄 ICS length:", icsText.length);
    console.log("📄 ICS preview:", icsText.slice(0, 250));

    if (!icsText.includes("BEGIN:VCALENDAR")) {
      console.log("📄 NOT ICS START:", icsText.slice(0, 300));
      throw new Error("Received content but it's not ICS (missing BEGIN:VCALENDAR)");
    }

    const parsedEvents = await parseIcsToEvents(icsText);
    console.log("📊 parsed events:", parsedEvents.length);

    await deleteWiseImportedEvents(userId);
    await insertImportedEvents(userId, parsedEvents);

    const all = await storage.getEventsByUserId(userId);

    const wiseEvents = all.filter((e: any) => e.source === "wise" || e.source === "imported");

    res.setHeader("X-WISE-ICAL", "1");

    return res.json({
      imported: parsedEvents.length,
      events: wiseEvents,
    });
  } catch (e: any) {
    console.error("❌ WISE IMPORT ERROR:", e);
    return res.status(500).json({
      message: e?.message ?? String(e),
    });
  } finally {
    await context.close();
    await browser.close();
  }
});









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




  