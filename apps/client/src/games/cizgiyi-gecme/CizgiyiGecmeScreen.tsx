import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticMatch, hapticPress, hapticResult, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fanfare, unlockAudio } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { createChoiceSync, stepValue } from "../../ui/numberPicker.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./cizgiyi-gecme.css";
import { cizgiCues, LAST_MS } from "./cues.js";
import { Sonuc } from "./Sonuc.js";
import {
  climbSound,
  coinSound,
  crashSound,
  flagSound,
  lastTick,
  rocketSound,
  seatSound,
  sonarSound,
} from "./sounds.js";
import { ChooseTower, type TowerEntry } from "./Tower.js";
import { isPeak, parseCizgiView, shortName, towerRatio, widthWord, zoneLabel, zoneOf } from "./view.js";

/** Radar taraması bu kadar yeniyse oynar (geç açılan ekranda tarama yok, yanan platformlar doğrudan görünür). */
export const SCAN_MS = 1_200;
const STEPS: readonly number[] = [-10, -1, 1, 10];

export function entriesOf(props: GameScreenProps): TowerEntry[] {
  return props.match.participants.map((id) => {
    const p = props.players.find((x) => x.id === id);
    return { id, avatar: p?.avatar ?? 0, nickname: p?.nickname ?? "Oyuncu", connected: p?.connected ?? true };
  });
}

/** Kilitleyenler ve kopanlar (izleyici, TV; CZ-U12, U13): avatar, kısa ad, kilit bayrağı. */
export function Crew(props: {
  entries: TowerEntry[];
  lockedIds: readonly string[];
  totals?: Record<string, number> | undefined;
  awards?: Record<string, number> | null | undefined;
  tv?: boolean;
}) {
  return (
    <ul class="czcrew" classList={{ "czcrew--tv": props.tv === true }}>
      <For each={props.entries}>
        {(e) => (
          <li
            class="czcrew__who"
            data-locked={props.lockedIds.includes(e.id) ? "1" : undefined}
            data-off={e.connected ? undefined : "1"}
          >
            <Avatar index={e.avatar} size={props.tv ? 52 : 30} connected={e.connected} />
            <span class="czcrew__name">{shortName(e.nickname, props.tv ? 10 : 7)}</span>
            <Show when={props.lockedIds.includes(e.id)}>
              <i class="czcrew__flag" aria-hidden="true">
                🔒
              </i>
            </Show>
            <Show when={props.totals}>{(t) => <b class="czcrew__sum">Σ {t()[e.id] ?? 0}</b>}</Show>
            <Show when={(props.awards?.[e.id] ?? 0) > 0}>
              <em class="czcrew__award">+{props.awards?.[e.id]}</em>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

export default function CizgiyiGecmeScreen(props: GameScreenProps) {
  const view = createMemo(() => parseCizgiView(props.match.publicView, props.match.view));
  const entries = createMemo<TowerEntry[]>(() => entriesOf(props));
  const me = () => entries().find((e) => e.id === props.selfId);
  const reveal = () => view()?.reveal ?? null;
  const round = () => view()?.round ?? 1;
  const reduced = () => reducedMotion();
  const players = () => entries().length;
  const [lockRound, setLockRound] = createSignal<number | null>(null);
  const lockedIds = () => view()?.lockedIds ?? [];
  const locked = () => (view()?.locked ?? false) || lockRound() === round();
  const closed = () => {
    const v = view();
    return props.spectator === true || !v || locked() || props.now() >= v.endsAt || v.reveal !== null;
  };

  // Yerel seçim tur başına: yeni turda boş başlar (seçim her turun başında boşalır, CZ-M1).
  const [syncRound, setSyncRound] = createSignal(0);
  const sync = createChoiceSync({
    serverValue: () => view()?.myChoice,
    send: (value) => {
      sendAction({ kind: "choose", value });
    },
    closed,
  });
  const mine = (): number | null =>
    (syncRound() === round() ? sync.value() : null) ?? view()?.myChoice ?? null;
  const setMine = (value: number, final: boolean): void => {
    if (closed()) return;
    setSyncRound(round());
    sync.set(value, final);
  };
  const width = () => view()?.zoneWidth ?? 10;
  const zone = () => {
    const m = mine();
    return m === null ? null : zoneOf(m, width());
  };

  const lock = (): AckLike => {
    const v = view();
    const value = mine();
    if (!v || value === null || closed()) return false;
    // Sürükleme bitmeden basıldıysa en son değer önce gider (iletiler sıralı ulaşır).
    if (v.myChoice !== value) sendAction({ kind: "choose", value });
    unlockAudio();
    flagSound();
    hapticPress(30);
    const r = round();
    setLockRound(r);
    const ack = sendActionAck({ kind: "lock" });
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setLockRound(null);
    });
    return ack;
  };

  const left = () => {
    const v = view();
    return v ? v.endsAt - props.now() : 0;
  };
  const urgent = () => !reveal() && left() > 0 && left() <= LAST_MS;
  const radar = () => view()?.radar ?? null;
  const radarIn = () => {
    const v = view();
    if (!v || v.radarAt === null || v.radar !== null || v.reveal) return null;
    const ms = v.radarAt - props.now();
    return ms > 0 && v.radarAt < v.endsAt ? Math.ceil(ms / 1000) : null;
  };
  const scan = () => {
    const r = radar();
    return r !== null && !reduced() && !reveal() && props.now() - r.at < SCAN_MS;
  };
  const myFire = () => {
    const r = radar();
    const z = zone();
    return r !== null && z !== null && r.zones.includes(z);
  };

  cizgiCues(view, props.now, reduced, () => entries().map((e) => e.id), {
    last: (secs) => {
      if (props.spectator) return;
      lastTick(secs);
      // CZ-U14: seçmemiş oyuncunun telefonu her saniye titrer.
      if (mine() === null) hapticTick();
    },
    radar: (_r, zones) => {
      sonarSound();
      const z = zone();
      if (!props.spectator && z !== null && zones.includes(z)) hapticMatch();
    },
    climb: (_r, pin) => climbSound(towerRatio(pin.value, width())),
    seat: () => seatSound(),
    crash: (_r, z) => {
      crashSound();
      const m = reveal()?.choices[props.selfId];
      if (!props.spectator && m !== null && m !== undefined && zoneOf(m, width()) === z) hapticSolo();
    },
    launch: () => rocketSound(),
    points: () => {
      if (props.spectator) return;
      const pts = reveal()?.points[props.selfId] ?? 0;
      if (pts >= 2) {
        fanfare();
        hapticResult();
      } else if (pts === 1) {
        coinSound();
        hapticMatch();
      }
    },
  });

  const subLine = () => {
    const m = mine();
    const z = zone();
    if (m === null || z === null)
      return urgent() ? "Seçmezsen pasif kalırsın!" : "Kuleye dokun: pinin oraya çıkar";
    if (isPeak(z, width()))
      return locked() ? "Zirvede kilitlendin · 100 tek başına" : "Zirvedesin · 100 tek başına";
    return `${zoneLabel(z, width())} platformundasın`;
  };
  /** Sayının altındaki satırın ikinci yarısı; yatayda sığmadığı için kulenin yanındaki nota taşınır (CZ-U10). */
  const perLine = () => {
    const z = zone();
    return z !== null && !isPeak(z, width()) ? ` · her platform ${width()} sayı` : "";
  };
  const radarText = () => {
    const r = radar();
    if (!r) return null;
    return r.zones.length === 0
      ? "RADAR: kimse yan yana değil"
      : `RADAR: ${r.zones.length} platform kalabalık!`;
  };

  return (
    <Screen class="cz">
      <Show when={view()}>
        {(v) => (
          <Show when={!v().reveal}>
            <PhaseClock startedAt={v().roundStartedAt} endsAt={v().endsAt} urgency />
          </Show>
        )}
      </Show>

      <Show when={view()}>
        {(v) => (
          <Show
            when={!v().reveal}
            fallback={
              <Sonuc
                view={v()}
                entries={entries()}
                selfId={props.spectator ? "" : props.selfId}
                now={props.now}
                reduced={reduced()}
              />
            }
          >
            <div
              class="cz__body"
              data-spectator={props.spectator ? "1" : undefined}
              data-urgent={urgent() ? "1" : undefined}
            >
              <div class="cz__top">
                <span class="cz__round">
                  Tur {v().round}/{v().rounds}
                </span>
                <span class="cz__note">
                  {players()} kişisiniz: platformlar {widthWord(players())}
                  <span class="cz__per-side"> · her platform {width()} sayı</span>
                </span>
                <Show when={!props.spectator && v().round > 1}>
                  <span class="cz__sum">Σ {v().totals[props.selfId] ?? 0}</span>
                </Show>
              </div>

              <div class="cz__hero">
                <div class="cz__num" data-set={!props.spectator && mine() !== null ? "1" : undefined}>
                  {props.spectator ? "?" : (mine() ?? "?")}
                </div>
                <p
                  class="cz__sub"
                  data-warn={!props.spectator && mine() === null && urgent() ? "1" : undefined}
                >
                  {props.spectator ? "Herkes gizlice seçiyor" : subLine()}
                  <span class="cz__per">
                    {props.spectator ? ` · her platform ${width()} sayı` : perLine()}
                  </span>
                </p>
              </div>

              <div class="cz__radar" data-on={radar() ? "1" : undefined} role="status" aria-live="polite">
                <Show when={radarText()}>
                  {(t) => (
                    <>
                      <b>{t()}</b>
                      <Show when={!props.spectator && myFire() && !locked()}>
                        <span>🔥 Burada yalnız değilsin!</span>
                      </Show>
                    </>
                  )}
                </Show>
              </div>

              <div class="cz__stage">
                <ChooseTower
                  width={width()}
                  value={props.spectator ? null : mine()}
                  readonly={props.spectator === true}
                  disabled={closed()}
                  locked={locked()}
                  avatar={me()?.avatar ?? 0}
                  radar={radar()}
                  scan={scan()}
                  urgent={urgent()}
                  onChange={setMine}
                />
              </div>

              <div class="cz__bottom">
                <Show
                  when={!props.spectator}
                  fallback={
                    <>
                      <Crew
                        entries={entries()}
                        lockedIds={lockedIds()}
                        totals={v().round > 1 ? v().totals : undefined}
                      />
                      <TamamBar
                        spectator
                        locked={false}
                        ready={lockedIds().length}
                        readyIds={lockedIds()}
                        total={entries().length}
                        dots={false}
                        onLock={lock}
                      />
                    </>
                  }
                >
                  <Show
                    when={!locked()}
                    fallback={
                      <div class="czlocked" role="status">
                        <p class="czlocked__flag">
                          🔒 Kilitlendin · <b>{mine() ?? "?"}</b>
                        </p>
                        <p class="czlocked__radar">
                          <Show
                            when={radar()}
                            fallback={
                              radarIn() !== null
                                ? `Radar ${radarIn()} sn sonra…`
                                : `Diğerleri seçiyor · ${lockedIds().length}/${entries().length}`
                            }
                          >
                            {myFire()
                              ? "Senin platformun: 🔥 kalabalık — artık kaçamazsın!"
                              : "Senin platformun: sakin ✓"}
                          </Show>
                        </p>
                      </div>
                    }
                  >
                    <div class="czsteps">
                      <For each={STEPS}>
                        {(d) => (
                          <button
                            type="button"
                            class="czstep"
                            disabled={closed() || mine() === null}
                            onClick={() => {
                              const m = mine();
                              if (m === null) return;
                              hapticPress(8);
                              setMine(stepValue(m, d, 0, 100, m), true);
                            }}
                          >
                            {d > 0 ? `+${d}` : `−${-d}`}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                  <TamamBar
                    locked={locked()}
                    disabled={mine() === null || closed()}
                    ready={lockedIds().length}
                    readyIds={lockedIds()}
                    total={entries().length}
                    onLock={lock}
                  />
                </Show>
              </div>
            </div>
          </Show>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
