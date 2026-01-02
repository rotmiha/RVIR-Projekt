import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("app.db");

export function initDb() {
  db.execSync( 

    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      program TEXT,
      year TEXT
    );
    

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,              -- "study" | "personal"
      start_time TEXT NOT NULL,        -- ISO string
      end_time TEXT NOT NULL,          -- ISO string
      location TEXT,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'manual' -- "manual" | "imported"
    );
  );
 
  try {
    db.execSync(ALTER TABLE users ADD COLUMN program TEXT;);
  } catch {}

  try {
    db.execSync(ALTER TABLE users ADD COLUMN year TEXT;);
  } catch {}
}