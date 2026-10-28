import { type CosmeticItem, type Cosmetics, cosmeticItem } from "@glix/engine";
import { Show } from "solid-js";

/** Katalogdaki ürünü ve türünü doğrular; bilinmeyen kimlik ya da yanlış tür yok sayılır (ağdan gelen veri). */
function pick(id: string | undefined, type: CosmeticItem["type"]): CosmeticItem | null {
  if (id === undefined) return null;
  const it = cosmeticItem(id);
  return it && it.type === type ? it : null;
}

/** Avatar çerçevesi kimliği (geçerliyse). */
export const frameOf = (c: Cosmetics | undefined): string | undefined => pick(c?.frame, "cerceve")?.id;

/** Oyuncu adı: ad efekti varsa stillenir; yoksa düz metin (ek kutu yok denecek kadar hafif). */
export function PlayerName(props: { name: string; cosmetics?: Cosmetics | undefined }) {
  const fx = () => pick(props.cosmetics?.nameFx, "ad-efekti");
  return (
    <Show when={fx()} fallback={props.name}>
      {(it) => (
        <span class="cos-name" data-fx={it().id}>
          {props.name}
        </span>
      )}
    </Show>
  );
}

/** Adın altındaki unvan; yoksa hiçbir şey çizilmez. Uzunsa kesilir. */
export function PlayerTitle(props: { cosmetics?: Cosmetics | undefined; class?: string }) {
  const t = () => pick(props.cosmetics?.title, "unvan");
  return (
    <Show when={t()}>
      {(it) => (
        <span class={`cos-title ${props.class ?? ""}`} data-r={it().rarity}>
          {it().name}
        </span>
      )}
    </Show>
  );
}
