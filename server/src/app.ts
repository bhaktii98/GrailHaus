import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { corsPlugin } from "./plugins/cors.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { authPlugin } from "./plugins/auth.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { websocketPlugin } from "./plugins/websocket.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { profileRoutes } from "./modules/profile/profile.routes.js";
import { packsRoutes } from "./modules/packs/packs.routes.js";
import { usernameRoutes } from "./modules/username/username.routes.js";
import { purchaseRoutes } from "./modules/purchase/purchase.routes.js";
import { itemsRoutes } from "./modules/items/items.routes.js";
import { portfolioRoutes } from "./modules/portfolio/portfolio.routes.js";
import { marketplaceRoutes } from "./modules/marketplace/marketplace.routes.js";
import { packsAdminRoutes } from "./modules/packs/packs.admin.routes.js";
import { activityRoutes } from "./modules/activity/activity.routes.js";
import { categoriesRoutes } from "./modules/categories/categories.routes.js";
import { walletRoutes } from "./modules/wallet/wallet.routes.js";
import { dropSocketRoutes } from "./modules/packs/dropSocket.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    genReqId: () => randomUUID(),
    requestIdHeader: "x-request-id",
  });
  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  await app.register(corsPlugin);
  await app.register(swaggerPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(websocketPlugin);

  // Public — browsable without a session.
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(packsRoutes);
  await app.register(itemsRoutes);
  await app.register(activityRoutes);
  await app.register(categoriesRoutes);
  await app.register(dropSocketRoutes);

  // Requires a valid app session (see modules/auth — not Supabase).
  await app.register(profileRoutes);
  await app.register(usernameRoutes);
  await app.register(purchaseRoutes);
  await app.register(portfolioRoutes);
  await app.register(walletRoutes);

  // Mixed — browsing listings is public (like /packs), listing/delisting/buying require a session.
  await app.register(marketplaceRoutes);

  // Admin only — requires profiles.is_admin, not just a valid session.
  await app.register(packsAdminRoutes);

  return app;
}
