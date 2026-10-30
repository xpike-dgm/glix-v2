import { type Accessor, createSignal } from "solid-js";
import { type PropPath, propSrc } from "../../ui/props.js";

/**
 * Henüz üretilmemiş olabilecek görseller (ziyafet masası, mum). Dosya yerindeyse kullanılır; yoksa ekran CSS/SVG
 * karşılığıyla çizilir. Her görsel oturumda bir kez denenir; yüklenemezse sessizce CSS'e kalınır.
 */
export type OptionalArt = Extract<PropPath, "zehirli-kadeh/masa" | "zehirli-kadeh/mum">;

const probes = new Map<OptionalArt, Accessor<boolean>>();

export function optionalArt(path: OptionalArt): Accessor<boolean> {
  const known = probes.get(path);
  if (known) return known;
  const [ready, setReady] = createSignal(false);
  probes.set(path, ready);
  if (typeof Image !== "undefined") {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setReady(img.naturalWidth > 0);
    img.onerror = () => setReady(false);
    img.src = propSrc(path);
  }
  return ready;
}

/** CSS `background-image` için adres; görsel yoksa `none`. */
export const artUrl = (path: OptionalArt, ok: boolean): string => (ok ? `url("${propSrc(path)}")` : "none");
