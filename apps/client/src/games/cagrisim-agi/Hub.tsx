import { createSignal, For, onCleanup, Show } from "solid-js";
import { serverNow } from "../../net/store.js";
import { ringPoint, ringState, wordScale } from "./view.js";

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

/** Halkanın çevresi (r = 33 birim, viewBox 100). */
const RING_C = 2 * Math.PI * 33;

export interface OrbitNode {
  id: string;
  color: string;
  /** Oyuncunun halkadaki sırası (sabit yer). */
  slot: number;
}

interface Props {
  word: string;
  /** Küçük (sonuç başlığı) görünüm: şimşekler gizlenir. */
  mini?: boolean;
  /** Sayaç halkası (CG-U2): kalan süre halkanın sönmesiyle görünür; son 5 sn kırmızı ve büyük saniye. */
  timer?: { startedAt: number; endsAt: number } | undefined;
  /** Yörüngedeki ışık düğümleri (CG-U3): yalnız "gönderdi" bilgisi, sahibinin renginde. */
  nodes?: OrbitNode[] | undefined;
  /** Oyuncu sayısı (düğüm yerleri). */
  slots?: number;
  /** "TEK YÜREK" (CG-U7): küre altın renge döner. */
  gold?: boolean;
  /** Kelime geçişi: küre bir an söner. */
  dim?: boolean;
}

/** Ana kelime: elektrikli merkez. */
export function Hub(props: Props) {
  const [now, setNow] = createSignal(serverNow());
  const timer = setInterval(() => setNow(serverNow()), 200);
  onCleanup(() => clearInterval(timer));
  const ring = () => (props.timer ? ringState(now(), props.timer.startedAt, props.timer.endsAt) : null);
  return (
    <div
      class="hub"
      data-mini={props.mini ? "1" : undefined}
      data-urgent={ring()?.urgent ? "1" : undefined}
      data-gold={props.gold ? "1" : undefined}
      data-dim={props.dim ? "1" : undefined}
    >
      <svg class="hub__bolts" viewBox="0 0 200 200" aria-hidden="true">
        <For each={BOLTS}>{(pts, i) => <polyline points={pts} data-k={i() % 2} />}</For>
      </svg>
      <Show when={ring()}>
        {(r) => (
          <svg class="hub__ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="hub__ring-bg" cx="50" cy="50" r="33" />
            <circle
              class="hub__ring-fg"
              cx="50"
              cy="50"
              r="33"
              stroke-dasharray={`${RING_C}`}
              stroke-dashoffset={`${RING_C * (1 - r().left)}`}
            />
          </svg>
        )}
      </Show>
      <Show when={props.nodes}>
        {(nodes) => (
          <div class="hub__orbit" aria-hidden="true">
            <For each={nodes()}>
              {(n) => {
                const p = ringPoint(n.slot, Math.max(props.slots ?? 8, 1), 44);
                return (
                  <i
                    class="hub__node"
                    style={{ "--nc": n.color, left: `${p.x}%`, top: `${p.y}%` }}
                    data-id={n.id}
                  />
                );
              }}
            </For>
          </div>
        )}
      </Show>
      <div class="hub__orb">
        <span
          class="hub__word"
          style={props.mini ? undefined : { "font-size": `${wordScale(props.word)}cqw` }}
        >
          {props.word}
        </span>
        <Show when={ring()?.urgent ? ring() : null}>
          {(r) => (
            <span class="hub__secs" aria-hidden="true">
              {r().secs}
            </span>
          )}
        </Show>
      </div>
    </div>
  );
}
