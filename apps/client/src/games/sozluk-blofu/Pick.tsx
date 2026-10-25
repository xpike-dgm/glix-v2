import { For, Show } from "solid-js";
import { sendActionAck } from "../../net/client.js";
import { CheckIcon } from "../../ui/Icons.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { CrewMember, SozlukScreenView } from "./view.js";
import { Term } from "./Write.js";

interface Props {
  view: SozlukScreenView;
  crew: CrewMember[];
  spectator: boolean;
}

/** Karıştırılmış kartlardan gerçek anlamı seç; kendi yazdığın kart seçilemez. */
export function Pick(props: Props) {
  const cards = () => props.view.cards ?? [];
  const closed = () => props.spectator || props.view.locked;
  const pick = createPendingPick({
    server: () => props.view.myPick,
    send: (card) => sendActionAck({ kind: "pick", card }),
    closed,
  });
  return (
    <>
      <div class="sb__head sb__head--pick">
        <span class="overline">{props.spectator ? "Gizli seçim" : "Gerçek anlam hangisi?"}</span>
        <Term word={props.view.word} small />
      </div>
      <ul class="sbcards" data-scroll aria-label="Tanımlar">
        <For each={cards()}>
          {(c, i) => {
            const own = () => props.view.myCard === c.id;
            const picked = () => pick.value() === c.id;
            return (
              <li style={{ "--i": i() }}>
                <button
                  type="button"
                  class="sbcard"
                  data-picked={picked() ? "1" : undefined}
                  data-own={own() ? "1" : undefined}
                  disabled={closed() || own()}
                  aria-pressed={picked()}
                  onClick={() => pick.pick(c.id)}
                >
                  <span class="sbcard__no">{i() + 1}</span>
                  <span class="sbcard__body">
                    <span class="sbcard__text">{c.text}</span>
                    <Show when={own()}>
                      <span class="sbcard__tag">Senin yazdığın</span>
                    </Show>
                  </span>
                  <Show when={picked()}>
                    <span class="sbcard__tick" aria-hidden="true">
                      <CheckIcon size="70%" />
                    </span>
                  </Show>
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
        disabled={pick.value() === null}
        spectator={props.spectator}
        onLock={() => sendActionAck({ kind: "lock" })}
      />
    </>
  );
}
