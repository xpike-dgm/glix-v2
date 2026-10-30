import { createSignal, Show } from "solid-js";
import { ALISVERIS_PROP_FILES, alisverisPropExists, type PropPath, propSrc } from "../../ui/props.js";
import { productInitials } from "./view.js";

/** Yüklenemeyen ürün görselleri (henüz üretilmemiş): bir kez denenir, sonra doğrudan yer tutucu çizilir. */
const missing = new Set<string>();

/** Ürün görselinin adresi; havuz dışı numarada yok. */
export function urunSrc(id: number): string | null {
  const file = ALISVERIS_PROP_FILES[id];
  // Derlemede dosyası olmayan (henüz üretilmemiş) ürün için istek atılmaz: doğrudan yer tutucu.
  return file && alisverisPropExists(file) ? propSrc(`gizli-alisveris/${file}` as PropPath) : null;
}

/**
 * Ürün simgesi: kimliğe karşılık gelen ürün görseli. Görsel dosyası yoksa (yeni ürünler) ürünün baş harflerini
 * taşıyan neon bir kutu siluet çizilir; dosya eklenince kod değişmeden görsel kullanılır.
 */
export function UrunArt(props: { id: number; name: string; decorative?: boolean }) {
  const src = () => urunSrc(props.id);
  const [failed, setFailed] = createSignal(false);
  const broken = () => failed() || src() === null || missing.has(src() ?? "");
  return (
    <Show
      when={!broken()}
      fallback={
        <span
          class="uart uart--ph"
          style={{ "--h": `${(props.id * 47) % 360}deg` }}
          role="img"
          aria-label={props.decorative ? undefined : props.name}
          aria-hidden={props.decorative ? "true" : undefined}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M10 18 L24 10 L38 18 L38 34 L24 42 L10 34 Z" class="uart__box" />
            <path d="M10 18 L24 26 L38 18 M24 26 L24 42" class="uart__edge" />
          </svg>
          <b>{productInitials(props.name)}</b>
        </span>
      }
    >
      <img
        class="uart"
        src={src() ?? ""}
        alt={props.decorative ? "" : props.name}
        draggable={false}
        width="384"
        height="384"
        onError={() => {
          const s = src();
          if (s) missing.add(s);
          setFailed(true);
        }}
      />
    </Show>
  );
}
