import type { Profile } from "@grailhaus/shared";
import { NotFoundError } from "../../lib/errors.js";
import { findProfileByUserId } from "./profile.repository.js";

export async function getCurrentProfile(userId: string): Promise<Profile> {
  const row = await findProfileByUserId(userId);
  if (!row) {
    throw new NotFoundError("Profile not found — the signup trigger may not have run yet.");
  }
  return {
    id: row.public_id,
    displayName: row.display_name,
    username: row.username,
    balanceCents: Number(row.balance_cents),
    createdAt: row.created_at,
  };
}
