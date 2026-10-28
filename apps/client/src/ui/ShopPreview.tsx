import { CELEBRATION_SPRITES, type CosmeticItem, STICKERS_PER_PACK } from "@glix/engine";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { playCelebration } from "../fx/celebration.js";
import { Avatar } from "./Avatar.js";
import { COLLAGE_STICKERS } from "./artItems.js";
import { cardBackSrc, DEFAULT_CARD_BACK_SRC, entryLayers, packStickerSrc } from "./shopArt.js";

/** Kart arkası görseli (480x720, kartın kendi köşe yuvarlaklığıyla); `item` yoksa klasik sırt. */
export function CardBackArt(props: { item?: CosmeticItem | undefined; size: "tile" | "big" }) {
  return (
    <img
      class="art-card"
      data-size={props.size}
      src={props.item ? cardBackSrc(props.item.id) : DEFAULT_CARD_BACK_SRC}
      alt=""
      width="480"
      height="720"
      draggable={false}
      decoding="async"
    />
  );
}

/** Zafer kutlamasının dört parçacığı yan yana (karo, dolap). */
export function CelebrationCollage(props: { item: CosmeticItem }) {
  return (
    <span class="art-sprites" aria-hidden="true">
      <For each={Array.from({ length: CELEBRATION_SPRITES }, (_, i) => i + 1)}>
        {(n) => (
          <img
            src={`/assets/shop/zafer/${props.item.asset}-${n}.webp`}
            alt=""
            draggable={false}
            style={{ "--n": n }}
          />
        )}
      </For>
    </span>
  );
}

/** Tepki paketinden 4 çıkartmalık dağınık kolaj (karo, dolap). */
export function PackCollage(props: { item: CosmeticItem }) {
  return (
    <span class="art-collage" aria-hidden="true">
      <For each={Array.from({ length: COLLAGE_STICKERS }, (_, i) => i + 1)}>
        {(n) => <img src={packStickerSrc(props.item, n)} alt="" draggable={false} style={{ "--n": n }} />}
      </For>
    </span>
  );
}

/** Paketin altı çıkartması (satın alma sayfası). */
export function PackGrid(props: { item: CosmeticItem }) {
  return (
    <span class="art-pack" aria-hidden="true">
      <For each={Array.from({ length: STICKERS_PER_PACK }, (_, i) => i + 1)}>
        {(n) => <img src={packStickerSrc(props.item, n)} alt="" draggable={false} />}
      </For>
    </span>
  );
}

/** Giriş efektinin iki katmanı üst üste, durağan: zemin halkası altta, ışık üstte (karo, dolap). */
export function EntryLayers(props: { item: CosmeticItem }) {
  return (
    <Show when={entryLayers(props.item.id)}>
      {(art) => (
        <span class="art-entry" aria-hidden="true">
          <img src={art().back} alt="" draggable={false} />
          <img src={art().front} alt="" draggable={false} />
        </span>
      )}
    </Show>
  );
}

/** Zafer kutlaması canlı: kısa bir patlama döngüsü (satın alma sayfası). Sayfa kapanınca durur. */
export function CelebrationLive(props: { item: CosmeticItem }) {
  let host: HTMLDivElement | undefined;
  onMount(() => {
    if (!host) return;
    let stop: (() => void) | undefined;
    let gone = false;
    playCelebration(host, props.item.id, { loop: true })
      .then((d) => {
        if (gone) d();
        else stop = d;
      })
      .catch(() => {
        // kutlama olmadan da sayfa çalışır
      });
    onCleanup(() => {
      gone = true;
      stop?.();
    });
  });
  return (
    <div class="art-live">
      <div class="art-live__host" ref={host} aria-hidden="true" />
      <CelebrationCollage item={props.item} />
    </div>
  );
}

/** Giriş efekti oyuncunun kendi avatarında, birkaç saniyede bir yeniden oynar (satın alma sayfası). */
export function EntryLive(props: { item: CosmeticItem; avatar: number; frame?: string | undefined }) {
  const [on, setOn] = createSignal(true);
  onMount(() => {
    const t = setInterval(() => {
      setOn(false);
      setTimeout(() => setOn(true), 160);
    }, 2600);
    onCleanup(() => clearInterval(t));
  });
  return (
    <span class="art-entrylive">
      <Avatar
        index={props.avatar}
        size="clamp(76px, 26vmin, 112px)"
        frame={props.frame}
        entry={on() ? props.item.id : undefined}
      />
    </span>
  );
}
