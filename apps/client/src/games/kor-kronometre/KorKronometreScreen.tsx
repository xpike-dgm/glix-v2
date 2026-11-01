import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import { hapticCrowd, hapticGo, hapticMatch, hapticPress, hapticSingle } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { currentFlashPeak } from "../../fx/shake.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow, state } from "../../net/store.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import { Dial } from "./Dial.js";
import { FinalRows, PressButton, type PressState, Strip, Track } from "./parts.js";
import {
  clickSound,
  dingSound,
  downSound,
  dropTick,
  glassBell,
  gongSound,
  upSound,
  whizSound,
  winSound,
} from "./sounds.js";
import {
  bigOffset,
  clockAt,
  entryOf,
  formatOffset,
  formatSeconds,
  handWinners,
  headLine,
  myOffsets,
  NEEDLE,
  NEEDLE_TOTAL_MS,
  needleFrac,
  parseKorKronometreView,
  REDUCED_ROW_STEP_MS,
  revealSpeech,
  targetPercent,
  targetSeconds,
  trackPercent,
  trendLine,
} from "./view.js";
import "./kor-kronometre.css";

const BAND_MS = 2_400;
const FLASH_MS = 500;

export default function KorKronometreScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKorKronometreView(props.match.publicView, props.match.view));
  const crew = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const nameOf = (id: string): string => playerOf(id)?.nickname ?? "Oyuncu";
  const clock = createMemo(() => {
    const v = view();
    return v ? clockAt(v, props.now()) : null;
  });
  const phase = () => clock()?.phase ?? "ready";
  const handNo = () => clock()?.hand ?? 0;
  const hands = () => view()?.hands ?? 3;
  const current = () => clock()?.current ?? null;
  const targetMs = () => current()?.targetMs ?? 10_000;

  // Dokunuşa anında yanıt: sunucu onayı beklenmeden kadran donar. Basış elde bir kezdir.
  const [localPressed, setLocalPressed] = createSignal<number[]>([]);
  const pressedNow = (): boolean => {
    const c = clock();
    const v = view();
    if (!c || !v) return false;
    if (localPressed().includes(c.hand)) return true;
    return c.phase === "count" && v.hand === c.hand && v.phase === "count" && v.pressed;
  };
  // KR-U9: izleyicinin puansız denemesi (yalnız bu telefonda; "BAŞLA!"dan ms).
  const [trials, setTrials] = createSignal<Record<number, number>>({});
  const trialOf = (hand: number): number | null => trials()[hand] ?? null;

  const [flash, setFlash] = createSignal(0);
  /** "BAŞLA!" anında kadran çerçevesi kısa süre renk değiştirir (hareket azaltmada flaşın yerine; KR-U17). */
  const [goMark, setGoMark] = createSignal(false);
  /** "BAŞLA!" yazısı (0,9 sn). */
  const [goText, setGoText] = createSignal<number | null>(null);
  const [band, setBand] = createSignal<{ id: number; text: string } | null>(null);
  const [live, setLive] = createSignal("");
  let n = 0;
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
  });
  const showBand = (text: string): void => {
    const id = ++n;
    setBand({ id, text });
    later(() => setBand((b) => (b?.id === id ? null : b)), BAND_MS);
  };

  // KR-U11: oyunun ortasında ekrana dönen oyuncuya dürüst bilgi.
  const rejoinLine = (): string | null => {
    const c = clock();
    if (!c || props.spectator) return null;
    if (c.phase === "count" && props.now() - c.phaseStartsAt > 1_500) {
      return pressedNow() ? "Basışın kayıtlı ✓" : "Geri döndün. Sayaç gizli; istersen yine bas.";
    }
    if (c.phase === "gap" && props.now() - c.phaseStartsAt > 1_000) return "Sıradaki elde oynarsın";
    return null;
  };
  onMount(() => {
    const line = rejoinLine();
    if (line) showBand(line);
  });
  createEffect(
    on(
      () => state.conn,
      (conn, prev) => {
        if (conn !== "open" || prev === undefined || prev === "open") return;
        const line = rejoinLine();
        if (line) showBand(line);
      },
      { defer: true },
    ),
  );

  // KR-M2 / KR-U3 / KR-U13: "BAŞLA!" — her telefonda kendi saat farkıyla aynı anda: flaş, gong, 32 ms titreşim.
  createEffect(
    on(
      () => `${phase()}:${handNo()}`,
      (_key, prev) => {
        const c = untrack(clock);
        if (!c) return;
        if (c.phase === "ready") {
          setLive(`Hazır ol, hedef ${targetSeconds(c.current.targetMs)} saniye`);
        } else if (c.phase === "count") {
          const fresh = prev !== undefined || untrack(props.now) - c.phaseStartsAt < 800;
          if (!fresh) return;
          setFlash(++n);
          unlockAudio();
          gongSound();
          hapticGo();
          setLive("Başla");
          // Sayarken ekran okuyucu hiçbir şey okumaz (KR-U17).
          later(() => setLive(""), 1_200);
        }
      },
    ),
  );

  // El açılışı (KR-U7): kendi sonucun için ses ve titreşim; ekran okuyucu satırı.
  const announced = new Set<number>();
  createEffect(() => {
    const c = clock();
    if (c?.phase !== "gap") return;
    const r = c.current.reveal;
    if (!r || announced.has(c.hand)) return;
    announced.add(c.hand);
    untrack(() => {
      setLive(revealSpeech(r, c.current.targetMs, props.spectator ? null : props.selfId, nameOf));
      if (props.spectator) return;
      const mine = entryOf(r, props.selfId);
      later(() => {
        if (mine?.bullseye) glassBell();
        else if ((mine?.points ?? 0) > 0) upSound();
        else downSound();
        haptic(mine?.points ?? 0);
      }, 250);
    });
  });
  const haptic = (points: number): void => {
    if (points >= 2) hapticCrowd();
    else if (points === 1) hapticMatch();
    else hapticSingle();
  };

  // Son açılış (KR-U5): ibre koşusu sesleri (vızz, her düşüşte tik, hedefte ding), ardından kendi sonucun.
  const finalEntries = () => (phase() === "over" ? (current()?.reveal?.entries ?? []) : []);
  const elapsed = () => props.now() - (current()?.endsAt ?? props.now());
  const reduced = () => reducedMotion();
  let runSeen: boolean | null = null;
  let dropsHeard = 0;
  let dingHeard = false;
  let awardHeard = false;
  createEffect(() => {
    if (phase() !== "over" || !view()?.final) return;
    const e = elapsed();
    untrack(() => {
      if (runSeen === null) runSeen = e < NEEDLE.lineIn + 300;
      if (!awardHeard && e >= (reduced() ? 400 : NEEDLE.lineIn + NEEDLE.run)) {
        awardHeard = true;
        const v = view();
        const me = v?.final?.standings.find((s) => s.playerId === props.selfId);
        const last = current()?.reveal ? entryOf(current()?.reveal ?? null, props.selfId) : null;
        setLive(
          `Oyun bitti. ${revealSpeech(current()?.reveal ?? { entries: [] }, targetMs(), props.spectator ? null : props.selfId, nameOf)}${
            me ? ` Toplam ${me.total}, ${me.rank}. sıradasın, genel skora ${me.award} puan.` : ""
          }`,
        );
        if (!props.spectator && me) {
          if (last?.bullseye) glassBell();
          if (me.award >= 2) winSound();
          else if (me.award === 1) upSound();
          else downSound();
          haptic(me.award);
        }
      }
      if (!runSeen || reduced()) return;
      if (e >= NEEDLE.lineIn && dropsHeard === 0 && e < NEEDLE.lineIn + 200) {
        whizSound();
        dropsHeard = -1;
      }
      const pins = finalEntries()
        .filter((x) => x.pressed && x.ms !== null)
        .map((x) => trackPercent(x.ms ?? 0, targetMs()))
        .sort((a, b) => a - b);
      const passed = pins.filter((p) => needleFrac(e) * 100 >= p).length;
      const heard = Math.max(0, dropsHeard);
      for (let i = heard; i < passed; i++) dropTick(i);
      if (passed > heard) dropsHeard = passed;
      if (!dingHeard && needleFrac(e) * 100 >= targetPercent(targetMs())) {
        dingHeard = true;
        dingSound();
      }
    });
  });

  /** Beyaz flaş yalnız yarım saniye DOM'da kalır (yokken hiçbir şeyi örtmez); hareket azaltmada hiç yoktur. */
  const [flashOn, setFlashOn] = createSignal<number | null>(null);
  createEffect(
    on(
      flash,
      (id) => {
        setGoMark(true);
        setGoText(id);
        later(() => setGoMark(false), 700);
        later(() => setGoText((v) => (v === id ? null : v)), 900);
        // Hareket azaltma: flaş yerine kadran çerçevesi renk değiştirir (CSS, `data-go`).
        if (reduced()) return;
        // Titreşimsiz telefonda flaş bir kademe güçlü (genel telafi ayarı: currentFlashPeak).
        setFlashOn(currentFlashPeak(0.75));
        later(() => setFlashOn((v) => (flash() === id ? null : v)), FLASH_MS);
      },
      { defer: true },
    ),
  );

  const press = (): void => {
    const c = clock();
    if (c?.phase !== "count") return;
    const t = serverNow();
    // Yerel saat henüz "BAŞLA!"ya gelmediyse basış gönderilmez (hak yanmaz).
    if (t < c.current.goAt) return;
    unlockAudio();
    if (props.spectator) {
      if (trialOf(c.hand) !== null) return;
      setTrials((m) => ({ ...m, [c.hand]: t - c.current.goAt }));
      clickSound();
      hapticPress(10);
      return;
    }
    if (pressedNow()) return;
    // Zamanlama oyunu: eylem dokunma anında gider; dokunma anı (sunucu saatiyle) birlikte gönderilir (KR-M1).
    sendAction({ kind: "press", at: Math.round(t) });
    setLocalPressed((l) => [...l, c.hand]);
    clickSound();
    hapticPress(10);
    setLive("Basışın kilitlendi");
  };

  const buttonState = (): PressState => {
    const c = clock();
    if (props.spectator) {
      if (c?.phase !== "count") return "wait";
      return trialOf(c.hand) === null ? "try" : "tried";
    }
    if (!c || c.phase === "ready") return "wait";
    if (c.phase === "count") return pressedNow() ? "locked" : "live";
    return "locked";
  };
  const dialLocked = () => (props.spectator ? trialOf(handNo()) !== null : pressedNow());
  const prevTarget = (): number | null => {
    const v = view();
    const c = clock();
    if (!v || !c || c.hand === 0 || c.phase !== "ready") return null;
    const prev = v.played[c.hand - 1];
    return prev ? targetSeconds(prev.targetMs) : null;
  };

  // El arası (KR-U7).
  const gap = createMemo(() => {
    const c = clock();
    const v = view();
    if (!c || !v || c.phase !== "gap") return null;
    const r = c.current.reveal;
    const mine = r ? entryOf(r, props.selfId) : null;
    const win = r ? handWinners(r) : null;
    const offsets = myOffsets(v.played, props.selfId, c.hand);
    const trial = trialOf(c.hand);
    const gains: Record<string, number> = {};
    for (const e of r?.entries ?? []) gains[e.playerId] = e.points;
    return {
      revealed: r !== null,
      big:
        mine?.pressed && mine.ms !== null
          ? bigOffset(mine.ms, c.current.targetMs)
          : props.spectator
            ? trial !== null
              ? bigOffset(trial, c.current.targetMs)
              : "İzliyorsun"
            : "Basmadın",
      tone: mine?.bullseye ? "bull" : (mine?.points ?? 0) > 0 ? "win" : "none",
      points: mine?.points ?? 0,
      winner: win
        ? `Bu el: ${win.ids.map(nameOf).join(", ")} · ${formatSeconds(win.distance)} sn`
        : "Bu elde kimse basmadı",
      trend: props.spectator || c.hand < 1 ? null : trendLine(offsets),
      next: c.next ? targetSeconds(c.next.targetMs) : null,
      gains,
    };
  });

  const finalView = createMemo(() => {
    const v = view();
    if (phase() !== "over" || !v?.final) return null;
    return v.final;
  });
  const me = () => finalView()?.standings.find((s) => s.playerId === props.selfId) ?? null;
  const lastMine = () => entryOf(current()?.reveal ?? null, props.selfId);
  const trialLine = (): string | null => {
    if (!props.spectator) return null;
    const t = trialOf(handNo());
    return t === null ? null : formatOffset(t, targetMs());
  };

  return (
    <Screen class="kro">
      <div
        class="kro__room"
        data-phase={phase()}
        data-dark={phase() === "count" ? "1" : undefined}
        data-go={goMark() ? "1" : undefined}
      >
        <Show when={view()}>
          <Show
            when={finalView()}
            fallback={
              <>
                <header class="kro__top">
                  <span class="kro__hand">
                    <For each={Array.from({ length: hands() }, (_, i) => i)}>
                      {(i) => (
                        <i
                          class="kro__pip"
                          data-on={i < handNo() || (i === handNo() && phase() !== "gap") ? "1" : undefined}
                          data-done={i < handNo() || (i === handNo() && phase() === "gap") ? "1" : undefined}
                        />
                      )}
                    </For>
                    <span class="kro__handText">
                      {handNo() + 1}. el / {hands()}
                    </span>
                  </span>
                  <Show when={phase() !== "gap"}>
                    <p class="kro__target" role="status">
                      <b class="kro__targetNum">{targetSeconds(targetMs())}</b>
                      <span class="kro__targetUnit">SANİYE</span>
                      <span class="sr-only">{`Hedef ${targetSeconds(targetMs())} saniye`}</span>
                    </p>
                  </Show>
                </header>

                <Show
                  when={gap()}
                  fallback={
                    <>
                      <div class="kro__stage">
                        <Dial
                          locked={dialLocked()}
                          pulse={phase() === "count"}
                          digit={phase() === "ready" ? targetSeconds(targetMs()) : null}
                          prevDigit={prevTarget()}
                        />
                        <Show when={phase() === "ready"}>
                          <span class="kro__ready" aria-hidden="true">
                            Hazır ol
                          </span>
                        </Show>
                        <Show when={goText()} keyed>
                          {(_n: number) => (
                            <span class="kro__go" aria-hidden="true">
                              BAŞLA!
                            </span>
                          )}
                        </Show>
                      </div>
                      <div class="kro__hint">
                        <Show
                          when={!props.spectator}
                          fallback={
                            <p class="kro__hintMain">
                              {phase() === "ready" ? "Hazır ol…" : "Herkes içinden sayıyor…"}
                            </p>
                          }
                        >
                          <Show
                            when={phase() === "count" && pressedNow()}
                            fallback={
                              <p class="kro__hintMain">
                                {phase() === "ready" ? "Hedefi oku, nefesini topla" : "İçinden say…"}
                              </p>
                            }
                          >
                            <p class="kro__hintMain">Basışın mühürlendi.</p>
                            <p class="kro__hintSub">Diğerleri hâlâ sayıyor — şaşırtmak serbest!</p>
                          </Show>
                        </Show>
                      </div>
                      <PressButton state={buttonState()} onPress={press} />
                    </>
                  }
                >
                  {(g) => (
                    <div class="kro-gap" data-tone={g().tone}>
                      <Show when={g().revealed} fallback={<p class="kro-gap__big">Açılıyor…</p>}>
                        <p class="kro-gap__big rise">{g().big}</p>
                        <Show when={!props.spectator}>
                          <p class="kro-gap__pts rise" style={{ "--i": 1 }}>
                            {g().points > 0 ? `+${g().points} el puanı` : "Bu elde puan yok"}
                          </p>
                        </Show>
                        <p class="kro-gap__win rise" style={{ "--i": 2 }}>
                          {g().winner}
                        </p>
                        <Show when={g().trend}>
                          {(t) => (
                            <p class="kro-gap__trend rise" style={{ "--i": 3 }}>
                              {t()}
                            </p>
                          )}
                        </Show>
                        <Show when={g().next}>
                          {(nx) => <p class="kro-gap__next">Sıradaki hedef: {nx()} saniye</p>}
                        </Show>
                      </Show>
                    </div>
                  )}
                </Show>

                <Show when={phase() !== "count"}>
                  <Strip
                    players={crew()}
                    totals={view()?.totals ?? {}}
                    selfId={props.selfId}
                    gains={gap()?.gains ?? null}
                  />
                </Show>
              </>
            }
          >
            {(fin) => (
              <div class="kro-final">
                <div class="kro-final__head">
                  <span class="overline">Son el · hedef {targetSeconds(targetMs())} saniye</span>
                  <Show
                    when={reduced() || elapsed() >= NEEDLE.lineIn + NEEDLE.run}
                    fallback={<p class="kro-final__verdict">Hedef {targetSeconds(targetMs())}…</p>}
                  >
                    <Show when={!props.spectator} fallback={<p class="kro-final__verdict">Sonuç</p>}>
                      <p class="kro-final__verdict" data-win={(me()?.award ?? 0) > 0 ? "1" : "0"}>
                        {(me()?.award ?? 0) > 0 ? `+${me()?.award} puan` : "Puan yok"}
                      </p>
                      <p class="kro-final__sub">
                        {headLine(lastMine(), targetMs())} · toplam {me()?.total ?? 0}
                      </p>
                    </Show>
                  </Show>
                </div>
                <Track
                  entries={finalEntries()}
                  targetMs={targetMs()}
                  elapsed={reduced() || elapsed() > NEEDLE_TOTAL_MS ? null : elapsed()}
                  playerOf={playerOf}
                  selfId={props.selfId}
                  avatar={28}
                  trial={props.spectator ? trialOf(handNo()) : null}
                />
                <Show when={reduced() || elapsed() >= NEEDLE.lineIn + NEEDLE.run}>
                  <FinalRows
                    standings={fin().standings}
                    lastEntries={finalEntries()}
                    lastTargetMs={targetMs()}
                    playerOf={playerOf}
                    selfId={props.selfId}
                    visible={reduced() ? Math.floor(Math.max(0, elapsed()) / REDUCED_ROW_STEP_MS) + 1 : null}
                    trial={trialLine()}
                  />
                </Show>
              </div>
            )}
          </Show>
        </Show>
        <Show when={flashOn()}>
          {(peak) => <div class="kro__flash" style={{ "--peak": peak() }} aria-hidden="true" />}
        </Show>
        <Show when={band()} keyed>
          {(b) => (
            <div class="kro__band" role="status">
              {b.text}
            </div>
          )}
        </Show>
      </div>
      <p class="sr-only" aria-live="polite">
        {live()}
      </p>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
