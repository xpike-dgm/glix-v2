// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { FitText } from "./FitText.js";

interface Props {
  first: string;
  last: string;
  /** Büyük ekran (TV). */
  big?: boolean;
}

/**
 * Sağlam zincir (BT-U6): ilk ve son cümle yan yana, aralarında iki zincir halkası birbirine geçip kilitlenir.
 * Hareket azaltmada halkalar baştan kilitli görünür.
 */
export function ChainLock(props: Props) {
  return (
    <section
      class="btl"
      data-big={props.big ? "1" : undefined}
      aria-label="Sağlam zincir: zincirdeki herkese +1"
    >
      <div class="btl__row">
        <div class="btl__card">
          <span class="btl__tag">İLK</span>
          <FitText text={props.first} max={props.big ? 34 : 16} min={props.big ? 16 : 13} />
        </div>
        <svg class="btl__links" viewBox="0 0 64 32" aria-hidden="true">
          <rect class="btl__ring btl__ring--a" x="4" y="9" width="30" height="14" rx="7" />
          <rect class="btl__ring btl__ring--b" x="30" y="9" width="30" height="14" rx="7" />
          <circle class="btl__spark" cx="32" cy="16" r="5" />
        </svg>
        <div class="btl__card">
          <span class="btl__tag">SON</span>
          <FitText text={props.last} max={props.big ? 34 : 16} min={props.big ? 16 : 13} />
        </div>
      </div>
      <p class="btl__label">
        SAĞLAM ZİNCİR <span>· herkese +1</span>
      </p>
    </section>
  );
}
