import type { PlayerInfo, SonKisiRoundResult } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import { lookOf } from "../../character/look.js";
import {
  hapticAlarm,
  hapticCrown,
  hapticMatch,
  hapticSingle,
  hapticSolo,
  hapticTap,
  hapticTick,
} from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { state } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { CharacterPoster } from "../../ui/CharacterPoster.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { Corridor, Lamps } from "./Corridor.js";
import { dash, farDoor, gold, gong, readyTone, shutter, siren, thump, ting } from "./sounds.js";
import { Timeline } from "./Timeline.js";
import "./son-kisi.css";
import {
  alarmLine,
  alarmMoment,
  CueGate,
  heartbeatMs,
  ownLine,
  parseSonKisiView,
  playHeadline,
  pointsText,
  pulseMs,
  roundHeadline,
  roundsLine,
  sonKisiCues,
  TIMELINE_STEP_MS,
  totalsLine,
} from "./view.js";

/** Alarm anı (siren, kepenk, YAKALANDIN / Kurtuldun / SON KİŞİ) zaman çizelgesinden önce bu kadar sürer (ms). */
const MOMENT_MS = 1_200;
/** Bant süresi (SK-U7: 1 sn). */
const BAND_MS = 1_000;
/** Tur arası (4 sn) sonunda "N. ALARM" ve "HAZIR" bantları (SK-U8). */
const NEXT_AT_MS = 2_700;
const READY_AT_MS = 3_400;

const MOMENT_TEXT = { last: "SON KİŞİ!", safe: "Kurtuldun", caught: "YAKALANDIN!" } as const;

export default function SonKisiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseSonKisiView(props.match.publicView, props.match.view));
  const pub = () => view()?.pub ?? null;
  const phase = () => pub()?.phase ?? "play";
  const round = () => pub()?.round ?? 0;
  const tension = () => pub()?.tension ?? 0;
  const crewCount = () => props.match.participants.length;
  const inside = () => crewCount() - (pub()?.escapedCount ?? 0);
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const nameOf = (id: string) => playerOf(id)?.nickname ?? "Oyuncu";
  const me = () => playerOf(props.selfId);
  const reduced = () => reducedMotion();

  // Kendi kaçışın: sunucu onayı gelmeden "KAÇTIN" (tur başına bir kez gönderilir).
  const [localRound, setLocalRound] = createSignal<number | null>(null);
  const sentRounds = new Set<number>();
  let ownEscapeAt = 0;
  const escaped = () =>
    !props.spectator && ((localRound() === round() && phase() === "play") || (view()?.priv.escaped ?? false));
  const myMs = () => view()?.priv.myMs ?? null;
  const canRun = () => !props.spectator && phase() === "play" && !escaped() && view() !== null;

  // Evre başlangıcı (yerel saat): tur arası/son açılışın zamanlaması buna göre.
  const [phaseStart, setPhaseStart] = createSignal(props.now());
  createEffect(
    on(
      () => `${round()}:${phase()}`,
      () => setPhaseStart(untrack(props.now)),
      { defer: true },
    ),
  );
  const elapsed = () => props.now() - phaseStart();

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

  const [band, setBand] = createSignal<{ id: number; text: string } | null>(null);
  let bandSeq = 0;
  const showBand = (text: string, ms = BAND_MS): void => {
    const id = ++bandSeq;
    setBand({ id, text });
    later(() => setBand((b) => (b?.id === id ? null : b)), ms);
  };
  const [live, setLive] = createSignal("");
  const [doorFlash, setDoorFlash] = createSignal(0);
  const [shake, setShake] = createSignal(false);

  const lastResult = (): SonKisiRoundResult | null => {
    const r = pub()?.results;
    return r && phase() !== "play" ? (r[round()] ?? null) : null;
  };

  // Ses ve titreşim: her an (eşik, kapı, bant, alarm) yalnız geçişte BİR KEZ (CueGate). Ekrana sonradan gelen
  // (yeniden bağlanan) eski anları duymaz.
  const gate = new CueGate();
  onMount(() => {
    const p = pub();
    if (p) gate.prime(sonKisiCues(p, crewCount()));
  });
  createEffect(() => {
    const p = pub();
    if (!p) return;
    const fresh = gate.fresh(sonKisiCues(p, crewCount()));
    untrack(() => {
      for (const c of fresh) {
        if (c.kind === "tension") {
          if (!escaped() && !props.spectator) hapticTick();
          setLive(`Gerilim arttı (${c.level}/3)`);
        } else if (c.kind === "door") {
          // Kendi kaçışının kapısı zaten çarptı; başkasınınki uzaktan duyulur.
          if (Date.now() - ownEscapeAt > 700) {
            farDoor();
            setDoorFlash((n) => n + 1);
          }
          setLive(`Biri kaçtı · içeride ${inside()} kişi`);
        } else if (c.kind === "band") {
          gong();
          showBand(c.text);
          if (c.text === "SON KİŞİ!" && !escaped() && !props.spectator) hapticSingle();
        } else if (c.kind === "ready") {
          readyTone();
        } else if (c.kind === "alarm") {
          alarm();
        }
      }
    });
  });

  const alarm = (): void => {
    siren();
    if (!reduced()) {
      setShake(true);
      later(() => setShake(false), 600);
    }
    later(shutter, 150);
    const r = lastResult();
    const m = r ? alarmMoment(r, props.spectator ? null : props.selfId) : null;
    const close = r?.escapes.find((e) => e.id === props.selfId)?.close ?? false;
    if (m === "last") {
      later(gold, 650);
      hapticCrown();
    } else if (m === "caught") hapticAlarm();
    else if (m === "safe") hapticMatch();
    else hapticSolo();
    if (close) later(ting, 950);
    setLive(m === null ? "Alarm!" : `Alarm! ${MOMENT_TEXT[m]}`);
  };

  // SK-U15: içerideki oyuncuda sürekli kalp atışı ve aynı ritimde hafif titreşim (düzey 1/2/3: 70/100/140 dk); kaçınca kesilir.
  createEffect(() => {
    const every = heartbeatMs(tension());
    if (every === null || phase() !== "play" || escaped() || props.spectator) return;
    const id = setInterval(() => {
      thump();
      hapticTick();
    }, every);
    onCleanup(() => clearInterval(id));
  });

  // SK-U13: geri dönen oyuncuya bant ve güçlü titreşim.
  createEffect(
    on(
      () => state.conn,
      (conn, prev) => {
        if (conn !== "open" || prev === undefined || prev === "open" || props.spectator) return;
        if (phase() === "play")
          showBand(escaped() ? "Döndün! Kaçışın kayıtlı" : "Döndün! Hâlâ içeridesin", 1_600);
        else if (phase() === "gap") showBand("Döndün! Sıradaki alarmda oynarsın", 1_600);
        hapticCrown();
      },
      { defer: true },
    ),
  );

  const run = (e: Event): void => {
    e.preventDefault();
    if (!canRun()) return;
    const r = round();
    unlockAudio();
    setLocalRound(r);
    ownEscapeAt = Date.now();
    dash();
    hapticTap();
    setLive("Kaçtın");
    if (sentRounds.has(r)) return;
    sentRounds.add(r);
    sendAction({ kind: "escape" });
  };

  const head = () =>
    playHeadline({
      spectator: props.spectator === true,
      escaped: escaped(),
      myMs: myMs(),
      inside: inside(),
      players: crewCount(),
    });
  const myTotal = () => pub()?.totals[props.selfId] ?? 0;
  const roundLabel = () => {
    const p = pub();
    if (!p) return "";
    return p.round === p.rounds - 1 ? "SON ALARM" : `ALARM ${p.round + 1}/${p.rounds}`;
  };
  const momentText = () => {
    const r = lastResult();
    const m = r ? alarmMoment(r, props.spectator ? null : props.selfId) : null;
    return m ? MOMENT_TEXT[m] : r?.rang === false ? "Herkes kaçtı" : "ALARM!";
  };
  const momentKind = () => {
    const r = lastResult();
    return (r ? alarmMoment(r, props.spectator ? null : props.selfId) : null) ?? "none";
  };
  const inMoment = () => phase() !== "play" && !reduced() && elapsed() < MOMENT_MS;
  const tlElapsed = () => {
    if (reduced()) return null;
    const e = elapsed() - MOMENT_MS;
    // Tur arası kısa sürüm iki kat hızlı yerleşir.
    return phase() === "gap" ? e * 2 : e;
  };
  const nextBand = () => {
    const p = pub();
    if (!p || phase() !== "gap") return null;
    if (elapsed() >= READY_AT_MS) return "HAZIR";
    if (elapsed() >= NEXT_AT_MS) return p.round + 1 === p.rounds - 1 ? "SON ALARM" : `${p.round + 2}. ALARM`;
    return null;
  };
  const finalDone = () => {
    const r = lastResult();
    return reduced() || (r !== null && elapsed() >= MOMENT_MS + r.escapes.length * TIMELINE_STEP_MS + 600);
  };

  return (
    <Screen class="sk">
      <div
        class="sk__root"
        data-phase={phase()}
        data-tension={tension()}
        data-escaped={escaped() ? "1" : undefined}
        data-shake={shake() ? "1" : undefined}
        style={{ "--pulse": `${pulseMs(tension())}ms` }}
      >
        <i class="sk__edge" aria-hidden="true" />
        <Show when={doorFlash() > 0}>
          <i class="sk__doorflash" aria-hidden="true" data-n={doorFlash() % 2} />
        </Show>
        <p class="sr-only" aria-live="polite">
          {live()}
        </p>

        <header class="sk__top">
          <span class="sk__round">{roundLabel()}</span>
          <Lamps level={tension()} />
          <Show when={!props.spectator} fallback={<span class="sk__pts">İzliyorsun</span>}>
            <span class="sk__pts">
              Puanın <b>{myTotal()}</b>
            </span>
          </Show>
        </header>

        <Show when={phase() === "play"}>
          <Status class="sk__text" titleClass="sk__head" subClass="sk__sub" on={escaped()} sub={head().sub}>
            {head().head}
          </Status>
          <p class="sk__count">
            İçeride <b>{inside()}</b> · Kaçtı <b>{pub()?.escapedCount ?? 0}</b>
          </p>
        </Show>

        <div class="sk__stage" data-moment={inMoment() ? momentKind() : undefined}>
          <Corridor shut={escaped() || phase() !== "play"} shutter={phase() !== "play"} />
          <Show when={phase() === "play" && !props.spectator}>
            <div class="sk__hero" data-run={escaped() ? "1" : undefined}>
              <Show when={me()} fallback={<span />}>
                {(m) => (
                  <CharacterPoster
                    avatar={m().avatar}
                    layers={lookOf(m().cosmetics).layers}
                    tints={lookOf(m().cosmetics).tints}
                    dance={null}
                    focus="full"
                    label={m().nickname}
                    fallback={
                      <Avatar index={m().avatar} size="min(30vw, 15dvh, 120px)" connected={m().connected} />
                    }
                  />
                )}
              </Show>
              <i class="sk__shadow" aria-hidden="true" />
            </div>
          </Show>
          <Show when={inMoment()}>
            <p class="sk__moment" data-kind={momentKind()}>
              {momentText()}
            </p>
          </Show>
        </div>

        <Show when={phase() !== "play" && !inMoment() && lastResult()}>
          {(r) => (
            <section class="sk__open rise" data-scroll aria-label="Alarm sonucu">
              <p class="sk__alarmline">{alarmLine(r())}</p>
              <p class="sk__winner">{roundHeadline(r(), nameOf, false)}</p>
              <Timeline
                result={r()}
                playerOf={playerOf}
                selfId={props.selfId}
                elapsed={tlElapsed()}
                short={phase() === "gap"}
                avatar={phase() === "gap" ? 30 : 34}
              />
              <Show when={!props.spectator && ownLine(r(), props.selfId, nameOf)}>
                {(line) => (
                  <p class="sk__own">
                    <span>{line()}</span>
                    <b class="sk__ownpts">{pointsText(r().points[props.selfId] ?? 0)}</b>
                  </p>
                )}
              </Show>
              <Show when={phase() === "gap"}>
                <p class="sk__totals">{totalsLine(pub()?.totals ?? {}, nameOf)}</p>
              </Show>
              <Show when={phase() === "over" && finalDone() && pub()?.final}>
                {(fin) => (
                  <div class="sk__final">
                    <Show when={!props.spectator && pub()}>
                      {(p) => <p class="sk__mysum">Üç alarm: {roundsLine(p().results, props.selfId)}</p>}
                    </Show>
                    <ol class="sk__rank">
                      <For each={fin()}>
                        {(s) => (
                          <li data-me={s.playerId === props.selfId ? "1" : undefined}>
                            <span class="sk__rk">{s.rank}</span>
                            <Show when={playerOf(s.playerId)}>
                              {(p) => <Avatar index={p().avatar} size={28} connected={p().connected} />}
                            </Show>
                            <span class="sk__rn">{nameOf(s.playerId)}</span>
                            <span class="sk__rp">{s.roundPoints.map(pointsText).join(" · ")}</span>
                            <b class="sk__rt">{s.total}</b>
                            <span class="sk__ra" data-zero={s.award === 0 ? "1" : undefined}>
                              {pointsText(s.award)}
                            </span>
                          </li>
                        )}
                      </For>
                    </ol>
                  </div>
                )}
              </Show>
            </section>
          )}
        </Show>

        <Show when={band() ?? (nextBand() ? { id: -1, text: nextBand() ?? "" } : null)}>
          {(b) => (
            <div class="sk__band" data-ready={b().text === "HAZIR" ? "1" : undefined} role="status">
              {b().text}
            </div>
          )}
        </Show>

        <Show when={phase() === "play" && !props.spectator}>
          {/* SK-U11: ekranın alt yarısı dokunma alanı (kenarlardan 24 px pay); düğme görünür hedeftir. */}
          <div class="sk__zone" aria-hidden="true" onPointerDown={run} />
          <footer class="sk__foot">
            <button
              type="button"
              class="sk__btn"
              data-done={escaped() ? "1" : undefined}
              disabled={!canRun()}
              onPointerDown={run}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") run(e);
              }}
            >
              {escaped() ? "KAÇTIN" : "KAÇ"}
            </button>
          </footer>
        </Show>
      </div>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
