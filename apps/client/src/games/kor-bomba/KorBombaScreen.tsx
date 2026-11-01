import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  canVibrate,
  hapticAlarm,
  hapticCatch,
  hapticError,
  hapticPress,
  hapticSingle,
  hapticTap,
} from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fail, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { state } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { BlastArt, BombArt } from "../../ui/BombArt.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { pressable } from "../../ui/press.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import type { GameScreenProps } from "../registry.js";
import { BombBadge, NoReturnIcon, PlugIcon, TapIcon } from "./icons.js";
import { bildiFor, HandChain, JourneyPanel } from "./parts.js";
import { bell, betClick, boom, catchSound, createFuseHiss, tak, unlockClick, whoosh } from "./sounds.js";
import "./kor-bomba.css";
import {
  betUsed,
  blastText,
  bombSpot,
  canBet,
  formatBonus,
  formatPeek,
  genitive,
  handChip,
  myBet,
  myResult,
  parseKorBombaView,
  peekLevel,
  remainingMs,
  type SeatPos,
  type SeatTap,
  seatPositions,
  seatTap,
  shortName,
} from "./view.js";

/** BM-U1: parmak kalkınca sayacın sönme süresi. */
const PEEK_RELEASE_MS = 150;
/** BM-U6: patlama gösterisinden sonra yolculuk açılır. */
const TRIP_DELAY_MS = 2_000;

interface Note {
  id: number;
  text: string;
  good: boolean;
}

export default function KorBombaScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKorBombaView(props.match.publicView, props.match.view));
  const seats = createMemo(() => seatPositions(props.match.participants, props.selfId));
  const count = () => props.match.participants.length;
  const seatOf = (id: string): SeatPos | undefined => seats().find((s) => s.id === id);
  const playerOf = (id: string) => props.players.find((p) => p.id === id);
  const nameOf = (id: string): string => playerOf(id)?.nickname ?? "Oyuncu";
  const connectedIds = createMemo(() =>
    props.match.participants.filter((id) => playerOf(id)?.connected !== false),
  );

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  // Pas verince bomba hemen yeni taşıyıcıya gider (sunucu aynı sonucu onaylar; reddedilirse geri döner).
  const [holderId, setHolder] = createOptimistic<string>(() => view()?.pub.holder ?? "", {
    onReject: () => {
      localPass = false;
      fail();
      hapticError();
    },
  });
  const exploded = () => view()?.pub.exploded ?? false;
  const iAmHolder = () =>
    !props.spectator && view()?.priv.role === "holder" && !exploded() && holderId() === props.selfId;
  const left = () => {
    const v = view();
    return v ? remainingMs(v, props.now()) : null;
  };
  const bomb = () => bombSpot(seatOf(holderId()), count());

  // BM-M1 / BM-U2: fitil tutuşuyor (kilit herkese açık; süreyle ilgisi yok).
  const lockLeft = () => Math.max(0, (view()?.pub.lockedUntil ?? 0) - props.now());
  const locked = () => iAmHolder() && lockLeft() > 0;
  const tapOf = (id: string): SeatTap => {
    const v = view();
    if (!v) return "locked";
    return seatTap(v.pub, id, connectedIds(), props.now());
  };

  // BM-U1: süre yalnız basılı tutarken görünür.
  const [peekHeld, setPeekHeld] = createSignal(false);
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  const peekOn = () => peekHeld() && left() !== null && !exploded();
  const level = () => {
    const l = left();
    return peekOn() && l !== null ? peekLevel(l) : null;
  };
  const startPeek = (e: PointerEvent): void => {
    if (left() === null || exploded()) return;
    e.preventDefault();
    clearTimeout(releaseTimer);
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // yakalanamadı: önemli değil
    }
    setPeekHeld(true);
    const pending = pendingBonus;
    pendingBonus = null;
    if (pending) showBonus(pending);
  };
  const endPeek = (): void => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => setPeekHeld(false), PEEK_RELEASE_MS);
  };
  onCleanup(() => {
    clearTimeout(releaseTimer);
    for (const t of timers) clearTimeout(t);
  });

  const [bonuses, setBonuses] = createSignal<{ id: number; text: string }[]>([]);
  let pendingBonus: string | null = null;
  let counter = 0;
  const showBonus = (text: string): void => {
    const id = ++counter;
    setBonuses((b) => [...b.slice(-2), { id, text }]);
    later(() => setBonuses((b) => b.filter((x) => x.id !== id)), 1000);
  };

  // BM-M3 / BM-U4: tek "PATLAR!" bahsi.
  const [betShown, setBetShown] = createOptimistic<boolean>(
    () => {
      const v = view();
      return v ? betUsed(v) : false;
    },
    {
      onReject: (reason) => {
        if (reason === "too_late") {
          setTooLate(true);
          later(() => setTooLate(false), 1_800);
        } else fail();
        hapticError();
      },
    },
  );
  const [tooLate, setTooLate] = createSignal(false);
  const mayBet = () => {
    const v = view();
    return v !== null && canBet(v, props.selfId, props.spectator === true) && holderId() !== props.selfId;
  };
  const showBetPanel = () => {
    const v = view();
    if (!v || props.spectator || exploded() || v.priv.role === "spectator") return false;
    return holderId() !== props.selfId && v.priv.role === "watcher";
  };
  const betChip = (): { text: string; mark?: "✓" | "✕" } | null => {
    const v = view();
    if (!v) return null;
    const active = myBet(v);
    if (active) return { text: `Bahsin: ${genitive(nameOf(active.holder))} eli` };
    const r = myResult(v);
    if (r) return r.correct ? { text: "Bahsin tuttu! +1", mark: "✓" } : { text: "Bahsin yandı", mark: "✕" };
    if (betShown()) return { text: `Bahsin: ${genitive(nameOf(v.pub.holder))} eli` };
    return null;
  };
  const placeBet = (): void => {
    const v = view();
    if (!v || !mayBet() || betShown()) return;
    unlockAudio();
    betClick();
    hapticPress();
    const turn = v.pub.passes;
    setBetShown(true, () => sendActionAck({ kind: "bet", turn }));
  };
  const betPress = pressable(placeBet);

  // BM-U5: kendi sonucun kendi koltuğunun üstünde (bildirim üst koltuğa binmez).
  const [note, setNote] = createSignal<Note | null>(null);
  let noteN = 0;
  let seenResult: number | null | undefined;
  createEffect(
    on(
      () => {
        const v = view();
        const r = v ? myResult(v) : null;
        return r ? `${r.turn}:${r.correct}` : null;
      },
      (key) => {
        const v = untrack(view);
        const r = v ? myResult(v) : null;
        if (seenResult === undefined) {
          seenResult = key === null ? null : 1;
          return;
        }
        // Pasla yanan bahis sessizce çipe döner (BM-U4); yalnız tutan bahis koltuğun üstünde duyurulur.
        if (!r || key === null || !r.correct) return;
        const id = ++noteN;
        setNote({ id, text: r.correct ? "Bildin! +1" : "Bahsin yandı", good: r.correct });
        if (r.correct) bell();
        later(() => setNote((x) => (x?.id === id ? null : x)), 2_400);
      },
    ),
  );

  const [blast, setBlast] = createSignal(false);
  const [lit, setLit] = createSignal<string | null>(null);
  const [edge, setEdge] = createSignal(false);
  const [backFlash, setBackFlash] = createSignal(false);
  let sparkEl: HTMLDivElement | undefined;
  let lastSeq: number | null = null;
  let localPass = false;

  // BM-U13: taşıyıcının sabit fitil cızırtısı (zamana bağlı değil).
  const hiss = createFuseHiss();
  createEffect(() => {
    if (iAmHolder()) hiss.start();
    else hiss.stop();
  });
  onCleanup(() => hiss.stop());

  // BM-M1: kilit bitince bant parlar, kısa "çıt".
  createEffect(
    on(locked, (now, prev) => {
      if (prev === true && !now && iAmHolder()) unlockClick();
    }),
  );

  const caught = (): void => {
    catchSound();
    hapticCatch();
    if (!canVibrate()) {
      setEdge(true);
      later(() => setEdge(false), 600);
    }
  };

  // Yeni pas: ışık kablodan yeni taşıyıcıya akar; eklenen süre yalnız bakan oyuncuda kıvılcım olur.
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      const pass = v.pub.lastPass;
      if (lastSeq === null) {
        lastSeq = pass?.seq ?? 0;
        return;
      }
      if (!pass || pass.seq <= lastSeq) return;
      lastSeq = pass.seq;
      const from = seatOf(pass.from);
      const to = seatOf(pass.to);
      // Kendi pasımın sesi dokunuşta zaten çalındı.
      if (pass.from === props.selfId && localPass) localPass = false;
      else if (pass.to === props.selfId && !props.spectator) caught();
      else {
        tak();
        hapticTap();
      }
      setLit(pass.to);
      later(() => setLit(null), 620);
      if (from && to && sparkEl && !reducedMotion()) {
        const at = (p: { x: number; y: number }, opacity: number) => ({
          left: `${p.x}%`,
          top: `${p.y}%`,
          opacity,
        });
        sparkEl.animate([at(from, 0), at(from, 1), at({ x: 50, y: 50 }, 1), at(to, 1), at(to, 0)], {
          duration: 460,
          easing: "cubic-bezier(.4,.1,.3,1)",
        });
      }
      // BM-M2 / BM-U1: 0 eklenince kıvılcım yok; bakmıyorsa sonraki bakışta 1 sn gösterilir. Sessiz.
      if (v.priv.role === "watcher" && v.priv.lastBonusMs !== null && v.priv.lastBonusMs > 0) {
        const text = formatBonus(v.priv.lastBonusMs);
        if (peekHeld()) later(() => showBonus(text), 200);
        else pendingBonus = text;
      }
    });
  });

  // Patlama. Ekran patlamış açılırsa yalnız son hâl gösterilir.
  let firstBlast = true;
  createEffect(
    on(exploded, (now) => {
      const initial = firstBlast;
      firstBlast = false;
      if (!now) {
        setBlast(false);
        return;
      }
      setBlast(true);
      setPeekHeld(false);
      if (initial) return;
      boom();
      // BM-U14: taşıyıcıya uzun alarm, diğerlerine tek kısa.
      if (untrack(() => view()?.pub.holder) === props.selfId && !props.spectator) hapticAlarm();
      else hapticSingle();
    }),
  );
  const blastedId = () => view()?.pub.holder ?? "";
  const mineBlast = () => blast() && blastedId() === props.selfId && !props.spectator;
  const blastSpot = () => bombSpot(seatOf(blastedId()), count());
  const winners = () => view()?.pub.correctPredictors ?? [];
  const bildi = () => bildiFor(winners(), playerOf, props.selfId);
  const tripOpen = () => {
    const at = view()?.pub.explodedAt;
    return at !== null && at !== undefined && props.now() >= at + TRIP_DELAY_MS && view()?.pub.journey;
  };

  // BM-U10: izleyicinin yerel "Kimde patlar?" seçimi (sunucuya gitmez).
  const [pick, setPick] = createSignal<string | null>(null);
  const pickLine = () => {
    const p = pick();
    if (!blast() || p === null) return null;
    return p === blastedId() ? "Tahminin tuttu!" : "Bu sefer olmadı";
  };

  // BM-U12: kopan taşıyıcı ve geri dönen taşıyıcı.
  const holderOffline = () => {
    const id = holderId();
    return !exploded() && id !== "" && playerOf(id)?.connected === false;
  };
  const showBack = (): void => {
    if (!iAmHolder()) return;
    setBackFlash(true);
    hapticAlarm();
    later(() => setBackFlash(false), 1_000);
  };
  onMount(() => {
    // Oyunun ortasında ekrana dönen taşıyıcı (yeniden yükleme): eli çoktan almışsa uyarı.
    if (iAmHolder() && props.now() - (view()?.pub.lockedUntil ?? props.now()) > 1_500) showBack();
  });
  createEffect(
    on(
      () => state.conn,
      (conn, prev) => {
        if (conn !== "open" || prev === undefined || prev === "open") return;
        showBack();
      },
      { defer: true },
    ),
  );

  /** Koltuğa bağlı etiket: yatayda sahneden taşmaz; üstteki koltukta altına iner. */
  const tagStyle = (id: string): Record<string, string> => {
    const seat = seatOf(id);
    return {
      left: `clamp(150px, ${seat?.x ?? 50}%, calc(100% - 150px))`,
      top: `${seat?.y ?? 50}%`,
    };
  };

  const pass = (id: string): void => {
    if (!iAmHolder() || id === props.selfId) return;
    if (tapOf(id) !== "ok") {
      hapticError();
      return;
    }
    unlockAudio();
    whoosh();
    hapticPress();
    localPass = true;
    setHolder(id, () => sendActionAck({ kind: "pass", to: id }));
    setLit(id);
    later(() => setLit(null), 620);
  };

  const pointerProps = {
    onPointerDown: startPeek,
    onPointerUp: endPeek,
    onPointerCancel: endPeek,
    onLostPointerCapture: endPeek,
    onContextMenu: (e: Event) => e.preventDefault(),
  };

  return (
    <div
      class="kbo"
      data-role={view()?.priv.role ?? "spectator"}
      data-blast={blast() ? "1" : undefined}
      data-level={level() ?? undefined}
      data-n={count() >= 7 ? "8" : undefined}
      data-edge={edge() ? "1" : undefined}
    >
      <div
        class="kbo__world"
        data-zoom={blast() && !mineBlast() ? "1" : undefined}
        style={{ "transform-origin": `${blastSpot().x}% ${blastSpot().y}%` }}
      >
        <div class="kbo__felt" aria-hidden="true" />
        <svg class="kbo__cables" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <title>Kablolar</title>
          <defs>
            <marker
              id="kbo-arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10z" fill="#ffc23b" />
            </marker>
          </defs>
          <For each={seats()}>
            {(s) => (
              <line
                class="kbo__cable"
                classList={{ "kbo__cable--on": lit() === s.id, "kbo__cable--holder": holderId() === s.id }}
                x1="50"
                y1="50"
                x2={50 + (s.x - 50) * 0.8}
                y2={50 + (s.y - 50) * 0.8}
                marker-end={lit() === s.id ? "url(#kbo-arrow)" : undefined}
                vector-effect="non-scaling-stroke"
              />
            )}
          </For>
        </svg>
        <div class="kbo__hub" aria-hidden="true" />

        <For each={seats()}>
          {(s) => {
            const player = () => playerOf(s.id);
            const isHolder = () => holderId() === s.id && !blast();
            const isSelf = () => s.id === props.selfId && !props.spectator;
            const press = pressable(() => (props.spectator ? setPick(s.id) : pass(s.id)));
            const asButton = () => (iAmHolder() && !isSelf()) || (props.spectator === true && !blast());
            const tap = () => (iAmHolder() && !isSelf() ? tapOf(s.id) : null);
            const offline = () => player()?.connected === false;
            const won = () => blast() && winners().includes(s.id);
            const label = () => {
              if (props.spectator) return `${player()?.nickname ?? ""}: bomba bunda patlar`;
              const t = tap();
              if (t === "offline") return `${player()?.nickname ?? ""}: bağlantısı yok`;
              if (t === "return") return `${player()?.nickname ?? ""}: sana az önce attı, geri verilemez`;
              return `${player()?.nickname ?? ""} kişisine pas ver`;
            };
            return (
              <Dynamic
                component={asButton() ? "button" : "div"}
                class="kbo__seat"
                type={asButton() ? "button" : undefined}
                aria-label={asButton() ? label() : undefined}
                aria-disabled={tap() !== null && tap() !== "ok" ? "true" : undefined}
                data-holder={isHolder() ? "1" : undefined}
                data-tap={tap() ?? undefined}
                data-off={offline() ? "1" : undefined}
                data-white={blast() && blastedId() === s.id ? "1" : undefined}
                data-pick={props.spectator && pick() === s.id ? "1" : undefined}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                onPointerDown={press.onPointerDown}
                onClick={press.onClick}
              >
                <span class="kbo__av">
                  <Avatar
                    index={player()?.avatar ?? 0}
                    size="var(--seat)"
                    connected={player()?.connected ?? true}
                    self={isSelf()}
                    ring={isHolder() ? "#FF3B5C" : undefined}
                  />
                  <Show when={isHolder()}>
                    <span class="kbo__badge kbo__badge--bomb">
                      <BombBadge />
                    </span>
                  </Show>
                  <Show when={tap() === "ok" && !locked()}>
                    <span class="kbo__badge kbo__badge--tap">
                      <TapIcon />
                    </span>
                  </Show>
                  <Show when={tap() === "return"}>
                    <span class="kbo__badge kbo__badge--no">
                      <NoReturnIcon />
                    </span>
                  </Show>
                  <Show when={offline()}>
                    <span class="kbo__badge kbo__badge--off">
                      <PlugIcon />
                    </span>
                  </Show>
                  <Show when={won()}>
                    <span class="kbo__badge kbo__badge--win" role="img" aria-label="bildi">
                      ✓ +1
                    </span>
                  </Show>
                </span>
                <span class="kbo__name">{shortName(player()?.nickname ?? "")}</span>
              </Dynamic>
            );
          }}
        </For>

        <Show when={!blast()}>
          <Dynamic
            component={left() !== null ? "button" : "div"}
            type={left() !== null ? "button" : undefined}
            class="kbo__bomb"
            data-skin={peekOn() ? "glow" : "core"}
            aria-label={left() !== null ? "Süreye bakmak için basılı tut" : undefined}
            style={{ left: `${bomb().x}%`, top: `${bomb().y}%` }}
            {...(left() !== null ? pointerProps : {})}
          >
            <BombArt>
              <Show when={peekOn()}>
                <span class="kbo__time">
                  {formatPeek(left() ?? 0)}
                  <Show when={level() !== "calm"}>
                    <span class="kbo__bang">!</span>
                  </Show>
                </span>
              </Show>
            </BombArt>
          </Dynamic>
        </Show>
        <Show when={blast()}>
          <div
            class="kbo__blast"
            style={{ left: `${blastSpot().x}%`, top: `${blastSpot().y}%` }}
            aria-hidden="true"
          >
            <span class="kbo__wave" />
            <BlastArt />
          </div>
          <Show when={!mineBlast() && !tripOpen()}>
            <p
              class="kbo__boomtag"
              data-below={(seatOf(blastedId())?.y ?? 50) < 40 ? "1" : undefined}
              style={tagStyle(blastedId())}
              role="status"
            >
              {blastText(nameOf(blastedId()), false)}
            </p>
          </Show>
        </Show>

        <div class="kbo__spark" ref={sparkEl} aria-hidden="true" />
        <Show when={peekOn()}>
          <div class="kbo__bonuses" style={{ left: `${bomb().x}%`, top: `${bomb().y}%` }} aria-hidden="true">
            <For each={bonuses()}>{(b) => <span class="kbo__bonus">{b.text}</span>}</For>
          </div>
        </Show>
        <Show when={note()}>
          {(n) => (
            <p
              class="kbo__note"
              data-good={n().good ? "1" : undefined}
              style={{ left: `${seatOf(props.selfId)?.x ?? 50}%`, top: `${seatOf(props.selfId)?.y ?? 84}%` }}
              role="status"
            >
              <span aria-hidden="true">{n().good ? "✓ " : "✕ "}</span>
              {n().text}
            </p>
          )}
        </Show>
      </div>

      <Show when={view()}>
        {(v) => (
          <HandChain
            class="kbo__chain"
            chip={handChip(
              v().pub.passes,
              nameOf(holderId()),
              holderId() === props.selfId && !props.spectator,
            )}
            trail={v().pub.trail}
            playerOf={playerOf}
            size="var(--link)"
          />
        )}
      </Show>

      <Show when={holderOffline()}>
        <p
          class="kbo__band"
          data-below={(seatOf(holderId())?.y ?? 50) < 40 ? "1" : undefined}
          style={tagStyle(holderId())}
          role="status"
        >
          {nameOf(holderId())} koptu — bomba onda!
        </p>
      </Show>

      <Show when={iAmHolder()}>
        <div class="kbo__cta" data-lock={locked() ? "1" : undefined} role="status">
          <span class="kbo__cta-text">{locked() ? "Fitil tutuşuyor…" : "BOMBA SENDE — birine dokun"}</span>
          <span class="kbo__cta-bar" aria-hidden="true">
            <span
              class="kbo__cta-fill"
              style={{ transform: `scaleX(${locked() ? 1 - lockLeft() / 1_500 : 1})` }}
            />
          </span>
        </div>
      </Show>

      <Show when={showBetPanel()}>
        <div class="kbo__bet" data-late={tooLate() ? "1" : undefined}>
          <Show
            when={!betShown() && mayBet()}
            fallback={
              <Show when={betChip()}>
                {(c) => (
                  <p class="kbo__betchip" data-mark={c().mark ?? undefined}>
                    <Show when={c().mark}>
                      <span aria-hidden="true">{c().mark} </span>
                    </Show>
                    {c().text}
                  </p>
                )}
              </Show>
            }
          >
            <p class="kbo__betq">{genitive(nameOf(holderId()))} elinde patlar mı?</p>
            <div class="kbo__betrow">
              <button
                type="button"
                class="kbo__betbtn"
                onPointerDown={betPress.onPointerDown}
                onClick={betPress.onClick}
              >
                PATLAR!
              </button>
              <p class="kbo__betsub">{tooLate() ? "Çok geç — son 3 sn'de bahis yok" : "Tek hakkın"}</p>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={left() !== null && !blast()}>
        <button type="button" class="kbo__peek" data-on={peekOn() ? "1" : undefined} {...pointerProps}>
          SÜREYE BAK
        </button>
      </Show>

      <Show when={props.spectator && !blast()}>
        <p class="kbo__pickhint">
          {pick() === null ? "Kimde patlar? Bir koltuğa dokun" : `Tahminin: ${nameOf(pick() ?? "")}`}
        </p>
      </Show>
      <Show when={pickLine()}>
        {(t) => (
          <p class="kbo__pickhint kbo__pickhint--done" role="status">
            {t()}
          </p>
        )}
      </Show>

      <Show when={bildi() && !tripOpen()}>
        <p class="kbo__bildi" role="status">
          {bildi()}
        </p>
      </Show>

      <Show when={mineBlast() && !tripOpen()}>
        <div class="kbo__stamp" role="status">
          <span>{blastText(nameOf(props.selfId), true)}</span>
        </div>
      </Show>

      <Show when={tripOpen()}>
        {(j) => (
          <div class="kbo__trip">
            <JourneyPanel
              journey={j()}
              winners={winners()}
              playerOf={playerOf}
              selfId={props.selfId}
              avatar="var(--trip)"
            />
          </div>
        )}
      </Show>

      <Show when={backFlash()}>
        <div class="kbo__back" role="alert">
          BOMBA HÂLÂ SENDE!
        </div>
      </Show>

      <div class="kbo__devam">
        <RevealContinue
          match={props.match}
          selfId={props.selfId}
          now={props.now}
          spectator={props.spectator}
        />
      </div>
    </div>
  );
}
