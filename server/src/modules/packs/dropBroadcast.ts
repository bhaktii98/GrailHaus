import type { WebSocket } from "@fastify/websocket";

/**
 * In-memory pub/sub for live drop updates — one process, one Map, no external broker. That's
 * enough for this stack (a single Fastify process; see the health check's own "single instance"
 * assumption elsewhere) and avoids standing up Redis/etc. just to fan out "stock changed" to
 * however many clients currently have one drop screen open. If this ever runs on more than one
 * instance behind a load balancer, this stops being cross-instance-consistent — the fix then is a
 * shared pub/sub (Redis, etc.), not a bigger Map.
 */
const subscribersByPackId = new Map<string, Set<WebSocket>>();

export function subscribe(packId: string, socket: WebSocket): void {
  const set = subscribersByPackId.get(packId) ?? new Set();
  set.add(socket);
  subscribersByPackId.set(packId, set);
}

export function unsubscribe(packId: string, socket: WebSocket): void {
  const set = subscribersByPackId.get(packId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) subscribersByPackId.delete(packId);
}

export interface DropStockUpdate {
  type: "stock";
  packId: string;
  stockRemaining: number;
}

/** Called right after a purchase against a drop pack commits (see purchase.service.ts) — every
 * client with that drop's screen open learns the new stock count immediately, no polling. Never
 * called for an evergreen pack (no `goesLiveAt`) — those have no live-drop screen watching them. */
export function broadcastStockUpdate(packId: string, stockRemaining: number): void {
  const set = subscribersByPackId.get(packId);
  if (!set || set.size === 0) return;
  const payload: DropStockUpdate = { type: "stock", packId, stockRemaining };
  const message = JSON.stringify(payload);
  for (const socket of set) {
    try {
      socket.send(message);
    } catch {
      // A dead/closing socket here just misses this one update — its own close handler (see
      // dropSocket.routes.ts) is what actually removes it from the set.
    }
  }
}
