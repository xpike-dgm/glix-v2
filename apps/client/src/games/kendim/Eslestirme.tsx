import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticReady, hapticTap } from "../../fx/haptics.js";
import { ready as readySound, tap, unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { BottomSheet } from "../../ui/BottomSheet.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { Crew } from "./KendimScreen.js";
import { cardOfPlayer, type KendimScreenView, pairOf, wordLen } from "./view.js";

interface Props {
  view: KendimScreenView;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
}

/**
 * Eşleştirme: karışık hologram kartlar; bir karta dokun, kimin olduğunu seç. Eşleştirmeler Tamam'a kadar
 * değiştirilebilir, boş bırakılan kart 0'dır.
 */
export function Eslestirme(props: Props) {
  const [open, setOpen] = createSignal<number | null>(null);
  const closed = () => props.spectator || props.view.locked;
  const member = (id: string | null) => (id === null ? undefined : props.crew.find((m) => m.id === id));
  const candidates = createMemo(() =>
    props.crew.filter((m) => m.id !== props.selfId && props.view.owners.includes(m.id)),
  );
  const openCard = () => props.view.cards.find((c) => c.id === open()) ?? null;
  const paired = () => props.view.cards.filter((c) => pairOf(props.view, c.id) !== null).length;

  const choose = (target: string | null): void => {
    const card = open();
    if (card === null) return;
    unlockAudio();
    tap();
    hapticTap();
    sendAction({ kind: "match", card, target });
    setOpen(null);
  };
  const lock = (): void => {
    if (closed()) return;
    if (sendAction({ kind: "lock" })) {
      readySound();
      hapticReady();
    }
  };

  return (
    <>
      <div class="kd__head">
        <span class="overline">
          {props.spectator ? "Eşleştirme" : `${paired()}/${props.view.cards.length} eşleşti`}
        </span>
        <span class="kd__title">{props.spectator ? "Herkes eşleştiriyor" : "Kim yazdı?"}</span>
      </div>

      <ul class="kd__cards" data-count={props.view.cards.length} data-scroll>
        <For each={props.view.cards}>
          {(card, i) => {
            const who = () => member(pairOf(props.view, card.id));
            return (
              <li style={{ "--i": i() }}>
                <button
                  type="button"
                  class="kd__card"
                  data-paired={who() ? "1" : undefined}
                  data-idle={closed() ? "1" : undefined}
                  style={{ "--pc": who() ? look(who()?.avatar ?? 0).color : "var(--cyan)" }}
                  disabled={closed()}
                  aria-label={`${card.text} kartı${who() ? `, eşi ${who()?.nickname}` : ", eşi yok"}`}
                  onClick={() => {
                    unlockAudio();
                    tap();
                    hapticTap();
                    setOpen(card.id);
                  }}
                >
                  <span
                    class="kd__word"
                    data-long={wordLen(card.text) > 7 ? "1" : undefined}
                    style={{ "--len": wordLen(card.text) }}
                  >
                    {card.text}
                  </span>
                  <span class="kd__slot">
                    <Show when={who()} fallback={<i class="kd__empty" />}>
                      {(m) => <Avatar index={m().avatar} size={30} />}
                    </Show>
                  </span>
                </button>
              </li>
            );
          }}
        </For>
      </ul>

      <TamamBar
        locked={props.view.locked}
        ready={props.view.ready.length}
        total={props.crew.length}
        spectator={props.spectator}
        onLock={lock}
      />

      <BottomSheet open={open() !== null} onClose={() => setOpen(null)} title={openCard()?.text ?? ""}>
        <p class="kd__ask">Bu kelime kimin?</p>
        <ul class="kd__who">
          <For each={candidates()}>
            {(m) => {
              const current = () => pairOf(props.view, open() ?? -1) === m.id;
              const elsewhere = () => {
                const c = cardOfPlayer(props.view, m.id);
                return c && c.id !== open() ? c.text : null;
              };
              return (
                <li>
                  <button
                    type="button"
                    class="kd__pick"
                    data-on={current() ? "1" : undefined}
                    aria-pressed={current()}
                    aria-label={`${m.nickname} adlı oyuncuyu seç`}
                    onClick={() => choose(m.id)}
                  >
                    <Avatar index={m.avatar} size={48} ring={current() ? "var(--lime)" : undefined} />
                    <span class="kd__pick-name">{m.nickname}</span>
                    <span class="kd__pick-tag" data-on={elsewhere() ? "1" : undefined}>
                      {elsewhere() ?? ""}
                    </span>
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
        <button
          type="button"
          class="kd__clear"
          disabled={pairOf(props.view, open() ?? -1) === null}
          onClick={() => choose(null)}
        >
          Boş bırak
        </button>
      </BottomSheet>
    </>
  );
}
