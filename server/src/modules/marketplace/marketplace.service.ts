import { Decimal } from "decimal.js";
import type { Category, Listing, RarityTierLevel } from "@grailhaus/shared";
import { pool } from "../../db/pool.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.js";
import { toItemDetail } from "../items/items.service.js";
import type { ItemDetailRow } from "../items/items.types.js";
import {
  creditSeller,
  debitBuyer,
  delistListing,
  findActiveListings,
  findListingsBySeller,
  findListingWithPartiesById,
  findOwnedItemOwner,
  getFeePercentForCategoryTier,
  insertListing,
  lockBuyerBalance,
  lockListingForBuy,
  markListingSold,
  transferOwnership,
  updateListingPrice,
} from "./marketplace.repository.js";
import type { ListingWithPartiesRow } from "./marketplace.types.js";

export interface BuyOutcome {
  status: "completed" | "failed";
  failureReason: "already_sold" | "delisted" | "insufficient_funds" | null;
  listing: Listing;
}

/** Integer-cents fee split via Decimal, per PRD §41 — never plain float math on money. */
function splitFee(priceCents: number, feePercent: number): { feeCents: number; sellerProceedsCents: number } {
  const feeCents = new Decimal(priceCents).times(feePercent).dividedBy(100).round().toNumber();
  return { feeCents, sellerProceedsCents: priceCents - feeCents };
}

function toListing(row: ListingWithPartiesRow): Listing {
  const itemRow: ItemDetailRow = {
    id: row.item_id,
    pack_id: row.item_pack_id,
    category: row.category,
    name: row.name,
    rarity_tier_level: row.rarity_tier_level,
    texture_url: row.texture_url,
    base_value_cents: row.base_value_cents,
    collection: row.collection,
    tagline: row.tagline,
    traits: row.traits,
    pokemon_name: row.pokemon_name,
    card_title: row.card_title,
    pokemon_type: row.pokemon_type,
    generation: row.generation,
    pokedex_number: row.pokedex_number,
    watch_name: row.watch_name,
    model_name: row.model_name,
    brand: row.brand,
    style: row.style,
    case_material: row.case_material,
    dial_color: row.dial_color,
    movement: row.movement,
    case_size: row.case_size,
  };

  return {
    id: row.listing_id,
    ownedItemId: row.owned_item_id,
    item: toItemDetail(itemRow),
    seller: { id: row.seller_public_id, username: row.seller_username },
    buyer: row.buyer_public_id ? { id: row.buyer_public_id, username: row.buyer_username } : null,
    priceCents: Number(row.price_cents),
    status: row.status,
    feePercent: row.fee_percent != null ? Number(row.fee_percent) : null,
    feeCents: row.fee_cents != null ? Number(row.fee_cents) : null,
    sellerProceedsCents: row.seller_proceeds_cents != null ? Number(row.seller_proceeds_cents) : null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

async function getListingRowOrThrow(listingId: string): Promise<ListingWithPartiesRow> {
  const row = await findListingWithPartiesById(listingId);
  if (!row) throw new NotFoundError("Listing not found");
  return row;
}

/** `viewerId` — the caller, when they happen to be signed in; their own listings are left out
 * so Browse only ever shows things the viewer can actually buy. Anonymous callers see all. */
export async function browseListings(
  category: Category | undefined,
  limit = 50,
  offset = 0,
  viewerId?: string
): Promise<Listing[]> {
  const rows = await findActiveListings(
    category,
    Math.min(Math.max(1, limit), 200),
    Math.max(0, offset),
    viewerId
  );
  return rows.map(toListing);
}

/** The signed-in seller's own book — active first, then resolved. See `findListingsBySeller`. */
export async function myListings(
  sellerId: string,
  category: Category | undefined,
  limit = 50,
  offset = 0
): Promise<Listing[]> {
  const rows = await findListingsBySeller(
    sellerId,
    category,
    Math.min(Math.max(1, limit), 200),
    Math.max(0, offset)
  );
  return rows.map(toListing);
}

export async function getListing(listingId: string): Promise<Listing> {
  return toListing(await getListingRowOrThrow(listingId));
}

/** Estimates the split at *today's* configured rate — only meaningful while a listing is still
 * active; once sold, `Listing.feeCents`/`sellerProceedsCents` are the real, recorded numbers
 * from `markListingSold`, computed once and never recalculated. */
export async function previewFeeSplit(
  category: Category,
  rarityTierLevel: RarityTierLevel,
  priceCents: number
): Promise<{ feePercent: number; feeCents: number; sellerProceedsCents: number }> {
  const feePercent = await getFeePercentForCategoryTier(pool, category, rarityTierLevel);
  return { feePercent, ...splitFee(priceCents, feePercent) };
}

export async function createListing(sellerId: string, ownedItemId: string, priceCents: number): Promise<Listing> {
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new BadRequestError("price must be a positive whole number of cents");
  }

  const owner = await findOwnedItemOwner(ownedItemId);
  if (!owner) throw new NotFoundError("Item not found");
  if (owner.userId !== sellerId) throw new BadRequestError("You don't own that item.");

  try {
    const row = await insertListing(ownedItemId, sellerId, priceCents);
    return getListing(row.id);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError("That item is already listed.");
    }
    throw err;
  }
}

/** "Edit price" (PRD-adjacent flow: Listing Live → Edit Price/Cancel → Listing Active) — the
 * listing stays the same row, same `createdAt`, same `id`; only `price_cents` moves. No new fee
 * is locked in by this — the buyer-facing fee preview is always computed live from today's rate
 * against whatever `price_cents` currently is. */
export async function updatePrice(sellerId: string, listingId: string, priceCents: number): Promise<Listing> {
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new BadRequestError("price must be a positive whole number of cents");
  }
  const updated = await updateListingPrice(listingId, sellerId, priceCents);
  if (!updated) {
    const row = await findListingWithPartiesById(listingId);
    if (!row) throw new NotFoundError("Listing not found");
    throw new ConflictError("Couldn't update the price — it's already sold, already delisted, or not yours.");
  }
  return getListing(listingId);
}

export async function delist(sellerId: string, listingId: string): Promise<Listing> {
  const removed = await delistListing(listingId, sellerId);
  if (!removed) {
    // Distinguish "doesn't exist" from "exists but isn't yours / already resolved" for a
    // clearer error, without leaking whether a listing exists to someone who never owned it.
    const row = await findListingWithPartiesById(listingId);
    if (!row) throw new NotFoundError("Listing not found");
    throw new ConflictError("Couldn't delist — it's already sold, already delisted, or not yours.");
  }
  return getListing(listingId);
}

/**
 * The one atomic marketplace transaction (PRD §32): validate, debit buyer, credit seller,
 * collect the fee, transfer ownership, mark sold — all inside one lock on the listing row.
 * Unlike pack purchases, this needs no separate idempotency-key table: a listing is a one-shot
 * resource by construction (the unique index guarantees at most one can ever be active per
 * item), so "retry the same buy" and "this listing's current state" are the same question —
 * answered by re-reading the row under lock, not by a client-supplied key.
 */
export async function buyListing(buyerId: string, listingId: string): Promise<BuyOutcome> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const listing = await lockListingForBuy(client, listingId);
    if (!listing) {
      await client.query("ROLLBACK");
      throw new NotFoundError("Listing not found");
    }
    if (listing.seller_id === buyerId) {
      await client.query("ROLLBACK");
      throw new BadRequestError("You can't buy your own listing.");
    }

    if (listing.status !== "active") {
      await client.query("COMMIT");
      // A retry after a dropped connection lands here too — if this exact buyer already won
      // it, that's their own past success, not a failure. Only a *different* buyer (or the
      // listing having been delisted) is a real "you didn't get it."
      if (listing.status === "sold" && listing.buyer_id === buyerId) {
        return { status: "completed", failureReason: null, listing: await getListing(listingId) };
      }
      const failureReason = listing.status === "sold" ? "already_sold" : "delisted";
      return { status: "failed", failureReason, listing: await getListing(listingId) };
    }

    const priceCents = Number(listing.price_cents);
    const buyerBalance = await lockBuyerBalance(client, buyerId);
    if (buyerBalance < priceCents) {
      await client.query("ROLLBACK");
      return { status: "failed", failureReason: "insufficient_funds", listing: await getListing(listingId) };
    }

    const feePercent = await getFeePercentForCategoryTier(client, listing.category, listing.rarity_tier_level);
    const { feeCents, sellerProceedsCents } = splitFee(priceCents, feePercent);

    await debitBuyer(client, buyerId, priceCents);
    await creditSeller(client, listing.seller_id, sellerProceedsCents);
    await transferOwnership(client, listing.owned_item_id, buyerId);
    await markListingSold(client, listingId, buyerId, feePercent, feeCents, sellerProceedsCents);

    await client.query("COMMIT");
    return { status: "completed", failureReason: null, listing: await getListing(listingId) };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}
