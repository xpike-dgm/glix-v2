/** Rus Ruleti koltuk simgeleri (süs; ekran okuyucuya gizli). */

/** RR-M1: az önce sana sıkan; kilit. */
export function LockIcon() {
  return (
    <svg class="rr-ico" viewBox="0 0 24 24" aria-hidden="true">
      <title>Kilitli</title>
      <rect x="5" y="10" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="2.4" />
    </svg>
  );
}

/** RR-U15: bağlantısı kopuk oyuncu: fiş. */
export function PlugIcon() {
  return (
    <svg class="rr-ico" viewBox="0 0 24 24" aria-hidden="true">
      <title>Bağlantı yok</title>
      <path
        d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** RR-U2: kurukafa (dolu: elenen, boş: kalan elenme). */
export function SkullIcon(props: { filled: boolean }) {
  return (
    <svg class="rr-skull" data-filled={props.filled ? "1" : undefined} viewBox="0 0 24 24" aria-hidden="true">
      <title>Elenme</title>
      <path
        d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.2 4.4 2.8 5.5V19a1.5 1.5 0 0 0 1.5 1.5h7.4a1.5 1.5 0 0 0 1.5-1.5v-3.4c1.6-1.1 2.8-2.9 2.8-5.5 0-4.4-3.3-7.6-8-7.6z"
        class="rr-skull__head"
      />
      <circle cx="8.8" cy="11" r="2" class="rr-skull__eye" />
      <circle cx="15.2" cy="11" r="2" class="rr-skull__eye" />
      <path d="M10.5 17v2.5M13.5 17v2.5" class="rr-skull__teeth" />
    </svg>
  );
}
