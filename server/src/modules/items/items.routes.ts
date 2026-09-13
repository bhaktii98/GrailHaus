import type { FastifyInstance } from "fastify";
import type { Category } from "@grailhaus/shared";
import { getItemDetail, listItemDetails } from "./items.service.js";
import { itemDetailSchema } from "./items.schema.js";

export async function itemsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { category?: Category } }>(
    "/items",
    {
      schema: {
        tags: ["items"],
        summary: "Full catalog detail for every item — public, same as /packs",
        querystring: {
          type: "object",
          properties: { category: { type: "string" } },
        },
        response: { 200: { type: "array", items: itemDetailSchema } },
      },
    },
    async (req) => listItemDetails(req.query.category)
  );

  app.get(
    "/items/:id",
    {
      schema: {
        tags: ["items"],
        summary: "Full catalog detail for one item — public, same as /packs",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: { 200: itemDetailSchema },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return getItemDetail(id);
    }
  );
}
