import { type CosmeticItem, type Cosmetics, cosmeticItem } from "@glix/engine";
import { Show } from "solid-js";
import { FxParticles } from "./Effects.js";
import { effectOf, nameFxLook } from "./effects.js";
import { plateSrc } from "./shopArt.js";

/** Katalogdaki ürünü ve türünü doğrular; bilinmeyen kimlik ya da yanlış tür yok sayılır (ağdan gelen veri). */
function pick(id: string | undefined, type: CosmeticItem["type"]): CosmeticItem | null {
  if (id === undefined) return null;
  const it = cosmeticItem(id);
  return it && it.type === type ? it : null;
}

/** Avatar çerçevesi kimliği (geçerliyse). */
export const frameOf = (c: Cosmetics | undefined): string | undefined => pick(c?.frame, "cerceve")?.id;

/**
 * Oyuncu adı: ad efekti varsa ürünün efekt tarifiyle (MG-4) stillenir; yoksa düz metin (ek kutu yok denecek kadar
 * hafif). Tarif geçersizse ad düz yazılır.
 */
export function PlayerName(props: { name: string; cosmetics?: Cosmetics | undefined }) {
  const fx = () => {
    const it = pick(props.cosmetics?.nameFx, "ad-efekti");
    const e = effectOf(it);
    return it && e ? { id: it.id, look: nameFxLook(e) } : null;
  };
  return (
    <Show when={fx()} fallback={props.name}>
      {(f) => (
        <span class={`cos-name ${f().look.class}`} data-fx={f().id} style={f().look.style}>
          {props.name}
          <Show when={f().look.particles} keyed>
            {(e) => <FxParticles effect={e} shape="box" />}
          </Show>
        </span>
      )}
    </Show>
  );
}

/**
 * Adın altındaki unvan; yoksa hiçbir şey çizilmez. `plate`: nadirliğe uygun levha üzerinde ortalı yazı
 * (mağaza, dolap, profil gibi belirgin yerler); varsayılan küçük düz metin (koltuk, satır).
 */
export function PlayerTitle(props: {
  cosmetics?: Cosmetics | undefined;
  class?: string;
  plate?: boolean | undefined;
}) {
  const t = () => pick(props.cosmetics?.title, "unvan");
  return (
    <Show when={t()}>
      {(it) => (
        <Show
          when={props.plate}
          fallback={
            <span class={`cos-title ${props.class ?? ""}`} data-r={it().rarity}>
              {it().name}
            </span>
          }
        >
          <TitlePlate item={it()} class={props.class} />
        </Show>
      )}
    </Show>
  );
}

/** Unvan levhası: 512x128 görsel, yazı ortada (nadirliğe göre renk). */
export function TitlePlate(props: { item: CosmeticItem; class?: string | undefined }) {
  return (
    <span
      class={`cos-plate ${props.class ?? ""}`}
      data-r={props.item.rarity}
      style={{ "background-image": `url(${plateSrc(props.item.rarity)})` }}
    >
      <span class="cos-plate__t">{props.item.name}</span>
    </span>
  );
}

/** Levhasız boş unvan yeri ("Yok"): kesik çizgili levha. */
export const EmptyPlate = () => <span class="cos-plate cos-plate--empty" aria-hidden="true" />;
