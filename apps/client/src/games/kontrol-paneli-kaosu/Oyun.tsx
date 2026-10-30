import type { WireColor } from "@glix/engine";
import { createSignal, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { type AckLike, createOptimistic } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { wireSnap } from "./bombSounds.js";
import { Note } from "./Note.js";
import { Panel } from "./Panel.js";
import type { KontrolScreenView } from "./view.js";

interface Props {
  view: KontrolScreenView;
  total: number;
  spectator: boolean;
}

/** Dalga: kendi panelin, kabloların altında yalnız sana görünen ipucu notu; bir kablo seç ve KES (dalga başına tek). */
export function Oyun(props: Props) {
  const [picked, setPicked] = createSignal<WireColor | null>(null);
  // Kesilen kablo dokununca hemen kopar; sunucu onaylar, reddederse geri gelir.
  const [myCut, setMyCut] = createOptimistic<WireColor | null>(() => props.view.myCut);
  const cutDone = () => myCut() !== null;
  const closed = () => props.spectator || cutDone();
  const cut = (): AckLike => {
    const color = picked();
    if (closed() || color === null) return false;
    unlockAudio();
    const ack = sendActionAck({ kind: "cut", color, wave: props.view.wave });
    // Kablo görselde hemen kopar (iyimser); kopma sesi ve titreşimi yalnız sunucu kabul edince.
    void ack.then((r) => {
      if (r.ok) wireSnap();
    });
    setMyCut(color, () => ack);
    return ack;
  };
  return (
    <div class="kp__main">
      <Show
        when={!props.spectator}
        fallback={
          <div class="kp__idle">
            <span>Herkes kendi bombasının kablosunu arıyor</span>
          </div>
        }
      >
        <Panel
          panel={props.view.panel}
          selected={picked()}
          cut={myCut()}
          disabled={closed()}
          onPick={(c) => {
            unlockAudio();
            tap();
            hapticTap();
            setPicked(c);
          }}
        />
        <Show when={props.view.clue}>{(clue) => <Note clue={clue()} />}</Show>
      </Show>

      <TamamBar
        locked={cutDone()}
        ready={props.view.done.length + (cutDone() && props.view.myCut === null ? 1 : 0)}
        total={props.total}
        disabled={picked() === null}
        spectator={props.spectator}
        dots={false}
        label="Kes"
        doneLabel="Kestin"
        onLock={cut}
      />
    </div>
  );
}
