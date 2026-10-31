import { SIZMA_ROUNDS, SIZMA_TURN_MS } from "@glix/engine";
import { createEffect, createMemo, For, on, onCleanup, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { atServerTime } from "../../net/serverTimer.js";
import { Avatar } from "../../ui/Avatar.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { Mask } from "./Mask.js";
import { Peek } from "./Peek.js";
import { saidTick, yourTurn } from "./sounds.js";
import { type CrewMember, type SizmaScreenView, turnInfo, wordSize } from "./view.js";

/** Kelime kristali: yalnız kendi kelimen, büyük. Kristalin biçimi herkes için aynıdır. */
export function WordGem(props: { word: string | null; mini?: boolean }) {
  return (
    <div class="sz__gem" data-mini={props.mini ? "1" : undefined} role="img" aria-label="Kelimen">
      <span class="sz__gem-in">
        <Show when={props.word} fallback={<Mask size={32} class="sz__gem-mask" />}>
          <span class="sz__word" style={{ "--ws": `${wordSize(props.word ?? "")}px` }}>
            {props.word}
          </span>
        </Show>
      </span>
    </div>
  );
}

/** Mikrofon simgesi (konuşan kartında). */
export function MicIcon(props: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size ?? 18} height={props.size ?? 18} aria-hidden="true">
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

interface Props {
  view: SizmaScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  tv?: boolean | undefined;
}

/**
 * İpucu turları (SZ-M3, SZ-U1): kelime kristali üstte, altında "TUR 1 / 2 · Konuşan: Mert"; tek sütun büyük
 * söyleme sırası (konuşan büyür ve parlar, 15 sn çubuğu; konuşmuşların numarası ✓; sıradakinde "Sıradaki").
 * Sırası gelende ana düğme "SÖYLEDİM"; "Oylamaya geç" ikincil düğme olarak kalır.
 */
export function ClueStage(props: Props) {
  const info = createMemo(() => turnInfo(props.view.order, props.view.turn, SIZMA_ROUNDS));
  const member = (id: string | null) => (id === null ? null : (props.crew.find((c) => c.id === id) ?? null));
  const speaker = () => member(info().speaker);
  const myTurn = () => !props.spectator && info().speaker === props.selfId;
  const [skipped, setSkipped] = createOptimistic<boolean>(() => props.view.locked);
  const readyCount = () =>
    Math.min(
      props.crew.length,
      props.view.ready.length + (skipped() && !props.view.ready.includes(props.selfId) ? 1 : 0),
    );
  const countdown = () => Math.max(0, Math.ceil((props.view.phaseEndsAt - props.now()) / 1_000));

  // Sıra sana gelince güçlü titreşim ve "ding".
  createEffect(
    on(myTurn, (mine, was) => {
      if (mine && was === false) yourTurn();
    }),
  );

  // Bağlantısı kopan konuşanın sırası hemen geçer: bağlı her katılımcı 1 sn sonra "geçir" der (sunucu birini kabul eder).
  createEffect(() => {
    const s = speaker();
    const turn = props.view.turn;
    if (props.spectator || props.tv || !s || s.connected) return;
    const stop = atServerTime(
      props.now() + 1_000,
      () => void sendActionAck({ kind: "said", turn }),
      props.now,
    );
    onCleanup(stop);
  });

  const said = (): void => {
    if (!myTurn()) return;
    saidTick();
    void sendActionAck({ kind: "said", turn: props.view.turn });
  };
  const skip = (): void => {
    if (props.spectator || skipped()) return;
    unlockAudio();
    hapticTap();
    setSkipped(true, () => sendActionAck({ kind: "skip" }));
  };

  const seats = createMemo(() =>
    props.view.order.flatMap((id, i) => {
      const m = member(id);
      return m ? [{ m, n: i + 1 }] : [];
    }),
  );
  /** Konuşma çubuğu: kalan süre (sunucu saatinden), CSS animasyonu negatif gecikmeyle başlatılır. */
  const barStyle = () => {
    const total = props.view.turnEndsAt - props.view.turnStartedAt || SIZMA_TURN_MS;
    const gone = Math.max(0, Math.min(total, props.now() - props.view.turnStartedAt));
    return { "--turn-ms": `${total}ms`, "--turn-gone": `-${gone}ms` };
  };

  return (
    <div class="sz__clue" data-myturn={myTurn() ? "1" : undefined} data-tv={props.tv ? "1" : undefined}>
      <Show when={myTurn()}>
        <div class="sz__edge" aria-hidden="true" />
      </Show>
      <div class="sz__gemwrap">
        <span class="overline sz__gemlabel">{props.spectator ? "Kelimeler gizli" : "Senin kelimen"}</span>
        <Peek
          since={props.view.startedAt}
          now={props.now}
          enabled={!props.spectator && props.view.word !== null}
        >
          <WordGem word={props.spectator ? null : props.view.word} />
        </Peek>
      </div>

      <div class="sz__turnbar" role="status">
        <span class="sz__round">
          Tur {info().round} / {info().rounds}
        </span>
        <Show
          when={!info().done}
          fallback={<span class="sz__speaking">Oylama başlıyor · {countdown()}</span>}
        >
          <Show
            when={myTurn()}
            fallback={
              <span class="sz__speaking">
                Konuşan: <b>{speaker()?.nickname ?? ""}</b>
              </span>
            }
          >
            <span class="sz__speaking sz__speaking--me">Sıra sende · ipucunu söyle</span>
          </Show>
        </Show>
      </div>

      <ol class="sz__order" aria-label="Söyleme sırası" data-n={seats().length}>
        <For each={seats()}>
          {(s) => {
            const now = () => s.m.id === info().speaker;
            const done = () => info().spoken.includes(s.m.id);
            const next = () => !now() && s.m.id === info().next;
            return (
              <li
                class="sz__seat"
                data-me={s.m.id === props.selfId ? "1" : undefined}
                data-now={now() ? "1" : undefined}
                data-done={done() ? "1" : undefined}
                data-off={s.m.connected ? undefined : "1"}
                style={now() ? barStyle() : undefined}
              >
                <span class="sz__avnum">
                  <Avatar
                    index={s.m.avatar}
                    size={now() && seats().length < 5 ? 40 : 34}
                    connected={s.m.connected}
                    ready={props.view.ready.includes(s.m.id)}
                  />
                  <span class="sz__num" data-done={done() ? "1" : undefined}>
                    {done() ? "✓" : s.n}
                  </span>
                </span>
                <span class="sz__who">{s.m.nickname}</span>
                <Show when={now()}>
                  <span class="sz__mic" role="img" aria-label="Konuşuyor">
                    <MicIcon />
                  </span>
                  <i class="sz__tbar" aria-hidden="true" />
                </Show>
                <Show when={next()}>
                  <span class="sz__nexttag">Sıradaki</span>
                </Show>
              </li>
            );
          }}
        </For>
      </ol>

      <Show when={!props.tv}>
        <div class="sz__actions">
          <Show
            when={!props.spectator}
            fallback={
              <p class="tamam__count">
                {readyCount()}/{props.crew.length} hazır
              </p>
            }
          >
            <Show when={myTurn()}>
              <PrimaryButton instant onClick={said} class="sz__said">
                SÖYLEDİM
              </PrimaryButton>
            </Show>
            <button
              type="button"
              class="sz__skip"
              data-on={skipped() ? "1" : undefined}
              disabled={skipped()}
              onClick={skip}
            >
              {skipped() ? "Hazırsın" : "Oylamaya geç"}
              <span class="sz__skip-n">
                {readyCount()}/{props.crew.length}
              </span>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
