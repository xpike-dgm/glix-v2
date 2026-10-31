import { CAPRAZ_ATES_INTERVAL_MS, type CaprazAtesRoundReveal } from "@glix/engine";
import { createEffect, createMemo, createSignal, type JSX, on, onCleanup, Show, untrack } from "solid-js";
import { createOpening } from "../../fx/opening.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { type AckLike, createOptimistic, toAck } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import "./capraz-ates.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Arena } from "./Arena.js";
import { FireFlash, Glass } from "./Fx.js";
import { Opening } from "./Opening.js";
import { Pick } from "./Pick.js";
import * as sfx from "./sounds.js";
import { duelLabel, FINAL_TIMELINE, INTERVAL_TIMELINE, type RevealTimeline } from "./timeline.js";
import {
  eachCount,
  mostTargeted,
  nameList,
  type Outcome,
  outcomeOf,
  parseCaprazAtesView,
  scoreText,
  shootersOf,
  stageOf,
} from "./view.js";

/** Siper seçimi iyimser değerde bu işaretle tutulur (oyuncu kimliği olamaz). */
const COVER = "\u0000siper";

const VERDICT: Record<Outcome, string> = {
  hit: "VURULDUN",
  free: "SAĞ KALDI",
  clash: "ÇARPIŞTI",
  cover: "Siperde",
  idle: "Ateş etmedin",
};

export default function CaprazAtesScreen(props: GameScreenProps) {
  const view = createMemo(() => parseCaprazAtesView(props.match.publicView, props.match.view));
  const stage = () => {
    const v = view();
    return v ? stageOf(v, props.now()) : "closed";
  };
  const revealKind = (): "interval" | "final" | null => {
    const s = stage();
    return s === "interval" || s === "final" ? s : null;
  };

  // Oyun başlarken bir kez, dokunulmaz süs sahnesi; girişi beklemez.
  const opening = createOpening("capraz-ates", () => view()?.startedAt);
  const crew = createMemo(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [p] : [];
    }),
  );
  const ids = () => crew().map((p) => p.id);
  const spectator = () => props.spectator === true;
  const locked = () => view()?.locked ?? false;
  const closed = () => stage() !== "pick";
  const round = () => view()?.round ?? 1;
  const first = (): CaprazAtesRoundReveal | undefined => view()?.rounds[0];

  // Seçim (hedef ya da siper): sunucu onaylayana kadar yerel gösterilir; reddedilirse eski haline döner.
  const [choice, setChoice] = createOptimistic<string | null>(() => {
    const v = view();
    if (!v) return null;
    return v.cover ? COVER : v.myTarget;
  });
  const blocked = () => spectator() || closed() || locked();
  const choose = (value: string): void => {
    if (blocked()) return;
    unlockAudio();
    if (value === COVER) sfx.shieldUp();
    else sfx.sightClick();
    if (choice() === value) return;
    setChoice(value, () =>
      toAck(
        value === COVER ? sendActionAck({ kind: "cover" }) : sendActionAck({ kind: "target", target: value }),
      ),
    );
  };
  const mine = () => {
    const c = choice();
    return c === COVER ? null : c;
  };
  const inCover = () => choice() === COVER;
  const lock = (): AckLike => {
    if (blocked() || choice() === null) return false;
    sfx.cock();
    return sendActionAck({ kind: "lock" });
  };

  // ---- Düello anı (her turun son 5 sn'si) ----
  const duel = () => {
    const v = view();
    if (!v || stage() !== "pick") return null;
    return duelLabel(v.endsAt - props.now());
  };
  let whistled = 0;
  createEffect(() => {
    const label = duel();
    const r = round();
    if (label === null || whistled >= r) return;
    whistled = r;
    untrack(() => {
      if (view() && (view()?.endsAt ?? 0) - props.now() > 2_000) sfx.whistle();
    });
  });

  // ---- Açılışlar: tur 1 (kısa) ve final ----
  const revealStart = (): number => {
    const v = view();
    if (!v) return 0;
    return stage() === "final" ? v.endsAt : v.roundStartedAt - CAPRAZ_ATES_INTERVAL_MS;
  };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void): void => {
    if (ms < -150) return;
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
  });
  createEffect(
    on(
      () => revealKind(),
      (s) => {
        if (s === null) return;
        const v = untrack(view);
        const reveal = v?.rounds[s === "final" ? 1 : 0];
        if (!v || !reveal) return;
        const el = untrack(props.now) - untrack(revealStart);
        const t: RevealTimeline = s === "final" ? FINAL_TIMELINE : INTERVAL_TIMELINE;
        const order = untrack(ids);
        const shots = order.filter((id) => reveal.targets[id] !== null && reveal.targets[id] !== undefined);
        if (shots.length === 0) return;
        later(t.muzzleAt - el, sfx.volley);
        if (s === "final") later(t.muzzleAt + 60 - el, () => sfx.whiz(t.flightMs / 1000));
        const anyHit = order.some((id) => outcomeOf(reveal, id) === "hit");
        const anyCover = shots.some((id) => {
          const to = reveal.targets[id];
          return to !== null && to !== undefined && reveal.cover.includes(to);
        });
        later(t.impactAt - el, () => {
          if (reveal.mutual.length > 0) sfx.spark();
          if (anyHit) sfx.hit();
        });
        if (anyCover) later(t.impactAt + 80 - el, sfx.ricochet);
        if (spectator()) return;
        const mineOut = outcomeOf(reveal, props.selfId);
        if (mineOut === "hit" && s === "final") later(t.impactAt + 140 - el, sfx.glass);
        if (mineOut === "free") later(t.verdictAt - el, sfx.survive);
      },
    ),
  );
  // Seçim kapanınca açık kalan büyük halka kapanır.
  const [ringOpen, setRingOpen] = createSignal(false);
  createEffect(() => {
    if (stage() !== "pick") setRingOpen(false);
  });

  const bar = () => {
    const v = view();
    if (!v) return { from: 0, to: 1, urgent: false };
    const s = stage();
    if (s === "final") return { from: v.endsAt, to: v.finishAt, urgent: false };
    if (s === "interval")
      return { from: v.roundStartedAt - CAPRAZ_ATES_INTERVAL_MS, to: v.roundStartedAt, urgent: false };
    return { from: v.roundStartedAt, to: v.endsAt, urgent: s === "pick" };
  };

  return (
    <Screen class="game cx">
      <Show when={opening() && round() === 1 && stage() === "pick"}>
        <Opening />
      </Show>
      <Show when={view()}>
        <PhaseClock startedAt={bar().from} endsAt={bar().to} urgency={bar().urgent} />
      </Show>

      <Show when={stage() === "pick" || stage() === "closed"}>
        <Pick
          crew={crew()}
          selfId={props.selfId}
          spectator={spectator()}
          round={round()}
          first={first()}
          mine={mine()}
          cover={inCover()}
          locked={locked()}
          closed={closed()}
          lockedIds={view()?.lockedIds ?? []}
          onPick={(id) => choose(id)}
          onCover={() => choose(COVER)}
          onLock={lock}
          onOpenRing={() => setRingOpen(true)}
          duel={duel()}
        />
      </Show>

      <Show when={revealKind()} keyed>
        {(s) => (
          <RevealView
            kind={s}
            view={() => view()}
            crew={crew()}
            selfId={props.selfId}
            spectator={spectator()}
            now={props.now}
            start={revealStart}
            comment={() => props.match.comment ?? null}
          />
        )}
      </Show>

      <Show when={ringOpen() && first()}>
        {(r) => (
          <div
            class="cx-ringview"
            role="dialog"
            aria-label="Tur 1'de kim kimi vurdu"
            onClick={() => setRingOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setRingOpen(false);
            }}
          >
            <div class="cx-ringview__box">
              <span class="overline">Tur 1</span>
              <span class="cx__title">Kim kimi vurdu?</span>
              <div class="cx-ringview__stage">
                <Arena
                  crew={crew()}
                  selfId={spectator() ? null : props.selfId}
                  reveal={r()}
                  timeline={INTERVAL_TIMELINE}
                  elapsed={0}
                  mode="still"
                />
              </div>
              <button type="button" class="cx-ringview__close" onClick={() => setRingOpen(false)}>
                Kapat
              </button>
            </div>
          </div>
        )}
      </Show>
      <div class="cx__devam">
        <RevealContinue
          match={props.match}
          selfId={props.selfId}
          now={props.now}
          spectator={props.spectator}
        />
      </div>
    </Screen>
  );
}

interface RevealProps {
  kind: "interval" | "final";
  view: () => ReturnType<typeof parseCaprazAtesView>;
  crew: GameScreenProps["players"];
  selfId: string;
  spectator: boolean;
  now: () => number;
  start: () => number;
  /** Oyun sonu yorumu (düello spikeri; sunucudan, doğrulanmış). Yoksa null; satır hiç çizilmez. */
  comment: () => string | null;
}

/** Tur 1'in kısa açılışı ya da final açılışı: halka, başlıkta kendi sonucun, altta özet satırları. */
function RevealView(props: RevealProps) {
  const final = props.kind === "final";
  const t = final ? FINAL_TIMELINE : INTERVAL_TIMELINE;
  // Ekran kurulduğu an açılışın neresindeyiz (geç gelen oyuncu sahneyi o andan izler).
  const elapsed = untrack(() => props.now() - props.start());
  const reveal = (): CaprazAtesRoundReveal | undefined => props.view()?.rounds[final ? 1 : 0];
  const ids = () => props.crew.map((p) => p.id);
  const nick = (id: string) => props.crew.find((p) => p.id === id)?.nickname ?? "Biri";
  const outcome = (): Outcome => {
    const r = reveal();
    return r ? outcomeOf(r, props.selfId) : "idle";
  };
  const score = () => reveal()?.scores[props.selfId] ?? 0;
  const vars = (): JSX.CSSProperties => ({
    "--el": `${Math.max(0, elapsed)}ms`,
    "--verdict": `${t.verdictAt}ms`,
    "--shooters": `${final ? FINAL_TIMELINE.shootersAt : t.verdictAt}ms`,
    "--summary": `${final ? FINAL_TIMELINE.summaryAt : t.verdictAt}ms`,
    "--total": `${final ? FINAL_TIMELINE.totalAt : t.verdictAt}ms`,
    "--next": `${INTERVAL_TIMELINE.nextAt}ms`,
  });

  const shootersLine = () => {
    const r = reveal();
    if (!r) return "";
    const by = shootersOf(r, props.selfId, ids()).map(nick);
    if (by.length === 0) return "Kimse sana ateş etmedi";
    const o = outcome();
    if (o === "cover") return `Kalkanına ateş edenler: ${nameList(by)}`;
    if (o === "hit") return `Seni vuranlar: ${nameList(by)}`;
    return `Sana ateş edenler: ${nameList(by)}`;
  };
  const summaryLine = () => {
    const r = reveal();
    const top = r ? mostTargeted(r, ids()) : null;
    if (!top) return "Kimse hedeflenmedi";
    if (top.ids.length === 1) return `En çok hedeflenen: ${nick(top.ids[0] ?? "")} (${top.count} kişi)`;
    if (top.ids.length > 3) return `${top.ids.length} oyuncu eşit hedeflendi (${eachCount(top.count)} kişi)`;
    return `En çok hedeflenenler: ${nameList(top.ids.map(nick))} (${eachCount(top.count)} kişi)`;
  };
  const totalLine = () => {
    const v = props.view();
    const tot = v?.totals?.[props.selfId];
    if (!v || tot === undefined) return "";
    const s1 = v.rounds[0]?.scores[props.selfId] ?? 0;
    const s2 = v.rounds[1]?.scores[props.selfId] ?? 0;
    return `Toplam ${scoreText(tot)} · Tur 1 ${scoreText(s1)} · Tur 2 ${scoreText(s2)}`;
  };
  const nextIn = () => {
    const v = props.view();
    return v ? Math.max(1, Math.ceil((v.roundStartedAt - props.now()) / 1_000)) : 0;
  };
  /** Düello spikeri yorumu yalnız final açılışında; gelmezse ya da boşsa hiç görünmez. */
  const quip = (): string | null => {
    const text = props.comment();
    return final && text !== null && text.trim() !== "" ? text : null;
  };

  return (
    <div class="cx__reveal" data-kind={props.kind} style={vars()}>
      <FireFlash elapsed={elapsed} />
      <Show when={final && !props.spectator && outcome() === "hit"}>
        <Glass delay={FINAL_TIMELINE.impactAt + 60 - elapsed} />
      </Show>

      <div class="cx__head cx__head--reveal">
        <span class="overline">{final ? "Final · Tur 2" : "Tur 1 sonucu"}</span>
        <Show when={!props.spectator} fallback={<span class="cx__title cx__late">Hedefler açıldı</span>}>
          <span class="cx__verdict-row cx__late" data-o={outcome()}>
            <span class="cx__score">{scoreText(score())}</span>
            <span class="cx__verdict">{VERDICT[outcome()]}</span>
          </span>
        </Show>
      </div>

      <div class="cx__stage">
        <Show when={reveal()}>
          {(r) => (
            <Arena
              crew={props.crew}
              selfId={props.spectator ? null : props.selfId}
              reveal={r()}
              totals={final ? (props.view()?.totals ?? null) : null}
              timeline={final ? FINAL_TIMELINE : INTERVAL_TIMELINE}
              elapsed={elapsed}
              mode={final ? "final" : "short"}
            />
          )}
        </Show>
      </div>

      <div class="cx__panel" role="status">
        <Show
          when={final}
          fallback={
            <p class="cx__line cx__line--next">
              Tur 2 başlıyor <b class="cx__next-n">{nextIn()}</b>
            </p>
          }
        >
          <Show when={!props.spectator}>
            <p class="cx__line cx__line--big" data-at="shooters" data-o={outcome()}>
              {shootersLine()}
            </p>
          </Show>
          <p class="cx__line" data-at="summary">
            {summaryLine()}
          </p>
          <Show when={!props.spectator && totalLine() !== ""}>
            <p class="cx__line cx__line--total" data-at="total">
              {totalLine()}
            </p>
          </Show>
          <Show when={props.spectator}>
            <p class="cx__line cx__line--dim" data-at="total">
              Rozetler iki turun toplamını gösterir
            </p>
          </Show>
          <Show when={quip()}>
            {(q) => (
              <p class="cx__line cx__quip" data-at="total">
                {q()}
              </p>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
}
