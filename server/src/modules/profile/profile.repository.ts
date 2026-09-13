import { pool } from "../../db/pool.js";

export interface ProfileRow {
  id: string;
  public_id: string;
  display_name: string | null;
  username: string | null;
  balance_cents: string;
  created_at: string;
}

export async function findProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const { rows } = await pool.query<ProfileRow>(
    "select id, public_id, display_name, username, balance_cents, created_at from public.profiles where id = $1",
    [userId]
  );
  return rows[0] ?? null;
}
