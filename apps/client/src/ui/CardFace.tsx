// biome-ignore-all lint/a11y/noSvgWithoutTitle: elmas dekoratif; anlamı kartın etiketi taşır
import { CARDS, type CardId, type CardRarity } from "@glix/engine";
import { type JSX, Show } from "solid-js";
import { cardLabel, gemCount, RARITY_LABEL } from "./cards.js";

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

/** Kapalı kart sırtı (Kör Seçim). */
export function CardBack(props: { onClick?: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      class="kc-card kc-card--back"
      data-layout="tile"
      disabled={props.disabled === true || !props.onClick}
      aria-label={props.label ?? "Kapalı kart"}
      onClick={() => props.onClick?.()}
    >
      <span class="kc-card__qmark" aria-hidden="true">
        ?
      </span>
    </button>
  );
}

interface Props {
  id: CardId;
  /** row: yatay ve alçak (dikey telefon seçimi); tile: dikey kart (yatay ekran, el, açıklama). */
  layout?: "row" | "tile" | "mini";
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
 * Kart yüzü. Çerçeve rengi nadirlikten gelir (turkuaz / mor / altın / kırmızı), elmas işareti rengi görmeyenler için
 * ikinci ipucudur. Görsel `/assets/cards/<kimlik>.webp` ile gelir; yoksa CSS çerçevesi ve gerçek metin kalır.
 */
export function CardFace(props: Props) {
  const def = () => CARDS[props.id];
  const body = (
    <>
      <span class="kc-card__art" aria-hidden="true">
        <img
          src={`/assets/cards/${props.id}.webp`}
          alt=""
          decoding="async"
          draggable={false}
          loading="lazy"
          onError={(e) => e.currentTarget.remove()}
        />
      </span>
      <span class="kc-card__top">
        <GemMark rarity={def().rarity} />
        <span class="kc-card__rar">{RARITY_LABEL[def().rarity]}</span>
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
      </span>
      <span class="kc-card__name">{def().name}</span>
      <span class="kc-card__text">{def().text}</span>
      {props.note}
    </>
  );
  return props.onClick ? (
    <button
      type="button"
      class="kc-card"
      data-r={def().rarity}
      data-layout={props.layout ?? "tile"}
      data-on={props.on ? "1" : undefined}
      disabled={props.disabled}
      aria-label={cardLabel(props.id)}
      aria-pressed={props.on === undefined ? undefined : props.on}
      onClick={() => props.onClick?.()}
    >
      {body}
    </button>
  ) : (
    <div
      class="kc-card"
      data-r={def().rarity}
      data-layout={props.layout ?? "tile"}
      data-on={props.on ? "1" : undefined}
      role="img"
      aria-label={cardLabel(props.id)}
    >
      {body}
    </div>
  );
}
