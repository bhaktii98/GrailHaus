import { pool } from "../../db/pool.js";

export interface AuthProfileRow {
  id: string;
  public_id: string;
  display_name: string | null;
  username: string | null;
  balance_cents: string;
  created_at: string;
  password_hash: string;
}

export async function findAuthProfileByEmail(email: string): Promise<AuthProfileRow | null> {
  const { rows } = await pool.query<AuthProfileRow>(
    `select id, public_id, display_name, username, balance_cents, created_at, password_hash
     from public.profiles where email = $1`,
    [email]
  );
  return rows[0] ?? null;
}

/** Mirrors the (now-inert) `handle_new_user()` trigger's starting-balance lookup — new
 * signups no longer go through `auth.users`, so this insert is the one place that logic
 * needs to live now. */
export async function insertProfile(params: {
  id: string;
  email: string;
  passwordHash: string;
}): Promise<AuthProfileRow> {
  const { rows: configRows } = await pool.query<{ starting_balance_cents: string }>(
    "select starting_balance_cents from public.platform_config limit 1"
  );
  const startingBalanceCents = configRows[0]?.starting_balance_cents ?? "2500000";

  const { rows } = await pool.query<AuthProfileRow>(
    `insert into public.profiles (id, email, password_hash, balance_cents)
     values ($1, $2, $3, $4)
     returning id, public_id, display_name, username, balance_cents, created_at, password_hash`,
    [params.id, params.email, params.passwordHash, startingBalanceCents]
  );
  return rows[0];
}
