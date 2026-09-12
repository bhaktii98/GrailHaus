import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRevealPickerStore } from "../state/revealPickerStore";
import { useCategoriesViewModel } from "../viewmodels/useCategoriesViewModel";
import { navigateToWorld } from "../navigation/navigationRef";
import { accents, fonts, ink, spacing } from "../theme/tokens";

/**
 * What the tab bar's raised "Reveal" button opens — not the actual mid-purchase Reveal screen
 * (AppNavigator.tsx's own comment explains why that was pulled off the tab bar: "it's only ever
 * meaningful mid-purchase... as a pushed screen it now pops back... instead of leaving an idle
 * empty tab"). A category picker never has that problem — there's always something to show —
 * which is why this is the sheet that slot opens instead of reviving the old screen-as-tab.
 *
 * Navigates via `navigateToWorld` (a navigationRef helper, not a screen-local `navigation` prop):
 * this sheet is mounted once at the tab-bar level (see RootTabs.tsx) so it can open regardless of
 * which tab is currently focused, and nothing at that level has an ordinary navigation prop to
 * call `.navigate` on.
 */
export function RevealPickerSheet() {
  const visible = useRevealPickerStore((s) => s.visible);
  const close = useRevealPickerStore((s) => s.close);
  const { categories } = useCategoriesViewModel();

  function handlePick(categoryId: string) {
    close();
    navigateToWorld(categoryId);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.eyebrow}>REVEAL</Text>
          <Text style={styles.title}>What are you opening?</Text>
          <View style={styles.rows}>
            {categories.map((c) => {
              const accent = accents[c.id as keyof typeof accents] ?? accents.cards;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => handlePick(c.id)}
                  style={[styles.row, { borderColor: `${accent.top}55` }]}
                >
                  <View style={[styles.dot, { backgroundColor: accent.top }]} />
                  <Text style={styles.rowLabel}>{c.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,3,14,0.72)" },
  sheet: {
    backgroundColor: "#171029",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.24)",
    alignSelf: "center",
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
    marginTop: spacing.lg,
  },
  title: { fontFamily: fonts.black, fontSize: 22, color: ink.text, marginTop: 6 },
  rows: { gap: spacing.md, marginTop: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 60,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { flex: 1, fontFamily: fonts.extrabold, fontSize: 15, color: ink.text },
});
