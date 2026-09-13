import { randomUUID } from "node:crypto";
import { signAppAccessToken, type Profile } from "@grailhaus/shared";
import { ConflictError, BadRequestError, UnauthorizedError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { findAuthProfileByEmail, insertProfile, type AuthProfileRow } from "./auth.repository.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toProfile(row: AuthProfileRow): Profile {
  return {
    id: row.public_id,
    displayName: row.display_name,
    username: row.username,
    balanceCents: Number(row.balance_cents),
    createdAt: row.created_at,
  };
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function signUp(rawEmail: string, password: string): Promise<{ token: string; profile: Profile }> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_PATTERN.test(email)) throw new BadRequestError("Enter a valid email address.");
  if (password.length < 8) throw new BadRequestError("Password must be at least 8 characters.");

  if (await findAuthProfileByEmail(email)) {
    throw new ConflictError("An account with that email already exists.");
  }

  const passwordHash = await hashPassword(password);
  const row = await insertProfile({ id: randomUUID(), email, passwordHash });
  const token = await signAppAccessToken(row.id, env.appJwtSecret);
  return { token, profile: toProfile(row) };
}

export async function signIn(rawEmail: string, password: string): Promise<{ token: string; profile: Profile }> {
  const email = normalizeEmail(rawEmail);
  const row = await findAuthProfileByEmail(email);
  // Same error either way — a wrong-password response shouldn't confirm the email exists.
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new UnauthorizedError("Incorrect email or password.");
  }
  const token = await signAppAccessToken(row.id, env.appJwtSecret);
  return { token, profile: toProfile(row) };
}
