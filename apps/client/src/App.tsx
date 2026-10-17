import { APP_VERSION } from "@glix/engine";
import { createSignal, onCleanup, onMount } from "solid-js";
import { type ConnectionState, connect } from "./connection.js";
import { mountHero } from "./hero.js";
import { resolveWsUrl } from "./wsUrl.js";

const STATUS_TEXT: Record<ConnectionState, string> = {
  connecting: "Bağlanıyor…",
  open: "Sunucuya bağlandı",
  closed: "Bağlantı yok",
};

export function App() {
  const [state, setState] = createSignal<ConnectionState>("connecting");
  let heroEl: HTMLDivElement | undefined;

  onMount(() => {
    const url = resolveWsUrl(window.location, import.meta.env.VITE_WS_URL, import.meta.env.DEV);
    const stop = connect(url, setState);
    let disposeHero: (() => void) | undefined;
    let gone = false;
    if (heroEl) {
      mountHero(heroEl)
        .then((d) => {
          if (gone) d();
          else disposeHero = d;
        })
        .catch(() => {
          // Pixi başlatılamazsa sahne boş kalır
        });
    }
    onCleanup(() => {
      gone = true;
      stop();
      disposeHero?.();
    });
  });

  return (
    <main class="shell">
      <h1 class="wordmark" aria-label="GLIX">
        <span class="cyan">GL</span>
        <span class="magenta">IX</span>
      </h1>
      <div class="hero" ref={heroEl} aria-hidden="true" />
      <p class="status" data-state={state()} role="status">
        <span class="dot" />
        {STATUS_TEXT[state()]}
      </p>
      <small class="version">v{APP_VERSION}</small>
    </main>
  );
}
