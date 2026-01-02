export async function importWiseForUser(
  userId: string,
  programValue: string,
  yearValue: string
) {
  const BASE_URL = "http://192.168.0.102:5000"; // če si na Android emulatorju, pogosto rabiš 10.0.2.2

  console.log("Importing WISE for:", userId, programValue, yearValue);

  const resp = await fetch(`${BASE_URL}/api/import/wise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, programValue, yearValue }),
  });

  const text = await resp.text();
  console.log("WISE RESP status:", resp.status);
  console.log("WISE RESP CT:", resp.headers.get("content-type"));
  console.log("WISE RESP body start:", text.slice(0, 200));

  if (!resp.ok) {
    throw new Error(`WISE import failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text);

  const imported = Number(data.imported ?? 0);
  const events = (data.events ?? []) as any[];

  // ✅ shrani v lokalni SQLite takoj
  if (events.length) {
    upsertEventsToSQLite(userId, events);
  }

  return { imported, eventsCountSynced: events.length };
}


export function debugPrintEvents(userId: string) {
  const rows = db.getAllSync(
    `SELECT id, title, start_time, end_time, source
     FROM events
     WHERE user_id = ?
     ORDER BY start_time
     LIMIT 10`,
    [userId]
  );

  console.log("📦 SQLITE EVENTS (first 10):", rows);
}


import { db } from "@/lib/db";

function toIso(x: any) {
  if (!x) return "";
  if (typeof x === "string") return x;
  const d = new Date(x);
  return isNaN(d.getTime()) ? String(x) : d.toISOString();
}

// expects events from backend with fields:
// id, title, type, startTime/endTime (or start_time/end_time), location, description, source
export function upsertEventsToSQLite(userId: string, events: any[]) {
  db.withTransactionSync(() => {
    for (const e of events) {
      db.runSync(
        `
        INSERT INTO events (
          id, user_id, title, type, start_time, end_time, location, description, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id=excluded.user_id,
          title=excluded.title,
          type=excluded.type,
          start_time=excluded.start_time,
          end_time=excluded.end_time,
          location=excluded.location,
          description=excluded.description,
          source=excluded.source
        `,
        [
          String(e.id),
          userId,
          String(e.title ?? ""),
          String(e.type ?? "study"),
          toIso(e.startTime ?? e.start_time),
          toIso(e.endTime ?? e.end_time),
          e.location ?? null,
          e.description ?? null,
          String(e.source ?? "imported"),
        ]
      );
    }
  });
}
