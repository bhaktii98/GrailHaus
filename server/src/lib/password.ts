import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** Salted scrypt, stored as `salt:hash` hex — no external dependency (bcrypt/argon2)
 * needed since Node's built-in `crypto.scrypt` is already a memory-hard KDF. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(hashHex, "hex");
  // Lengths must match before timingSafeEqual — it throws on mismatched buffer sizes
  // rather than returning false, which would leak length info via an exception instead.
  if (derived.length !== stored.length) return false;
  return timingSafeEqual(derived, stored);
}
