import { Component, type ReactNode } from "react";
import {
  getRenderer3DCapability,
  markRenderer3DSupported,
  markRenderer3DUnsupported,
  subscribeRenderer3DCapability,
} from "./rendererCapability";

interface Props {
  /** The real r3f/expo-gl <Canvas>...</Canvas> subtree. */
  children: ReactNode;
  /** The 2D reveal to show instead — same visual beat, no GPU 3D context required. */
  fallback: ReactNode;
}

interface State {
  broken: boolean;
}

/**
 * Renders the 3D reveal, but never lets a broken one reach the user as a white screen or a
 * frozen gesture. If mounting/rendering the 3D subtree throws (missing native module, expo-gl
 * context creation failure, an r3f reconciler error — the actual failure mode this was built
 * for, seen on-device on iOS), componentDidCatch swaps to the 2D fallback and remembers it for
 * the rest of the session via rendererCapability.ts, so no later reveal even attempts 3D again.
 *
 * A previously-failed session skips the 3D attempt entirely on mount (getRenderer3DCapability()
 * already false) — rendering `fallback` directly rather than remounting a subtree already known
 * to break, which would otherwise re-throw (and re-warn) on every single rip.
 *
 * Also subscribed to rendererCapability's live notification: a device that mounts 3D without
 * throwing but logs one of the known-bad GL warnings (silent degradation — nothing for
 * componentDidCatch to see) still gets swapped to `fallback` immediately, mid-scene, not just on
 * the next reveal's mount.
 */
export class Renderer3DBoundary extends Component<Props, State> {
  private unsubscribe: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { broken: getRenderer3DCapability() === false };
  }

  static getDerivedStateFromError(): State {
    return { broken: true };
  }

  componentDidCatch(error: unknown) {
    markRenderer3DUnsupported(error);
  }

  componentDidMount() {
    if (!this.state.broken) markRenderer3DSupported();
    this.unsubscribe = subscribeRenderer3DCapability(() => {
      if (!this.state.broken) this.setState({ broken: true });
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  render() {
    return this.state.broken ? this.props.fallback : this.props.children;
  }
}
