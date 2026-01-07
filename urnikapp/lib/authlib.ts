export type PublicUser = {
  id: string;
  username: string;
  email: string;
  program?: string | null;
  year?: string | null;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://164.8.207.68:5000"; // tvoj server IP

async function postJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
  program: string,
  year: string
): Promise<PublicUser> {
  const r = await postJson<{ user: PublicUser }>("/api/auth/register", {
    username,
    email,
    password,
    program,
    year,
  });
  return r.user;
}

export async function loginUser(email: string, password: string): Promise<PublicUser> {
  const r = await postJson<{ user: PublicUser }>("/api/auth/login", { email, password });
  return r.user;
}
