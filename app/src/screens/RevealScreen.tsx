import { Alert, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { OwnedItem, PulledOwnedItem } from "@grailhaus/shared";
import { usePackFlowViewModel } from "../viewmodels/usePackFlowViewModel";
import { RevealEngine } from "../engine/core/RevealEngine";
import { CardFlowEngine } from "../engine/cards/CardFlowEngine";
import { VaultBreakFlowEngine } from "../engine/cards/VaultBreakFlowEngine";
import { BatchSummaryScreen } from "../engine/cards/BatchSummaryScreen";
import { BulkRunOrchestrator } from "../engine/cards/bulk/BulkRunOrchestrator";
import { BlackLabelFlowEngine } from "../engine/cards/BlackLabelFlowEngine";
import { ScreenBackground } from "../components/ScreenBackground";
import { colors, spacing, typography } from "../theme/tokens";
import { reveal as revealCopy } from "../content/copy";
import type { AppStackParamList } from "../navigation/AppNavigator";

type Nav = NativeStackNavigationProp<AppStackParamList, "Reveal">;

/**
 * Reveal is a pushed screen, not a tab — it only exists mid-purchase, and
 * `startFlow` (usePackFlowViewModel) already navigates here right after a
 * successful buy. Tapping "done" on the summary clears the flow state AND
 * pops back to wherever the purchase started (Explore/Shelf/Drops/PackDetail
 * /DropDetail), so a finished reveal never leaves a dead-end screen behind.
 *
 * Cards purchases run through the new multi-phase `CardFlowEngine`
 * (processing → ready → rip → summary). Watches purchases TEMPORARILY still
 * render the old single-gesture `RevealEngine` — its own multi-phase
 * `VaultFlowEngine` (per the "rebuild purchase+reveal flows" plan) is a
 * later pass.
 */
export function RevealScreen() {
  const navigation = useNavigation<Nav>();
  const flow = usePackFlowViewModel();
  // "Tabs" is the root stack's own first screen (see AppNavigator) — navigating to it from a
  // pushed screen like this one pops back to it rather than pushing a duplicate, but its nested
  // tab/screen isn't expressible in AppStackParamList's types, so this jump is deliberately
  // loosely typed (same pattern ItemForkScreen already uses for the same reason).
  const rootNavigate = navigation.navigate as (name: string, params?: object) => void;

  function handleFinished() {
    flow.finishFlow();
    if (navigation.canGoBack()) navigation.goBack();
  }

  function handleGoHome() {
    flow.finishFlow();
    rootNavigate("Tabs", { screen: "Home" });
  }

  function handleViewCollection() {
    // Captured before finishFlow() clears the flow's own state. For a bulk run the whole batch
    // just landed, not merely whichever pack happens to be current — the curated presentation
    // never had a "current pack" to speak of — so highlight every item the purchase produced.
    const justAddedIds = flow.isBatch
      ? flow.packs.flat().map((i) => i.ownedItemId)
      : (flow.items?.map((i) => i.ownedItemId) ?? []);
    flow.finishFlow();
    rootNavigate("Tabs", { screen: "Portfolio", params: { screen: "Collection", params: { justAddedIds } } });
  }

  /** A genuinely new POST /purchase for the same SKU — not a client-side re-roll of the pack(s)
   * that were already on screen. Keeps the summary showing on failure (sold out, insufficient
   * funds) rather than clearing the flow out from under the user. Reused for both "Rip Another"
   * (single) and the batch summary's "Rip 10 More" — `quantity` is the only thing that differs. */
  async function handleRipAgain(quantity: 1 | 10 = 1) {
    if (!flow.sku) return;
    const result = await flow.startFlow(flow.sku, quantity);
    if (!result.ok) Alert.alert("Couldn't rip again", result.error);
  }

  function handleViewWatchDetails(owned: OwnedItem) {
    flow.finishFlow();
    rootNavigate("Tabs", { screen: "Portfolio", params: { screen: "WatchDetail", params: { owned } } });
  }

  function handleListForSale(owned: OwnedItem) {
    flow.finishFlow();
    rootNavigate("Tabs", { screen: "Portfolio", params: { screen: "SellItem", params: { owned } } });
  }

  /**
   * "List a Pull" on the batch summary — hands the run's best pull straight into the *existing*
   * marketplace listing flow, prefilled, rather than duplicating any listing logic here.
   *
   * `SellItem` takes an `OwnedItem`, so the pull is wrapped into one the same way the watches
   * post-reveal fork already does (see RevealEngine's own summary): cost basis is this purchase's
   * price split evenly across the copies it produced — floored, because the server hands the
   * sub-cent remainder to specific rows in an id order this side can't know. The authoritative
   * figure lands with the next portfolio read; the two differ by at most a cent.
   */
  function handleListPull(pull: PulledOwnedItem) {
    if (!flow.sku) return;
    const totalItems = flow.packs.flat().length;
    const totalSpendCents = flow.sku.priceCents * flow.packs.length;
    const acquiredAt = new Date().toISOString();
    handleListForSale({
      ownedItemId: pull.ownedItemId,
      item: pull,
      packId: flow.sku.id,
      purchaseId: flow.purchaseId,
      acquiredAt,
      heldSinceAt: acquiredAt,
      costBasisCents: totalItems > 0 ? Math.floor(totalSpendCents / totalItems) : null,
      acquiredVia: "pack",
      activeListing: null,
    });
  }

  if (!flow.isActive || !flow.config || !flow.sku) {
    return (
      <ScreenBackground>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{revealCopy.emptyTitle}</Text>
          <Text style={styles.emptyNote}>{revealCopy.emptyNote}</Text>
        </View>
      </ScreenBackground>
    );
  }

  // The terminal screen for a bulk (10-pack) rip — every pack in `flow.packs` has either been
  // shown or was explicitly skipped past (see usePackFlowViewModel.skipToResults), and every
  // one of their contents is still exactly what the purchase produced. Also what a device that
  // died between the last pack finishing and this screen being dismissed resumes directly onto.
  if (flow.isBatchSummary) {
    return (
      <BatchSummaryScreen
        sku={flow.sku}
        packs={flow.packs}
        isRipAgainWorking={flow.isPurchasing}
        onRipAgain={() => handleRipAgain(10)}
        onGoHome={handleGoHome}
        onViewCollection={handleViewCollection}
        onListPull={handleListPull}
      />
    );
  }

  /**
   * A bulk (10-pack) card purchase runs the curated Grail Hunt presentation instead of replaying a
   * per-pack reveal ten times: grails from every pack first (weakest → strongest), then the prime
   * grid, then the core list, then the same batch summary above.
   *
   * This is a *presentation* branch and nothing more. Both paths render the identical
   * server-generated, already-persisted `flow.packs`; the strategy only decides what order and
   * with how much ceremony those results are shown. Watches never reach it (they can't buy in
   * bulk), and a single pack never reaches it either — `strategy` is `SINGLE_PACK` whenever
   * there's one pack, so the traditional sequential rip below is completely untouched.
   */
  if (flow.strategy === "BULK_GRAIL_HUNT" && flow.bulkReveal && flow.sku.category === "cards") {
    return (
      <BulkRunOrchestrator
        sku={flow.sku}
        packs={flow.packs}
        bulkReveal={flow.bulkReveal}
        onGoToStage={(stage) => void flow.goToBulkStage(stage)}
        onAdvanceStage={() => void flow.advanceBulkStage()}
        onRevealGrail={(id) => void flow.revealGrail(id)}
        onSkipToResults={flow.skipToResults}
      />
    );
  }

  if (!flow.items) {
    return (
      <ScreenBackground>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{revealCopy.emptyTitle}</Text>
          <Text style={styles.emptyNote}>{revealCopy.emptyNote}</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (flow.sku.category === "cards") {
    // Everything below this point is the SINGLE_PACK path — a bulk run already returned above.
    // Vault Break and Black Label are the two card tiers with their own richer reveal (cards
    // physically rise out of the torn pack and fan out, with a staged rarity moment and
    // tap/drag/pinch/flip inspection) — every other tier keeps CardFlowEngine's tear + flat
    // swipe-through-cards flow. See VaultBreakFlowEngine's own header for why this started
    // scoped to just Vault Break, and BlackLabelFlowEngine's for why Black Label got the same
    // treatment rather than a third, different flow.
    if (flow.sku.tier === "vault_break") {
      return (
        <VaultBreakFlowEngine
          key={flow.purchaseId ?? undefined}
          sku={flow.sku}
          items={flow.items}
          onFinished={handleFinished}
          onRipAgain={() => handleRipAgain(1)}
          onGoHome={handleGoHome}
          onViewCollection={handleViewCollection}
          isRipAgainWorking={flow.isPurchasing}
        />
      );
    }
    if (flow.sku.tier === "black_label") {
      return (
        <BlackLabelFlowEngine
          key={flow.purchaseId ?? undefined}
          sku={flow.sku}
          items={flow.items}
          // Black Label IS bulk-eligible (see BlackLabelFlowEngine's own header) — without these
          // two, a 10-pack Black Label buy silently rendered as if it were a single pack.
          batchContext={flow.isBatch ? { index: flow.currentPackIndex, total: flow.quantity } : undefined}
          onSkipToResults={flow.isBatch ? flow.skipToResults : undefined}
          onFinished={handleFinished}
          onRipAgain={() => handleRipAgain(1)}
          onGoHome={handleGoHome}
          onViewCollection={handleViewCollection}
          isRipAgainWorking={flow.isPurchasing}
        />
      );
    }
    // Keyed by purchase id + pack index (not purchase id alone) so advancing from one pack of a
    // batch to the next always mounts a fresh instance — a batch's ten packs share one
    // purchaseId (one atomic purchase produced all of them), so without the index every pack
    // after the first would reuse pack one's already-`"summary"`-phase component instance
    // instead of starting its own tear from scratch.

    return (
      <CardFlowEngine
        key={`${flow.purchaseId ?? "none"}-${flow.currentPackIndex}`}
        sku={flow.sku}
        items={flow.items}
        config={flow.config}
        batchContext={flow.isBatch ? { index: flow.currentPackIndex, total: flow.quantity } : undefined}
        onNextPack={flow.isBatch ? () => flow.advanceBatch() : undefined}
        onSkipToResults={flow.isBatch ? flow.skipToResults : undefined}
        onFinished={handleFinished}
        onRipAgain={() => handleRipAgain(1)}
        onGoHome={handleGoHome}
        onViewCollection={handleViewCollection}
        isRipAgainWorking={flow.isPurchasing}
      />
    );
  }

  return (
    <RevealEngine
      key={flow.purchaseId ?? undefined}
      config={flow.config}
      items={flow.items}
      rarityTiers={flow.sku.rarityTiers}
      packId={flow.sku.id}
      purchaseId={flow.purchaseId}
      packPriceCents={flow.sku.priceCents}
      onViewDetails={handleViewWatchDetails}
      onKeep={handleViewCollection}
      onListForSale={handleListForSale}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: { color: colors.textPrimary, ...typography.title },
  emptyNote: { color: colors.textSecondary, ...typography.body, textAlign: "center" },
});
