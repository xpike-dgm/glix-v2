import { effectsBus } from "../../fx/sound.js";
import { humLevel, humPitch } from "./rhythm.js";

/** Son dokunuştan sonra vınlamanın sürdüğü kısa süre (sn); sonra söner. */
const HOLD_S = 0.14;

export interface Hum {
  /** Bir dokunuş: perde ve güç kendi hızına göre ayarlanır, kısa süre sonra kendiliğinden söner. */
  feed(rate: number): void;
  /** Sesi kapatır ve düğümleri bırakır. */
  stop(): void;
}

/**
 * Kendi hızına göre yükselen vınlama: tek bir sürekli osilatör (ve bir alt oktav), alçak geçiren süzgeçle
 * yumuşatılır. Her dokunuşta yalnız parametreler güncellenir; yeni düğüm üretilmez. Sessizdeyse çalmaz.
 */
export function createHum(): Hum {
  let nodes: {
    ctx: AudioContext;
    osc: OscillatorNode;
    sub: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;

  const silence = (): void => {
    if (!nodes) return;
    const t = nodes.ctx.currentTime;
    nodes.gain.gain.cancelScheduledValues(t);
    nodes.gain.gain.setTargetAtTime(0, t, 0.04);
  };

  const ensure = (): typeof nodes => {
    if (nodes) return nodes;
    const bus = effectsBus();
    if (!bus) return null;
    try {
      const { ctx } = bus;
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      sub.type = "triangle";
      filter.type = "lowpass";
      filter.Q.value = 4;
      gain.gain.value = 0;
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain).connect(bus.out);
      osc.start();
      sub.start();
      nodes = { ctx, osc, sub, filter, gain };
    } catch {
      nodes = null;
    }
    return nodes;
  };

  return {
    feed(rate) {
      if (!effectsBus()) {
        silence();
        return;
      }
      const n = ensure();
      if (!n) return;
      const t = n.ctx.currentTime;
      const f = humPitch(rate);
      n.osc.frequency.setTargetAtTime(f, t, 0.05);
      n.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
      n.filter.frequency.setTargetAtTime(f * 3, t, 0.05);
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setTargetAtTime(humLevel(rate), t, 0.025);
      n.gain.gain.setTargetAtTime(0, t + HOLD_S, 0.12);
    },
    stop() {
      if (!nodes) return;
      const n = nodes;
      nodes = null;
      try {
        const t = n.ctx.currentTime;
        n.gain.gain.cancelScheduledValues(t);
        n.gain.gain.setTargetAtTime(0, t, 0.03);
        n.osc.stop(t + 0.2);
        n.sub.stop(t + 0.2);
        n.osc.onended = () => n.gain.disconnect();
      } catch {
        // bağlam kapanmış olabilir
      }
    },
  };
}
