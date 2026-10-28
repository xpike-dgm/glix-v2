// biome-ignore-all lint/a11y/noSvgWithoutTitle: elmas dekoratif; anlamı kartın etiketi taşır
import { CARDS, type CardId, type CardRarity } from "@glix/engine";
import { createSignal, type JSX, Show } from "solid-js";
import {
  CARD_BACK_SRC,
  cardArt,
  cardFrame,
  cardLabel,
  gemCount,
  RARITY_LABEL,
  ROOMY_QUERY,
} from "./cards.js";
import { createMediaQuery } from "./viewport.js";

/** Elmas işareti: sıradan 1, nadir 2, efsanevi 3; kötü kartta kırık elmas (renk körleri nadirliği buradan okur). */
export function GemMark(props: { rarity: CardRarity; size?: number }) {
  const n = () => (props.rarity === "kotu" ? 1 : gemCount(rarityCard(props.rarity)));
  const s = () => props.size ?? 14;
  return (
    <span
      class="kc-gems"
      data-r={props.rarity}
      role="img"
      aria-label={props.rarity === "kotu" ? "Kırık elmas" : `${n()} elmas`}
    >
      {props.rarity === "kotu" ? (
        <svg width={s()} height={s()} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 2.5L3 10.5l8 11.5-1.6-8.6 2.4-3.1z" fill="currentColor" />
          <path d="M13.4 3.5l8 7-7.4 11 1.4-8.2-2.8-3.4z" fill="currentColor" opacity="0.55" />
        </svg>
      ) : (
        Array.from({ length: n() }, () => (
          <svg width={s()} height={s()} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2l9 8-9 12L3 10z" fill="currentColor" />
          </svg>
        ))
      )}
    </span>
  );
}

/** Elmas sayısını nadirlikten bulmak için temsilci kart. */
function rarityCard(r: CardRarity): CardId {
  return r === "siradan"
    ? "kalkan"
    : r === "nadir"
      ? "takas"
      : r === "efsanevi"
        ? "ters-kose"
        : "talihsizlik";
}

/** Kapalı kart sırtı (Kör Seçim, TV destesi). Görsel yüklenmezse CSS deseni ve "?" kalır. */
export function CardBack(props: {
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  /** row: alçak satır (dikey telefon); tile: dikey kart; auto: ekrana göre. */
  layout?: "row" | "tile" | "auto";
  /** Kart arkası görseli (mağazadan kuşanılan); yoksa klasik. */
  src?: string | undefined;
}) {
  const layout = useLayout(() => props.layout ?? "auto");
  return (
    <button
      type="button"
      class="kc-card kc-card--back"
      data-layout={layout()}
      disabled={props.disabled === true || !props.onClick}
      aria-label={props.label ?? "Kapalı kart"}
      onClick={() => props.onClick?.()}
    >
      <BackPic src={props.src} />
      <Show when={layout() === "row"}>
        <span class="kc-card__body">
          <span class="kc-card__name">Kapalı kart</span>
        </span>
      </Show>
    </button>
  );
}

/** Kart sırtı görseli; yüklenemezse kaldırılır ve arkadaki "?" görünür. */
export function BackPic(props: { src?: string | undefined }) {
  const [off, setOff] = createSignal(false);
  // Özel sırt yüklenemezse klasik sırta, o da yüklenemezse "?" desenine dönülür.
  const [fallback, setFallback] = createSignal(false);
  const src = () => (props.src && !fallback() ? props.src : CARD_BACK_SRC);
  return (
    <span class="kc-card__pic" data-off={off() ? "1" : undefined} aria-hidden="true">
      <Show when={off()}>
        <span class="kc-card__qmark">?</span>
      </Show>
      <Show when={!off()}>
        <img
          class="kc-card__frame"
          src={src()}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => (props.src && !fallback() ? setFallback(true) : setOff(true))}
        />
      </Show>
    </span>
  );
}

/** "auto": geniş yatay ekranda dikey kart (tile), diğer her yerde alçak satır (row). */
function useLayout(want: () => "row" | "tile" | "mini" | "auto"): () => "row" | "tile" | "mini" {
  const roomy = createMediaQuery(ROOMY_QUERY);
  return () => {
    const w = want();
    return w === "auto" ? (roomy() ? "tile" : "row") : w;
  };
}

interface Props {
  id: CardId;
  /**
   * row: yanda küçük kart, yazı yanında (dikey telefon); tile: dikey tam kart, yazı çerçevenin panelinde
   * (geniş ekran, TV); mini: küçük kart + ad (el şeridi); auto: ekrana göre row / tile.
   */
  layout?: "row" | "tile" | "mini" | "auto";
  onClick?: () => void;
  disabled?: boolean;
  /** Seçili / vurgulu. */
  on?: boolean;
  /** Küçük "Yeni" gibi köşe etiketi. */
  badge?: string | undefined;
  /** Kartın altına küçük ek (ör. hedef adı). */
  note?: JSX.Element;
}

/**
 * Kart yüzü. Çerçeve görseli nadirliği taşır (elmaslar, renk); resim penceresine kartın çizimi, alt panele gerçek metin gelir.
 * Görseller (`/assets/cards/`) yüklenmezse CSS çerçevesi, elmas işareti ve aynı metin kalır; elmas işareti renk körleri için ikinci ipucudur.
 */
export function CardFace(props: Props) {
  const def = () => CARDS[props.id];
  const layout = useLayout(() => props.layout ?? "auto");
  // Çerçeve görseli yüklenemezse CSS çerçevesine dönülür.
  const [frameOff, setFrameOff] = createSignal(false);
  const tags = (
    <>
      <Show when={def().attack}>
        <span class="kc-card__tag" data-k="attack">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          Saldırı
        </span>
      </Show>
      <Show when={def().hidden}>
        <span class="kc-card__tag" data-k="hidden">
          Gizli
        </span>
      </Show>
      <Show when={props.badge}>
        <span class="kc-card__tag" data-k="new">
          {props.badge}
        </span>
      </Show>
    </>
  );
  const body = (
    <>
      <span class="kc-card__pic" aria-hidden="true">
        <span class="kc-card__art">
          <img
            src={cardArt(props.id)}
            alt=""
            decoding="async"
            draggable={false}
            onError={(e) => e.currentTarget.remove()}
          />
        </span>
        <img
          class="kc-card__frame"
          src={cardFrame(def().rarity)}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFrameOff(true)}
        />
        <Show when={layout() === "tile"}>
          <span class="kc-card__panel">
            <span class="kc-card__pname">{def().name}</span>
            <span class="kc-card__ptext">{def().text}</span>
          </span>
          <span class="kc-card__tags">{tags}</span>
          {props.note}
        </Show>
      </span>
      <Show when={layout() === "row"}>
        <span class="kc-card__body">
          <span class="kc-card__top">
            <GemMark rarity={def().rarity} />
            <span class="kc-card__rar">{RARITY_LABEL[def().rarity]}</span>
            {tags}
          </span>
          <span class="kc-card__name">{def().name}</span>
          <span class="kc-card__text">{def().text}</span>
          {props.note}
        </span>
      </Show>
      <Show when={layout() === "mini"}>
        <span class="kc-card__name">{def().name}</span>
      </Show>
    </>
  );
  const common = () => ({
    class: "kc-card",
    "data-r": def().rarity,
    "data-layout": layout(),
    "data-frame": frameOff() ? "off" : undefined,
    "data-on": props.on ? "1" : undefined,
  });
  return props.onClick ? (
    <button
      type="button"
      {...common()}
      disabled={props.disabled}
      aria-label={cardLabel(props.id)}
      aria-pressed={props.on === undefined ? undefined : props.on}
      onClick={() => props.onClick?.()}
    >
      {body}
    </button>
  ) : (
    <div {...common()} role="img" aria-label={cardLabel(props.id)}>
      {body}
    </div>
  );
}

/** Yalnız küçük kart görseli (çerçeve + çizim); ayar listesi gibi satırlarda kullanılır. Anlamı satırın metni taşır. */
export function CardThumb(props: { id: CardId }) {
  const [frameOff, setFrameOff] = createSignal(false);
  return (
    <span
      class="kc-card kc-card--thumb"
      data-r={CARDS[props.id].rarity}
      data-layout="thumb"
      data-frame={frameOff() ? "off" : undefined}
      aria-hidden="true"
    >
      <span class="kc-card__pic">
        <span class="kc-card__art">
          <img
            src={cardArt(props.id)}
            alt=""
            decoding="async"
            draggable={false}
            loading="lazy"
            onError={(e) => e.currentTarget.remove()}
          />
        </span>
        <img
          class="kc-card__frame"
          src={cardFrame(CARDS[props.id].rarity)}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFrameOff(true)}
        />
      </span>
    </span>
  );
}
