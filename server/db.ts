import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const ssss = "postgresql://neondb_owner:npg_LQx9fhs3cwtn@ep-calm-pond-agmcrmms-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
if (!ssss) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}
export const pool = new Pool({ connectionString: ssss });
export const db = drizzle({ client: pool, schema });
