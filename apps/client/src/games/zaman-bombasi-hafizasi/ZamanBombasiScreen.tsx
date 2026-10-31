// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden); anlam metinde
import type { ZamanBombasiColor } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticAlarm, hapticError, hapticMatch, hapticPress, hapticSolo } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { atServerTime } from "../../net/serverTimer.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { BlastArt } from "../../ui/BombArt.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { FuseBomb } from "./FuseBomb.js";
import { centerIn, FLIGHT_MS, flightFrames } from "./flight.js";
import { PADS, PadSymbol, padSound } from "./pads.js";
import { boom, cleanChime, fuseTick, pickBlip, turnAlarm, whoosh } from "./sfx.js";
import {
  type ClientPhase,
  clientPhase,
  FUSE_RUSH_MS,
  formatClock,
  fuseBurnt,
  fuseTickMs,
  isNewResult,
  isSuddenDeath,
  lengthTone,
  litMs,
  parseZamanBombasiView,
  type StatusKind,
  statusOf,
} from "./view.js";
import "./zaman-bombasi.css";

const CRACKS = [
  "M52 -2 L47 14 L56 24 L45 38 L55 50 L43 63 L52 76 L46 90 L50 102",
  "M55 50 L72 44 L80 55 L96 52 L102 58",
  "M45 38 L30 33 L22 42 L8 38 L-2 44",
  "M43 63 L31 70 L33 84 L20 92",
  "M56 24 L68 18 L74 8",
];

const PAD_VAR: Record<ZamanBombasiColor, string> = {
  yesil: "var(--zc-yesil)",
  kirmizi: "var(--zc-kirmizi)",
  sari: "var(--zc-sari)",
  mavi: "var(--zc-mavi)",
};

const reduced = (): boolean =>
  document.documentElement.dataset.motion === "reduce" ||
  (document.documentElement.dataset.motion !== "full" &&
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches);

export default function ZamanBombasiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseZamanBombasiView(props.match.publicView, props.match.view));
  const [tick, setTick] = createSignal(0);
  // Toplam süre göstergesi: saniyede birkaç kez güncellenir (kare kare çizim gerekmez).
  const [clockNow, setClockNow] = createSignal(serverNow());
  const clockTimer = setInterval(() => setClockNow(serverNow()), 250);
  onCleanup(() => clearInterval(clockTimer));
  const timeLeft = () => {
    const v = view();
    return v ? Math.max(0, v.endsAt - clockNow()) : 0;
  };
  const sudden = () => {
    const v = view();
    return v ? !v.timeUp && v.phase !== "over" && isSuddenDeath(v, clockNow()) : false;
  };
  const phase = createMemo<ClientPhase>(() => {
    tick();
    const v = view();
    return v ? clientPhase(v, serverNow()) : "over";
  });
  const status = createMemo<StatusKind>(() => {
    tick();
    const v = view();
    return v
      ? statusOf({ v, phase: phase(), spectator: props.spectator === true, now: serverNow() })
      : "intro";
  });
  const mine = () => !props.spectator && (view()?.myTurn ?? false) && !(view()?.isOut ?? false);
  const canPlay = () => mine() && phase() === "input";
  const nameOf = (id: string | null | undefined): string =>
    props.players.find((p) => p.id === id)?.nickname ?? "Oyuncu";

  // ---- Seçim (ZB-M1/M2): yerel "gönderildi" işareti, sunucu onayına kadar ikinci dokunuşu engeller. ----
  const [sentColor, setSentColor] = createSignal<ZamanBombasiColor | null>(null);
  const [sentTarget, setSentTarget] = createSignal<string | null>(null);
  let pickKey = -1;
  createEffect(() => {
    const d = view()?.pick?.deadline ?? -1;
    if (d !== pickKey) {
      pickKey = d;
      setSentColor(null);
      setSentTarget(null);
    }
  });
  const canPickColor = () =>
    !props.spectator && status() === "pickColor" && phase() === "pick" && sentColor() === null;
  const canPickTarget = () =>
    !props.spectator && status() === "pickTarget" && phase() === "pick" && sentTarget() === null;
  const myColor = (): ZamanBombasiColor | null => view()?.pickColor ?? sentColor();

  const [lit, setLit] = createSignal<ZamanBombasiColor | null>(null);
  const [playIdx, setPlayIdx] = createSignal(-1);
  const [pressedPad, setPressedPad] = createSignal<ZamanBombasiColor | null>(null);
  const [leftMs, setLeftMs] = createSignal(0);
  const [burnt, setBurnt] = createSignal(0);
  const [alerting, setAlerting] = createSignal(false);
  const [flying, setFlying] = createSignal(false);
  const [blastId, setBlastId] = createSignal<string | null>(null);
  let panel: HTMLDivElement | undefined;
  let tint: HTMLSpanElement | undefined;
  let shock: HTMLSpanElement | undefined;
  let fly: HTMLSpanElement | undefined;
  let strip: HTMLElement | undefined;
  let overlayBox: HTMLDivElement | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let playTimers: (() => void)[] = [];
  let fxTimers: (() => void)[] = [];
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(
      () => {
        timers.delete(t);
        fn();
      },
      Math.max(0, ms),
    );
    timers.add(t);
  };
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
    for (const cancel of playTimers) cancel();
    for (const cancel of fxTimers) cancel();
    cancelAnimationFrame(raf);
  });

  const flashTint = (color: ZamanBombasiColor): void => {
    if (!tint) return;
    tint.style.setProperty("--tint", PAD_VAR[color]);
    tint.animate([{ opacity: 0 }, { opacity: 0.42, offset: 0.25 }, { opacity: 0 }], {
      duration: 300,
      easing: "ease-out",
    });
  };

  // Evre sınırları ve oynatma ışıkları: sunucudan gelen mutlak zamanlardan, sunucu saatine bağlı zamanlayıcıyla.
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      for (const cancel of playTimers) cancel();
      playTimers = [];
      setLit(null);
      const now = serverNow();
      const at = (target: number, fn: () => void): void => {
        playTimers.push(atServerTime(target, fn, serverNow));
      };
      const edges = [v.turnStart, v.inputStart, v.deadline, v.endsAt];
      if (v.pick) edges.push(v.pick.opensAt, v.pick.deadline);
      if (v.lastThrow) edges.push(v.lastThrow.at, v.lastThrow.at + FLIGHT_MS);
      for (const edge of edges) if (edge > now) at(edge, () => setTick((n) => n + 1));
      setTick((n) => n + 1);
      if (v.phase === "over" || v.phase === "pick") return;
      const seq = v.sequence;
      const dur = litMs(v.length, v.stepMs);
      setPlayIdx(now >= v.turnStart && now < v.inputStart ? Math.floor((now - v.turnStart) / v.stepMs) : -1);
      if (!seq || now >= v.inputStart) return;
      seq.forEach((color, i) => {
        const start = v.turnStart + i * v.stepMs;
        const end = start + dur;
        if (end <= now) return;
        at(start, () => {
          setPlayIdx(i);
          setLit(color);
          flashTint(color);
          if (serverNow() - start < 120) padSound(color, dur);
        });
        at(end, () => setLit((cur) => (cur === color ? null : cur)));
      });
    });
  });

  // Fitil: yalnız giriş evresinde kare kare; sıra sendeyse tik sesi (son 2 sn sıklaşır).
  let raf = 0;
  createEffect(() => {
    cancelAnimationFrame(raf);
    const v = view();
    if (!v || phase() !== "input") return;
    const total = Math.max(1, v.deadline - v.inputStart);
    const ticking = untrack(mine);
    let nextTick = 0;
    const frame = (): void => {
      const now = serverNow();
      const left = Math.max(0, v.deadline - now);
      setLeftMs(left);
      setBurnt(fuseBurnt(total, left));
      if (ticking && left > 0 && performance.now() >= nextTick) {
        fuseTick(left <= FUSE_RUSH_MS);
        nextTick = performance.now() + fuseTickMs(left);
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
  });

  const pulsePad = (color: ZamanBombasiColor): void => {
    const el = panel?.querySelector<HTMLElement>(`.zpad[data-c="${color}"] .zpad__face`);
    el?.animate([{ scale: "1" }, { scale: "1.08", offset: 0.35 }, { scale: "1" }], {
      duration: 240,
      easing: "ease-out",
    });
  };

  // Yeni doğru basışlar (sunucu onayı): nabız + nota; başkalarında tuş yanar; herkeste yeşil iz.
  let seenPressed = 0;
  let seenTurn = -1;
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      if (v.turn !== seenTurn) {
        seenTurn = v.turn;
        seenPressed = 0;
      }
      if (v.pressed.length > seenPressed) {
        const fresh = v.pressed.slice(seenPressed);
        seenPressed = v.pressed.length;
        const color = fresh[fresh.length - 1];
        if (color) {
          pulsePad(color);
          if (!mine()) {
            setLit(color);
            padSound(color, 200);
            later(() => setLit((cur) => (cur === color ? null : cur)), 220);
          }
        }
        panel?.animate(
          [
            { boxShadow: "inset 0 0 40px rgba(0,0,0,.6), 0 0 0 2px rgba(182,255,59,0)" },
            {
              boxShadow: "inset 0 0 40px rgba(0,0,0,.6), 0 0 0 3px rgba(182,255,59,.9)",
              offset: 0.25,
            },
            { boxShadow: "inset 0 0 40px rgba(0,0,0,.6), 0 0 0 2px rgba(182,255,59,0)" },
          ],
          { duration: 420, easing: "ease-out" },
        );
      }
    });
  });

  // Bir sıranın sonucu: TEMİZ (şok dalgası, zil) ya da patlama (savrulan avatar, sarsıntı). Yalnız ekran açıkken gelenler.
  let lastTurn: number | null = null;
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      const seen = lastTurn;
      lastTurn = Math.max(lastTurn ?? -1, v.last?.turn ?? 0);
      if (!isNewResult(v.last, seen) || !v.last) return;
      const ownTurn = v.last.player === props.selfId && !props.spectator;
      if (v.last.kind === "ok") {
        cleanChime();
        if (ownTurn) hapticMatch();
        shock?.animate(
          [
            { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.95 },
            { transform: "translate(-50%, -50%) scale(2.4)", opacity: 0 },
          ],
          { duration: reduced() ? 1 : 620, easing: "cubic-bezier(.2,.7,.3,1)" },
        );
        return;
      }
      boom();
      if (ownTurn) {
        hapticSolo();
        later(hapticError, 220);
      }
      const out = v.last.player;
      setBlastId(out);
      later(() => setBlastId((cur) => (cur === out ? null : cur)), 1300);
      if (!reduced()) {
        panel?.parentElement?.animate(
          [
            { transform: "translate(0, 0)" },
            { transform: "translate(-9px, 3px) rotate(-.6deg)" },
            { transform: "translate(8px, -3px) rotate(.5deg)" },
            { transform: "translate(-5px, 2px)" },
            { transform: "translate(3px, 0)" },
            { transform: "translate(0, 0)" },
          ],
          { duration: 460, easing: "ease-out" },
        );
      }
    });
  });

  // Bomba atışı: yay çizerek uçar; hedef bensem varışta "SIRA SENDE!" (kenar ışığı, güçlü titreşim, alarm).
  let seenThrow = "";
  let alertTurn = -1;
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      const t = v.lastThrow;
      const key = t ? `${v.turn}:${t.at}:${t.to}` : "";
      const now = serverNow();
      if (key !== seenThrow) {
        seenThrow = key;
        for (const cancel of fxTimers) cancel();
        fxTimers = [];
        if (t && now < t.at + FLIGHT_MS) {
          fxTimers.push(atServerTime(t.at, () => launch(t.from, t.to), serverNow));
        }
      }
      // Uyarı: bu sıranın sahibi bensem ve oynatma başlamadıysa (ilk sıra: atış yok, hemen).
      if (mine() && v.phase === "pause" && alertTurn !== v.turn && now < v.turnStart) {
        alertTurn = v.turn;
        const from = t ? t.at + FLIGHT_MS : now;
        fxTimers.push(
          atServerTime(
            from,
            () => {
              setAlerting(true);
              turnAlarm();
              hapticAlarm();
            },
            serverNow,
          ),
        );
        fxTimers.push(atServerTime(v.turnStart, () => setAlerting(false), serverNow));
      }
    });
  });
  // Uyarı yalnız oynatma başlayana kadar (evre istemci saatinden türer; sunucu bu sınırda yayın yapmaz).
  createEffect(() => {
    if (phase() !== "pause") setAlerting(false);
  });

  const launch = (from: string | null, to: string): void => {
    const box = overlayBox;
    const target = strip?.querySelector(`[data-id="${to}"] .av`);
    const source = from ? strip?.querySelector(`[data-id="${from}"] .av`) : null;
    if (!fly || !box || !target) return;
    whoosh();
    if (reduced()) return;
    setFlying(true);
    const anim = fly.animate(flightFrames(source ? centerIn(source, box) : null, centerIn(target, box)), {
      duration: FLIGHT_MS,
      easing: "cubic-bezier(.35,.1,.45,1)",
      fill: "forwards",
    });
    anim.onfinish = () => {
      setFlying(false);
      anim.cancel();
    };
  };

  const cracked = () => {
    const v = view();
    if (!v?.last || v.last.kind === "ok") return false;
    if (v.last.turn < v.turn - 1) return false;
    const p = phase();
    return p === "pick" || p === "pause" || p === "over" || (p === "expired" && v.phase === "pick");
  };

  let pressedAt = 0;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(releaseTimer));
  const down = (color: ZamanBombasiColor, e: PointerEvent): void => {
    e.preventDefault();
    if (canPickColor()) {
      unlockAudio();
      setSentColor(color);
      padSound(color, 260);
      pickBlip();
      hapticPress();
      pulsePad(color);
      sendAction({ kind: "color", color });
      return;
    }
    if (!canPlay()) return;
    unlockAudio();
    pressedAt = performance.now();
    clearTimeout(releaseTimer);
    setPressedPad(color);
    padSound(color, 180);
    hapticPress();
    sendAction({ kind: "press", color });
  };
  const up = (): void => {
    const hold = Math.max(0, 90 - (performance.now() - pressedAt));
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => setPressedPad(null), hold);
  };
  const pickTarget = (id: string): void => {
    if (!canPickTarget()) return;
    unlockAudio();
    setSentTarget(id);
    pickBlip();
    hapticPress();
    sendAction({ kind: "target", target: id });
  };

  const padsOn = () => canPlay() || canPickColor();
  const padState = (color: ZamanBombasiColor): "dim" | "ready" | "lit" => {
    if (lit() === color || pressedPad() === color || myColor() === color) return "lit";
    return padsOn() ? "ready" : "dim";
  };

  const dots = createMemo(() => Array.from({ length: view()?.length ?? 0 }, (_, i) => i));
  const dotState = (i: number): "on" | "now" | "ok" | "" => {
    const v = view();
    if (!v) return "";
    const p = phase();
    if (p === "playback") return i < playIdx() ? "on" : i === playIdx() ? (lit() ? "now" : "on") : "";
    if (p === "input" || (p === "expired" && v.phase === "input")) return i < v.pressed.length ? "ok" : "";
    if (v.phase === "pick" && v.pick?.kind === "throw") return "ok";
    return "";
  };
  /** Doğru girişten sonra eklenecek yeni nokta: seçenin ekranında seçtiği renk, diğerlerinde "seçildi". */
  const newDot = (): ZamanBombasiColor | "hidden" | null => {
    const v = view();
    if (v?.phase !== "pick" || v.pick?.kind !== "throw") return null;
    const c = myColor();
    if (c) return c;
    return v.pick.colorDone ? "hidden" : null;
  };

  const title = (): string => {
    const v = view();
    switch (status()) {
      case "intro":
        return "Hazır ol!";
      case "alert":
        return "Sıra sende!";
      case "thrown":
        return "Bomba atıldı!";
      case "watch":
        return "İzle";
      case "watchMine":
        return "İzle ve ezberle";
      case "mine":
        return "Sıra sende!";
      case "other":
        return `${nameOf(v?.active)} basıyor`;
      case "ok":
        return "TEMİZ!";
      case "fail":
        return `${nameOf(v?.last?.player)} elendi`;
      case "timeout":
        return "Süre doldu!";
      case "pickColor":
        return "Rengi seç";
      case "pickTarget":
        return v?.pick?.kind === "restart" ? "Yeni kurbanı seç" : "Kime atıyorsun?";
      case "pickOther":
        return `${nameOf(v?.pick?.by)} seçiyor`;
      case "eliminated":
        return "Elendin";
      default:
        return v?.timeUp ? "Süre doldu" : "Oyun bitti";
    }
  };
  const sub = (): string => {
    const v = view();
    const n = v?.length ?? 2;
    switch (status()) {
      case "intro":
        return v?.active ? `İlk sıra: ${nameOf(v.active)}` : "Işıkları ezberle";
      case "alert":
        return "Işıkları izle ve ezberle";
      case "thrown":
        return v?.lastThrow?.auto
          ? `Rastgele seçildi: ${nameOf(v.active)}`
          : `${nameOf(v?.lastThrow?.from)} → ${nameOf(v?.active)}`;
      case "watch":
        return v?.active ? `${nameOf(v.active)} bunu tekrarlayacak` : "";
      case "watchMine":
        return `${n} renk — sıra sende`;
      case "mine":
        return "Aynı sırayla bas";
      case "other":
        return "Bomba sana da gelebilir!";
      case "ok":
        return v?.pick?.by === props.selfId && !props.spectator
          ? "Şimdi diziye renk ekle"
          : `${nameOf(v?.last?.player)} bombayı atacak`;
      case "fail":
        return "Dizi 2 renge döndü";
      case "timeout":
        return `${nameOf(v?.last?.player)} elendi`;
      case "pickColor":
        return "Diziye eklenecek renge dokun";
      case "pickTarget":
        if (v?.pick?.kind === "restart") return "Bombayı sen attın, sıradakini sen seç";
        return v?.pick?.blocked ? "Az önce atana hemen geri atamazsın" : "Bombayı birine fırlat";
      case "pickOther":
        if (v?.pick?.kind === "restart") return "Bombayı kime atacak?";
        return v?.pick?.colorDone ? "Bombayı kime atacak?" : "Diziye renk ekliyor";
      case "eliminated":
        return "Arkadaşlarını izle";
      default:
        return "";
    }
  };
  const tone = (): string => {
    const s = status();
    if (s === "mine" || s === "alert" || s === "pickColor" || s === "pickTarget") return "cyan";
    if (s === "ok") return "lime";
    if (s === "fail" || s === "timeout" || s === "eliminated") return "red";
    return "";
  };

  const secs = () => Math.max(0, Math.ceil(leftMs() / 1000));
  const rush = () => phase() === "input" && leftMs() <= FUSE_RUSH_MS;
  const pickOpen = () => {
    tick();
    const v = view();
    return v?.pick ? phase() === "pick" && serverNow() >= v.pick.opensAt : false;
  };

  const roster = () => {
    const v = view();
    if (!v) return props.players.filter((p) => props.match.participants.includes(p.id));
    return v.order
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  };
  const pickPlayers = () => {
    const v = view();
    return roster().filter((p) => !(v?.eliminated.includes(p.id) ?? false));
  };
  const validTarget = (id: string): boolean => {
    const v = view();
    if (!v?.pick) return false;
    return id !== v.pick.by && id !== v.pick.blocked && !v.eliminated.includes(id);
  };
  const cols = () => {
    const n = roster().length;
    return n <= 5 ? n : Math.ceil(n / 2);
  };

  return (
    <Screen class="game zgame">
      <div class="zgame__fx" ref={overlayBox} aria-hidden="true">
        <span class="zedge" data-on={alerting() ? "1" : undefined} />
        <span class="zfly" ref={fly} data-on={flying() ? "1" : undefined}>
          <span class="zfly__bomb" />
        </span>
      </div>
      <Show when={alerting()}>
        <div class="zband" role="alert">
          <span class="display zband__text">SIRA SENDE!</span>
        </div>
      </Show>

      <Show when={view()}>
        {(v) => (
          <div class="ztotal" data-sudden={sudden() ? "1" : undefined}>
            <span class="ztotal__clock">{formatClock(timeLeft())}</span>
            <ProgressBar class="ztotal__bar" startedAt={v().startedAt} endsAt={v().endsAt} now={serverNow} />
            <Show when={sudden()}>
              <span class="ztotal__badge">Ani ölüm</span>
            </Show>
          </div>
        )}
      </Show>

      <Status
        class="zstatus"
        titleClass="display zstatus__title"
        subClass="zstatus__sub"
        tone={tone()}
        sub={sub()}
      >
        {title()}
      </Status>

      <div class="zlen" data-tone={lengthTone(view()?.length ?? 2)}>
        <span class="zlen__label">Dizi</span>
        <Show when={view()?.length} keyed>
          {(n) => <span class="display zlen__num">{n}</span>}
        </Show>
        <div class="ztrack" aria-hidden="true">
          <For each={dots()}>{(i) => <i class="ztrack__dot" data-s={dotState(i)} />}</For>
          <Show when={newDot()}>
            {(c) => <i class="ztrack__dot ztrack__dot--new" data-s="new" data-c={c()} />}
          </Show>
        </div>
      </div>

      <div
        class="zpanel"
        data-cracked={cracked() ? "1" : undefined}
        data-active={padsOn() ? "1" : undefined}
        data-picking={canPickColor() ? "1" : undefined}
        ref={panel}
      >
        <For each={PADS}>
          {(pad) => (
            <button
              type="button"
              class="zpad"
              data-c={pad.color}
              data-state={padState(pad.color)}
              data-pressed={pressedPad() === pad.color ? "1" : undefined}
              aria-label={canPickColor() ? `${pad.label} ekle` : pad.label}
              disabled={!padsOn()}
              onPointerDown={(e) => down(pad.color, e)}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={up}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span class="zpad__side" />
              <span class="zpad__face">
                <PadSymbol color={pad.color} />
              </span>
            </button>
          )}
        </For>

        <span class="zpanel__tint" ref={tint} aria-hidden="true" />
        <span class="zshock" ref={shock} aria-hidden="true" />

        <div class="zhub" data-live={phase() === "input" ? "1" : undefined} aria-hidden="true">
          <Show when={!cracked()} fallback={<BlastArt class="zhub__blast" />}>
            <FuseBomb class="zhub__bomb" burnt={burnt} live={phase() === "input"} rush={rush()}>
              <Show when={phase() === "input"}>
                <span class="display zhub__num" data-rush={rush() ? "1" : undefined}>
                  {secs()}
                </span>
              </Show>
            </FuseBomb>
          </Show>
        </div>

        <svg class="zcrack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <For each={CRACKS}>{(d) => <path d={d} vector-effect="non-scaling-stroke" />}</For>
        </svg>
        <span class="zpanel__flash" aria-hidden="true" />

        <Show when={pickOpen() ? view()?.pick : null}>
          {(pk) => (
            <ProgressBar
              class="zpanel__picktime"
              startedAt={pk().opensAt}
              endsAt={pk().deadline}
              now={serverNow}
              urgency
            />
          )}
        </Show>

        <Show when={status() === "pickTarget"}>
          <div class="zpick">
            <PlayerPicker
              players={pickPlayers()}
              selfId={props.selfId}
              selected={sentTarget()}
              disabled={!canPickTarget()}
              ring="var(--cyan)"
              canPick={(p) => validTarget(p.id)}
              label={(p) => `Bombayı ${p.nickname} adlı oyuncuya at`}
              onPick={pickTarget}
            />
          </div>
        </Show>
      </div>

      <footer class="zstrip" ref={strip} style={{ "--zs-pcols": cols(), "--zs-n": roster().length }}>
        <For each={roster()}>
          {(p) => {
            const out = () => view()?.eliminated.includes(p.id) ?? false;
            const holder = () => !out() && view()?.active === p.id && phase() !== "over";
            return (
              <div
                class="zs"
                data-id={p.id}
                data-me={p.id === props.selfId ? "1" : undefined}
                data-active={holder() ? "1" : undefined}
                data-out={out() ? "1" : undefined}
                data-blast={blastId() === p.id ? "1" : undefined}
                data-alert={alerting() && p.id === props.selfId ? "1" : undefined}
              >
                <span class="zs__av">
                  <Avatar
                    index={p.avatar}
                    size="var(--zs-av)"
                    mood={out() ? "out" : undefined}
                    connected={p.connected}
                  />
                  <Show when={holder() && !flying()}>
                    <span class="zs__bomb" aria-hidden="true" />
                  </Show>
                </span>
                <span class="zs__name">{p.nickname}</span>
              </div>
            );
          }}
        </For>
      </footer>
    </Screen>
  );
}
