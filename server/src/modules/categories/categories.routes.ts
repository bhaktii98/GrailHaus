import type { FastifyInstance } from "fastify";
import { listCategories } from "./categories.service.js";

const hapticStepSchema = {
  type: "object",
  properties: {
    atMs: { type: "number" },
    kind: { type: "string", enum: ["light", "medium", "heavy", "success"] },
  },
};

const openingBeatSchema = {
  type: "object",
  properties: { atMs: { type: "number" }, label: { type: "string" } },
};

export const categoryRevealSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    meshArchetype: { type: "string", description: "Selects a geometry-builder from the app's fixed archetype registry." },
    paletteBackground: { type: "string" },
    paletteAccent: { type: "string" },
    cameraPosition: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
    cameraFov: { type: "number" },
    lighting: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["ambient", "directional"] },
          position: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          intensity: { type: "number" },
          color: { type: "string" },
        },
      },
    },
    gestureMode: { type: "string", enum: ["tear", "lift-lid"] },
    gestureVelocityThreshold: { type: "number" },
    gestureTravelDistance: { type: "number" },
    commonBeatMs: { type: "number" },
    rareHoldMs: { type: "number" },
    hapticCommon: { type: "array", items: hapticStepSchema },
    hapticRare: { type: "array", items: hapticStepSchema },
    openingBeatsCommon: { type: ["array", "null"], items: openingBeatSchema },
    openingBeatsRare: { type: ["array", "null"], items: openingBeatSchema },
    sortOrder: { type: "number" },
  },
};

export async function categoriesRoutes(app: FastifyInstance) {
  app.get(
    "/categories",
    {
      schema: {
        tags: ["categories"],
        summary: "Every category's full reveal personality — palette, camera, lighting, gesture, timing, haptics.",
        response: { 200: { type: "array", items: categoryRevealSchema } },
      },
    },
    async () => listCategories()
  );
}
