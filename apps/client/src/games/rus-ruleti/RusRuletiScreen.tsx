import { RUS_RULETI_SPIN_MS } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticHold, hapticPress, hapticShot, hapticTap, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { state } from "../../net/store.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { createPredictionToast, PredictRow } from "../../ui/PredictRow.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { cockCue, holdBandOn } from "./cues.js";
import { Outro, OutsMeter, ShotStrip } from "./parts.js";
import { bang, click, cock, finale, heart, lastWordNote, lock, spin, swap } from "./sounds.js";
import { type SeatMode, Table } from "./Table.js";
import "./rus-ruleti.css";
import {
  bamLine,
  dative,
  displayPub,
  genitive,
  locative,
  parseRusRuletiView,
  riskLine,
  seatPositions,
  shownRisk,
  stageOf,
  tallyLine,
} from "./view.js";

/** Gönderilen atış sunucudan onay görmezse yerel "gönderildi" durumu bu kadar sonra düşer. */
const PENDING_MS = 1800;
/** RR-U15: dönen oyuncuya bant süresi. */
const BACK_MS = 1_500;

type Tone = "boom" | "safe" | "hold" | "dim";

export default function RusRuletiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseRusRuletiView(props.match.publicView, props.match.view));
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
  onCleanup(() => {
    clearInterval(timer);
    for (const t of timers) clearTimeout(t);
  });

  const stage = createMemo(() => {
    const v = view();
    return v ? stageOf(v.pub, clock()) : "deciding";
  });
  const seats = createMemo(() => seatPositions(view()?.pub.players ?? [], props.selfId));
  const playerOf = (id: string) => props.players.find((q) => q.id === id);
  const nick = (id: string): string => playerOf(id)?.nickname ?? "Oyuncu";
  const label = (id: string): string => (id === props.selfId && !props.spectator ? "Sen" : nick(id));
  /** RR-U5: dönüş sırasında atıştan önceki hâl (sonuç ele verilmez). */
  const pub = createMemo(() => {
    const v = view();
    return v ? displayPub(v.pub, clock()) : undefined;
  });

  /** Elenen izleyici: her atıştan önce "patlar mı?" tahmini verebilir (puan yok, yalnız Kâhin rozeti). */
  const outView = () => {
    const v = view();
    if (!v || props.spectator || v.pub.over || v.priv.role !== "out") return null;
    if (v.pub.lastWord?.from === props.selfId) return null;
    return v.priv;
  };
  createPredictionToast(() => {
    const v = view();
    return v && v.priv.role === "out" ? v.priv.lastResult : null;
  });
  const imAlive = () => !props.spectator && view()?.priv.role === "alive";
  const iHold = () => imAlive() && pub()?.holder === props.selfId && !pub()?.lastWord && !pub()?.over;
  const canAim = () => iHold() && stage() === "deciding" && !pending();
  const myLastWord = () =>
    !props.spectator && stage() === "lastWord" && pub()?.lastWord?.from === props.selfId;

  // Seçilen hedef ve gönderim durumu: yeni atış gelince sıfırlanır.
  const [sel, setSel] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(pendingTimer));

  const mode = (id: string): SeatMode => {
    const p = pub();
    if (!p?.alive.includes(id)) return "off";
    if (myLastWord()) return passing() ? "off" : "on";
    if (!canAim()) return "off";
    return p.noReturn === id ? "lock" : "on";
  };
  const [passing, setPassing] = createSignal(false);
  const tap = (id: string): void => {
    if (myLastWord()) {
      if (passing()) return;
      unlockAudio();
      hapticPress();
      setPassing(true);
      void sendActionAck({ kind: "pass", to: id }).then((ack) => {
        if (!ack.ok) {
          setPassing(false);
          hapticError();
        }
      });
      return;
    }
    if (!canAim() || mode(id) !== "on") return;
    unlockAudio();
    lock();
    hapticPress();
    setSel(id);
  };
  const fire = (): void => {
    const target = sel();
    if (!canAim() || target === null) return;
    setPending(true);
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => setPending(false), PENDING_MS);
    sendAction({ kind: "shoot", target });
  };
  createEffect(
    on(
      () => pub()?.lastWord?.from ?? null,
      () => setPassing(false),
    ),
  );

  // RR-U5 / RR-U6 / RR-U7: atış: tambur dönüşü ve kalp atışı, 1,2 sn sonra klik ya da BAM; ilk açılışta çalmaz.
  let seenSeq: number | null = null;
  createEffect(
    on(
      () => pub()?.last?.seq ?? 0,
      (seq) => {
        const prev = seenSeq;
        seenSeq = seq;
        setSel(null);
        setPending(false);
        const last = untrack(pub)?.last;
        if (prev === null || !last || seq <= prev) return;
        const wait = Math.max(0, last.at + RUS_RULETI_SPIN_MS - props.now());
        if (wait > 200) {
          spin();
          heart(last.risk >= 56);
          later(() => heart(last.risk >= 56), Math.min(600, wait - 100));
        }
        later(() => {
          if (last.exploded) {
            bang();
            // Seni vurdularsa uzun titreşim; kendi BAM'inden sonra telefon susar.
            if (last.target === props.selfId && last.shooter !== props.selfId) hapticShot();
          } else {
            click();
            if (last.target === props.selfId || last.shooter === props.selfId) hapticTap();
            if (last.target !== last.shooter) later(swap, 400);
          }
        }, wait);
      },
    ),
  );

  // RR-U9: silah sana geçince bant, kenar ışığı, horoz sesi ve güçlü titreşim.
  const band = () => {
    const p = pub();
    if (!p || !iHold()) return false;
    return holdBandOn(p, clock());
  };
  cockCue(band, () => {
    cock();
    hapticHold();
  });
  // Son 5 sn: sahibin telefonu her saniye kısa titrer (tik sesi kabuk saatinden gelir).
  const secsLeft = () => {
    const p = pub();
    if (!p || p.deadline === null || stage() !== "deciding") return null;
    return Math.max(0, Math.ceil((p.deadline - clock()) / 1000));
  };
  const urgent = () => {
    const s = secsLeft();
    return s !== null && s <= 5;
  };
  createEffect(
    on(secsLeft, (s, prev) => {
      if (s === null || prev === undefined || prev === null || s === prev || s > 5 || s === 0) return;
      if (iHold()) hapticTick();
    }),
  );
  // RR-M3: son söz başlayınca alçak nota.
  createEffect(
    on(
      () => stage() === "lastWord",
      (on, was) => {
        if (on && was === false) {
          lastWordNote();
          if (myLastWord()) hapticTap();
        }
      },
    ),
  );
  // RR-U8: oyun içi açılış başlarken tok vuruş.
  createEffect(
    on(
      () => stage() === "over",
      (on, was) => {
        if (on && was === false) finale();
      },
    ),
  );
  // RR-U15: bağlantı dönünce kısa bant.
  const [back, setBack] = createSignal(false);
  createEffect(
    on(
      () => state.conn,
      (conn, prev) => {
        if (conn !== "open" || prev === undefined || prev === "open" || pub()?.over) return;
        setBack(true);
        later(() => setBack(false), BACK_MS);
      },
      { defer: true },
    ),
  );

  // RR-U5: halka dönüşte atışın riskini, sonra yeni riski sayarak gösterir.
  const target = () => {
    const p = pub();
    return p ? shownRisk(p, clock()) : 0;
  };
  const [shown, setShown] = createSignal(target());
  let counter: ReturnType<typeof setInterval> | undefined;
  createEffect(
    on(target, (to) => {
      clearInterval(counter);
      if (reducedMotion()) {
        setShown(to);
        return;
      }
      counter = setInterval(() => {
        const cur = untrack(shown);
        if (cur === to) {
          clearInterval(counter);
          return;
        }
        setShown(cur + Math.sign(to - cur) * Math.min(2, Math.abs(to - cur)));
      }, 28);
    }),
  );
  onCleanup(() => clearInterval(counter));

  const holderOff = () => playerOf(pub()?.holder ?? "")?.connected === false;

  const head = (): { text: string; tone: Tone; sub: string } => {
    const v = view();
    if (!v) return { text: "Hazırlanıyor", tone: "dim", sub: "" };
    const p = v.pub;
    const l = p.last;
    const st = stage();
    if (st === "over") {
      if (imAlive()) return { text: "Hayattasın!", tone: "safe", sub: "Hayatta kalanlar +1 alır" };
      if (props.spectator) return { text: "Oyun bitti", tone: "dim", sub: "Hayatta kalanlar +1 alır" };
      return { text: "Bu sefer olmadı", tone: "dim", sub: "Hayatta kalanlar +1 alır" };
    }
    if (st === "spin" && l) {
      const sub =
        l.shooter === l.target
          ? `${label(l.shooter)} kendine sıkıyor · %${l.risk}`
          : `${label(l.shooter)} → ${label(l.target)} · %${l.risk}`;
      return { text: "Tambur dönüyor…", tone: "dim", sub };
    }
    if (st === "result" && l) {
      if (l.exploded) return { text: "BAM!", tone: "boom", sub: bamLine(l, label, props.selfId) };
      let sub = `Boş! Silah ${dative(nick(l.target))} geçti`;
      if (l.shooter === l.target) sub = `${label(l.shooter)} kendine sıktı, boş`;
      else if (l.target === props.selfId && !props.spectator) sub = "Boş! Silah sana geçti";
      return { text: "Klik!", tone: "safe", sub };
    }
    if (st === "lastWord" && p.lastWord) {
      if (myLastWord()) return { text: "Son sözün", tone: "hold", sub: "Silahı kime veriyorsun?" };
      return {
        text: `${nick(p.lastWord.from)} son sözünü söylüyor…`,
        tone: "dim",
        sub: "Silahı kime verecek?",
      };
    }
    if (st === "handoff" && p.handoff) {
      const to = p.handoff.to === props.selfId && !props.spectator ? "sana" : dative(nick(p.handoff.to));
      return p.handoff.chosen
        ? { text: `${label(p.handoff.from)} silahı ${to} verdi`, tone: "hold", sub: "" }
        : { text: `Silah ${to} geçti`, tone: "dim", sub: "Kura çekildi" };
    }
    if (iHold()) return { text: "Silah sende!", tone: "hold", sub: "Birini ya da kendini seç" };
    const who = nick(p.holder);
    const title = `${genitive(who)} elinde · %${p.risk}`;
    if (holderOff()) return { text: title, tone: "dim", sub: `${who} bağlı değil · ${secsLeft() ?? 0} sn` };
    if (imAlive()) return { text: title, tone: "dim", sub: "Seni de seçebilir" };
    return { text: title, tone: "dim", sub: `${who} karar veriyor` };
  };

  const bar = () => {
    const p = pub();
    if (!p || p.deadline === null || stage() !== "deciding") return { from: 0, to: 0 };
    return { from: p.openAt, to: p.deadline };
  };
  const meDown = () => {
    const l = pub()?.last;
    return !props.spectator && stage() === "result" && l?.exploded === true && l.target === props.selfId;
  };
  const lastWordLeft = () => {
    const lw = pub()?.lastWord;
    return lw ? Math.max(0, Math.ceil((lw.endsAt - clock()) / 1000)) : 0;
  };
  const predictQuestion = () => {
    const p = pub();
    if (!p) return "Patlar mı?";
    if (p.lastWord) return `Sıradaki atış · %${p.risk} · Patlar mı?`;
    return `${genitive(nick(p.holder))} atışı · %${p.risk} · Patlar mı?`;
  };
  const footerNote = () => {
    if (props.spectator) return "Elenenler izleyici olur";
    const st = stage();
    if (st === "spin") return "Tambur dönüyor…";
    if (st === "result" || st === "handoff") return "Silah el değiştiriyor…";
    if (st === "lastWord") return "Son söz bekleniyor…";
    return "Silah sahibini bekle";
  };

  return (
    <Screen class="game rr">
      <div
        class="rr__root"
        data-stage={stage()}
        data-boom={stage() === "result" && pub()?.last?.exploded ? String(pub()?.last?.seq) : undefined}
        data-edge={band() ? "1" : undefined}
      >
        <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={stage() === "deciding"} />

        <div class="rr__top">
          <Status
            class="rr__text"
            titleClass="rr__head"
            subClass="rr__sub"
            tone={head().tone}
            sub={head().sub}
          >
            {head().text}
          </Status>
          <Show when={stage() !== "over" ? pub() : undefined}>{(p) => <OutsMeter pub={p()} />}</Show>
        </div>

        <div class="rr__tablebox">
          <Show when={pub()}>
            {(p) => (
              <Table
                pub={p()}
                stage={stage()}
                seats={seats()}
                playerOf={playerOf}
                label={label}
                risk={shown()}
                aim={sel()}
                size="var(--rr-av)"
                mode={mode}
                onTap={tap}
                urgent={urgent()}
              />
            )}
          </Show>
          <Show when={stage() === "over" && pub()}>
            {(p) => (
              <Outro
                pub={p()}
                playerOf={playerOf}
                nameOf={label}
                selfId={props.spectator ? "" : props.selfId}
                avatar="var(--rr-out-av)"
                class="rr__outro"
              />
            )}
          </Show>
        </div>

        <div class="rr__side">
          <Show when={stage() === "deciding" && pub()}>
            {(p) => (
              <p class="rr__next">
                {riskLine(p().risk)}
                <Show when={iHold()}>
                  <span class="rr__self">Kendine sıkarsan sıradaki atış senin elinde</span>
                </Show>
              </p>
            )}
          </Show>
          <Show when={stage() !== "over"}>
            <ShotStrip history={pub()?.history ?? []} nameOf={label} class="rr__shots" />
          </Show>

          <footer class="rr__foot">
            <Show when={myLastWord()}>
              <p class="rr__lastword" role="status">
                {passing() ? "Silah veriliyor…" : `Bir oyuncuya dokun · ${lastWordLeft()} sn`}
              </p>
            </Show>
            <Show when={outView()}>
              {(out) => (
                <div class="rr__predictbox">
                  <For each={[out().turn]}>
                    {(turn) => (
                      <PredictRow
                        class="rr__predict"
                        stacked
                        question={predictQuestion()}
                        yesLabel="Evet"
                        noLabel="Hayır"
                        turn={turn}
                        chosen={outView()?.prediction ?? null}
                      />
                    )}
                  </For>
                  <p class="rr__tally">{tallyLine(out().tally)}</p>
                </div>
              )}
            </Show>
            <Show
              when={iHold() && stage() === "deciding"}
              fallback={
                <Show when={!outView() && !myLastWord() && stage() !== "over"}>
                  <p class="rr__note" role="status">
                    {footerNote()}
                  </p>
                </Show>
              }
            >
              <PrimaryButton
                instant
                variant="danger"
                disabled={sel() === null || pending()}
                busy={pending()}
                reason={
                  sel() === null
                    ? "Bir hedefe dokun"
                    : sel() === props.selfId
                      ? "Hedef: kendin"
                      : `Hedef: ${nick(sel() as string)}`
                }
                onClick={fire}
              >
                {sel() === props.selfId ? "KENDİNE ATEŞ ET" : "ATEŞ ET"}
              </PrimaryButton>
            </Show>
          </footer>
        </div>

        <Show when={band()}>
          <p class="rr__band" aria-hidden="true">
            SİLAH SENDE!
          </p>
        </Show>
        <Show when={back() && pub()}>
          {(p) => (
            <p class="rr__band rr__band--back" role="status">
              Döndün! Silah {p().holder === props.selfId ? "sende" : locative(nick(p().holder))} · %{p().risk}
            </p>
          )}
        </Show>
        <Show when={meDown() ? pub()?.last : null}>
          {(l) => (
            <div class="rr__down" role="status">
              <strong>{bamLine(l(), label, props.selfId)}</strong>
              <span>%{l().risk}</span>
            </div>
          )}
        </Show>
      </div>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
