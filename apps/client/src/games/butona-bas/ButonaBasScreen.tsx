import {
  BUTONA_BAS_COOLDOWN_MS,
  BUTONA_BAS_ROUND_MS,
  type ButonaBasWindowResult,
  type PlayerInfo,
} from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import { hapticCrowd, hapticMatch, hapticPress, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { readStored, writeStored } from "../../net/storage.js";
import { serverNow, state } from "../../net/store.js";
import { textSize } from "../../settings/settings.js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon, CloseIcon, CrownIcon } from "../../ui/Icons.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import { ArcadeButton, type ArcadeFx } from "./ArcadeButton.js";
import { butonaBasCues } from "./cues.js";
import { FinalReveal, GapSummary, RoundBadge } from "./parts.js";
import {
  buzzSound,
  cheerSound,
  chordSound,
  endFanfare,
  gongSound,
  klakSound,
  lastTick,
  refillSound,
  whooshSound,
} from "./sounds.js";
import {
  gapStep,
  hintKey,
  hintNeeded,
  leadersOf,
  maxWindowIndex,
  newWindows,
  ordinal,
  parseButonaBasView,
  rankOf,
  rejoinLine,
  resultOf,
  revealOrder,
  roundClockAt,
  roundEndLine,
  roundStar,
  shortName,
  stripSplit,
  urgentSecs,
} from "./view.js";
import "./butona.css";

interface Float {
  id: number;
  text: string;
  kind: "match" | "crowd" | "solo";
}

interface MatchRow {
  id: number;
  text: string;
  tone: "match" | "crowd" | "solo";
  /** Eşleştiğin oyuncular (kendin hariç); tek kalınca boş. */
  others: PlayerInfo[];
}

interface Link {
  id: number;
  tone: "match" | "crowd" | "solo";
  ids: string[];
}

const FLASH_MS = 800;
const MATCH_ROW_MS = 900;
const BAND_MS = 1_500;
const HINT_MS = 1_000;

export default function ButonaBasScreen(props: GameScreenProps) {
  const view = createMemo(() => parseButonaBasView(props.match.publicView, props.match.view));
  const crew = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const order = () => crew().map((p) => p.id);
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  // Tur/ara geçişi yerel saatten türetilir (görünüm yalnız durum değişince gelir).
  const clock = createMemo(() => {
    const v = view();
    return v ? roundClockAt(v.startedAt, v.endsAt, props.now()) : null;
  });
  const phase = () => clock()?.phase ?? "play";
  const round = () => clock()?.round ?? 0;
  const rounds = () => view()?.rounds ?? 3;
  const waveMs = () => clock()?.windowMs ?? view()?.windowMs ?? 300;
  const urgent = createMemo(() => {
    const c = clock();
    return c ? urgentSecs(c, props.now()) : null;
  });
  const scores = () => view()?.scores ?? {};
  const myScore = () => view()?.myScore ?? scores()[props.selfId] ?? 0;
  const leaders = createMemo(() => leadersOf(scores()));
  const finalShown = () => phase() === "over" && view()?.final != null;

  const [pressed, setPressed] = createSignal(false);
  const [waves, setWaves] = createSignal<number[]>([]);
  const [fx, setFx] = createSignal<ArcadeFx | null>(null);
  const [floats, setFloats] = createSignal<Float[]>([]);
  const [flashes, setFlashes] = createSignal<Record<string, "match" | "crowd" | "solo">>({});
  const [links, setLinks] = createSignal<Link[]>([]);
  const [row, setRow] = createSignal<MatchRow | null>(null);
  const [fill, setFill] = createSignal<number | null>(null);
  const [readyFx, setReadyFx] = createSignal<number | undefined>(undefined);
  const [empty, setEmpty] = createSignal<number | undefined>(undefined);
  const [localReady, setLocalReady] = createSignal(0);
  const [band, setBand] = createSignal<{ id: number; text: string; kind: "back" | "hint" } | null>(null);
  const [live, setLive] = createSignal("");
  let counter = 0;
  let lastSeen: number | null = null;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let pressedAt = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
    clearTimeout(releaseTimer);
  });
  const showBand = (text: string, kind: "back" | "hint", ms: number): void => {
    const id = ++counter;
    setBand({ id, text, kind });
    later(() => setBand((b) => (b?.id === id ? null : b)), ms);
  };

  // BB-U12 / BB-U15: ekrana tur ortasında girildiyse "Tur 2 sürüyor — bas!"; ilk turun başında "Sayın" ipucu.
  onMount(() => {
    const c = clock();
    if (!c || props.spectator) return;
    const now = props.now();
    const back = rejoinLine(c, now);
    if (back) {
      showBand(back, "back", BAND_MS);
      return;
    }
    if (c.phase === "play" && c.round === 0 && now - c.phaseStartsAt < 2_000) {
      const user = state.account?.username ?? null;
      const key = user === null ? null : hintKey(user);
      if (hintNeeded(user, key === null ? null : readStored(key))) {
        showBand("Sayın: 3… 2… 1… BAS!", "hint", HINT_MS);
        if (key !== null) writeStored(key, "1");
      }
    }
  });
  // Bağlantı geri gelince (aynı ekranda kalındıysa) de haber ver.
  createEffect(
    on(
      () => state.conn,
      (conn, prev) => {
        if (props.spectator || conn !== "open" || prev === undefined || prev === "open") return;
        const c = clock();
        const back = c ? rejoinLine(c, props.now()) : null;
        if (back) showBand(back, "back", BAND_MS);
      },
      { defer: true },
    ),
  );

  // Yeni puanlanan pencerelere tepki: yalnız bu ekran açıkken gelenler.
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      if (lastSeen === null) {
        lastSeen = maxWindowIndex(v.recent, null) ?? -1;
        return;
      }
      const fresh = newWindows(v.recent, lastSeen);
      lastSeen = maxWindowIndex(v.recent, lastSeen);
      let mine: ButonaBasWindowResult | null = null;
      for (const w of fresh) {
        const r = resultOf(w);
        const next = { ...flashes() };
        for (const id of w.pressers) next[id] = r.tone;
        setFlashes(next);
        const linkId = ++counter;
        if (w.pressers.length >= 2)
          setLinks((l) => [...l.slice(-2), { id: linkId, tone: r.tone, ids: w.pressers }]);
        later(() => {
          setFlashes((cur) => {
            const c = { ...cur };
            for (const id of w.pressers) delete c[id];
            return c;
          });
          setLinks((l) => l.filter((x) => x.id !== linkId));
        }, FLASH_MS);
        if (w.pressers.includes(props.selfId)) mine = w;
      }
      if (!mine || props.spectator) return;
      const r = resultOf(mine);
      const fid = ++counter;
      setFloats((f) => [...f.slice(-3), { id: fid, text: r.float, kind: r.tone }]);
      later(() => setFloats((f) => f.filter((x) => x.id !== fid)), 950);
      const rid = ++counter;
      const others = mine.pressers
        .filter((id) => id !== props.selfId)
        .map(playerOf)
        .filter((p): p is PlayerInfo => p !== undefined);
      setRow({ id: rid, text: r.line, tone: r.tone, others });
      later(() => setRow((cur) => (cur?.id === rid ? null : cur)), MATCH_ROW_MS);
      setFx({ kind: r.tone, n: ++counter });
      if (r.tone === "solo") {
        buzzSound();
        hapticSolo();
      } else if (r.tone === "crowd") {
        cheerSound();
        hapticCrowd();
      } else {
        chordSound(mine.pressers.length);
        hapticMatch();
      }
    });
  });

  // Evre geçişleri: tur başı gong, ara "vuuş" ve ekran okuyucu satırı, oyun sonu fanfar.
  butonaBasCues(clock, props.now, {
    play: () => {
      if (!props.spectator) gongSound();
    },
    gap: (c) => {
      const v = view();
      if (!v) return;
      if (!props.spectator) whooshSound();
      const rank = props.spectator ? null : rankOf(v.scores, props.selfId).rank;
      setLive(roundEndLine(c.round, props.spectator ? null : myScore(), rank));
    },
    over: () => {
      const v = view();
      if (!v) return;
      if (!props.spectator) endFanfare();
      const ranked = [...revealOrder(v.scores, order())].reverse();
      setLive(
        `Oyun bitti. ${ranked
          .map(
            (id, i) => `${ordinal(i + 1)} ${playerOf(id)?.nickname ?? "Oyuncu"}, ${v.scores[id] ?? 0} puan`,
          )
          .join("; ")}.`,
      );
    },
  });

  // BB-U6: son 3 saniyede her saniye tık (son saniyede iki tık).
  createEffect(
    on(urgent, (secs, prev) => {
      if (secs === null || secs === prev || props.spectator) return;
      lastTick(secs === 1);
    }),
  );

  // Skor değişince büyük rakam kısa süre "zıplar".
  let scoreEl: HTMLSpanElement | undefined;
  createEffect(
    on(
      myScore,
      (now, prev) => {
        if (prev === undefined || now === prev || reducedMotion()) return;
        scoreEl?.animate(
          [
            { transform: "scale(1)", color: now > prev ? "#B6FF3B" : "#FF3B5C" },
            { transform: "scale(1.22)", color: now > prev ? "#B6FF3B" : "#FF3B5C", offset: 0.3 },
            { transform: "scale(1)", color: "#F3F5FF" },
          ],
          { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      },
      { defer: true },
    ),
  );

  const readyAt = (): number => Math.max(localReady(), view()?.readyAt ?? 0);
  const filling = () => fill() !== null;

  const release = (): void => {
    const hold = Math.max(0, 90 - (performance.now() - pressedAt));
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => setPressed(false), hold);
  };

  const press = (): void => {
    const v = view();
    if (!v || props.spectator) return;
    unlockAudio();
    const t = serverNow();
    const c = roundClockAt(v.startedAt, v.endsAt, t);
    // Turlar arasındaki ara ve oyun sonrası: basış sunucuda sayılmaz, gönderilmez.
    if (c.phase !== "play") return;
    // BB-M1 / BB-U3: dolarken basış sayılmaz: "boş" sallanma, ses ve titreşim yok.
    if (t < readyAt()) {
      setEmpty(++counter);
      return;
    }
    pressedAt = performance.now();
    clearTimeout(releaseTimer);
    setPressed(true);
    klakSound();
    hapticPress(10);
    const id = ++counter;
    setWaves((w) => [...w.slice(-3), id]);
    later(() => setWaves((w) => w.filter((x) => x !== id)), waveMs() + 60);
    setLocalReady(t + BUTONA_BAS_COOLDOWN_MS);
    setFill(id);
    later(() => {
      if (fill() !== id) return;
      setFill(null);
      setReadyFx(++counter);
      refillSound();
      hapticTick();
    }, BUTONA_BAS_COOLDOWN_MS);
    sendAction({ kind: "press", at: Math.round(t) });
  };

  const onPadDown = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    press();
  };

  const locked = () => !view() || phase() !== "play";
  const label = () => (props.spectator ? "" : filling() ? "DOLUYOR" : "BAS");
  const lastChance = () => round() === rounds() - 1 && urgent() !== null;
  const progress = () => {
    const c = clock();
    return c && c.phase === "play"
      ? Math.min(1, Math.max(0, (props.now() - c.phaseStartsAt) / BUTONA_BAS_ROUND_MS))
      : 0;
  };
  const gap = createMemo(() => {
    const c = clock();
    const v = view();
    if (!c || !v || c.phase !== "gap") return null;
    const step = gapStep(props.now() - c.phaseStartsAt);
    const star = roundStar(v.roundScores, c.round - 1, order());
    return {
      step,
      done: c.round,
      next: c.round,
      star: star ? { player: playerOf(star.id), points: star.points } : null,
    };
  });
  /** BB-U5: tur puanı etiketleri (ara sırasında "+6", "−2"). */
  const gainOf = (id: string): number | null => {
    const g = gap();
    if (!g || g.step === "done") return null;
    return view()?.roundScores[id]?.[g.done - 1] ?? 0;
  };
  const meta = () => {
    const { rank, gap: behind } = rankOf(scores(), props.selfId);
    if (myScore() <= 0 && leaders().length === 0) return "Birlikte basın!";
    if (behind === 0) return leaders().length > 1 ? "Önde eşitsin" : "Öndesin";
    return `${rank}. sıradasın · lidere ${behind}`;
  };
  const front = () => {
    const ids = leaders();
    const first = ids[0];
    if (first === undefined) return null;
    return { player: playerOf(first), more: ids.length - 1, score: scores()[first] ?? 0 };
  };

  // BB-U4: şeritte aynı pencerede basanları birleştiren çizgiler (avatar merkezleri arasından).
  let stripEl: HTMLElement | undefined;
  const cells = new Map<string, HTMLElement>();
  const linePoints = (ids: string[]): string => {
    if (!stripEl) return "";
    const box = stripEl.getBoundingClientRect();
    const pts: { x: number; y: number }[] = [];
    for (const id of ids) {
      const el = cells.get(id)?.querySelector(".av");
      if (!el) continue;
      const r = el.getBoundingClientRect();
      pts.push({ x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top });
    }
    pts.sort((a, b) => a.y - b.y || a.x - b.x);
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  };
  const split = () => stripSplit(crew().length);
  const nameMax = () => (textSize() === "large" && crew().length >= 8 ? 5 : 7);

  return (
    <Screen class={`game bb ${crew().length > 4 ? "bb--two" : ""}`}>
      <Show when={clock()}>
        {(c) => <PhaseClock startedAt={c().phaseStartsAt} endsAt={c().phaseEndsAt} urgency={false} />}
      </Show>

      <div class="bb__head">
        <RoundBadge
          round={Math.min(rounds() - 1, round())}
          rounds={rounds()}
          live={phase() === "play"}
          urgent={urgent() !== null}
          progress={progress()}
        />
        <Show when={!finalShown()}>
          <Show
            when={!props.spectator}
            fallback={
              <div class="bb__score bb__score--watch">
                <span class="overline">Önde</span>
                <Show when={front()} fallback={<span class="bb__front">Henüz kimse yok</span>}>
                  {(f) => (
                    <span class="bb__front">
                      <Show when={f().player}>{(p) => <Avatar index={p().avatar} size={30} />}</Show>
                      <span class="bb__frontName">
                        {f().player?.nickname ?? "Oyuncu"}
                        {f().more > 0 ? ` +${f().more}` : ""}
                      </span>
                      <b class="bb__frontNum">· {f().score}</b>
                    </span>
                  )}
                </Show>
              </div>
            }
          >
            <div class="bb__score">
              <span class="overline">Puanın</span>
              <span class="bb__num" data-testid="kendi-puan" ref={scoreEl}>
                {myScore()}
              </span>
              <span class="bb__meta">{meta()}</span>
            </div>
          </Show>
        </Show>
      </div>

      <Show
        when={!finalShown()}
        fallback={
          <Show when={view()?.final}>
            {(fin) => (
              <FinalReveal
                players={crew()}
                scores={scores()}
                roundScores={view()?.roundScores ?? {}}
                final={fin()}
                elapsed={props.now() - (view()?.endsAt ?? props.now())}
                selfId={props.selfId}
                comment={props.match.comment ?? null}
              />
            )}
          </Show>
        }
      >
        <div
          class="bb__pad"
          data-locked={locked() ? "1" : undefined}
          ref={(el) => {
            // BB-U8: basma alanı (görsel merkez buton); dinleyiciler doğrudan bağlanır, buton klavyeyle de basılır.
            el.addEventListener("pointerdown", onPadDown);
            for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, release);
            el.addEventListener("contextmenu", (e) => e.preventDefault());
          }}
        >
          <div class="bb__stage" data-gap={gap()?.step}>
            <Show when={row()} keyed>
              {(r) => (
                <div class="bbrow" data-tone={r.tone} aria-hidden="true">
                  <span class="bbrow__crew">
                    <Show when={playerOf(props.selfId)}>
                      {(me) => <Avatar index={me().avatar} size={30} />}
                    </Show>
                    <For each={r.others.slice(0, 7)}>
                      {(p) => (
                        <>
                          <i class="bbrow__link" />
                          <Avatar index={p.avatar} size={30} />
                        </>
                      )}
                    </For>
                  </span>
                  <b class="bbrow__text">{r.text}</b>
                </div>
              )}
            </Show>
            <ArcadeButton
              pressed={pressed()}
              waves={waves()}
              waveMs={waveMs()}
              fx={fx()}
              label={label()}
              ariaLabel={props.spectator ? "İzliyorsun" : filling() ? "Doluyor" : "Bas"}
              disabled={locked() || props.spectator}
              watching={props.spectator}
              ring={Math.min(2, round())}
              fill={fill()}
              ready={readyFx()}
              empty={empty()}
              urgent={urgent() !== null}
              glow={gap()?.step === "tight"}
              onKey={press}
              testId="bas-butonu"
            />
            <Show when={props.spectator}>
              <span class="bb__watch">İzliyorsun</span>
            </Show>
            <div class="floats" aria-hidden="true">
              <For each={floats()}>{(f) => <span class={`float float--${f.kind}`}>{f.text}</span>}</For>
            </div>
            <Show when={gap()}>
              {(g) => <GapSummary step={g().step} done={g().done} next={g().next} star={g().star} />}
            </Show>
            <Show when={lastChance()}>
              <div class="bbband bbband--last" aria-hidden="true">
                SON ŞANS!
              </div>
            </Show>
            <Show when={band()} keyed>
              {(b) => (
                <div class="bbband" data-kind={b.kind} aria-hidden="true">
                  {b.text}
                </div>
              )}
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!finalShown()}>
        <footer
          class="bbstrip"
          ref={stripEl}
          style={{ "--cols": split() }}
          data-two={crew().length > 4 ? "1" : undefined}
        >
          <For each={crew()}>
            {(p) => {
              const off = () => p.connected === false;
              const gain = () => gainOf(p.id);
              return (
                <div
                  class="bbs"
                  data-me={p.id === props.selfId ? "1" : undefined}
                  data-off={off() ? "1" : undefined}
                  data-flash={flashes()[p.id]}
                  ref={(el) => cells.set(p.id, el)}
                >
                  <span class="bbs__av">
                    <Avatar
                      index={p.avatar}
                      size={p.id === props.selfId ? "var(--bbav-me)" : "var(--bbav)"}
                      connected={!off()}
                      flash={
                        flashes()[p.id] === undefined
                          ? undefined
                          : flashes()[p.id] === "solo"
                            ? "solo"
                            : "match"
                      }
                    />
                    <Show when={leaders().includes(p.id)}>
                      <span class="bbs__crown" role="img" aria-label="Önde">
                        <CrownIcon size={16} />
                      </span>
                    </Show>
                    <Show when={flashes()[p.id]}>
                      {(t) => (
                        <span class="bbs__mark" data-tone={t()} aria-hidden="true">
                          {t() === "solo" ? <CloseIcon size={13} /> : <CheckIcon size={13} />}
                        </span>
                      )}
                    </Show>
                    <Show when={gain()} keyed>
                      {(g) => (
                        <span class="bbs__gain" data-sign={g > 0 ? "+" : g < 0 ? "-" : "0"}>
                          {g > 0 ? `+${g}` : g < 0 ? `−${Math.abs(g)}` : "0"}
                        </span>
                      )}
                    </Show>
                  </span>
                  <span class="bbs__name">{off() ? "koptu" : shortName(p.nickname, nameMax())}</span>
                  <span class="bbs__score">{scores()[p.id] ?? 0}</span>
                </div>
              );
            }}
          </For>
          <svg class="bbstrip__links" aria-hidden="true">
            <For each={links()}>
              {(l) => <polyline class="bbstrip__line" data-tone={l.tone} points={linePoints(l.ids)} />}
            </For>
          </svg>
        </footer>
      </Show>
      <p class="sr-only" aria-live="polite">
        {live()}
      </p>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
