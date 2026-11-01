import { type Accessor, createEffect, untrack } from "solid-js";
import { createOnce } from "../../fx/cue.js";
import { type CizgiScreenView, type ClimbPin, climbPlan } from "./view.js";

/** Geç açılan ekranda (yeniden bağlanma) geçmiş anın sesi yalnız bu kadar yeniyse çalar. */
export const FRESH_MS = 400;
/** Radar geç gelen görünümde bu kadar yeniyse çalar. */
export const RADAR_FRESH_MS = 1_500;
/** Son uyarı penceresi (CZ-U14): son 5 sn. */
export const LAST_MS = 5_000;

export interface CizgiCueHandlers {
  /** Son 5 sn, her saniye bir kez. */
  last: (secs: number, round: number) => void;
  /** Radar çekildi (`zones`: yanan platformlar). */
  radar: (round: number, zones: readonly number[]) => void;
  /** Açılışta bir pin tırmanmaya başladı / platformuna oturdu. */
  climb: (round: number, pin: ClimbPin) => void;
  seat: (round: number, pin: ClimbPin) => void;
  /** Bir platformda çarpışma oldu. */
  crash: (round: number, zone: number) => void;
  /** En yüksek tek kalan fırladı (tek kalan yoksa çağrılmaz). */
  launch: (round: number) => void;
  /** Puan ve başlık göründü. */
  points: (round: number) => void;
}

/**
 * Çizgiyi Geçme ses tetikleyicileri (CZ-U14 / CZ-U5 / CZ-U6). Saat her karede ilerler, görünüm her güncellemede yeniden
 * üretilir; her olay kimliğiyle (`tur:olay:sıra`) ekranın ömrü boyunca yalnız bir kez çalar. Geç açılan ekranda geçmiş
 * anlar sessiz geçer.
 */
export function cizgiCues(
  view: Accessor<CizgiScreenView | null>,
  now: Accessor<number>,
  reduced: Accessor<boolean>,
  order: Accessor<readonly string[]>,
  on: CizgiCueHandlers,
): void {
  const once = createOnce();
  createEffect(() => {
    const v = view();
    const t = now();
    if (!v) return;
    untrack(() => {
      const r = v.round;
      const radar = v.radar;
      if (radar) {
        once(`radar:${r}`, () => {
          if (t - radar.at < RADAR_FRESH_MS) on.radar(r, radar.zones);
        });
      }
      const reveal = v.reveal;
      if (!reveal) {
        const left = v.endsAt - t;
        if (left > 0 && left <= LAST_MS) {
          const secs = Math.ceil(left / 1000);
          once(`last:${r}:${secs}`, () => on.last(secs, r));
        }
        return;
      }
      const elapsed = t - v.endsAt;
      const plan = climbPlan(reveal, order(), reduced(), r < v.rounds);
      plan.pins.forEach((p, i) => {
        if (elapsed >= p.startAt && p.startAt < p.seatAt) {
          once(`climb:${r}:${i}`, () => {
            if (elapsed - p.startAt < FRESH_MS) on.climb(r, p);
          });
        }
        if (elapsed >= p.seatAt) {
          once(`seat:${r}:${i}`, () => {
            if (elapsed - p.seatAt < FRESH_MS) on.seat(r, p);
          });
        }
      });
      for (const [zone, at] of plan.crashAt) {
        if (elapsed < at) continue;
        once(`crash:${r}:${zone}`, () => {
          if (elapsed - at < FRESH_MS) on.crash(r, zone);
        });
      }
      const hasWinner = Object.values(reveal.status).includes("first");
      if (hasWinner && elapsed >= plan.launchAt) {
        once(`launch:${r}`, () => {
          if (elapsed - plan.launchAt < FRESH_MS) on.launch(r);
        });
      }
      if (elapsed >= plan.pointsAt) {
        once(`points:${r}`, () => {
          if (elapsed - plan.pointsAt < FRESH_MS) on.points(r);
        });
      }
    });
  });
}
