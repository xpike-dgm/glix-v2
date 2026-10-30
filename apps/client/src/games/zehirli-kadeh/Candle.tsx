import { artUrl, optionalArt } from "./art.js";

/**
 * Süre mumu: kalan süreye göre eriyen mum. Her takas bitişi 5 sn uzattığı için mum biraz uzar ve alev parlar
 * (`bump`). Son saniyelerde (`tense`) alev titrer, mum sallanır. Görsel (`mum.webp`) varsa gövde onunla çizilir.
 */
export function Candle(props: { left: number; secs: number; bump?: string | undefined; tense: boolean }) {
  const art = optionalArt("zehirli-kadeh/mum");
  return (
    <div
      class="zkm"
      data-tense={props.tense ? "1" : undefined}
      data-art={art() ? "1" : undefined}
      style={{ "--f": props.left.toFixed(3), "--mum": artUrl("zehirli-kadeh/mum", art()) }}
      role="timer"
      aria-label={`${props.secs} saniye kaldı`}
    >
      <span class="zkm__candle" aria-hidden="true">
        <span class="zkm__wax" />
        <span class="zkm__top">
          <span class="zkm__glow" data-bump={props.bump} />
          <span class="zkm__flame" data-bump={props.bump} />
          <span class="zkm__wick" />
        </span>
        <span class="zkm__dish" />
      </span>
      <span class="zkm__secs" aria-hidden="true">
        {props.secs}
      </span>
    </div>
  );
}
