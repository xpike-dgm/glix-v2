import { Show } from "solid-js";
import { state } from "../net/store.js";

/** Bağlantı koptuğunda yarı saydam örtü; dönünce kendiliğinden kalkar. */
export function Reconnecting() {
  // Odasız ana sayfada örtü yerine "internet yok" durumu görünür (Home).
  const onHome = () => !state.snapshot && state.nav === "home" && state.notFoundCode === null;
  const visible = () =>
    (state.conn === "connecting" || state.conn === "closed") &&
    (state.everOpen || state.failedAttempts >= 2) &&
    !onHome();
  return (
    <Show when={visible()}>
      <div class="overlay" role="alert">
        <svg class="ring" viewBox="0 0 80 80" width="84" height="84" aria-hidden="true">
          <defs>
            <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#2EF2FF" />
              <stop offset="1" stop-color="#FF2BD6" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(140,160,255,.18)" stroke-width="7" />
          <path
            d="M40 8a32 32 0 0 1 32 32"
            fill="none"
            stroke="url(#ringg)"
            stroke-width="7"
            stroke-linecap="round"
          />
        </svg>
        <p class="overlay__text">Tekrar bağlanıyor…</p>
      </div>
    </Show>
  );
}
