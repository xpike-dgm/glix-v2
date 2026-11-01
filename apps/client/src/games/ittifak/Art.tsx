import { Show } from "solid-js";
import { ittifakProp } from "../../ui/props.js";

/*
 * İttifak çizimleri. Görsel dosyası (docs/oneriler/GORSEL-IHTIYACLARI.md "İttifak") derlemede varsa o kullanılır;
 * yoksa CSS/SVG karşılığı çizilir ve olmayan dosya hiç istenmez.
 */

/** IT-U1 / IT-U13: üstten görülen yuvarlak müzakere masası (TV'de geniş hâli). */
export function Table(props: { wide?: boolean; urgent?: boolean }) {
  const src = () => ittifakProp(props.wide ? "masa-genis" : "masa");
  return (
    <div
      class="it__table"
      data-wide={props.wide ? "1" : undefined}
      data-urgent={props.urgent ? "1" : undefined}
      aria-hidden="true"
    >
      <Show when={src()} fallback={<i class="it__table-css" />}>
        {(s) => <img class="it__table-img" src={s()} alt="" draggable={false} />}
      </Show>
    </div>
  );
}

/** IT-U2: balmumu söz mührü; `broken` ise kırık hâli (IT-U6 İHANET damgası). */
export function Seal(props: { broken?: boolean; class?: string }) {
  const src = () => ittifakProp(props.broken ? "muhur-kirik" : "muhur");
  return (
    <Show
      when={src()}
      fallback={
        <svg class={`it-seal ${props.class ?? ""}`} viewBox="0 0 40 40" aria-hidden="true">
          <Show
            when={props.broken}
            fallback={
              <>
                <path
                  d="M20 2l4 3 5-1 2 4 5 2-1 5 3 4-3 4 1 5-5 2-2 4-5-1-4 3-4-3-5 1-2-4-5-2 1-5-3-4 3-4-1-5 5-2 2-4 5 1z"
                  fill="#b0182f"
                  stroke="#5c0815"
                  stroke-width="1.2"
                />
                <circle cx="20" cy="20" r="10" fill="#d42a42" stroke="#7a0d1d" stroke-width="1" />
                <path
                  d="M14 21l4 4 8-9"
                  fill="none"
                  stroke="#ffd7a0"
                  stroke-width="2.4"
                  stroke-linecap="round"
                />
                <ellipse cx="15" cy="13" rx="4" ry="2" fill="#ff8a96" opacity="0.5" />
              </>
            }
          >
            <path d="M19 3l-4 2-5-1-2 4-5 2 1 5-3 4 3 4-1 5 5 2 2 4 5-1 4 3 2-9-4-6 4-7z" fill="#8f1326" />
            <path
              d="M23 5l4-1 2 4 5 2-1 5 3 4-3 4 1 5-5 2-2 4-5-1-3 2 2-9-4-7 4-6z"
              fill="#b0182f"
              transform="translate(2 1) rotate(8 30 20)"
            />
          </Show>
        </svg>
      }
    >
      {(s) => (
        <img class={`it-seal ${props.class ?? ""}`} src={s()} alt="" aria-hidden="true" draggable={false} />
      )}
    </Show>
  );
}

/** IT-U6: İTTİFAK rozeti: görsel varsa altın plaka olarak arkada, yazıyı kod çizer (yoksa CSS plaka). */
export function AllianceBadge() {
  const src = () => ittifakProp("ittifak-rozet");
  return (
    <span
      class="it__ally-badge"
      data-img={src() ? "1" : undefined}
      style={src() ? { "background-image": `url(${src()})` } : undefined}
    >
      {/* Yazı ayrı kutuda: görselde altın bant yalnız ortada, yazı da yalnız o bandın üstünde durur. */}
      <span class="it__ally-text">İTTİFAK</span>
    </span>
  );
}
