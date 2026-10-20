import type { WireColor } from "@glix/engine";
import { createSignal, Show } from "solid-js";
import { hapticReady, hapticTap } from "../../fx/haptics.js";
import { fail, ready as readySound, tap, unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { Panel } from "./Panel.js";
import { clueText, type KontrolScreenView } from "./view.js";

interface Props {
  view: KontrolScreenView;
  total: number;
  spectator: boolean;
}

/** Oyun: kendi panelin, kabloların altında yalnız sana görünen ipucu notu; bir kablo seç ve KES. */
export function Oyun(props: Props) {
  const [picked, setPicked] = createSignal<WireColor | null>(null);
  const cutDone = () => props.view.myCut !== null;
  const closed = () => props.spectator || cutDone();
  const cut = (): void => {
    const color = picked();
    if (closed() || color === null) return;
    unlockAudio();
    if (sendAction({ kind: "cut", color })) {
      readySound();
      hapticReady();
    } else {
      fail();
    }
  };
  return (
    <>
      <div class="kp__head">
        <span class="overline">Kontrol paneli</span>
        <span class="kp__title">
          {props.spectator ? "Herkes kablo kesiyor" : cutDone() ? "Kablo kesildi" : "Bir kablo kes"}
        </span>
      </div>

      <div class="kp__main">
        <Show
          when={!props.spectator}
          fallback={
            <div class="kp__idle" aria-hidden="true">
              <span>Paneller sessizce çalışıyor</span>
            </div>
          }
        >
          <Panel
            panel={props.view.panel}
            selected={picked()}
            cut={props.view.myCut}
            disabled={closed()}
            onPick={(c) => {
              unlockAudio();
              tap();
              hapticTap();
              setPicked(c);
            }}
          />
          <Show when={props.view.clue}>
            {(clue) => (
              <div class="kp__note">
                <span class="kp__note-tag">İpucu notu · sesli oku</span>
                <p class="kp__note-text">{clueText(clue())}</p>
              </div>
            )}
          </Show>
        </Show>

        <TamamBar
          locked={cutDone()}
          ready={props.view.done.length}
          total={props.total}
          disabled={picked() === null}
          spectator={props.spectator}
          label="Kes"
          doneLabel="Kestin"
          onLock={cut}
        />
      </div>
    </>
  );
}
