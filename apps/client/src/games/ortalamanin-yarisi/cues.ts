import type { Accessor } from "solid-js";
import { onPhaseKey } from "../../fx/cue.js";
import type { RevealStage, RoundPhase } from "./view.js";

/**
 * Ortalamaya En Yakın ses ve titreşim tetikleyicileri (OY-U15). Girdiler her karede (saat 50 ms'de bir) yeniden
 * hesaplanır; anahtar memo'dan geçtiği için her olay YALNIZ geçişte bir kez çalar. Ekran sonradan açıldıysa
 * (anahtarın ilk görülüşü) geçmiş anın sesi çalınmaz; yalnız tur kartı ilk görülüşte de çalar (kart kısadır).
 */

export interface ChooseCueInput {
  round: number;
  phase: RoundPhase;
  /** Son 3 saniyede kalan tam saniye; yoksa null. */
  lastSecond: number | null;
  locked: boolean;
}

export function ortalamaChooseCues(
  input: Accessor<ChooseCueInput | null>,
  on: { card: (round: number) => void; last: (second: number) => void; lock: () => void },
): void {
  onPhaseKey(
    () => {
      const i = input();
      return i ? `${i.round}:${i.phase}` : "";
    },
    () => {
      const i = input();
      if (i?.phase === "card") on.card(i.round);
    },
  );
  onPhaseKey(
    () => {
      const i = input();
      return i?.lastSecond ? `${i.round}:son:${i.lastSecond}` : "";
    },
    () => {
      const s = input()?.lastSecond;
      if (s) on.last(s);
    },
  );
  onPhaseKey(
    () => {
      const i = input();
      return i ? `${i.round}:kilit:${i.locked ? 1 : 0}` : "";
    },
    (_k, opening) => {
      if (!opening && input()?.locked) on.lock();
    },
  );
}

export interface RevealCueInput {
  round: number;
  stage: RevealStage;
  /** Düşmüş nokta sayısı (adım 1). */
  popped: number;
  /** Sönmüş ip sayısı (adım 4). */
  ropesOut: number;
}

export function ortalamaRevealCues(
  input: Accessor<RevealCueInput | null>,
  on: { pop: (index: number) => void; stage: (stage: RevealStage) => void; rope: (index: number) => void },
): void {
  const keyed = (key: () => string, fn: () => void): void =>
    onPhaseKey(key, (k, opening) => {
      if (k !== "" && !opening) fn();
    });
  keyed(
    () => {
      const i = input();
      return i ? `${i.round}:pop:${i.popped}` : "";
    },
    () => {
      const p = input()?.popped ?? 0;
      if (p > 0) on.pop(p - 1);
    },
  );
  keyed(
    () => {
      const i = input();
      return i ? `${i.round}:evre:${i.stage}` : "";
    },
    () => {
      const s = input()?.stage;
      if (s !== undefined && s > 0) on.stage(s);
    },
  );
  keyed(
    () => {
      const i = input();
      return i && i.stage === 3 ? `${i.round}:ip:${i.ropesOut}` : "";
    },
    () => {
      const r = input()?.ropesOut ?? 0;
      if (r > 0) on.rope(r - 1);
    },
  );
}
