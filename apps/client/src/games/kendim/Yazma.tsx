import { For } from "solid-js";
import { hapticReady } from "../../fx/haptics.js";
import { ready as readySound } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { WordField } from "../../ui/WordField.js";
import { createWordDraft } from "../../ui/wordDraft.js";
import { hasWord } from "../../ui/wordInput.js";
import type { Crew } from "./KendimScreen.js";
import type { KendimScreenView } from "./view.js";

interface Props {
  view: KendimScreenView;
  crew: Crew[];
  spectator: boolean;
}

/** Yazma: kendini anlatan tek kelime. Tamam'a kadar değiştirilebilir. */
export function Yazma(props: Props) {
  const draft = createWordDraft({
    server: () => props.view.myText ?? "",
    send: (text) => {
      sendAction({ kind: "write", text });
    },
    allowEmpty: false,
  });
  const lock = (): void => {
    if (props.spectator || props.view.locked || !hasWord(draft.text())) return;
    draft.flush();
    if (sendAction({ kind: "lock" })) {
      readySound();
      hapticReady();
    }
  };
  return (
    <>
      <div class="kd__head kd__head--write">
        <span class="overline">Kendini anlat</span>
        <span class="kd__title">{props.spectator ? "Herkes yazıyor" : "Tek kelime yaz"}</span>
      </div>

      <div class="kd__mid">
        {props.spectator ? (
          <div class="kd__idle" aria-hidden="true">
            <span>· · ·</span>
          </div>
        ) : (
          <>
            <WordField
              variant="sign"
              label="Seni anlatan kelime"
              placeholder="Ben…"
              value={props.view.myText ?? ""}
              locked={props.view.locked}
              onInput={(raw) => draft.input(raw)}
              onEnter={lock}
            />
            <p class="kd__hint">Seni en iyi anlatan tek kelime</p>
          </>
        )}
      </div>

      <ul class="kd__crew" aria-label="Oyuncular">
        <For each={props.crew}>
          {(p) => (
            <li class="kd__p" data-done={props.view.ready.includes(p.id) ? "1" : undefined}>
              <Avatar
                index={p.avatar}
                size="min(40px, calc((100vw - 40px - 56px) / 8))"
                connected={p.connected}
                ready={props.view.ready.includes(p.id)}
              />
            </li>
          )}
        </For>
      </ul>

      <TamamBar
        locked={props.view.locked}
        ready={props.view.ready.length}
        total={props.crew.length}
        disabled={!hasWord(draft.text())}
        spectator={props.spectator}
        onLock={lock}
      />
    </>
  );
}
