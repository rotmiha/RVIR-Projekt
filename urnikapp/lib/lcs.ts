// lib/ics.ts
type IcsEvent = {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
};

function parseIcsDate(v: string): Date {
  // podpira: 20260101T120000Z ali 20260101T120000 ali 20260101
  if (v.includes("T")) {
    const isZ = v.endsWith("Z");
    const s = isZ ? v.slice(0, -1) : v;
    const yyyy = Number(s.slice(0, 4));
    const mm = Number(s.slice(4, 6)) - 1;
    const dd = Number(s.slice(6, 8));
    const hh = Number(s.slice(9, 11));
    const mi = Number(s.slice(11, 13));
    const ss = Number(s.slice(13, 15)) || 0;

    return isZ
      ? new Date(Date.UTC(yyyy, mm, dd, hh, mi, ss))
      : new Date(yyyy, mm, dd, hh, mi, ss);
  } else {
    const yyyy = Number(v.slice(0, 4));
    const mm = Number(v.slice(4, 6)) - 1;
    const dd = Number(v.slice(6, 8));
    return new Date(yyyy, mm, dd);
  }
}

export function parseIcs(text: string): IcsEvent[] {
  // unfold (ICS continuation lines start with space)
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(" ") && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }

  const out: IcsEvent[] = [];
  let cur: any = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.SUMMARY && cur?.DTSTART && cur?.DTEND) {
        out.push({
          title: cur.SUMMARY,
          start: parseIcsDate(cur.DTSTART),
          end: parseIcsDate(cur.DTEND),
          location: cur.LOCATION,
          description: cur.DESCRIPTION,
        });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;

      const left = line.slice(0, idx);
      const value = line.slice(idx + 1);

      // LEFT je lahko "DTSTART;TZID=..." -> key je do ;
      const key = left.split(";")[0];

      if (["SUMMARY", "DTSTART", "DTEND", "LOCATION", "DESCRIPTION"].includes(key)) {
        cur[key] = value.replace(/\\n/g, "\n");
      }
    }
  }

  return out;
}
