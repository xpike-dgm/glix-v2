import { createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { tap } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { createChoiceSync } from "../../ui/numberPicker.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./gizli-kareler.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { KareSonuc, type SonucEntry } from "./KareSonuc.js";
import { cellName, type KarelerScreenView, parseKarelerView, screenPhase } from "./view.js";

interface SecimProps {
  v: KarelerScreenView;
  stage: 1 | 2;
  /** Bu aşamada seçebilir mi (katılımcı ve hayatta). */
  canPick: boolean;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

/** Seçim ızgarası. Aşama başına yeni örnek oluşur; yerel seçim aşamalar arasında taşınmaz. */
function Secim(props: SecimProps) {
  const cells = () => Array.from({ length: props.v.size * props.v.size }, (_, i) => i);
  const endsAt = () => (props.stage === 1 ? props.v.endsAt : (props.v.stage2?.endsAt ?? props.v.endsAt));
  const closed = () => !props.canPick || props.v.locked || props.now() >= endsAt();
  const total = () => (props.stage === 1 ? props.entries.length : (props.v.stage2?.players.length ?? 0));
  const me = () => props.entries.find((e) => e.id === props.selfId);
  const sync = createChoiceSync({
    serverValue: () => props.v.myChoice,
    send: (cell) => sendActionAck({ kind: "pick", cell }),
    closed,
  });
  const mine = (): number | null => (props.canPick ? (sync.value() ?? props.v.myChoice) : null);
  const racers = () => {
    const ids = props.v.stage2?.players ?? [];
    return props.entries.filter((e) => ids.includes(e.id));
  };

  const title = (): string => {
    if (props.spectator) return "Herkes gizlice seçiyor";
    if (!props.canPick) return "Elendin";
    return mine() === null ? "Bir kare seç" : "Karen hazır";
  };
  const sub = (): string => {
    if (props.spectator) return "Sonuç süre bitince açılır";
    if (!props.canPick) return "Kalanlar 2. aşamada yarışıyor";
    if (props.v.locked) return "Seçimin kesinleşti";
    if (props.stage === 2) return "Gizli ödül karesi var: tek başına basarsan +2";
    return mine() === null ? "Seçmezsen pasif kalırsın" : "Tamam'a basana kadar değiştirebilirsin";
  };

  return (
    <>
      <div class="khero">
        <Show when={!props.canPick && !props.spectator}>
          <span class="khero__out">
            <Avatar index={me()?.avatar ?? 0} size="clamp(40px, 7dvh, 56px)" mood="out" />
          </span>
        </Show>
        <p class="overline">{props.stage}. aşama / 2</p>
        <h2 class="khero__title" data-set={mine() === null ? undefined : "1"}>
          {title()}
        </h2>
        <p class="khero__sub">{sub()}</p>
      </div>

      <div class="kstage">
        <div class="kgrid" style={{ "--n": props.v.size }} data-off={props.canPick ? undefined : "1"}>
          <For each={cells()}>
            {(cell) => {
              const press = pressable(() => {
                if (closed()) return;
                hapticTap();
                tap();
                sync.set(cell, true);
              });
              return (
                <button
                  type="button"
                  class="kcell"
                  data-on={mine() === cell ? "1" : undefined}
                  style={{ "--i": cell }}
                  disabled={!props.canPick || props.v.locked}
                  aria-label={cellName(cell, props.v.size)}
                  aria-pressed={mine() === cell}
                  onPointerDown={press.onPointerDown}
                  onClick={press.onClick}
                >
                  <Show when={mine() === cell} fallback={<i class="kcell__core" />}>
                    <span class="kcell__me">
                      <Avatar index={me()?.avatar ?? 0} size="var(--as)" />
                    </span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <Show when={props.canPick || props.spectator}>
        <TamamBar
          locked={props.v.locked}
          ready={props.v.ready.length}
          readyIds={props.v.ready}
          total={total()}
          disabled={mine() === null}
          spectator={props.spectator}
          onLock={() => sendActionAck({ kind: "lock" })}
        />
      </Show>

      <Show when={props.stage === 2 && !props.canPick && racers().length > 0}>
        <div class="kpassive">
          <span class="kpassive__label">Yarışanlar</span>
          <For each={racers()}>
            {(e) => (
              <span class="kpassive__who">
                <Avatar index={e.avatar} size="clamp(22px, 3.6dvh, 28px)" connected={e.connected} />
              </span>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

export default function GizliKarelerScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKarelerView(props.match.publicView, props.match.view));
  // Sunucu saati reaktif değildir; aşama geçişleri (2. aşamanın başlaması) için yerel bir saat.
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 200);
  onCleanup(() => clearInterval(timer));
  const entries = createMemo<SonucEntry[]>(() =>
    props.match.participants.map((id) => {
      const p = props.players.find((x) => x.id === id);
      return {
        id,
        avatar: p?.avatar ?? 0,
        nickname: p?.nickname ?? "Oyuncu",
        connected: p?.connected ?? true,
      };
    }),
  );
  const phase = createMemo(() => {
    const v = view();
    return v ? screenPhase(v, clock()) : null;
  });
  const spectator = () => props.spectator === true;
  const survivor = (v: KarelerScreenView): boolean => v.stage1?.status[props.selfId] === "solo";

  /** Üstteki süre çubuğunun aralığı: seçim süresi ya da açılış penceresi. */
  const bar = (v: KarelerScreenView): { from: number; to: number } => {
    switch (phase()) {
      case "reveal1":
        return { from: v.endsAt, to: v.stage2?.startsAt ?? v.finishesAt ?? v.endsAt };
      case "choose2":
        return { from: v.stage2?.startsAt ?? v.endsAt, to: v.stage2?.endsAt ?? v.endsAt };
      case "reveal2":
        return { from: v.stage2?.endsAt ?? v.endsAt, to: v.finishesAt ?? v.endsAt };
      default:
        return { from: v.startedAt, to: v.endsAt };
    }
  };

  return (
    <Screen class="kk">
      <Show when={view()}>
        {(v) => (
          <PhaseClock
            startedAt={bar(v()).from}
            endsAt={bar(v()).to}
            urgency={phase() === "choose1" || phase() === "choose2"}
          />
        )}
      </Show>

      <Show when={view()}>
        {(v) => (
          <Switch>
            <Match when={phase() === "choose1"}>
              <Secim
                v={v()}
                stage={1}
                canPick={!spectator()}
                entries={entries()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
              />
            </Match>
            <Match when={phase() === "reveal1" && v().stage1}>
              {(r) => (
                <KareSonuc
                  reveal={r()}
                  size={v().size}
                  anchor={v().endsAt}
                  final={false}
                  continues={v().stage2 !== null}
                  walkover={v().walkover}
                  total={v().points?.[props.selfId] ?? 0}
                  entries={entries()}
                  selfId={props.selfId}
                  spectator={spectator()}
                  now={props.now}
                />
              )}
            </Match>
            <Match when={phase() === "choose2"}>
              <Secim
                v={v()}
                stage={2}
                canPick={!spectator() && survivor(v())}
                entries={entries()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
              />
            </Match>
            <Match when={phase() === "reveal2" && v().stage2Reveal}>
              {(r) => (
                <KareSonuc
                  reveal={r()}
                  size={v().size}
                  anchor={v().stage2?.endsAt ?? v().endsAt}
                  final={true}
                  continues={false}
                  walkover={null}
                  bonus={v().bonus}
                  total={v().points?.[props.selfId] ?? 0}
                  entries={entries()}
                  selfId={props.selfId}
                  spectator={spectator()}
                  now={props.now}
                />
              )}
            </Match>
          </Switch>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
