import type { ZamanBombasiColor } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { atServerTime } from "../../net/serverTimer.js";
import { serverNow } from "../../net/store.js";
import { createServerNow } from "../../net/time.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import { FuseBomb } from "./FuseBomb.js";
import { centerIn, FLIGHT_MS, flightFrames } from "./flight.js";
import { PADS, PadSymbol, padSound } from "./pads.js";
import {
  clientPhase,
  FUSE_RUSH_MS,
  formatClock,
  fuseBurnt,
  isSuddenDeath,
  lengthTone,
  litIndexAt,
  parseZamanBombasiView,
  statusOf,
} from "./view.js";
import "./stage-view.css";

/**
 * Zaman Bombası Hafızası, büyük ekran (ZB-U8): tuş takımı sol yarıda, sağda büyük oyuncu sütunu (avatar, ad,
 * durum). Bomba sırası gelenin kartında durur (giriş evresinde fitili yanar) ve atışta seçilen karta uçar.
 * Yalnız herkese açık görünüm kullanılır.
 */
export default function ZamanBombasiStageView(props: GameScreenProps) {
  const now = createServerNow(40);
  const view = createMemo(() => parseZamanBombasiView(props.match.publicView, props.match.view));
  const phase = createMemo(() => {
    const v = view();
    return v ? clientPhase(v, now()) : "over";
  });
  const status = createMemo(() => {
    const v = view();
    return v ? statusOf({ v, phase: phase(), spectator: true, now: now() }) : "intro";
  });
  const nameOf = (id: string | null | undefined): string =>
    props.players.find((p) => p.id === id)?.nickname ?? "Oyuncu";

  // Oynatmada yanan tuş; girişte son doğru basışın yankısı.
  const playLit = createMemo<ZamanBombasiColor | null>(() => {
    const v = view();
    if (!v || v.phase === "over" || !v.sequence || phase() !== "playback") return null;
    const i = litIndexAt(v, now());
    return i >= 0 ? (v.sequence[i] ?? null) : null;
  });
  const [echo, setEcho] = createSignal<ZamanBombasiColor | null>(null);
  let echoTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(echoTimer));
  createEffect(
    on(
      () => view()?.pressed.length ?? 0,
      (n, prev) => {
        const v = view();
        if (!v || n === 0 || (prev !== undefined && n <= prev)) return;
        const c = v.pressed[n - 1];
        if (!c) return;
        setEcho(c);
        clearTimeout(echoTimer);
        echoTimer = setTimeout(() => setEcho(null), 260);
      },
    ),
  );
  const lit = (): ZamanBombasiColor | null => playLit() ?? echo();
  createEffect(
    on(playLit, (c) => {
      if (c) padSound(c, 220);
    }),
  );

  // Bomba atışı: kartlar arasında yay çizerek uçar (sunucu saatine bağlı zamanlayıcıyla başlar).
  let column: HTMLDivElement | undefined;
  let root: HTMLDivElement | undefined;
  let fly: HTMLSpanElement | undefined;
  const [flying, setFlying] = createSignal(false);
  let cancelFlight: (() => void) | null = null;
  onCleanup(() => cancelFlight?.());
  createEffect(
    on(
      () => {
        const t = view()?.lastThrow;
        return t ? `${t.at}:${t.to}` : "";
      },
      (key) => {
        cancelFlight?.();
        cancelFlight = null;
        const t = view()?.lastThrow;
        if (!key || !t || serverNow() >= t.at + FLIGHT_MS) return;
        cancelFlight = atServerTime(
          t.at,
          () => {
            const target = column?.querySelector(`[data-id="${t.to}"] .zbtv__bombslot`);
            const source = t.from ? column?.querySelector(`[data-id="${t.from}"] .zbtv__bombslot`) : null;
            if (!fly || !root || !target) return;
            setFlying(true);
            const anim = fly.animate(
              flightFrames(source ? centerIn(source, root) : null, centerIn(target, root)),
              { duration: FLIGHT_MS, easing: "cubic-bezier(.35,.1,.45,1)", fill: "forwards" },
            );
            anim.onfinish = () => {
              setFlying(false);
              anim.cancel();
            };
          },
          serverNow,
        );
      },
    ),
  );

  const dots = () => Array.from({ length: view()?.length ?? 0 }, (_, i) => i);
  const dotState = (i: number): string => {
    const v = view();
    if (!v) return "";
    if (phase() === "playback") {
      const cur = litIndexAt(v, now());
      return i < Math.floor((now() - v.turnStart) / v.stepMs) ? "on" : i === cur ? "now" : "";
    }
    if (phase() === "input" || (phase() === "expired" && v.phase === "input"))
      return i < v.pressed.length ? "ok" : "";
    if (v.phase === "pick" && v.pick?.kind === "throw") return "ok";
    return "";
  };
  const timeLeft = () => {
    const v = view();
    return v ? Math.max(0, v.endsAt - now()) : 0;
  };
  const sudden = () => {
    const v = view();
    return v ? !v.timeUp && v.phase !== "over" && isSuddenDeath(v, now()) : false;
  };
  const tone = (): string => {
    const s = status();
    if (s === "ok") return "lime";
    if (s === "fail" || s === "timeout") return "red";
    if (s === "other" || s === "pickOther" || s === "thrown" || s === "alert") return "cyan";
    return "";
  };
  const heading = (): string => {
    const v = view();
    switch (status()) {
      case "intro":
        return "Hazır ol!";
      case "alert":
      case "thrown":
        return `Bomba ${nameOf(v?.active)} oyuncusunda`;
      case "watch":
      case "watchMine":
        return "İzle ve ezberle";
      case "mine":
      case "other":
        return `${nameOf(v?.active)} basıyor`;
      case "ok":
        return "TEMİZ!";
      case "fail":
        return `${nameOf(v?.last?.player)} elendi`;
      case "timeout":
        return "Süre doldu!";
      case "pickOther":
      case "pickColor":
      case "pickTarget":
        return `${nameOf(v?.pick?.by)} seçiyor`;
      default:
        return v?.timeUp ? "Süre doldu" : "Oyun bitti";
    }
  };
  const subline = (): string => {
    const v = view();
    if (!v) return "";
    const s = status();
    if (s === "intro" || s === "watch" || s === "watchMine" || s === "alert" || s === "thrown")
      return v.active ? `${nameOf(v.active)} bu ${v.length} rengi tekrarlayacak` : "";
    if (s === "other" || s === "mine") return `${v.pressed.length} / ${v.length} renk`;
    if (s === "ok") return `${nameOf(v.last?.player)} bombayı atacak`;
    if (s === "fail" || s === "timeout") return "Dizi 2 renge döndü";
    if (s === "pickOther" || s === "pickColor" || s === "pickTarget") {
      if (v.pick?.kind === "restart") return "Yeni kurbanı seçiyor";
      return v.pick?.colorDone ? "Bombayı kime atacak?" : "Diziye renk ekliyor";
    }
    return "";
  };

  const roster = () => {
    const v = view();
    return (v?.order ?? [])
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  };
  const stateOf = (id: string): { key: string; label: string } => {
    const v = view();
    if (!v) return { key: "", label: "" };
    if (v.eliminated.includes(id)) return { key: "out", label: "Elendi" };
    if (v.phase === "over") return { key: "safe", label: "Hayatta" };
    if (v.active === id) {
      if (v.phase === "pick") return { key: "pick", label: "Bombayı atıyor" };
      return { key: "turn", label: phase() === "input" ? "Basıyor" : "Sırada" };
    }
    return { key: "", label: "Aktif" };
  };
  const burnt = (): number => {
    const v = view();
    if (!v || phase() !== "input") return 0;
    return fuseBurnt(Math.max(1, v.deadline - v.inputStart), v.deadline - now());
  };
  const rush = () => {
    const v = view();
    return !!v && phase() === "input" && v.deadline - now() <= FUSE_RUSH_MS;
  };

  return (
    <Show when={view()}>
      {(v) => (
        <div class="zbtv" data-sudden={sudden() ? "1" : undefined} ref={root}>
          <section class="zbtv__left">
            <div class="zbtv__top">
              <div class="zbtv__headbox">
                <p class="zbtv__head" data-tone={tone()}>
                  {heading()}
                </p>
                <p class="zbtv__sub">{subline()}</p>
              </div>
              <div class="zbtv__total" role="timer" aria-label="Kalan toplam süre">
                <span class="zbtv__totalnum">{formatClock(timeLeft())}</span>
                <Show when={sudden()}>
                  <span class="zbtv__badge">Ani ölüm</span>
                </Show>
              </div>
            </div>
            <div class="zbtv__pads">
              <For each={PADS}>
                {(pad) => (
                  <div class="zbtv__pad" data-c={pad.color} data-state={lit() === pad.color ? "lit" : "dim"}>
                    <PadSymbol color={pad.color} />
                    <span class="zbtv__padname">{pad.label}</span>
                  </div>
                )}
              </For>
            </div>
            <div class="zbtv__seq" data-tone={lengthTone(v().length)}>
              <span class="zbtv__len">
                Dizi <b>{v().length}</b>
              </span>
              <div class="zbtv__track" aria-hidden="true">
                <For each={dots()}>{(i) => <i class="zbtv__dot" data-s={dotState(i)} />}</For>
              </div>
            </div>
          </section>
          <section class="zbtv__right" style={{ "--n": roster().length }} ref={column}>
            <For each={roster()}>
              {(p) => {
                const st = () => stateOf(p.id);
                const holder = () => st().key === "turn" || st().key === "pick";
                return (
                  <div class="zbtv__card" data-id={p.id} data-s={st().key}>
                    <Avatar
                      index={p.avatar}
                      size="var(--zbtv-card-av)"
                      connected={p.connected}
                      mood={st().key === "out" ? "out" : undefined}
                      ring={holder() ? "var(--cyan)" : undefined}
                    />
                    <div class="zbtv__cardtext">
                      <span class="zbtv__name">{p.nickname}</span>
                      <span class="zbtv__state">{st().label}</span>
                    </div>
                    <span class="zbtv__bombslot" aria-hidden="true">
                      <Show when={holder() && !flying()}>
                        <FuseBomb class="zbtv__bomb" burnt={burnt} live={phase() === "input"} rush={rush()} />
                      </Show>
                    </span>
                  </div>
                );
              }}
            </For>
          </section>
          <span class="zbtv__fly" ref={fly} data-on={flying() ? "1" : undefined} aria-hidden="true">
            <FuseBomb class="zbtv__flybomb" burnt={() => 0} live={false} />
          </span>
        </div>
      )}
    </Show>
  );
}
