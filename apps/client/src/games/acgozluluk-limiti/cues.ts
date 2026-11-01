import { type Accessor, createEffect, untrack } from "solid-js";
import { createOnce } from "../../fx/cue.js";
import {
  type AcgozlulukScreenView,
  DOOR_MS,
  type FillSegment,
  fillPlan,
  type Verdict,
  verdictOf,
} from "./view.js";

/** Geç açılan ekranda (yeniden bağlanma) geçmiş anın sesi yalnız bu kadar yeniyse çalar. */
export const FRESH_MS = 400;
/** Gözcü bakışı geç gelen görünümde bu kadar yeniyse çalar. */
export const PEEK_FRESH_MS = 1_500;

export interface AcgozlulukCueHandlers {
  /** Son 5 sn, her saniye bir kez (kasa kapısı dişlisi). */
  gear: (secs: number, locked: boolean) => void;
  /** Gözcü'nün kendi bakışı (yalnız Gözcü'nün görünümünde kelime vardır). */
  peek: (round: number) => void;
  /** Tur açıldı: kapak. */
  lid: (round: number) => void;
  /** Şerit düştü. */
  strip: (round: number, index: number, seg: FillSegment) => void;
  /** Limite 3 kala kalp atışı başladı. */
  heart: (round: number) => void;
  /** Karar yazısı. */
  verdict: (round: number, verdict: Verdict) => void;
}

/**
 * Açgözlülük Limiti ses tetikleyicileri (AL-U14 / AL-U6 / AL-U15). Saat her karede ilerler, görünüm her güncellemede
 * yeniden üretilir; her olay kimliğiyle (`tur:olay:sıra`) ekranın ömrü boyunca yalnız bir kez çalar. Geç açılan ekranda
 * geçmiş anlar sessiz geçer.
 */
export function acgozlulukCues(
  view: Accessor<AcgozlulukScreenView | null>,
  now: Accessor<number>,
  reduced: Accessor<boolean>,
  on: AcgozlulukCueHandlers,
): void {
  const once = createOnce();
  createEffect(() => {
    const v = view();
    const t = now();
    if (!v) return;
    untrack(() => {
      const r = v.round;
      if (v.scout) {
        const at = v.scout.at;
        once(`peek:${r}`, () => {
          if (t - at < PEEK_FRESH_MS) on.peek(r);
        });
      }
      const reveal = v.reveal;
      if (!reveal) {
        const left = v.endsAt - t;
        if (left > 0 && left <= DOOR_MS) {
          const secs = Math.ceil(left / 1000);
          once(`gear:${r}:${secs}`, () => on.gear(secs, v.locked));
        }
        return;
      }
      const elapsed = t - v.endsAt;
      once(`lid:${r}`, () => {
        if (elapsed < FRESH_MS) on.lid(r);
      });
      const plan = fillPlan(reveal, reduced());
      plan.segments.forEach((s, i) => {
        if (elapsed < s.at) return;
        const fresh = elapsed - s.at < FRESH_MS;
        once(`seg:${r}:${i}`, () => {
          if (fresh) on.strip(r, i, s);
        });
        if (s.slow) {
          once(`heart:${r}`, () => {
            if (fresh) on.heart(r);
          });
        }
      });
      if (elapsed >= plan.verdictAt) {
        once(`verdict:${r}`, () => {
          if (elapsed - plan.verdictAt < FRESH_MS) on.verdict(r, verdictOf(reveal));
        });
      }
    });
  });
}
