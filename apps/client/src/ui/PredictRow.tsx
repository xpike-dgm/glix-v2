import { type Accessor, createEffect, on, Show } from "solid-js";
import { hapticPress } from "../fx/haptics.js";
import { unlockAudio } from "../fx/sound.js";
import { sendActionAck } from "../net/client.js";
import { toast } from "../net/store.js";
import { createOptimistic } from "./optimistic.js";
import { pressable } from "./press.js";

interface Props {
  /** Kısa soru ("Patlar mı?"). */
  question: string;
  yesLabel: string;
  noLabel: string;
  /** Tahmin edilen el / atış sırası (eylemdeki `turn`). */
  turn: number;
  /** Sunucudaki kendi tahminim; yoksa null. */
  chosen: boolean | null;
  /** Dar alanlarda soru yalnız ekran okuyucuya okunur. */
  compact?: boolean;
  /** Soru üstte, iki eşit büyük düğme altta (geniş alanlı oyunlar). */
  stacked?: boolean;
  class?: string;
}

/**
 * Kompakt tahmin satırı: iki düğme, seçince anında "Tahminin alındı" (iyimser; sunucu reddederse geri döner).
 * Satır yalnız hak sahibine çizilir; süre ya da başka gizli bilgi hakkında hiçbir ipucu taşımaz.
 */
export function PredictRow(props: Props) {
  const [shown, setShown] = createOptimistic<boolean | null>(() => props.chosen);
  const pick = (explodes: boolean): void => {
    if (shown() !== null) return;
    unlockAudio();
    hapticPress();
    setShown(explodes, () => sendActionAck({ kind: "predict", turn: props.turn, explodes }));
  };
  const yes = pressable(() => pick(true));
  const no = pressable(() => pick(false));
  return (
    <div
      class={`prd ${props.stacked ? "prd--stack" : ""} ${props.class ?? ""}`}
      data-done={shown() !== null ? "1" : undefined}
    >
      <Show
        when={shown() === null}
        fallback={
          <p class="prd__done" role="status">
            Tahminin alındı
          </p>
        }
      >
        <span class={props.compact ? "sr-only" : "prd__q"}>{props.question}</span>
        <div class="prd__btns">
          <button type="button" class="prd__btn" onPointerDown={yes.onPointerDown} onClick={yes.onClick}>
            {props.yesLabel}
          </button>
          <button type="button" class="prd__btn" onPointerDown={no.onPointerDown} onClick={no.onClick}>
            {props.noLabel}
          </button>
        </div>
      </Show>
    </div>
  );
}

/** Çözülen tahminin sonucunu küçük bir bildirimle ("Bildin!" / "Bilemedin") gösterir; ilk değer (yenileme) sessizdir. */
export function createPredictionToast(result: Accessor<{ turn: number; correct: boolean } | null>): void {
  let seen: number | null | undefined;
  createEffect(
    on(result, (r) => {
      const key = r ? r.turn : null;
      if (seen === undefined) {
        seen = key;
        return;
      }
      if (r && key !== seen) toast(r.correct ? "Bildin!" : "Bilemedin", r.correct ? "success" : "info");
      seen = key;
    }),
  );
}
