import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
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
  const timer = setInterval(() => setLeft(secs()), 250);
  onCleanup(() => clearInterval(timer));
  return (
    <>
      <div class="yy__head">
        <span class="overline">Sözlü tartışma</span>
        <span class="yy__title">Yazanlar kim?</span>
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
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={!props.spectator}>
        <RolePeek role={props.view.role} />
      </Show>
      <TamamBar
        locked={props.view.locked}
        ready={props.view.ready.length}
        total={props.crew.length}
        spectator={props.spectator}
        label="Tahmine geçelim"
        doneLabel="Hazırsın"
        onLock={() => sendActionAck({ kind: "skip" })}
      />
    </>
  );
}
