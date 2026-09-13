import type { FastifyInstance } from "fastify";
import { subscribe, unsubscribe } from "./dropBroadcast.js";

/**
 * A live drop's own channel — one socket connection per pack per open screen. Public (like
 * `/packs`/`/activity/recent`): a drop's stock count is browsable without a session, same access
 * model as the rest of the catalog, so there's no auth handshake here to keep this simple.
 *
 * Sends nothing on connect — the client already has a `stockRemaining` from `GET /packs`; this
 * only ever pushes the delta from here on (see dropBroadcast.ts's `broadcastStockUpdate`, called
 * from purchase.service.ts right after a purchase against this pack commits).
 */
export async function dropSocketRoutes(app: FastifyInstance) {
  app.get("/ws/packs/:packId", { websocket: true }, (socket, req) => {
    const { packId } = req.params as { packId: string };
    subscribe(packId, socket);
    socket.on("close", () => unsubscribe(packId, socket));
    socket.on("error", () => unsubscribe(packId, socket));
  });
}
