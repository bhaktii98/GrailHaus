import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const KEY = "grailhaus_device_id";
let cached: string | null = null;

/** A stable, random, per-install identifier — not tied to hardware. Sent as
 * X-Device-Id on signup as a recorded (not blocking) signal for the
 * one-account-per-user loophole line in the economics audit. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await SecureStore.getItemAsync(KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, id);
  }
  cached = id;
  return id;
}
