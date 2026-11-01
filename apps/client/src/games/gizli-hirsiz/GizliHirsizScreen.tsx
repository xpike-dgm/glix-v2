import type { GizliHirsizChoice } from "@glix/engine";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap, hapticTick } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { state } from "../../net/store.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { Core, type CoreState } from "./Core.js";
import { Outro } from "./Outro.js";
import "./gizli-hirsiz.css";
import {
  alarm,
  countTick,
  createAmbience,
  hollow,
  lastTick,
  listen,
  mechanism,
  quietNote,
  stirBeat,
  vaultOpen,
} from "./sounds.js";
import { Table } from "./Table.js";
import {
  decidedLine,
  headOf,
  outroStep,
  parseGizliHirsizView,
  revealHeadline,
  seatArc,
  shownCount,
  signalText,
} from "./view.js";

/** GH-U9: dinleme animasyonu (işaret anından sonra). */
const LISTEN_MS = 600;
/** GH-U14: dönen oyuncuya bant süresi. */
const BACK_MS = 1_000;

export default function GizliHirsizScreen(props: GameScreenProps) {
  const view = createMemo(() => parseGizliHirsizView(props.match.publicView, props.match.view));
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const ambience = createAmbience();
  onCleanup(() => {
    clearInterval(timer);
    for (const t of timers) clearTimeout(t);
    ambience.stop();
  });

  const [localChoice, setLocalChoice] = createSignal<GizliHirsizChoice | null>(null);
  const [peek, setPeek] = createSignal(false);
  let sent = false;

  const playerOf = (id: string) => props.players.find((p) => p.id === id);
  const nick = (id: string): string => playerOf(id)?.nickname ?? "Oyuncu";
  const label = (id: string): string => (id === props.selfId && !props.spectator ? "Sen" : nick(id));
  const participants = () => props.match.participants;
  const seats = createMemo(() => seatArc(participants(), props.spectator ? "" : props.selfId));

  /** Yalnız kendi kararın: sunucudan gelen `choice` ya da yerel karar. */
  const choice = (): GizliHirsizChoice | null =>
    props.spectator ? null : (localChoice() ?? view()?.choice ?? null);
  const over = () => {
    const v = view();
    return !v || v.finished || clock() >= v.endsAt;
  };
  const locked = () => props.spectator === true || choice() !== null || over();
  const secsLeft = () => {
    const v = view();
    return v ? Math.max(0, Math.ceil((v.endsAt - clock()) / 1000)) : 0;
  };
  const urgent = () => !over() && secsLeft() <= 5;
  const signal = () => view()?.signal ?? null;
  const listening = () => {
    const v = view();
    return (
      v?.signalAt != null && v.signal !== null && clock() >= v.signalAt && clock() < v.signalAt + LISTEN_MS
    );
  };
  const signalShown = () => (signal() !== null && !listening() ? signal() : null);

  const decide = (kind: GizliHirsizChoice): void => {
    if (locked()) return;
    unlockAudio();
    setLocalChoice(kind);
    // GH-U15 / GH-U3: karar anında ses yok; titreşim kadran tıkırtısıyla aynı.
    hapticTap();
    if (sent) return;
    sent = true;
    sendAction({ kind });
  };

  const outro = () => {
    const v = view();
    if (!v?.reveal || clock() < v.endsAt) return null;
    return { reveal: v.reveal, elapsed: clock() - v.endsAt };
  };
  const step = () => {
    const o = outro();
    return o ? outroStep(o.elapsed, o.reveal.thieves.length) : null;
  };
  const coreState = (): CoreState => {
    const o = outro();
    return o && step() === "stamp" ? o.reveal.outcome : "idle";
  };

  // GH-U15: oyun boyu uğultu; son 5 sn'de lazer vızıltısı hızlanır.
  createEffect(() => ambience.set(!over(), urgent()));
  // GH-U7: son 5 sn herkesin telefonu saniyede bir kısa titrer ve alçak tik (karar vermiş olsun olmasın).
  createEffect(
    on(secsLeft, (s, prev) => {
      if (prev === undefined || s === prev || s > 5 || s === 0 || over()) return;
      hapticTick();
      lastTick();
    }),
  );
  // GH-U9: işaret anı: dinleme, sonra sessiz nota ya da kalp çarpıntısı (herkeste aynı anda).
  createEffect(
    on(listening, (on, was) => {
      if (on && was === false) listen();
    }),
  );
  createEffect(
    on(signalShown, (s, prev) => {
      if (s === null || prev !== null || prev === undefined) return;
      if (s === "stir") stirBeat();
      else quietNote();
    }),
  );
  // GH-U5: açılış sesleri yalnız canlı geçişlerde.
  createEffect(
    on(step, (st, prev) => {
      const o = outro();
      if (!o || prev === undefined || st === prev) return;
      if (st === "dark" || (prev === null && st === "door")) mechanism();
      if (st === "stamp") {
        if (o.reveal.outcome === "solo") {
          vaultOpen();
          hapticMatch();
        } else if (o.reveal.outcome === "multi") {
          alarm();
          hapticSolo();
        } else hollow();
      }
    }),
  );
  createEffect(
    on(
      () => {
        const o = outro();
        return o && step() === "count" ? shownCount(o.elapsed, o.reveal.thieves.length) : null;
      },
      (c, prev) => {
        if (c !== null && prev !== undefined && c !== prev) countTick();
      },
    ),
  );

  // GH-U14: bağlantı dönünce kısa bant.
  const [back, setBack] = createSignal(false);
  createEffect(
    on(
      () => state.conn,
      (conn, prev) => {
        if (conn !== "open" || prev === undefined || prev === "open" || over()) return;
        setBack(true);
        later(() => setBack(false), BACK_MS);
      },
      { defer: true },
    ),
  );

  const head = () =>
    headOf({
      spectator: props.spectator === true,
      choice: choice(),
      over: over(),
      hasSignal: view()?.signalAt != null,
    });
  const headText = () => {
    const o = outro();
    if (o && step() === "stamp") return revealHeadline(o.reveal);
    return head().head;
  };
  const subText = () => {
    if (over()) return "";
    if (props.spectator) return decidedLine(view()?.decided.length ?? 0, participants().length);
    return head().sub;
  };

  return (
    <Screen class="gh">
      <div
        class="gh__root"
        data-phase={outro() ? "outro" : over() ? "closing" : "deciding"}
        data-step={step() ?? undefined}
        data-outcome={step() === "stamp" ? outro()?.reveal.outcome : undefined}
        data-urgent={urgent() ? "1" : undefined}
        data-signal={signalShown() ?? undefined}
      >
        <Show when={view()}>
          {(v) => (
            <PhaseClock
              startedAt={over() ? 0 : v().startedAt}
              endsAt={over() ? 0 : v().endsAt}
              urgency={!over()}
            />
          )}
        </Show>
        <i class="gh__lasers" aria-hidden="true" />

        <div class="gh__top">
          <Status class="gh__text" titleClass="gh__head" subClass="gh__sub" sub={subText()}>
            {headText()}
          </Status>
          <Show when={!over() && (signalShown() || listening())}>
            <p class="gh__signal" data-signal={signalShown() ?? "listen"} role="status">
              {signalShown() ? signalText(signalShown() ?? "quiet") : "Kasa dinleniyor…"}
            </p>
          </Show>
        </div>

        <div class="gh__stage">
          <div class="gh__ring">
            <Core
              state={coreState()}
              opening={step() === "stamp"}
              print={peek() && choice() === "steal"}
              urgent={urgent()}
              listening={listening()}
              dial={!props.spectator}
            />
          </div>
          <Table
            seats={seats()}
            decided={view()?.decided ?? []}
            playerOf={playerOf}
            label={label}
            locks={!over()}
          />
        </div>

        <footer class="gh__foot">
          <Show when={outro()}>
            {(o) => (
              <Outro
                reveal={o().reveal}
                elapsed={o().elapsed}
                signal={view()?.signal ?? null}
                playerOf={playerOf}
                nameOf={label}
                avatar="var(--gh-crew)"
              />
            )}
          </Show>
          <Show when={!over() && !props.spectator}>
            <Show
              when={choice()}
              fallback={
                <div class="gh__pick">
                  <button
                    type="button"
                    class="gh__btn gh__btn--pass"
                    disabled={locked()}
                    aria-label="Çalma"
                    onClick={() => decide("pass")}
                  >
                    ÇALMA
                  </button>
                  <button
                    type="button"
                    class="gh__btn gh__btn--steal"
                    disabled={locked()}
                    aria-label="Çal, tek seferlik, geri alınamaz"
                    onClick={() => decide("steal")}
                  >
                    ÇAL
                  </button>
                </div>
              }
            >
              {(c) => (
                <div class="gh__kept" data-peek={peek() ? "1" : undefined}>
                  <span class="gh__kepttext" aria-live="polite">
                    {peek() ? `Seçimin: ${c() === "steal" ? "ÇAL" : "ÇALMA"}` : "Kararın kayıtlı"}
                  </span>
                  <button
                    type="button"
                    class="gh__eye"
                    aria-label="Seçimini görmek için basılı tut"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setPeek(true);
                    }}
                    onPointerUp={() => setPeek(false)}
                    onPointerLeave={() => setPeek(false)}
                    onPointerCancel={() => setPeek(false)}
                    onContextMenu={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") setPeek(true);
                    }}
                    onKeyUp={() => setPeek(false)}
                    onBlur={() => setPeek(false)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <title>Göz</title>
                      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              )}
            </Show>
          </Show>
        </footer>

        <Show when={step() === "dark"}>
          <p class="gh__flash" aria-hidden="true">
            SÜRE DOLDU
          </p>
        </Show>
        <Show when={back() && !over()}>
          <p class="gh__band" role="status">
            Döndün · {secsLeft()} sn kaldı
          </p>
        </Show>
      </div>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
