import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticTick } from "../../fx/haptics.js";
import { tap } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { RolePeek } from "./RolePeek.js";
import { clockTickSound } from "./sounds.js";
import { HintLine } from "./TopicCard.js";
import { YY_PLAN } from "./timeline.js";
import { ringPosition, type YaziYazScreenView } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

interface Props {
  view: YaziYazScreenView;
  crew: Crew[];
  selfId: string;
  now: () => number;
  spectator: boolean;
}

/** Özel işaret (yalnız bu cihazda): bir dokunuş şüpheli, iki dokunuş temiz, üçüncü kapalı (YY-U3). */
type Mark = "sus" | "clear";
const nextMark = (m: Mark | undefined): Mark | undefined =>
  m === undefined ? "sus" : m === "sus" ? "clear" : undefined;

/**
 * Sözlü tartışma: portreler halkada, ortada kalan süre, altında konu ve harf ipucu. Herkeste aynı anda atan nabız
 * çerçevesi kimseyi öne çıkarmaz (sahte "yazıyor" balonu yok). Son 10 sn'de saat kırmızı, tik ve hafif titreşim.
 */
export function Tartisma(props: Props) {
  const pos = createMemo(() => props.crew.map((_, i) => ringPosition(i, props.crew.length)));
  const secs = () => Math.max(0, Math.ceil((props.view.talkEndsAt - props.now()) / 1000));
  const [left, setLeft] = createSignal(secs());
  const [marks, setMarks] = createSignal<Readonly<Record<string, Mark>>>({});
  const toggle = (id: string): void => {
    setMarks((all) => {
      const next = { ...all };
      const m = nextMark(all[id]);
      if (m === undefined) delete next[id];
      else next[id] = m;
      return next;
    });
  };
  // Alçak (yatay) ekranda portreler küçüktür ve 48 px dokunma alanı sığmaz: işaret orada kapalıdır.
  const short = window.matchMedia("(max-height: 460px)");
  const [isShort, setShort] = createSignal(short.matches);
  const onShort = (e: MediaQueryListEvent): void => {
    setShort(e.matches);
  };
  short.addEventListener("change", onShort);
  onCleanup(() => short.removeEventListener("change", onShort));
  const timer = setInterval(() => setLeft(secs()), 250);
  onCleanup(() => clearInterval(timer));
  const warn = () => left() > 0 && left() <= YY_PLAN.talkWarnSec;
  createEffect(
    on(left, (s, prev) => {
      if (prev === undefined || s === prev || !warn() || props.spectator) return;
      clockTickSound();
      hapticTick();
    }),
  );
  const markLabel = (m: Mark | undefined): string =>
    m === "sus" ? "şüpheli" : m === "clear" ? "temiz" : "işaretsiz";

  return (
    <>
      <div class="yy__head">
        <span class="overline">Sözlü tartışma</span>
        <span class="yy__title">Yazanlar kim?</span>
        <Show when={!props.spectator && !isShort()}>
          <span class="yy__hint">Dokun: ? şüpheli, ✓ temiz (gizli)</span>
        </Show>
      </div>

      <div class="yy__stage">
        <div class="yy__arena" data-warn={warn() ? "1" : undefined}>
          <div class="yy__center">
            <div class="yy__clock" role="timer" aria-label="Kalan süre">
              <span class="yy__clock-num">{left()}</span>
              <span class="yy__clock-unit">saniye</span>
            </div>
            <HintLine topic={props.view.topic} letters={props.view.letters} />
          </div>
          <For each={props.crew}>
            {(m, i) => (
              <div
                class="yy__node"
                data-me={m.id === props.selfId ? "1" : undefined}
                data-mark={marks()[m.id]}
                style={{ left: `${pos()[i()]?.x ?? 50}%`, top: `${pos()[i()]?.y ?? 50}%` }}
              >
                <span class="yy__pulse" aria-hidden="true">
                  <Avatar
                    index={m.avatar}
                    size="var(--yy-av)"
                    connected={m.connected}
                    ready={props.view.ready.includes(m.id)}
                  />
                </span>
                <span class="yy__name">{m.nickname}</span>
                <i class="yy__mark" aria-hidden="true">
                  {marks()[m.id] === "clear" ? "✓" : "?"}
                </i>
                <Show when={!props.spectator && m.id !== props.selfId && !isShort()}>
                  <button
                    type="button"
                    class="yy__sus-btn"
                    aria-label={`${m.nickname} için işaret: ${markLabel(marks()[m.id])} (yalnız sen görürsün)`}
                    onClick={() => {
                      tap();
                      toggle(m.id);
                    }}
                  />
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={!props.spectator}>
        <RolePeek role={props.view.role} hasTopic={props.view.topic !== null} />
      </Show>
      <TamamBar
        dots={false}
        locked={props.view.locked}
        ready={props.view.ready.length}
        readyIds={props.view.ready}
        total={props.crew.length}
        spectator={props.spectator}
        label="Tahmine geç"
        doneLabel="Hazırsın"
        onLock={() => sendActionAck({ kind: "skip" })}
      />
    </>
  );
}
