import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticCrowd, hapticHold, hapticMatch, hapticPress, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { createOpening } from "../../fx/opening.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./acgozluluk-limiti.css";
import { acgozlulukCues } from "./cues.js";
import { Opening } from "./Opening.js";
import { Crew, Ledger, Seal, Strip } from "./parts.js";
import {
  coinSound,
  crackSound,
  gearSound,
  goldSound,
  heartSound,
  keyholeSound,
  lidSound,
  sealSound,
  sighSound,
  stripSound,
} from "./sounds.js";
import { Tank, type TankEntry } from "./Tank.js";
import {
  chipColumns,
  chipHue,
  doorProgress,
  everyoneLine,
  FIT_TEXT,
  fairShareOf,
  fillPlan,
  greedLabel,
  parseAcgozlulukView,
  runningTotal,
  shortName,
  VERDICT_TEXT,
  verdictOf,
  whatIfLine,
} from "./view.js";

export default function AcgozlulukLimitiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseAcgozlulukView(props.match.publicView, props.match.view));
  const ids = () => props.match.participants;
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const entries = createMemo<TankEntry[]>(() =>
    ids().map((id) => {
      const p = playerOf(id);
      return { id, avatar: p?.avatar ?? 0, name: p?.nickname ?? "Oyuncu", connected: p?.connected ?? true };
    }),
  );
  const reveal = () => view()?.reveal ?? null;
  const round = () => view()?.round ?? 1;
  const reduced = () => reducedMotion();
  // Oyunun başında bir kez, dokunulmaz süs sahnesi; girişi beklemez.
  const opening = createOpening("acgozluluk-limiti", () => view()?.startedAt);
  const lockedIds = () => view()?.lockedIds ?? [];
  const locked = () => view()?.locked ?? false;
  const closed = () => {
    const v = view();
    return !v || props.now() >= v.endsAt || v.reveal !== null;
  };
  const max = () => view()?.maxChoice ?? 3;
  const fair = () => {
    const v = view();
    return v ? fairShareOf(v.band, v.maxChoice) : 1;
  };
  const isScout = () => !props.spectator && view()?.scoutId === props.selfId;

  // Dokunuşa anında yanıt: sunucu onayı gelene kadar yerel seçim gösterilir (her tur boşalır).
  const [local, setLocal] = createSignal<{ round: number; value: number } | null>(null);
  const mine = (): number | null => {
    const r = reveal();
    if (r) return r.missing.includes(props.selfId) ? null : (r.choices[props.selfId] ?? null);
    const l = local();
    return (l && l.round === round() ? l.value : null) ?? view()?.myChoice ?? null;
  };
  createEffect(
    on(
      () => view()?.myChoice,
      (server) => {
        if (server !== undefined && server !== null) setLocal({ round: round(), value: server });
      },
    ),
  );

  const choose = (value: number): void => {
    if (props.spectator || closed() || locked()) return;
    unlockAudio();
    coinSound(value, max());
    hapticPress(10);
    if (mine() === value) return;
    setLocal({ round: round(), value });
    sendAction({ kind: "choose", value });
  };
  const lock = (): AckLike => {
    if (props.spectator || closed() || locked() || mine() === null) return false;
    sealSound();
    hapticPress(30);
    return sendActionAck({ kind: "lock" });
  };

  const open = createMemo(() => {
    const v = view();
    const r = v?.reveal;
    if (!v || !r) return null;
    return { reveal: r, plan: fillPlan(r, reduced()), elapsed: props.now() - v.endsAt };
  });
  const verdictShown = () => {
    const o = open();
    return o !== null && o.elapsed >= o.plan.verdictAt;
  };
  const whatIfShown = () => {
    const o = open();
    return o !== null && o.elapsed >= o.plan.whatIfAt;
  };

  acgozlulukCues(view, props.now, reduced, {
    gear: (secs, isLocked) => {
      if (props.spectator) return;
      gearSound(secs);
      // AL-U15: seçmemiş ya da kilitlememiş oyuncunun telefonu her saniye kısa titrer.
      if (!isLocked) hapticTick();
    },
    peek: () => {
      keyholeSound();
      hapticMatch();
    },
    lid: () => lidSound(),
    strip: (_r, i) => stripSound(i),
    heart: () => heartSound(),
    verdict: (_r, v) => {
      if (v === "full") {
        goldSound(true);
        hapticCrowd();
      } else if (v === "roomy") sighSound();
      else if (v === "close" || v === "gold") goldSound(false);
      else {
        crackSound(v === "boom");
        hapticHold();
      }
    },
  });

  const options = () => Array.from({ length: max() + 1 }, (_, i) => i);
  const everyone = () => {
    const v = view();
    const m = mine();
    if (!v || props.spectator || m === null || m <= 0 || v.reveal) return null;
    return { choice: m, ...everyoneLine(m, v.maxChoice, v.band) };
  };
  const door = () => {
    const v = view();
    return v ? doorProgress(v, props.now()) : 0;
  };
  const peek = () => {
    const s = view()?.scout;
    return s && isScout() ? { word: s.word, ago: props.now() - s.at } : null;
  };
  const peekAgo = () => {
    const at = view()?.scoutPeekedAt;
    return at === null || at === undefined ? null : props.now() - at;
  };
  const shownTotal = () => {
    const o = open();
    return o ? runningTotal(o.plan, o.elapsed) : null;
  };
  const scoutName = () => {
    const id = view()?.scoutId;
    return id ? shortName(playerOf(id)?.nickname ?? "Oyuncu") : null;
  };
  const isFinal = () => view()?.final !== null && view()?.final !== undefined;

  return (
    <Screen class="lim">
      <Show when={view()}>
        {(v) => (
          <Show when={!v().reveal}>
            <PhaseClock startedAt={v().roundStartedAt} endsAt={v().endsAt} urgency />
          </Show>
        )}
      </Show>

      <Show when={view()}>
        {(v) => (
          <div
            class="lim__body"
            data-mode={v().reveal ? "open" : "closed"}
            data-spectator={props.spectator ? "1" : undefined}
          >
            <div class="lim__side" data-scroll>
              <Show when={!props.spectator}>
                <Ledger view={v()} playerOf={playerOf} participants={ids()} />
                <Crew
                  ids={ids()}
                  playerOf={playerOf}
                  selfId={props.selfId}
                  totals={v().totals}
                  lockedIds={v().reveal ? [] : lockedIds()}
                  scoutId={v().scoutId}
                />
              </Show>
            </div>

            <div class="lim__center">
              <div class="lim__stats">
                <div class="lim__stat">
                  <span class="overline">Limit</span>
                  <span class="lim__num lim__num--limit" data-fog={verdictShown() ? undefined : "1"}>
                    {verdictShown() ? v().reveal?.limit : `${v().band.low}–${v().band.high}`}
                  </span>
                </div>
                <Show
                  when={v().reveal}
                  fallback={
                    <div class="lim__stat">
                      <span class="overline">{props.spectator ? "Sayılar" : "Seçimin"}</span>
                      <span class="lim__num" data-empty={mine() === null ? "1" : undefined}>
                        {props.spectator ? `0–${v().maxChoice}` : (mine() ?? "–")}
                      </span>
                    </div>
                  }
                >
                  {(r) => (
                    <div class="lim__stat" data-over={verdictShown() ? (r().over ? "1" : "0") : undefined}>
                      <span class="overline">Toplam</span>
                      <span class="lim__num lim__num--total">{shownTotal() ?? "?"}</span>
                    </div>
                  )}
                </Show>
              </div>

              <Show when={!v().reveal}>
                <Show
                  when={isScout()}
                  fallback={
                    <Show when={scoutName()}>
                      {(n) => (
                        <p class="lim__scout" classList={{ "lim__scout--glint": (peekAgo() ?? 9e9) < 1_200 }}>
                          👁 Gözcü: <b>{n()}</b>
                          {peekAgo() !== null ? " · baktı" : ""}
                        </p>
                      )}
                    </Show>
                  }
                >
                  <p class="lim__scout lim__scout--me">👁 Bu tur Gözcü sensin</p>
                </Show>
              </Show>

              <div class="lim__stage">
                <Show when={opening() && !v().reveal && v().round === 1}>
                  <Opening />
                </Show>
                <Tank
                  band={v().band}
                  entries={entries()}
                  selfId={props.selfId}
                  mine={mine()}
                  lockedIds={lockedIds()}
                  scoutId={v().scoutId}
                  peekAgo={peekAgo()}
                  peek={peek()}
                  everyone={everyone()}
                  door={door()}
                  open={open()}
                  reduced={reduced()}
                />
                <Show when={door() > 0 && !v().reveal && !locked() && !props.spectator}>
                  <p class="lim__door" role="status">
                    Kasa kapanıyor!
                  </p>
                </Show>
              </div>
            </div>

            <div class="lim__bottom">
              <Show
                when={v().reveal}
                fallback={
                  <div class="lim__pick">
                    <Show
                      when={!props.spectator}
                      fallback={
                        <div class="lim__watch">
                          <p class="lim__watch-title">Kasa doluyor…</p>
                          <Ledger view={v()} playerOf={playerOf} participants={ids()} big />
                          <Crew
                            ids={ids()}
                            playerOf={playerOf}
                            selfId=""
                            totals={v().totals}
                            lockedIds={lockedIds()}
                            scoutId={v().scoutId}
                            size={44}
                            names
                          />
                          <TamamBar
                            spectator
                            locked={false}
                            ready={lockedIds().length}
                            readyIds={lockedIds()}
                            total={ids().length}
                            dots={false}
                            onLock={lock}
                          />
                        </div>
                      }
                    >
                      <Show when={!locked()} fallback={<Seal value={mine() ?? 0} scout={isScout()} />}>
                        <div class="lim__hint">
                          <Show when={mine() !== null} fallback="Bir sayı seç">
                            <span class="lim__label" style={{ "--h": chipHue(mine() ?? 0, max()) }}>
                              {mine()} · {greedLabel(mine() ?? 0, fair(), max())}
                            </span>
                          </Show>
                          <Show when={everyone()}>
                            {(e) => (
                              <span class="lim__all" data-fit={e().fit}>
                                Herkes {e().choice} derse → {e().total} · {FIT_TEXT[e().fit]}
                              </span>
                            )}
                          </Show>
                          <Show when={everyone()}>
                            <small class="lim__assume">varsayım: herkes aynı sayıyı seçerse</small>
                          </Show>
                        </div>
                        <div class="lim-chips" style={{ "--cols": chipColumns(options().length) }}>
                          <For each={options()}>
                            {(n) => {
                              const label = () => greedLabel(n, fair(), max());
                              return (
                                <button
                                  type="button"
                                  class="lim-chip"
                                  aria-pressed={mine() === n}
                                  aria-label={`${n}, ${label().toLocaleLowerCase("tr")}`}
                                  disabled={closed()}
                                  style={{ "--h": chipHue(n, max()), "--k": Math.min(5, n) }}
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    choose(n);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      choose(n);
                                    }
                                  }}
                                >
                                  <span class="lim-chip__n">{n}</span>
                                  <i class="lim-chip__pile" aria-hidden="true" />
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                      <TamamBar
                        locked={locked()}
                        dots={false}
                        disabled={closed() || mine() === null}
                        ready={lockedIds().length}
                        readyIds={lockedIds()}
                        total={ids().length}
                        onLock={lock}
                      />
                    </Show>
                  </div>
                }
              >
                {(r) => {
                  const verdict = () => verdictOf(r());
                  const myPoints = () => r().points[props.selfId] ?? 0;
                  const award = () => view()?.final?.[props.selfId] ?? 0;
                  return (
                    <div class="lim__result" data-over={r().over ? "1" : "0"} data-verdict={verdict()}>
                      <Show
                        when={verdictShown()}
                        fallback={<p class="lim__verdict lim__verdict--wait">Kasa açılıyor…</p>}
                      >
                        <p class="lim__verdict" role="status">
                          {VERDICT_TEXT[verdict()]}
                        </p>
                      </Show>
                      <p class="lim__whatif" data-on={whatIfShown() ? "1" : undefined}>
                        {whatIfLine(
                          r(),
                          props.spectator ? null : props.selfId,
                          v().maxChoice,
                          v().totals,
                          (id) =>
                            id === props.selfId ? "Sen" : shortName(playerOf(id)?.nickname ?? "Oyuncu"),
                        )}
                      </p>
                      <Show when={!props.spectator && verdictShown()}>
                        <p class="lim__points">
                          {isFinal()
                            ? award() > 0
                              ? `Toplam ${v().totals[props.selfId] ?? 0} jeton · +${award()} puan`
                              : `Toplam ${v().totals[props.selfId] ?? 0} jeton · puan yok`
                            : myPoints() > 0
                              ? `Bu tur +${myPoints()} jeton · Σ ${v().totals[props.selfId] ?? 0}`
                              : `Bu tur jeton yok · Σ ${v().totals[props.selfId] ?? 0}`}
                        </p>
                      </Show>
                      <Strip
                        reveal={r()}
                        participants={ids()}
                        playerOf={playerOf}
                        selfId={props.spectator ? "" : props.selfId}
                        totals={v().totals}
                        final={verdictShown() ? v().final : null}
                        stamped={verdictShown()}
                      />
                    </div>
                  );
                }}
              </Show>
            </div>
          </div>
        )}
      </Show>
      <div class="lim__devam">
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
