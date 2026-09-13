// A live drop's stock count, pushed the instant someone else claims — see server's
// dropSocket.routes.ts/dropBroadcast.ts. Deliberately a thin wrapper around the platform's own
// `WebSocket` (no socket.io/etc dependency): one small message shape, one channel per pack, no
// need for anything heavier.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const WS_URL = API_URL.replace(/^http/, "ws");

interface DropStockMessage {
  type: "stock";
  packId: string;
  stockRemaining: number;
}

function isDropStockMessage(value: unknown): value is DropStockMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "stock" &&
    typeof (value as { stockRemaining?: unknown }).stockRemaining === "number"
  );
}

/** Opens a socket for one pack's live stock updates and returns a cleanup function. Reconnects
 * on its own (a few seconds after any close/error) for as long as the caller hasn't cleaned up —
 * a drop screen can sit open for the drop's whole live window, well past any one connection's
 * natural lifetime on a mobile network. */
export function connectDropSocket(packId: string, onStockUpdate: (stockRemaining: number) => void): () => void {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function open() {
    if (stopped) return;
    socket = new WebSocket(`${WS_URL}/ws/packs/${encodeURIComponent(packId)}`);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (isDropStockMessage(data)) onStockUpdate(data.stockRemaining);
      } catch {
        // A malformed frame just gets ignored — the next real update still arrives fine.
      }
    };
    const scheduleReconnect = () => {
      if (stopped || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        open();
      }, 3000);
    };
    socket.onclose = scheduleReconnect;
    socket.onerror = scheduleReconnect;
  }

  open();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
