import { KARALAMA_DRAW_MS } from "@glix/engine";
import { type JSX, Show } from "solid-js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { KaralamaScreenView } from "./view.js";
import { WordBar } from "./WordCard.js";

interface Props {
  view: KaralamaScreenView;
  now: () => number;
  /** "draw": süre drawEndsAt'e, "vote": voteEndsAt'e kadar. */
  phase?: "draw" | "vote";
  /** Kelime çubuğunun yanında gösterilecek başlık (izleyici ya da oylama). */
  title?: string;
  /** Başlığın sağındaki küçük öğe (ör. oylamada "Senin çizimin"). */
  aside?: JSX.Element;
  /** Kelimeye bakıldı (KD-U1). */
  onSeen?: () => void;
}

/**
 * Üst şerit: kelime yalnız "Kelimeni gör" çubuğuna basılı tutunca görünür (KD-U1; yan bakan okuyamaz, bilgisizin sarı
 * sinyali de yalnız açıkken). Süre kabuk saatine bildirilir.
 */
export function Header(props: Props) {
  const phase = () => props.phase ?? "draw";
  const endsAt = () => (phase() === "draw" ? props.view.drawEndsAt : props.view.voteEndsAt);
  const startedAt = () =>
    phase() === "draw" ? props.view.drawEndsAt - KARALAMA_DRAW_MS : props.view.drawEndsAt;
  return (
    <>
      <header class="kd__top">
        <div class="kd__center" data-aside={props.aside ? "1" : undefined}>
          <Show when={props.title}>
            <span class="kd__title">{props.title}</span>
          </Show>
          <Show when={props.view.word}>
            {(w) => (
              <WordBar
                word={w()}
                near={props.view.near}
                {...(props.onSeen ? { onSeen: props.onSeen } : {})}
              />
            )}
          </Show>
        </div>
        <Show when={props.aside}>{props.aside}</Show>
      </header>
      <PhaseClock startedAt={startedAt()} endsAt={endsAt()} urgency />
    </>
  );
}
