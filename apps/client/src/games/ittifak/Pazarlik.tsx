import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { pressable } from "../../ui/press.js";
import { propSrc } from "../../ui/props.js";
import { bondPattern, ringPosition } from "./view.js";

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

interface Props {
  crew: CrewMember[];
  selfId: string;
  /** Pazarlığın bitişi (sunucu saati, ms). */
  endsAt: number;
  now: () => number;
  /** "Oylamaya geçelim" diyenler. */
  ready?: readonly string[];
  /** Söz işareti koyduğun oyuncular (yalnız sana görünür). */
  promised?: readonly string[];
  /** Verilirse portrelere dokununca söz işareti konur/kalkar (izleyicide verilmez). */
  onPromise?: (id: string) => void;
}

function PromiseTap(props: { m: CrewMember; on: boolean; onPromise: (id: string) => void }) {
  // Parmak dokunur dokunmaz etkinleşir; klavye/ekran okuyucu `click` ile.
  const press = pressable(() => props.onPromise(props.m.id));
  return (
    <button
      type="button"
      class="it__tap"
      data-on={props.on ? "1" : undefined}
      aria-pressed={props.on}
      aria-label={`${props.m.nickname} için söz işareti`}
      onPointerDown={press.onPointerDown}
      onClick={press.onClick}
    />
  );
}

/**
 * Sözlü pazarlık sahnesi: portreler halkada, aralarında geçici neon bağlar ve konuşma izleri belirip söner.
 * Süs ve zaman göstergesidir; hiçbir söz ya da anlaşma kaydedilmez. Ortada kalan süre görünür.
 */
export function Pazarlik(props: Props) {
  const bonds = createMemo(() => bondPattern(props.crew.length));
  const pos = (i: number) => ringPosition(i, props.crew.length);
  const [left, setLeft] = createSignal(Math.max(0, Math.ceil((props.endsAt - props.now()) / 1000)));
  const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((props.endsAt - props.now()) / 1000))), 250);
  onCleanup(() => clearInterval(timer));
  return (
    <div class="it__stage">
      <div class="it__arena">
        <svg class="it__bonds" viewBox="0 0 100 100" aria-hidden="true">
          <For each={bonds()}>
            {(b) => {
              const a = () => pos(b.a);
              const c = () => pos(b.b);
              return (
                <g
                  style={{
                    color: look(props.crew[b.a]?.avatar ?? 0).color,
                    "--d": `${b.delay}s`,
                    "--dur": `${b.dur}s`,
                  }}
                >
                  <line class="it__bond-glow" x1={a().x} y1={a().y} x2={c().x} y2={c().y} />
                  <line class="it__bond" x1={a().x} y1={a().y} x2={c().x} y2={c().y} />
                </g>
              );
            }}
          </For>
        </svg>

        <div class="it__clock" role="timer" aria-label="Kalan süre">
          <img
            class="it__shake"
            src={propSrc("genel/el-sikisma")}
            alt=""
            aria-hidden="true"
            draggable={false}
            width="384"
            height="384"
          />
          <span class="it__clock-num">{left()}</span>
          <span class="it__clock-unit">saniye</span>
        </div>

        <For each={props.crew}>
          {(m, i) => (
            <div
              class="it__node"
              data-me={m.id === props.selfId ? "1" : undefined}
              style={{ left: `${pos(i()).x}%`, top: `${pos(i()).y}%` }}
            >
              <Avatar
                index={m.avatar}
                size="var(--it-av)"
                connected={m.connected}
                ready={props.ready?.includes(m.id) === true}
              />
              <i
                class="it__bubble"
                aria-hidden="true"
                style={{ "--bd": `${(i() * 1.3) % 5}s`, "--flip": i() % 2 === 0 ? 1 : -1 }}
              >
                <b />
                <b />
                <b />
              </i>
              <Show when={props.promised?.includes(m.id)}>
                <span class="it__seal" aria-hidden="true">
                  söz
                </span>
              </Show>
              <Show when={props.onPromise && m.id !== props.selfId}>
                <PromiseTap
                  m={m}
                  on={props.promised?.includes(m.id) === true}
                  onPromise={(id) => props.onPromise?.(id)}
                />
              </Show>
              <span class="it__name">{m.nickname}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
