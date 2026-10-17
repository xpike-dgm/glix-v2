import { For } from "solid-js";
import { wordScale } from "./view.js";

/** Ana kelimeden yayılan sekiz çatallı şimşek çizgisi (sabit, hesaplanmış). */
const BOLTS: string[] = Array.from({ length: 8 }, (_, k) => {
  const base = (k * 45 + 22.5) * (Math.PI / 180);
  const radii = [56, 66, 75, 85, 97];
  const pts = radii.map((r, i) => {
    const jitter = (i % 2 === 0 ? 1 : -1) * (k % 2 === 0 ? 0.1 : 0.14) * (i === 0 || i === 4 ? 0.4 : 1);
    const a = base + jitter;
    return `${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`;
  });
  return pts.join(" ");
});

interface Props {
  word: string;
  /** Küçük (sonuç başlığı) görünüm: şimşekler gizlenir. */
  mini?: boolean;
}

/** Ana kelime: elektrikli merkez. */
export function Hub(props: Props) {
  return (
    <div class="hub" data-mini={props.mini ? "1" : undefined}>
      <svg class="hub__bolts" viewBox="0 0 200 200" aria-hidden="true">
        <For each={BOLTS}>{(pts, i) => <polyline points={pts} data-k={i() % 2} />}</For>
      </svg>
      <div class="hub__orb">
        <span
          class="hub__word"
          style={props.mini ? undefined : { "font-size": `${wordScale(props.word)}cqw` }}
        >
          {props.word}
        </span>
      </div>
    </div>
  );
}
