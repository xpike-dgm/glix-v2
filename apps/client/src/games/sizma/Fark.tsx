import { For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";
import type { ActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { Mask } from "./Mask.js";
import { Peek } from "./Peek.js";
import type { CrewMember, SizmaScreenView } from "./view.js";

interface Props {
  view: SizmaScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  /** true = Evet, false = Hayır. Cevap tek seferliktir. */
  onAnswer: (yes: boolean) => Promise<ActionAck>;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.8" />
    </svg>
  );
}

/**
 * "Sızma sen miydin?" (SZ-M2, SZ-U4): herkese aynı soru sorulur, böylece kimin sızma olduğu sezdirilmez.
 * Kelimen hatırlatılır; kural satırı; Evet pembe maskeli, Hayır düz gri. Basınca seçilen düğme kilitle kalır,
 * diğeri kaybolur. Alt yarıda cevap verenlerin avatarları belirir (cevabın ne olduğu değil).
 */
export function Fark(props: Props) {
  const [mine, setMine] = createOptimistic<boolean | null>(() => props.view.myNotice);
  const done = () => mine() !== null;
  const total = () => props.crew.length;
  const answeredIds = () =>
    props.view.myNotice === null && done() && !props.view.ready.includes(props.selfId)
      ? [...props.view.ready, props.selfId]
      : props.view.ready;
  const answered = () => props.crew.filter((m) => answeredIds().includes(m.id));

  const choose = (yes: boolean): void => {
    if (props.spectator || done()) return;
    unlockAudio();
    tap();
    hapticTap();
    setMine(yes, () => props.onAnswer(yes));
  };

  return (
    <div class="sz__ask">
      <div class="sz__ask-top">
        <span class="overline">Sızma açıklanmadan önce</span>
        <Mask size={72} class="sz__ask-mask" />
        <h2 class="sz__ask-q">{props.spectator ? "Oyuncular cevap veriyor" : "Sızma sen miydin?"}</h2>
        <Show when={!props.spectator && props.view.word}>
          {(w) => (
            <Peek since={props.view.phaseStartedAt} now={props.now} enabled class="sz__minepeek">
              <span class="sz__mine">
                Senin kelimen <b>{w()}</b>
              </span>
            </Peek>
          )}
        </Show>
        <p class="sz__rule">
          <span>
            Sızmaysan Evet: <b>+1</b>
          </span>{" "}
          · <span>Değilsen Evet: yakalama puanı yanar</span>
        </p>
      </div>

      <div class="sz__answered">
        <ul class="sz__answered-list" aria-label="Cevap verenler">
          <For each={answered()}>
            {(m) => (
              <li class="sz__answered-av">
                <Avatar index={m.avatar} size={40} connected={m.connected} />
              </li>
            )}
          </For>
        </ul>
        <p class="sz__answered-n" role="status">
          {done() ? "Cevabın kilitlendi · " : ""}
          {answered().length}/{total()} cevapladı
        </p>
      </div>

      <Show when={!props.spectator}>
        <div class="sz__yn" data-done={done() ? "1" : undefined}>
          <Show when={mine() !== false}>
            <button
              type="button"
              class="sz__yn-btn sz__yn-btn--yes"
              data-on={mine() === true ? "1" : undefined}
              disabled={done()}
              aria-pressed={mine() === true}
              onClick={() => choose(true)}
            >
              <Show when={mine() === true} fallback={<Mask size={26} class="sz__yn-ico" />}>
                <LockIcon />
              </Show>
              Evet
            </button>
          </Show>
          <Show when={mine() !== true}>
            <button
              type="button"
              class="sz__yn-btn sz__yn-btn--no"
              data-on={mine() === false ? "1" : undefined}
              disabled={done()}
              aria-pressed={mine() === false}
              onClick={() => choose(false)}
            >
              <Show when={mine() === false}>
                <LockIcon />
              </Show>
              Hayır
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
