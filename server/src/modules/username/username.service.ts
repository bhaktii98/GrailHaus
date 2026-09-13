import { BadRequestError, ConflictError } from "../../lib/errors.js";
import { claimUsername, isUsernameTaken } from "./username.repository.js";

/** Lowercase letters, digits, underscore, 3-20 chars — matches the DB check constraint
 * (profiles_username_format) so a value that passes here never fails at the DB. */
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const RESERVED = new Set(["admin", "grailhaus", "support", "root", "moderator", "staff"]);

function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}

function assertValidFormat(username: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new BadRequestError("Collector ID must be 3-20 characters: lowercase letters, numbers, underscore only.");
  }
  if (RESERVED.has(username)) {
    throw new BadRequestError("That Collector ID is reserved.");
  }
}

export async function checkUsernameAvailability(raw: string): Promise<{ username: string; available: boolean }> {
  const username = normalize(raw);
  assertValidFormat(username);
  const taken = await isUsernameTaken(username);
  return { username, available: !taken };
}

export async function claimUsernameForUser(userId: string, raw: string): Promise<{ username: string }> {
  const username = normalize(raw);
  assertValidFormat(username);
  if (await isUsernameTaken(username)) {
    throw new ConflictError("That Collector ID is already taken.");
  }
  const claimed = await claimUsername(userId, username);
  if (!claimed) {
    throw new ConflictError("That Collector ID is already taken, or this account already has one.");
  }
  return { username };
}
