import { For } from "solid-js";
import { currentFlashPeak } from "../../fx/shake.js";
import { propSrc } from "../../ui/props.js";

/** Çekirdeğin bölündüğü parça sayısı (sabit; az sayıda DOM düğümü). */
const SHARDS = 9;

interface Shard {
  clip: string;
  tx: string;
  ty: string;
  r: string;
}

/** Çekirdeği merkezden pasta dilimlerine böler; her dilim kendi yönünde uçar. Kenarlar hafif kırıktır. */
function shards(): Shard[] {
  const out: Shard[] = [];
  const step = 360 / SHARDS;
  for (let i = 0; i < SHARDS; i++) {
    const a0 = i * step + (i % 2 === 0 ? 4 : -3);
    const a1 = (i + 1) * step + ((i + 1) % 2 === 0 ? 4 : -3);
    const mid = (a0 + a1) / 2;
    const pt = (deg: number, rad: number): string => {
      const t = ((deg - 90) * Math.PI) / 180;
      return `${(50 + Math.cos(t) * rad).toFixed(1)}% ${(50 + Math.sin(t) * rad).toFixed(1)}%`;
    };
    const t = ((mid - 90) * Math.PI) / 180;
    const dist = 46 + (i % 3) * 9;
    out.push({
      clip: `polygon(50% 50%, ${pt(a0, 75)}, ${pt(mid, 68)}, ${pt(a1, 75)})`,
      tx: `${(Math.cos(t) * dist).toFixed(1)}vmax`,
      ty: `${(Math.sin(t) * dist).toFixed(1)}vmax`,
      r: `${(i % 2 === 0 ? 1 : -1) * (40 + (i % 4) * 25)}deg`,
    });
  }
  return out;
}

/**
 * Patlama sahnesi (bir kez oynar, çağıran kaldırır): beyaz flaş, çekirdek parçalara ayrılır, ekranı kaplayan şok
 * dalgası. Parçalar ilk anda hızla açılır, kısa bir yavaş çekimden sonra savrulur. Flaş azaltılmış harekette
 * yumuşar (`currentFlashPeak`).
 */
export function BoomScene() {
  const list = shards();
  return (
    <div class="ay-boom" aria-hidden="true" style={{ "--peak": String(currentFlashPeak(1)) }}>
      <i class="ay-boom__wave" />
      <i class="ay-boom__wave ay-boom__wave--late" />
      <div class="ay-boom__core">
        <For each={list}>
          {(s) => (
            <i
              class="ay-boom__shard"
              style={{
                "clip-path": s.clip,
                "-webkit-clip-path": s.clip,
                "background-image": `url(${propSrc("genel/enerji-cekirdegi-asiri")})`,
                "--tx": s.tx,
                "--ty": s.ty,
                "--r": s.r,
              }}
            />
          )}
        </For>
      </div>
      <i class="ay-boom__flash" />
    </div>
  );
}
