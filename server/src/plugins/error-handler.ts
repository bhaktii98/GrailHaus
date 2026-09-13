import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../lib/errors.js";

export const errorHandlerPlugin = fp(async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      reply.code(err.statusCode).send({ error: err.message });
      return;
    }
    app.log.error(err);
    reply.code(500).send({ error: "Internal Server Error" });
  });
});
