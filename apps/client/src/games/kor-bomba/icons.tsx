/** Kör Bomba koltuk simgeleri (süs; ekran okuyucuya gizli). */

/** Kopuk oyuncu: fiş. */
export function PlugIcon() {
  return (
    <svg class="kbo-ico" viewBox="0 0 24 24" aria-hidden="true">
      <title>Kopuk</title>
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

/** Az önce atan: geri ok ve çarpı. */
export function NoReturnIcon() {
  return (
    <svg class="kbo-ico" viewBox="0 0 24 24" aria-hidden="true">
      <title>Geri verilemez</title>
      <path
        d="M9 7 4 11l5 4M4 11h9a6 6 0 0 1 6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M15 3l6 6M21 3l-6 6" stroke="#ff3b5c" stroke-width="2.4" stroke-linecap="round" />
    </svg>
  );
}

/** Pas verilebilir: dokunan parmak. */
export function TapIcon() {
  return (
    <svg class="kbo-ico" viewBox="0 0 24 24" aria-hidden="true">
      <title>Dokun</title>
      <path
        d="M10 12V5.5a1.5 1.5 0 0 1 3 0V11l4.2.9a2 2 0 0 1 1.6 2.3l-.8 4.6A2.5 2.5 0 0 1 15.5 21h-4a3 3 0 0 1-2.4-1.2L5.6 15a1.5 1.5 0 0 1 2.2-2z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Taşıyıcı rozeti (BM-U16): küçük bomba. */
export function BombBadge() {
  return (
    <svg class="kbo-ico" viewBox="0 0 24 24" aria-hidden="true">
      <title>Bomba</title>
      <circle cx="11" cy="14" r="7" fill="#05060d" stroke="#ff3b5c" stroke-width="2" />
      <path d="M15 8l3-3" stroke="#ffc23b" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="19.5" cy="4" r="1.8" fill="#ffc23b" />
    </svg>
  );
}
