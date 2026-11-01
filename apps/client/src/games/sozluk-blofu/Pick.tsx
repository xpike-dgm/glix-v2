import { For, Show } from "solid-js";
import { sendActionAck } from "../../net/client.js";
import { CheckIcon } from "../../ui/Icons.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { paperTapSound } from "./sounds.js";
import { type CrewMember, cardNumber, type SozlukScreenView } from "./view.js";
import { Term } from "./Write.js";

interface Props {
  view: SozlukScreenView;
  crew: CrewMember[];
  spectator: boolean;
}

/**
 * Karıştırılmış kartlardan gerçek anlamı seç (SB-U4): kendi kartın listeden çıkar ve başlığın altında "Senin blöfün (3)"
 * şeridine döner; numaralar ortak sıradan gelir (herkeste aynı). Seçili kart "SEÇİLDİ" yazısıyla da belli olur (SB-U18).
 */
export function Pick(props: Props) {
  const cards = () => props.view.cards ?? [];
  const closed = () => props.spectator || props.view.locked;
  const pick = createPendingPick({
    server: () => props.view.myPick,
    send: (card) => sendActionAck({ kind: "pick", card }),
    closed,
  });
  const ownNo = () => cardNumber(cards(), props.view.myCard);
  const ownText = () => cards().find((c) => c.id === props.view.myCard)?.text ?? props.view.myBluff ?? "";
  const chosen = () => {
    const id = pick.value();
    const c = cards().find((x) => x.id === id);
    return c ? { no: cardNumber(cards(), c.id), text: c.text } : null;
  };
  return (
    <>
      <div class="sb__head sb__head--pick">
        <span class="overline">{props.spectator ? "Gizli seçim" : "Gerçek anlam hangisi?"}</span>
        <Term word={props.view.word} type={props.view.wordType} small />
      </div>
      <Show when={!props.spectator && ownNo()}>
        {(no) => (
          <p class="sbown">
            <b>Senin blöfün ({no()})</b> <span>{ownText()}</span>
          </p>
        )}
      </Show>
      <ul class="sbcards" data-scroll aria-label="Tanımlar">
        <For each={cards()}>
          {(c, i) => {
            const picked = () => pick.value() === c.id;
            return (
              <Show when={props.view.myCard !== c.id}>
                <li style={{ "--i": i() }}>
                  <button
                    type="button"
                    class="sbcard"
                    data-picked={picked() ? "1" : undefined}
                    disabled={closed()}
                    aria-pressed={picked()}
                    aria-label={`Kart ${i() + 1}: ${c.text}${picked() ? ", seçildi" : closed() ? "" : ", seçilebilir"}`}
                    onClick={() => {
                      if (!closed() && !picked()) paperTapSound();
                      pick.pick(c.id);
                    }}
                  >
                    <span class="sbcard__no">{i() + 1}</span>
                    <span class="sbcard__body">
                      <span class="sbcard__text">{c.text}</span>
                    </span>
                    <Show when={picked()}>
                      <span class="sbcard__sel" aria-hidden="true">
                        <span class="sbcard__tick">
                          <CheckIcon size="70%" />
                        </span>
                        SEÇİLDİ
                      </span>
                    </Show>
                  </button>
                </li>
              </Show>
            );
          }}
        </For>
      </ul>
      <Show when={!props.spectator && chosen()}>
        {(c) => (
          <p class="sbchosen" aria-hidden="true">
            Seçimin: {c().no} · {c().text}
          </p>
        )}
      </Show>
      <TamamBar
        locked={props.view.locked}
        ready={props.view.ready.length}
        readyIds={props.view.ready}
        total={props.crew.length}
        disabled={pick.value() === null}
        spectator={props.spectator}
        onLock={() => sendActionAck({ kind: "lock" })}
      />
    </>
  );
}
