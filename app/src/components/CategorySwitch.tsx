import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Category } from "@grailhaus/shared";
import { typography } from "../theme/tokens";
import { useCategoriesViewModel } from "../viewmodels/useCategoriesViewModel";

/**
 * The Shelf's category segmented switch — tapping a side jumps the whole screen's register
 * (tier vocabulary, art) to that category. Segments come from the backend-driven `categories`
 * table (useCategoriesViewModel), not a hardcoded two-entry array — a category added via the
 * admin dashboard shows up here with no app change, which is the concrete "does adding handbags
 * actually reach the app" proof point for this screen specifically.
 *
 * The active pill's own gold gradient is fixed — GrailhausPacks.js's own `tabOn` treatment,
 * the same regardless of which tab is selected — rather than swapping to that category's own
 * accent, which read as the highlight itself changing identity every time you switched tabs.
 */
export function CategorySwitch({ value, onChange }: { value: Category; onChange: (category: Category) => void }) {
  const { categories, isLoading } = useCategoriesViewModel();

  if (isLoading && categories.length === 0) {
    return (
      <View style={[styles.track, styles.loadingTrack]}>
        <ActivityIndicator color="rgba(255,255,255,0.6)" />
      </View>
    );
  }

  return (
    <View style={styles.track}>
      {categories.map((category) => {
        const isActive = category.id === value;
        return (
          <Pressable key={category.id} style={styles.segment} onPress={() => onChange(category.id)}>
            {isActive ? (
              <LinearGradient
                colors={["#fbe08f", "#e0aa2e", "#b9821a"]}
                locations={[0, 0.52, 1]}
                style={styles.activePill}
              >
                <Text style={styles.activeLabel}>{category.label.toUpperCase()}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.inactiveLabel}>{category.label.toUpperCase()}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 64,
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 5,
  },
  loadingTrack: { alignItems: "center", justifyContent: "center" },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  activePill: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 0,
    elevation: 4,
  },
  activeLabel: { ...typography.switchLabel, color: "#1b1205", textAlign: "center" },
  inactiveLabel: { ...typography.switchLabel, color: "rgba(255,255,255,0.5)", textAlign: "center" },
});
