import bcrypt from "bcryptjs";
import { randomUUID } from "expo-crypto";
import { db } from "@/lib/db";

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  program?: string | null;
  year?: string | null;
};

/**
 * REGISTER
 */
export function registerUser(
  username: string,
  email: string,
  password: string,
  program: string,
  year: string
): PublicUser {
  const id = randomUUID();

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPw = String(password);
  const cleanprogram = program;
  const cleayear = year;

  console.log(cleanprogram, cleayear);
  if (!cleanPw) throw new Error("Geslo je prazno");

  // bcrypt hash (SYNC – najbolj stabilno v Expo)
  const hash = bcrypt.hashSync(cleanPw, 10);

  db.runSync(
    `
    INSERT INTO users (id, username, email, password, program, year)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [id, cleanUsername, cleanEmail, hash, program, year]
  );


  const check = db.getFirstSync(
  "SELECT program, year FROM users WHERE id = ?",
  [id]
);

console.log("DB CHECK:", check);


  return {
    id,
    username: cleanUsername,
    email: cleanEmail,
    program,
    year,
  };
}

/**
 * LOGIN
 */
export function loginUser(email: string, password: string): PublicUser {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPw = String(password);

  const row = db.getFirstSync<{
    id: string;
    username: string;
    email: string;
    password: string;
    program: string | null;
    year: string | null;
  }>(
    `
    SELECT id, username, email, password, program, year
    FROM users
    WHERE email = ?
    LIMIT 1
    `,
    [cleanEmail]
  );

  if (!row) throw new Error("Napačen email ali geslo");

  // zaščita pred pokvarjenimi zapisi
  if (!row.password?.startsWith("$2")) {
    throw new Error("Pokvarjen hash gesla (resetiraj users tabelo).");
  }

  const ok = bcrypt.compareSync(cleanPw, row.password);
  if (!ok) throw new Error("Napačen email ali geslo");

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    program: row.program,
    year: row.year,
  };
}
