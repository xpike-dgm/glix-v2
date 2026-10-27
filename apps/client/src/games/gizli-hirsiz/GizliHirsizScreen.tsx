import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { Core } from "./Core.js";
import "./gizli-hirsiz.css";
import { prick } from "./sounds.js";
import { parseGizliHirsizView } from "./view.js";

export default function GizliHirsizScreen(props: GameScreenProps) {
  const view = createMemo(() => parseGizliHirsizView(props.match.publicView, props.match.view));
  const [localPressed, setLocalPressed] = createSignal(false);
  const [ripple, setRipple] = createSignal(0);
  let sent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  // Yalnız kendi basışın: sunucudan gelen `pressed` ya da yerel basış.
  const pressed = () => !props.spectator && (localPressed() || (view()?.pressed ?? false));
  const over = () => {
    const v = view();
    return !v || v.finished || props.now() >= v.endsAt;
  };
  const locked = () => props.spectator === true || pressed() || over();

  const steal = (e: PointerEvent): void => {
    e.preventDefault();
    if (locked()) return;
    unlockAudio();
    setLocalPressed(true);
    setRipple((n) => n + 1);
    prick();
    hapticTap();
    if (sent) return;
    sent = true;
    sendAction({ kind: "steal" });
  };

  const headline = () => {
    if (props.spectator) return "Kasayı izliyorsun";
    return pressed() ? "Parmak izin kayıtta" : "Doğru anı bekle";
  };
  const sub = () => {
    if (props.spectator) return "Kimin bastığı sonda belli olur";
    return pressed() ? "Sonucu sonda göreceksin" : "Yalnız bir kez basabilirsin";
  };

  return (
    <Screen class="gh">
      <Show when={view()}>{(v) => <PhaseClock startedAt={v().startedAt} endsAt={v().endsAt} urgency />}</Show>

      <Status class="gh__text" titleClass="gh__head" subClass="gh__sub" on={pressed()} sub={sub()}>
        {headline()}
      </Status>

      <div class="gh__stage">
        <Core state={pressed() ? "marked" : "idle"} />
        <Show when={ripple() > 0 ? ripple() : false} keyed>
          {(n) => <i class="gh__ripple" data-n={n} aria-hidden="true" />}
        </Show>
      </div>

      <footer class="gh__foot">
        <Show when={!props.spectator}>
          <button
            type="button"
            class="gh__btn"
            data-done={pressed() ? "1" : undefined}
            disabled={locked()}
            onPointerDown={steal}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") steal(e as unknown as PointerEvent);
            }}
          >
            {pressed() ? "BASTIN" : "ÇAL"}
          </button>
        </Show>
      </footer>
    </Screen>
  );
}
