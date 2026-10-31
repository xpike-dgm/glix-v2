import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticTap, hapticTick } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { Corridor } from "./Corridor.js";
import { dash, thump } from "./sounds.js";
import "./son-kisi.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { parseSonKisiView, pulseMs } from "./view.js";

export default function SonKisiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseSonKisiView(props.match.publicView, props.match.view));
  const [localEscaped, setLocalEscaped] = createSignal(false);
  let sent = false;

  const escaped = () => !props.spectator && (localEscaped() || (view()?.priv.escaped ?? false));
  const over = () => view()?.pub.finished ?? true;
  const locked = () => props.spectator === true || escaped() || over();
  const tension = () => view()?.pub.tension ?? 0;
  const me = () => props.players.find((p) => p.id === props.selfId);
  const crew = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const gone = (id: string) => view()?.pub.escaped.includes(id) ?? false;

  // Gerilim yükselince hafif bir kalp atışı (yalnız hâlâ koridorda olanlar; yalnız 0-3 düzeyi bilinir).
  let lastTension: number | null = null;
  createEffect(
    on(tension, (t) => {
      const prev = lastTension;
      lastTension = t;
      if (prev === null || t <= prev || escaped() || props.spectator) return;
      thump();
      hapticTick();
    }),
  );
  onCleanup(() => {
    lastTension = null;
  });

  const run = (e: PointerEvent): void => {
    e.preventDefault();
    if (locked()) return;
    unlockAudio();
    setLocalEscaped(true);
    dash();
    hapticTap();
    if (sent) return;
    sent = true;
    sendAction({ kind: "escape" });
  };

  const headline = () => {
    if (props.spectator) return "Koridoru izliyorsun";
    return escaped() ? "Kaçtın!" : "Alarmı bekle";
  };
  const sub = () => {
    if (props.spectator) return "Son kaçan kazanır";
    return escaped() ? "Şimdi diğerlerini bekle" : "Herkesten geç kaç, alarmdan önce";
  };

  return (
    <Screen class="sk">
      <Status class="sk__text" titleClass="sk__head" subClass="sk__sub" on={escaped()} sub={sub()}>
        {headline()}
      </Status>

      <div
        class="sk__stage"
        data-tension={tension()}
        data-escaped={escaped() ? "1" : undefined}
        style={{ "--pulse": `${pulseMs(tension())}ms` }}
      >
        <Corridor />
        <Show when={!props.spectator}>
          <div class="sk__hero">
            <Show when={me()}>
              {(m) => <Avatar index={m().avatar} size="min(34vw, 17dvh, 132px)" connected={m().connected} />}
            </Show>
            <i class="sk__shadow" aria-hidden="true" />
          </div>
        </Show>
      </div>

      <div class="sk__crew">
        <For each={crew()}>
          {(p) => (
            <div class="sk__mate" data-gone={gone(p.id) ? "1" : undefined}>
              <Avatar
                index={p.avatar}
                size="min(44px, calc((100vw - 40px - 42px) / 8))"
                connected={p.connected}
              />
            </div>
          )}
        </For>
      </div>

      <footer class="sk__foot">
        <Show when={!props.spectator}>
          <button
            type="button"
            class="sk__btn"
            data-done={escaped() ? "1" : undefined}
            disabled={locked()}
            onPointerDown={run}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") run(e as unknown as PointerEvent);
            }}
          >
            {escaped() ? "KAÇTIN" : "KAÇ"}
          </button>
        </Show>
      </footer>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
