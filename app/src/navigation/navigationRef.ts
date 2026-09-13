import { createNavigationContainerRef } from "@react-navigation/native";
import type { Category } from "@grailhaus/shared";
import type { AppStackParamList } from "./AppNavigator";

/**
 * A ref onto the root NavigationContainer (attached in App.tsx), so app-shell code that isn't
 * itself a screen — most notably the boot/foreground reveal-resume check in App.tsx — can push
 * the Reveal screen without needing a navigation prop. Type-only import of AppStackParamList
 * keeps this from creating a runtime cycle with AppNavigator.tsx.
 */
export const navigationRef = createNavigationContainerRef<AppStackParamList>();

/**
 * Safe to call before the container has mounted (e.g. a resume check that finishes while the
 * splash screen is still up) — silently does nothing rather than throwing; App.tsx's
 * `onReady` callback covers that race by re-checking for a resumed flow once the container
 * actually comes up. Also safe to call more than once for the same resume (the boot effect and
 * `onReady` can both fire close together) — a no-op once Reveal is already the front screen,
 * rather than pushing a duplicate.
 */
export function navigateToReveal(): void {
  if (!navigationRef.isReady()) return;
  if (navigationRef.getCurrentRoute()?.name === "Reveal") return;
  navigationRef.navigate("Reveal");
}

/**
 * Pushes Home's "World" screen (the category-scoped pack shelf) for `category`, from wherever the
 * tap actually happened — the tab bar's "Reveal" quick-launch button, most notably, which sits
 * above every tab and has no screen-local navigation prop of its own. "World" is only registered
 * under HomeStack (see HomeStack.tsx), so this needs the same nested `{screen, params}` shape a
 * screen-prop `navigation.navigate("Home", { screen: "World", params: { category } })` call would
 * use — `as never` because `AppStackParamList` only knows about the top-level "Tabs" route, not
 * what's nested two navigators deep inside it.
 */
export function navigateToWorld(category: Category): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(
    "Tabs",
    { screen: "Home", params: { screen: "World", params: { category } } } as never
  );
}
