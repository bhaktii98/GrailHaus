import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export const corsPlugin = fp(async function corsPlugin(app: FastifyInstance) {
  await app.register(cors, { origin: true });
});
