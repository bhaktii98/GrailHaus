import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/authService";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { ScreenBackground } from "../components/ScreenBackground";
import { accents, colors, radii, shadow, spacing, typography } from "../theme/tokens";
import { account as copy } from "../content/copy";

/** The signed-in counterpart to AuthScreen — reachable from Home's header account icon
 * (see HomeScreen). Its one real job is giving a signed-in user an actual way to sign out:
 * `authService.signOut()` already existed and worked, but nothing in the app called it. */
export function AccountScreen({ onClose }: { onClose: () => void }) {
  const session = useSessionViewModel();

  function confirmSignOut() {
    Alert.alert(copy.signOutConfirmTitle, copy.signOutConfirmBody, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.signOutConfirmCta,
        style: "destructive",
        onPress: async () => {
          await authService.signOut();
          onClose();
        },
      },
    ]);
  }

  const memberSince = session.profile?.createdAt
    ? new Date(session.profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <ScreenBackground>
      <LinearGradient pointerEvents="none" colors={["rgba(177,75,255,0.18)", "transparent"]} style={styles.wash} />

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.centerFill}>
          <LinearGradient colors={[accents.cards.top, accents.cards.bottom]} style={[styles.avatarRing, shadow.glow(accents.cards.glow)]}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={colors.textPrimary} />
            </View>
          </LinearGradient>
          <Text style={styles.username}>@{session.profile?.username ?? "…"}</Text>
          {memberSince && <Text style={styles.memberSince}>{copy.memberSince(memberSince)}</Text>}

          {session.balanceCents != null && (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>{copy.balance}</Text>
              <Text style={styles.balanceValue}>${(session.balanceCents / 100).toLocaleString()}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.signOut} onPress={confirmSignOut} hitSlop={12}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>{copy.signOut}</Text>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  wash: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  headerTitle: { color: colors.textPrimary, ...typography.title, fontSize: 15 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { color: colors.textPrimary, ...typography.display, fontSize: 22 },
  memberSince: { color: colors.textMuted, ...typography.body, marginTop: spacing.xs },

  balanceCard: {
    marginTop: spacing.xl,
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineSoft,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  balanceLabel: { color: colors.textMuted, ...typography.caption },
  balanceValue: { color: colors.textPrimary, ...typography.display, fontSize: 26, marginTop: spacing.xs },

  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    alignSelf: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  signOutText: { color: colors.danger, ...typography.body },
});
