import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { useAuthViewModel, type AuthStep } from "../viewmodels/useAuthViewModel";
import { GlossyButton } from "../components/GlossyButton";
import { ScreenBackground } from "../components/ScreenBackground";
import { AuthGem } from "../components/AuthGem";
import { accent, colors, radii, spacing, typography } from "../theme/tokens";
import { auth as authCopy } from "../content/copy";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BACK_TARGET: Partial<Record<AuthStep, AuthStep>> = {
  register: "welcome",
  signin: "welcome",
};

export function AuthScreen({ onClose, initialStep }: { onClose?: () => void; initialStep?: AuthStep }) {
  const auth = useAuthViewModel(initialStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const backTarget = BACK_TARGET[auth.step];
  const showClose = onClose && auth.step !== "claim-username";
  const shownError = validationError ?? auth.error;

  function validEmail(value: string) {
    setValidationError(null);
    if (!EMAIL_PATTERN.test(value.trim())) {
      setValidationError(authCopy.emailInvalid);
      return false;
    }
    return true;
  }

  return (
    <ScreenBackground>
      <View style={styles.container}>
        {backTarget && (
          <Pressable style={styles.back} onPress={() => auth.goTo(backTarget)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
        )}
        {showClose && (
          <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>{authCopy.close}</Text>
          </Pressable>
        )}

        {auth.step === "welcome" && (
          <View style={styles.centerFill}>
            <AuthGem />
            <Text style={styles.wordmark}>{authCopy.welcomeTitle}</Text>
            <Text style={styles.tagline}>{authCopy.welcomeTagline}</Text>
            <View style={styles.welcomeActions}>
              <GlossyButton label={authCopy.createAccount} onPress={() => auth.goTo("register")} variant="violet" />
              <Pressable style={styles.linkRow} onPress={() => auth.goTo("signin")}>
                <Text style={styles.linkMuted}>
                  {authCopy.alreadyCollecting} <Text style={styles.link}>{authCopy.signInLink}</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {auth.step === "register" && (
          <>
            <Text style={styles.title}>{authCopy.registerTitle}</Text>
            <Text style={styles.subtitle}>{authCopy.registerSubtitle}</Text>

            <Field
              label={authCopy.emailLabel}
              value={email}
              onChangeText={setEmail}
              placeholder={authCopy.emailPlaceholder}
              keyboardType="email-address"
              autoComplete="email"
            />
            <Field
              label={authCopy.passwordLabel}
              value={password}
              onChangeText={setPassword}
              placeholder={authCopy.passwordPlaceholder}
              secureTextEntry
              autoComplete="new-password"
            />
            <Field
              label={authCopy.confirmPasswordLabel}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={authCopy.confirmPasswordPlaceholder}
              secureTextEntry
              autoComplete="new-password"
            />
            {shownError && <Text style={styles.error}>{shownError}</Text>}

            <GlossyButton
              label={authCopy.createAccountCta}
              onPress={() => {
                if (validEmail(email)) auth.register(email, password, confirmPassword);
              }}
              disabled={!email || !password || !confirmPassword}
              loading={auth.isSubmitting}
              variant="violet"
            />
            <Pressable style={styles.linkRow} onPress={() => auth.goTo("signin")}>
              <Text style={styles.linkMuted}>
                {authCopy.alreadyCollecting} <Text style={styles.link}>{authCopy.signInLink}</Text>
              </Text>
            </Pressable>
          </>
        )}

        {auth.step === "signin" && (
          <>
            <Text style={styles.title}>{authCopy.signInTitle}</Text>
            <Text style={styles.subtitle}>{authCopy.signInSubtitle}</Text>

            <Field
              label={authCopy.emailLabel}
              value={email}
              onChangeText={setEmail}
              placeholder={authCopy.emailPlaceholder}
              keyboardType="email-address"
              autoComplete="email"
            />
            <Field
              label={authCopy.passwordLabel}
              value={password}
              onChangeText={setPassword}
              placeholder={authCopy.passwordPlaceholder}
              secureTextEntry
              autoComplete="password"
            />
            {shownError && <Text style={styles.error}>{shownError}</Text>}

            <GlossyButton
              label={authCopy.signInCta}
              onPress={() => {
                if (validEmail(email)) auth.signIn(email, password);
              }}
              disabled={!email || !password}
              loading={auth.isSubmitting}
              variant="violet"
            />
            <Pressable style={styles.linkRow} onPress={() => auth.goTo("register")}>
              <Text style={styles.linkMuted}>
                {authCopy.noAccount} <Text style={styles.link}>{authCopy.createAccount}</Text>
              </Text>
            </Pressable>
          </>
        )}

        {auth.step === "claim-username" && (
          <View style={styles.centerFill}>
            <Text style={styles.title}>{authCopy.claimTitle}</Text>
            <Text style={[styles.subtitle, styles.centerText]}>{authCopy.claimSubtitle}</Text>

            <View style={styles.handleRow}>
              <Text style={styles.handleAt}>@</Text>
              <TextInput
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  auth.checkUsername(value);
                }}
                placeholder={authCopy.usernamePlaceholder}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.handleInput}
                autoFocus
              />
            </View>
            <UsernameStatusLine status={auth.usernameStatus} />
            {auth.error && <Text style={styles.error}>{auth.error}</Text>}

            <GlossyButton
              label={authCopy.claimCta}
              onPress={() => auth.claimUsername(username)}
              disabled={auth.usernameStatus !== "available"}
              loading={auth.isSubmitting}
              variant="violet"
            />
          </View>
        )}

        {auth.step === "welcome-back" && (
          <View style={styles.centerFill}>
            <View style={styles.bloom} pointerEvents="none">
              <Svg width={360} height={360}>
                <Defs>
                  <RadialGradient id="wbBloom" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={accent.cards.c1} stopOpacity="0.34" />
                    <Stop offset="0.5" stopColor={accent.cards.c2} stopOpacity="0.16" />
                    <Stop offset="1" stopColor={accent.cards.c2} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect width={360} height={360} fill="url(#wbBloom)" />
              </Svg>
            </View>

            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.successBadgeText}>{authCopy.welcomeBackEyebrow}</Text>
            </View>

            <AuthGem size={156} />
            <Text style={styles.wordmark}>{authCopy.welcomeBackTitle(auth.claimedUsername ?? "")}</Text>
            <Text style={styles.tagline}>{authCopy.welcomeBackBody}</Text>

            <View style={styles.welcomeActions}>
              <GlossyButton label={authCopy.enterGrailhaus} onPress={auth.finish} variant="violet" />
            </View>
          </View>
        )}
      </View>
    </ScreenBackground>
  );
}

function Field({
  label,
  ...inputProps
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input} {...inputProps} />
    </View>
  );
}

function UsernameStatusLine({ status }: { status: "idle" | "checking" | "available" | "taken" | "invalid" }) {
  if (status === "idle") return <View style={styles.usernameStatusSpacer} />;
  const text =
    status === "checking"
      ? authCopy.usernameChecking
      : status === "available"
        ? authCopy.usernameAvailable
        : status === "taken"
          ? authCopy.usernameTaken
          : authCopy.usernameInvalid;
  return (
    <Text
      style={[
        styles.usernameStatus,
        status === "available" && styles.usernameStatusOk,
        (status === "taken" || status === "invalid") && styles.usernameStatusBad,
      ]}
    >
      {status === "checking" ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
      {status === "available" ? <Ionicons name="checkmark-circle" size={14} color={colors.success} /> : null} {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  back: { position: "absolute", top: spacing.xl, left: spacing.xl, zIndex: 1 },
  close: { position: "absolute", top: spacing.xl, right: spacing.xl, zIndex: 1 },
  closeText: { color: colors.textMuted, ...typography.body },

  wordmark: { color: colors.textPrimary, ...typography.display, fontSize: 34, marginTop: spacing.lg, textAlign: "center" },
  tagline: { color: colors.textSecondary, ...typography.body, textAlign: "center", marginBottom: spacing.lg },
  welcomeActions: { width: "100%", gap: spacing.lg, marginTop: spacing.md },

  bloom: { position: "absolute", alignSelf: "center" },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(99,232,92,0.14)",
    borderWidth: 1,
    borderColor: "rgba(99,232,92,0.32)",
    marginBottom: spacing.sm,
  },
  successBadgeText: {
    color: colors.success,
    ...typography.caption,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  title: { color: colors.textPrimary, ...typography.display, marginBottom: spacing.xs },
  subtitle: { color: colors.textSecondary, ...typography.body, marginBottom: spacing.xl },
  centerText: { textAlign: "center" },

  field: { marginBottom: spacing.md },
  fieldLabel: { color: colors.textSecondary, ...typography.caption, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },

  error: { color: colors.danger, ...typography.caption, marginBottom: spacing.sm },
  link: { color: colors.violetTop },
  linkMuted: { color: colors.textMuted, ...typography.body },
  linkRow: { marginTop: spacing.xl, alignSelf: "center" },

  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    width: "100%",
  },
  handleAt: { color: colors.textMuted, ...typography.title, marginRight: spacing.xs },
  handleInput: { flex: 1, color: colors.textPrimary, ...typography.title, paddingVertical: spacing.md },
  usernameStatus: { color: colors.textMuted, ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.lg },
  usernameStatusOk: { color: colors.success },
  usernameStatusBad: { color: colors.danger },
  usernameStatusSpacer: { height: 12 + spacing.sm + spacing.lg },
});
