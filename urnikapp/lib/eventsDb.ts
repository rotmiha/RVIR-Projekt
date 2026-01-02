import { db } from "@/lib/db";

export type DbEvent = {
  id: string;
  userId: string;
  title: string;
  type: "study" | "personal";
  startTime: string;
  endTime: string;
  location?: string | null;
  description?: string | null;
  source?: "manual" | "imported";
};

function uuid() {
  // simple UUID-ish for sqlite
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getEventsForUser(userId: string): DbEvent[] {
  const rows = db.getAllSync<any>(
    SELECT * FROM events WHERE user_id = ? ORDER BY start_time ASC,
    [userId]
  );

  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    type: r.type,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location,
    description: r.description,
    source: r.source,
  }));
}

export function deleteImportedEvents(userId: string) {
  db.runSync(DELETE FROM events WHERE user_id = ? AND source = 'imported', [userId]);
}

export function insertImportedEvents(
  userId: string,
  events: Array<{
    title: string;
    startTime: string; // ISO
    endTime: string;   // ISO
    location?: string | null;
    description?: string | null;
  }>
) {
  for (const e of events) {
    db.runSync(
      INSERT INTO events
        (id, user_id, title, type, start_time, end_time, location, description, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?),
      [
        uuid(),
        userId,
        e.title,
        "study",
        e.startTime,
        e.endTime,
        e.location ?? null,
        e.description ?? null,
        "imported",
      ]
    );
  }
}