import type { FastifyInstance } from "fastify";
import { signIn, signUp } from "./auth.service.js";

const authResponseSchema = {
  type: "object",
  properties: {
    token: { type: "string" },
    profile: {
      type: "object",
      properties: {
        id: { type: "string", description: "Opaque public id, e.g. usr_..." },
        displayName: { type: ["string", "null"] },
        username: { type: ["string", "null"], description: "The public Collector ID, null until claimed" },
        balanceCents: { type: "number" },
        createdAt: { type: "string" },
      },
    },
  },
};

const credentialsBodySchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string" },
    password: { type: "string" },
  },
};

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string; password: string } }>(
    "/auth/signup",
    {
      schema: {
        tags: ["auth"],
        summary: "Create an account — returns a session immediately, no email confirmation",
        body: credentialsBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => signUp(req.body.email, req.body.password)
  );

  app.post<{ Body: { email: string; password: string } }>(
    "/auth/signin",
    {
      schema: {
        tags: ["auth"],
        summary: "Sign in with email + password",
        body: credentialsBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (req) => signIn(req.body.email, req.body.password)
  );
}
