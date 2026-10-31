// biome-ignore-all lint/a11y/noSvgWithoutTitle: çizim dekoratif (aria-hidden)
import { Show } from "solid-js";

/** Telefon görseli (sahip üretecek). Dosya derlemede varsa onu, yoksa SVG çizimi kullanılır. */
export const PHONE_ART_SRC = "/assets/props/bozuk-telefon/telefon.webp";
const hasArt = (): boolean => typeof __BOZUK_PHONE_ART__ !== "undefined" && __BOZUK_PHONE_ART__ === true;

/** Kablonun yolu: telefonun arkasından kıvrılarak sağ kenardan çıkar (sıradaki oyuncuya). */
const CABLE =
  "M150 112 C 162 112 164 100 172 100 C 180 100 178 114 186 114 C 194 114 192 100 200 100 C 208 100 206 114 214 114 C 222 114 222 92 240 84";

interface Props {
  /** Cümle gönderildi: ışık kablodan sıradakine akar, telefon kısa sallanır. */
  sending: boolean;
}

/**
 * İlk cümle ekranı (BT-U4): büyük eski çevirmeli telefon ve sağ kenara uzanan kıvrık kablosu. Gönderilince cümle
 * (parlayan bir not) kablo boyunca sıradakine gider. Hareket azaltmada not doğrudan kablonun ucunda görünür.
 */
export function PhoneArt(props: Props) {
  return (
    <div class="btp" data-send={props.sending ? "1" : undefined} aria-hidden="true">
      <svg viewBox="0 0 240 150" class="btp__svg" preserveAspectRatio="xMidYMid meet">
        <path class="btp__cable" d={CABLE} />
        <path class="btp__pulse" d={CABLE} pathLength="100" />
        <Show
          when={hasArt()}
          fallback={
            <g class="btp__phone">
              {/* gövde */}
              <path class="btp__body" d="M40 132 L58 70 H142 L160 132 Z" />
              <path class="btp__rim" d="M52 120 H148" />
              {/* kadran */}
              <circle class="btp__dial" cx="100" cy="100" r="22" />
              <circle class="btp__hub" cx="100" cy="100" r="7" />
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                const a = ((-60 + i * 27) * Math.PI) / 180;
                return (
                  <circle class="btp__hole" cx={100 + Math.cos(a) * 15} cy={100 + Math.sin(a) * 15} r="3.4" />
                );
              })}
              {/* ahize */}
              <path
                class="btp__handset"
                d="M30 62 C 30 44 48 38 60 46 L 70 54 C 76 46 124 46 130 54 L 140 46 C 152 38 170 44 170 62 C 170 70 160 72 150 66 L 136 58 C 120 52 80 52 64 58 L 50 66 C 40 72 30 70 30 62 Z"
              />
              <path class="btp__cradle" d="M62 70 V62 M138 70 V62" />
            </g>
          }
        >
          <image class="btp__img" href={PHONE_ART_SRC} x="20" y="10" width="140" height="130" />
        </Show>
        <g class="btp__note" style={{ "offset-path": `path("${CABLE}")` }}>
          <rect x="-11" y="-8" width="22" height="16" rx="3" />
          <path d="M-6 -2 H6 M-6 3 H3" />
        </g>
      </svg>
      <span class="btp__sent">Sıradakine gitti!</span>
    </div>
  );
}
