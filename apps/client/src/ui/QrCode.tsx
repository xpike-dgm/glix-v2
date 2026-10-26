import { createMemo, Show } from "solid-js";
import { encodeQr, qrPath } from "./qr.js";

/**
 * Metni QR olarak çizer. Beyaz zemin ve 4 modüllük sessiz bölge her zaman vardır
 * (karanlık temada bile telefon kameraları okuyabilsin diye). Sığmayan metinde hiçbir şey çizilmez.
 */
export function QrCode(props: { text: string; label: string; class?: string }) {
  const art = createMemo(() => {
    const m = encodeQr(props.text);
    return m ? qrPath(m) : null;
  });
  return (
    <Show when={art()} keyed>
      {(a) => (
        <svg
          class={`qr ${props.class ?? ""}`}
          viewBox={`0 0 ${a.size} ${a.size}`}
          role="img"
          aria-label={props.label}
          shape-rendering="crispEdges"
        >
          <rect width={a.size} height={a.size} fill="#ffffff" />
          <path d={a.d} fill="#000000" />
        </svg>
      )}
    </Show>
  );
}
