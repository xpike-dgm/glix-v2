import { createMemo, createSignal, For, Index, Show } from "solid-js";
import { hapticReady } from "../../fx/haptics.js";
import { type ActionAck, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { pressable } from "../../ui/press.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { createWordDraft } from "../../ui/wordDraft.js";
import { SecretBoard } from "./SecretBoard.js";
import { dingSound } from "./sounds.js";
import { HintLine } from "./TopicCard.js";
import { gridRows, letterSlots, type YaziYazScreenView } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";
import { shortName } from "./Yazma.js";

interface Props {
  view: YaziYazScreenView;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
}

/**
 * Tahmin (YY-U4): seçtiğin kişi büyür, pembe halka ve "YAZAN?" rozeti alır; hazır olanlarda köşede küçük yeşil nokta
 * (aynı işaret iki anlamda kullanılmaz). Izgara oyuncu sayısına göre ortalanır (boş hücre yok). "Kelimesi ne?" alanı
 * gizli panodur; altında harf kutucukları dolar.
 */
export function Tahmin(props: Props) {
  const closed = () => props.spectator || props.view.locked;
  const pick = createPendingPick({
    server: () => props.view.myGuess.target,
    send: (id) => sendActionAck({ kind: "guessPlayer", target: id }),
    closed,
  });
  const draft = createWordDraft({
    server: () => props.view.myGuess.word,
    send: (text) => sendActionAck({ kind: "guessWord", text }),
    allowEmpty: true,
  });
  const [typed, setTyped] = createSignal(props.view.myGuess.word);
  const lock = (): Promise<ActionAck> | false => {
    if (closed() || pick.value() === null) return false;
    draft.flush();
    dingSound();
    hapticReady();
    return sendActionAck({ kind: "lock" });
  };
  const rows = createMemo(() => {
    const sizes = gridRows(props.crew.length);
    let at = 0;
    return sizes.map((n) => {
      const row = props.crew.slice(at, at + n);
      at += n;
      return row;
    });
  });
  const cols = () => Math.max(1, ...rows().map((r) => r.length));
  // Harf kutucukları: yazılan uzunluğa en yakın (eşit ya da büyük) ipucu sayısına kadar.
  const target = () => {
    const n = letterSlots(typed(), null).length;
    const counts = (props.view.letters ?? []).filter((x): x is number => x !== null).sort((a, b) => a - b);
    return counts.find((c) => c >= n) ?? null;
  };
  const slots = () => letterSlots(props.view.locked ? props.view.myGuess.word : typed(), target());
  const fits = () => {
    const n = letterSlots(typed(), null).length;
    return n > 0 && (props.view.letters ?? []).includes(n);
  };

  return (
    <>
      <div class="yy__head yy__head--guess">
        <span class="overline">Tahmin zamanı</span>
        <span class="yy__title">{props.spectator ? "Tahmin ediyorlar" : "Yazan kim?"}</span>
        <HintLine topic={props.view.topic} letters={props.view.letters} />
      </div>

      <div class="yyg" style={{ "--yyg-cols": cols() }} data-n={props.crew.length}>
        <For each={rows()}>
          {(row) => (
            <div class="yyg__row">
              <For each={row}>
                {(p) => {
                  const self = () => p.id === props.selfId;
                  const picked = () => pick.value() === p.id;
                  const press = pressable(() => {
                    if (!closed() && !self()) pick.pick(p.id);
                  });
                  return (
                    <button
                      type="button"
                      class="yyg__cell"
                      data-picked={picked() ? "1" : undefined}
                      data-self={self() ? "1" : undefined}
                      data-off={p.connected ? undefined : "1"}
                      data-idle={closed() ? "1" : undefined}
                      disabled={closed() || self()}
                      aria-pressed={picked()}
                      aria-label={
                        self() ? `${p.nickname} (sen)` : `${p.nickname} adlı oyuncuyu yazan olarak seç`
                      }
                      onPointerDown={press.onPointerDown}
                      onClick={press.onClick}
                    >
                      <span class="yyg__portrait">
                        <Show when={self()}>
                          <span class="yyg__you">Sen</span>
                        </Show>
                        <Avatar
                          index={p.avatar}
                          size="var(--yyg-av)"
                          connected={p.connected}
                          ring={picked() ? "#FF2BD6" : undefined}
                        />
                        <Show when={props.view.ready.includes(p.id)}>
                          <i class="yyg__dot" role="img" aria-label="hazır" />
                        </Show>
                        <Show when={picked()}>
                          <span class="yyg__badge">YAZAN?</span>
                        </Show>
                      </span>
                      <span class="yyg__name">{shortName(p.nickname)}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </div>

      <div class="yy__foot">
        <Show when={!props.spectator}>
          <SecretBoard
            variant="plain"
            label="Kelime tahmini"
            placeholder="Kelimesi ne?"
            value={props.view.myGuess.word}
            locked={props.view.locked}
            onInput={(raw) => draft.input(raw)}
            onText={setTyped}
            onEnter={lock}
          />
          <Show when={slots().length > 0}>
            <div class="yy__slots" data-fit={fits() ? "1" : undefined} aria-hidden="true">
              <Index each={slots()}>
                {(ch) => <span class="yy__slot" data-on={ch() ? "1" : undefined} />}
              </Index>
            </div>
          </Show>
        </Show>
        <TamamBar
          dots={false}
          locked={props.view.locked}
          ready={props.view.ready.length}
          readyIds={props.view.ready}
          total={props.crew.length}
          disabled={pick.value() === null}
          spectator={props.spectator}
          onLock={lock}
        />
      </div>
    </>
  );
}
