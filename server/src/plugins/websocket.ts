import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export const websocketPlugin = fp(async function websocketPlugin(app: FastifyInstance) {
  await app.register(websocket);
});
