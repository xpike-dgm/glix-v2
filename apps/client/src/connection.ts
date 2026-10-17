import { APP_VERSION, type ServerMessage } from "@glix/engine";

export type ConnectionState = "connecting" | "open" | "closed";

/** Sunucuya bağlanır, kapanırsa artan beklemeyle yeniden dener. Durdurma işlevi döner. */
export function connect(url: string, onState: (s: ConnectionState) => void): () => void {
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let stopped = false;

  const open = (): void => {
    onState("connecting");
    const sock = new WebSocket(url);
    ws = sock;
    sock.onopen = () => sock.send(JSON.stringify({ type: "hello", clientVersion: APP_VERSION }));
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMessage;
        if (msg.type === "welcome") {
          attempt = 0;
          onState("open");
        }
      } catch {
        // geçersiz mesaj yok sayılır
      }
    };
    sock.onclose = () => {
      if (stopped) return;
      onState("closed");
      attempt += 1;
      timer = setTimeout(open, Math.min(1000 * 2 ** (attempt - 1), 10_000));
    };
  };
  open();

  return () => {
    stopped = true;
    clearTimeout(timer);
    ws?.close();
  };
}
