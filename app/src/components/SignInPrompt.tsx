import { StyleSheet, Text, View } from "react-native";
import { GlossyButton } from "./GlossyButton";
import { useAuthStore } from "../state/authStore";
import { typography } from "../theme/tokens";

/**
 * Dropped into any screen whose data requires being signed in (Portfolio, "My Listings", …).
 * Guest browsing never fires the underlying authenticated request for that data — the screen's
 * own viewmodel gates the query on `isSignedIn` instead — this is what renders in its place,
 * handing off to the same on-demand auth sheet every purchase/sell action already uses.
 */
export function SignInPrompt({ title, body, ctaLabel = "SIGN IN" }: { title: string; body: string; ctaLabel?: string }) {
  const requireAuth = useAuthStore((s) => s.requireAuth);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.button}>
        <GlossyButton label={ctaLabel} onPress={() => requireAuth(() => {})} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 32, marginTop: 60, gap: 10 },
  title: { ...typography.title, textAlign: "center", color: "#fff" },
  body: { ...typography.sectionSub, textAlign: "center" },
  button: { width: "100%", marginTop: 14 },
});
