import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { tap } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { RolePeek } from "./RolePeek.js";
import { ringPosition, type YaziYazScreenView } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

interface Props {
  view: YaziYazScreenView;
  crew: Crew[];
  selfId: string;
  now: () => number;
  spectator: boolean;
}

/** Sözlü tartışma: portreler halkada, ortada kalan süre; panolar kapalı, herkes konuşur. */
export function Tartisma(props: Props) {
  const pos = createMemo(() => props.crew.map((_, i) => ringPosition(i, props.crew.length)));
  const secs = () => Math.max(0, Math.ceil((props.view.talkEndsAt - props.now()) / 1000));
  const [left, setLeft] = createSignal(secs());
  // Özel şüphe işareti: yalnız bu cihazda durur; sunucuya gitmez, puanı ve kuralları etkilemez.
  const [suspects, setSuspects] = createSignal<readonly string[]>([]);
  const toggleSuspect = (id: string): void => {
    setSuspects((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
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
  return (
    <>
      <div class="yy__head">
        <span class="overline">Sözlü tartışma</span>
        <span class="yy__title">Yazanlar kim?</span>
        <Show when={!props.spectator && !isShort()}>
          <span class="yy__hint">Şüphelendiğine dokun · yalnız sen görürsün</span>
        </Show>
      </div>

      <div class="yy__stage">
        <div class="yy__arena">
          <div class="yy__clock" role="timer" aria-label="Kalan süre">
            <span class="yy__clock-num">{left()}</span>
            <span class="yy__clock-unit">saniye</span>
          </div>
          <For each={props.crew}>
            {(m, i) => (
              <div
                class="yy__node"
                data-me={m.id === props.selfId ? "1" : undefined}
                data-sus={suspects().includes(m.id) ? "1" : undefined}
                style={{ left: `${pos()[i()]?.x ?? 50}%`, top: `${pos()[i()]?.y ?? 50}%` }}
              >
                <Avatar
                  index={m.avatar}
                  size="var(--yy-av)"
                  connected={m.connected}
                  ready={props.view.ready.includes(m.id)}
                />
                <i class="yy__bubble" aria-hidden="true" style={{ "--bd": `${(i() * 1.3) % 5}s` }}>
                  <b />
                  <b />
                  <b />
                </i>
                <span class="yy__name">{m.nickname}</span>
                <i class="yy__sus" aria-hidden="true">
                  ?
                </i>
                <Show when={!props.spectator && m.id !== props.selfId && !isShort()}>
                  <button
                    type="button"
                    class="yy__sus-btn"
                    aria-pressed={suspects().includes(m.id)}
                    aria-label={`${m.nickname} için şüphe işareti (yalnız sen görürsün)`}
                    onClick={() => {
                      tap();
                      toggleSuspect(m.id);
                    }}
                  />
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={!props.spectator}>
        <RolePeek role={props.view.role} />
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
