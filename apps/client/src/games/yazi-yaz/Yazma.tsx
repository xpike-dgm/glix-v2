import { createSignal, For, Show } from "solid-js";
import { hapticReady } from "../../fx/haptics.js";
import { ready as readySound } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import type { AckLike } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { WordField } from "../../ui/WordField.js";
import { createWordDraft } from "../../ui/wordDraft.js";
import { hasWord } from "../../ui/wordInput.js";
import { RolePeek } from "./RolePeek.js";
import type { YaziYazScreenView } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

interface Props {
  view: YaziYazScreenView;
  crew: Crew[];
  spectator: boolean;
}

/**
 * Yazma sahnesi: yazan ve masumun ekranı birebir aynı görünür (aynı alan, aynı yazılar); rol yalnız "Rolüm"
 * düğmesi basılı tutulunca görünür.
 */
export function Yazma(props: Props) {
  const draft = createWordDraft({
    server: () => props.view.myText ?? "",
    send: (text) => {
      sendAction({ kind: "write", text });
    },
    allowEmpty: false,
  });
  const [nudge, setNudge] = createSignal(false);
  const locked = () => props.view.locked;

  const lock = (): AckLike => {
    if (props.spectator || locked() || !hasWord(draft.text())) return false;
    if (props.view.role === "innocent" && draft.text() !== "MASUM") {
      setNudge(true);
      return false;
    }
    draft.flush();
    readySound();
    hapticReady();
    return sendActionAck({ kind: "lock" });
  };

  return (
    <>
      <div class="yy__head yy__head--write">
        <span class="overline">Gizli yazı</span>
        <span class="yy__title">{props.spectator ? "Herkes yazıyor" : "Kelimeni yaz"}</span>
      </div>

      <div class="yy__mid">
        <Show
          when={!props.spectator}
          fallback={
            <div class="yy__sign yy__sign--idle" aria-hidden="true">
              <span>· · ·</span>
            </div>
          }
        >
          <WordField
            variant="sign"
            label="Yazın"
            placeholder="Yaz…"
            value={props.view.myText ?? ""}
            locked={locked()}
            onInput={(raw) => {
              setNudge(false);
              return draft.input(raw);
            }}
            onEnter={lock}
          />
          <p class="yy__nudge" data-on={nudge() ? "1" : undefined} role="status">
            {nudge() ? "Yalnız MASUM yazabilirsin" : ""}
          </p>
          <RolePeek role={props.view.role} />
        </Show>
      </div>

      <ul class="yy__crew" aria-label="Oyuncular">
        <For each={props.crew}>
          {(p) => (
            <li class="yy__p" data-done={props.view.ready.includes(p.id) ? "1" : undefined}>
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
        locked={locked()}
        ready={props.view.ready.length}
        readyIds={props.view.ready}
        total={props.crew.length}
        disabled={!hasWord(draft.text())}
        spectator={props.spectator}
        onLock={lock}
      />
    </>
  );
}
