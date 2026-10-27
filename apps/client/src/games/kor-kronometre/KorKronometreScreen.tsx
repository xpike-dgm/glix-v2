import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { currentFlashPeak } from "../../fx/shake.js";
import { match as matchSound, solo as soloSound, tap, unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import "./kor-kronometre.css";
import { Dial } from "./Dial.js";
import {
  entryOf,
  formatOffset,
  formatSeconds,
  formatTarget,
  parseKorKronometreView,
  targetPercent,
  trackPercent,
} from "./view.js";

export default function KorKronometreScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKorKronometreView(props.match.publicView, props.match.view));
  const reveal = () => view()?.reveal ?? null;
  const targetMs = () => view()?.targetMs ?? 10_000;

  // Dokunuşa anında yanıt: sunucu onayı beklenmeden kadran donar. Basış tek seferdir.
  const [localPressed, setLocalPressed] = createSignal(false);
  const pressed = () => localPressed() || (view()?.pressed ?? false);
  const closed = () => {
    const v = view();
    return !v || v.reveal !== null || props.now() >= v.endsAt;
  };

  let flashEl: HTMLDivElement | undefined;
  const press = (e: PointerEvent): void => {
    e.preventDefault();
    if (props.spectator || pressed() || closed()) return;
    // Zamanlama oyunu: eylem pointerdown anında gider, başka hiçbir iş onu geciktirmez.
    sendAction({ kind: "press" });
    setLocalPressed(true);
    unlockAudio();
    tap();
    hapticTap();
    flashEl?.animate([{ opacity: currentFlashPeak(0.55) }, { opacity: 0 }], {
      duration: 420,
      easing: "ease-out",
    });
  };

  // Sonuç açılınca bir kez ses ve titreşim.
  let announced = false;
  createEffect(() => {
    const r = reveal();
    if (!r || announced) return;
    announced = true;
    const mine = entryOf(r, props.selfId);
    const timer = setTimeout(() => {
      if (mine && mine.points > 0) {
        matchSound();
        hapticMatch();
      } else if (!props.spectator) {
        soloSound();
        hapticSolo();
      }
    }, 420);
    onCleanup(() => clearTimeout(timer));
  });

  const mine = () => entryOf(reveal(), props.selfId);
  const avatarOf = (id: string) => props.players.find((p) => p.id === id)?.avatar ?? 0;
  const connectedOf = (id: string) => props.players.find((p) => p.id === id)?.connected ?? true;

  return (
    <Screen class="kk">
      <Show when={view()}>
        <Show
          when={reveal()}
          fallback={
            <>
              <p class="kk__target-label" role="status">
                {formatTarget(targetMs())}
              </p>
              <div class="kk__stage">
                <Dial locked={pressed()} />
                <div class="kk__flash" ref={flashEl} aria-hidden="true" />
              </div>
              <p class="kk__hint" role="status">
                {props.spectator
                  ? "Herkes içinden sayıyor…"
                  : pressed()
                    ? "Bastın! Diğerleri bekleniyor"
                    : "İçinden say…"}
              </p>
              <Show when={!props.spectator}>
                <button
                  type="button"
                  class="kk__press"
                  data-done={pressed() ? "1" : undefined}
                  disabled={pressed() || closed()}
                  aria-label="Bas"
                  onPointerDown={press}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      press(e as unknown as PointerEvent);
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span class="kk__press-label">{pressed() ? "BASTIN" : "BAS"}</span>
                </button>
              </Show>
            </>
          }
        >
          {(r) => (
            <div class="kk__result">
              <div class="kk__head">
                <span class="overline">{formatTarget(targetMs())}</span>
                <Show when={!props.spectator} fallback={<p class="kk__verdict">Sonuç</p>}>
                  <p class="kk__verdict" data-win={(mine()?.points ?? 0) > 0 ? "1" : "0"}>
                    {(mine()?.points ?? 0) > 0 ? `+${mine()?.points} puan` : "Puan yok"}
                  </p>
                  <p class="kk__sub">
                    {mine()?.pressed
                      ? `${formatSeconds(mine()?.ms ?? 0)} sn · ${formatOffset(mine()?.ms ?? 0, targetMs())}`
                      : "Basmadın"}
                  </p>
                </Show>
              </div>
              <ol class="kk__rows">
                <For each={r().entries}>
                  {(e, i) => (
                    <li
                      class="kk__row rise"
                      style={{ "--i": i() }}
                      data-me={e.playerId === props.selfId ? "1" : undefined}
                      data-pts={e.points}
                    >
                      <Avatar index={avatarOf(e.playerId)} size={36} connected={connectedOf(e.playerId)} />
                      <div class="kk__track" aria-hidden="true">
                        <i class="kk__target" style={{ left: `${targetPercent(targetMs())}%` }} />
                        <Show when={e.ms !== null}>
                          <i class="kk__dot" style={{ left: `${trackPercent(e.ms ?? 0, targetMs())}%` }} />
                        </Show>
                      </div>
                      <span class="kk__time" data-missed={e.pressed ? undefined : "1"}>
                        {e.ms !== null ? formatSeconds(e.ms) : "basmadı"}
                      </span>
                      <span class="kk__pts" data-pts={e.points}>
                        {e.pressed ? (e.points > 0 ? `+${e.points}` : "0") : "–"}
                      </span>
                    </li>
                  )}
                </For>
              </ol>
            </div>
          )}
        </Show>
      </Show>
    </Screen>
  );
}
