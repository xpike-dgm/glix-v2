import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
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
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          {(v) => <ProgressBar startedAt={v().startedAt} endsAt={v().endsAt} now={serverNow} urgency />}
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <div class="gh__text">
        <span class="overline">Gizli Hırsız</span>
        <h2 class="gh__head" data-on={pressed() ? "1" : undefined}>
          {headline()}
        </h2>
        <p class="gh__sub">{sub()}</p>
      </div>

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
