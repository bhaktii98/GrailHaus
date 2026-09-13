import { pool } from "../../db/pool.js";

export async function isUsernameTaken(username: string): Promise<boolean> {
  const { rows } = await pool.query("select 1 from public.profiles where username = $1", [username]);
  return rows.length > 0;
}

/** Claims a username for a user who doesn't have one yet — the `username is null` guard makes
 * this atomic against a second claim racing in on the same account, and the column's own unique
 * constraint catches two accounts racing on the same name. Returns false if either lost the race. */
export async function claimUsername(userId: string, username: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "update public.profiles set username = $1 where id = $2 and username is null",
    [username, userId]
  );
  return (rowCount ?? 0) > 0;
}
