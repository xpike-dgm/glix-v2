import { Show } from "solid-js";
import { hapticReady } from "../../fx/haptics.js";
import { ready as readySound } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { look } from "../../ui/avatars.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { WordField } from "../../ui/WordField.js";
import { createWordDraft } from "../../ui/wordDraft.js";
import type { YaziYazScreenView } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

const RING = "#FF2BD6";

interface Props {
  view: YaziYazScreenView;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
}

/** Tahmin: bir oyuncu seç, kelimesini yaz, Tamam. Seçim ve kelime Tamam'a kadar değiştirilebilir. */
export function Tahmin(props: Props) {
  const closed = () => props.spectator || props.view.locked;
  const pick = createPendingPick({
    server: () => props.view.myGuess.target,
    send: (id) => {
      sendAction({ kind: "guessPlayer", target: id });
    },
    closed,
  });
  const draft = createWordDraft({
    server: () => props.view.myGuess.word,
    send: (text) => {
      sendAction({ kind: "guessWord", text });
    },
    allowEmpty: true,
  });
  const chosen = () => {
    const id = pick.value();
    return id === null ? null : (props.crew.find((m) => m.id === id) ?? null);
  };
  const lock = (): void => {
    if (closed() || pick.value() === null) return;
    draft.flush();
    if (sendAction({ kind: "lock" })) {
      readySound();
      hapticReady();
    }
  };
  return (
    <>
      <div class="yy__head">
        <span class="overline">{props.spectator ? "Tahmin zamanı" : "Tahmin zamanı"}</span>
        <Show
          when={chosen()}
          fallback={<span class="yy__title">{props.spectator ? "Herkes tahmin ediyor" : "Yazan kim?"}</span>}
        >
          {(p) => (
            <span class="yy__title yy__title--picked" style={{ "--tc": look(p().avatar).color }}>
              {p().nickname}
            </span>
          )}
        </Show>
      </div>

      <PlayerPicker
        players={props.crew}
        selfId={props.selfId}
        selected={pick.value()}
        disabled={closed()}
        ring={RING}
        canPick={() => true}
        ready={props.view.ready}
        label={(p) => `${p.nickname} adlı oyuncuyu yazan olarak seç`}
        onPick={(id) => pick.pick(id)}
      />

      <div class="yy__foot">
        <Show when={!props.spectator}>
          <WordField
            variant="plain"
            label="Kelime tahmini"
            placeholder="Kelimesi ne?"
            value={props.view.myGuess.word}
            locked={props.view.locked}
            onInput={(raw) => draft.input(raw)}
            onEnter={lock}
          />
        </Show>
        <TamamBar
          locked={props.view.locked}
          ready={props.view.ready.length}
          total={props.crew.length}
          disabled={pick.value() === null}
          spectator={props.spectator}
          onLock={lock}
        />
      </div>
    </>
  );
}
