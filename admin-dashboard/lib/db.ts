import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy admin-dashboard/.env.local.example to .env.local.");
}

/** Direct Postgres connection using the database's own credentials — deliberately
 * not going through Supabase's PostgREST/RLS layer, so writes here aren't subject
 * to (and don't need) row-level security policies meant for the public API. */
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
