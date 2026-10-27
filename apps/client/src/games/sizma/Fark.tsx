import { Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";
import type { ActionAck } from "../../net/client.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { Status } from "../../ui/Status.js";
import { Mask } from "./Mask.js";
import type { CrewMember, SizmaScreenView } from "./view.js";

interface Props {
  view: SizmaScreenView;
  crew: CrewMember[];
  spectator: boolean;
  /** true = Evet, false = Hayır. Cevap tek seferliktir. */
  onAnswer: (yes: boolean) => Promise<ActionAck>;
}

/**
 * "Sızma sen miydin?": herkese aynı soru sorulur, böylece kimin sızma olduğu sezdirilmez.
 * Cevabın yalnız sana görünür; sızmanın cevabı sonuçta açılır.
 */
export function Fark(props: Props) {
  const [mine, setMine] = createOptimistic<boolean | null>(() => props.view.myNotice);
  const done = () => mine() !== null;
  const total = () => props.crew.length;
  const answered = () =>
    Math.min(total(), props.view.ready.length + (props.view.myNotice === null && done() ? 1 : 0));

  const choose = (yes: boolean): void => {
    if (props.spectator || done()) return;
    unlockAudio();
    tap();
    hapticTap();
    setMine(yes, () => props.onAnswer(yes));
  };

  return (
    <>
      <div class="sz__head">
        <span class="overline">Sızma açıklanmadan önce</span>
      </div>
      <div class="sz__mid sz__ask">
        <Mask size={56} class="sz__ask-mask" />
        <Show
          when={!props.spectator}
          fallback={
            <Status class="sz__status" sub={`${props.view.ready.length}/${total()} cevapladı`}>
              Oyuncular cevap veriyor
            </Status>
          }
        >
          <Status
            class="sz__status"
            sub={
              done() ? `Cevabın gizli · ${answered()}/${total()} cevapladı` : "Cevabın yalnız sana görünür"
            }
          >
            Sızma sen miydin?
          </Status>
        </Show>
      </div>
      <Show when={!props.spectator}>
        <div class="sz__yn">
          <button
            type="button"
            class="sz__yn-btn"
            data-on={mine() === true ? "1" : undefined}
            disabled={done()}
            aria-pressed={mine() === true}
            onClick={() => choose(true)}
          >
            Evet
          </button>
          <button
            type="button"
            class="sz__yn-btn"
            data-on={mine() === false ? "1" : undefined}
            disabled={done()}
            aria-pressed={mine() === false}
            onClick={() => choose(false)}
          >
            Hayır
          </button>
        </div>
      </Show>
    </>
  );
}
