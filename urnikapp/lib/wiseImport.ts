const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://164.8.207.68:5000";

type ImportWiseResponse = {
  imported: number;
  program: string;
  year: string;
  events?: any[];
};

export async function refreshWiseSchedule(programValue: string, yearValue: string) {
  console.log("Refreshing WISE schedule for:", programValue, yearValue);

  const resp = await fetch(`${BASE_URL}/api/import/wise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ programValue, yearValue }),
  });

  const text = await resp.text();

  console.log("WISE RESP status:", resp.status);
  console.log("WISE RESP CT:", resp.headers.get("content-type"));
  console.log("WISE RESP body start:", text.slice(0, 200));

  if (!resp.ok) {
    throw new Error(`WISE refresh failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text) as ImportWiseResponse;

  return {
    imported: Number(data.imported ?? 0),
    program: String(data.program ?? programValue),
    year: String(data.year ?? yearValue),
  };
}
