import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./tek-ve-kucuk.css";
import { columnOf, parseTekView, pickersOf, type TekScreenView } from "./view.js";

/** Renge ek ikinci ipucu: kazanan ★, tek kalan ●, çakışan ✕. */
const COLUMN_MARK: Record<string, string> = { win: "★", solo: "●", clash: "✕", empty: "" };
const COLUMN_NOTE: Record<string, string> = {
  win: "kazandı",
  solo: "tek kaldı",
  clash: "çakıştı",
  empty: "kimse seçmedi",
};

/** Tek turun ekranı: yerel seçim ve kilit her turda sıfırdan kurulur. */
function RoundScreen(props: GameScreenProps) {
  const view = createMemo<TekScreenView | null>(() => parseTekView(props.match.publicView, props.match.view));
  const byId = createMemo(() => new Map(props.players.map((p) => [p.id, p])));
  const crew = () => props.match.participants;
  const [local, setLocal] = createSignal<number | null>(null);
  const [sentLock, setSentLock] = createSignal(false);
  const reveal = () => view()?.reveal ?? null;
  const locked = () => (view()?.locked ?? false) || sentLock();
  const mine = (): number | null => local() ?? view()?.myValue ?? null;
  const closed = () => {
    const v = view();
    return props.spectator === true || !v || locked() || v.phase !== "choose" || props.now() >= v.phaseEndsAt;
  };
  const choose = (value: number): void => {
    if (closed()) return;
    hapticTap();
    setLocal(value);
    sendAction({ kind: "choose", value });
  };
  const lock = () => {
    const value = mine();
    if (value === null || closed()) return false;
    if (view()?.myValue !== value) sendAction({ kind: "choose", value });
    setSentLock(true);
    const ack = sendActionAck({ kind: "lock" });
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setSentLock(false);
    });
    return ack;
  };
  const values = () => Array.from({ length: view()?.max ?? 0 }, (_, i) => i + 1);
  const isLast = () => (view()?.round ?? 0) >= (view()?.rounds ?? 99);
  const nameOf = (id: string | null): string => (id ? (byId().get(id)?.nickname ?? "Oyuncu") : "");
  const myPts = () => reveal()?.points[props.selfId] ?? 0;
  const myFinal = () => view()?.final?.[props.selfId] ?? 0;

  return (
    <Screen class="tvk">
      <Show when={view()}>
        {(v) => (
          <PhaseClock
            startedAt={v().phaseStartedAt}
            endsAt={v().phaseEndsAt}
            urgency={v().phase === "choose"}
          />
        )}
      </Show>
      <Show when={view()}>
        {(v) => (
          <>
            <div class="tvk__stage">
              <div role="status">
                <b class="tvk__roundNo">
                  Tur {v().round}/{v().rounds}
                </b>
                <span class="tvk__goal">En küçük TEK sayı kazanır</span>
              </div>
              <Show
                when={reveal()}
                fallback={
                  <>
                    <Show when={v().previous.length > 0}>
                      <ul class="tvk__prev" aria-label="Önceki turların kazanan sayıları">
                        <li>Önceki:</li>
                        <For each={v().previous}>
                          {(p) => (
                            <li class="tvk__prevItem" data-none={p.winningValue === null ? "1" : undefined}>
                              {p.winningValue ?? "–"}
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                    <div class="tvk__big" data-set={mine() === null ? undefined : "1"}>
                      {props.spectator ? "?" : (mine() ?? "?")}
                    </div>
                    <p class="tvk__sub">
                      {props.spectator
                        ? "Herkes gizlice seçiyor"
                        : mine() === null
                          ? `1 ile ${v().max} arası bir sayı seç`
                          : locked()
                            ? "Sayın kesinleşti"
                            : "Değiştirebilir ya da Tamam diyebilirsin"}
                    </p>
                    <Show when={!props.spectator}>
                      <div class="tvk__keys">
                        <For each={values()}>
                          {(n) => (
                            <button
                              type="button"
                              class="tvk__key"
                              data-on={mine() === n ? "1" : undefined}
                              disabled={closed()}
                              aria-pressed={mine() === n}
                              onPointerDown={() => choose(n)}
                              onClick={(e) => {
                                if (e.detail === 0) choose(n);
                              }}
                            >
                              {n}
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                    <div class="tvk__pods" aria-hidden="true">
                      <For each={crew()}>
                        {(id) => (
                          <span
                            class="tvk__pod"
                            data-ready={v().lockedIds.includes(id) ? "1" : undefined}
                            style={{ "--c": look(byId().get(id)?.avatar ?? 0).color }}
                          >
                            {v().lockedIds.includes(id) ? "✓" : "?"}
                          </span>
                        )}
                      </For>
                    </div>
                  </>
                }
              >
                {(r) => (
                  <>
                    <div class="tvk__head">
                      <span class="tvk__headBig" data-win={r().winner === null ? "0" : "1"}>
                        {r().winner === null
                          ? "Kimse tek kalmadı"
                          : `${nameOf(r().winner)} · ${r().winningValue}`}
                      </span>
                      <p class="tvk__sub">
                        {props.spectator
                          ? ""
                          : isLast() && myFinal() > 0
                            ? `Genel skora +${myFinal()}`
                            : myPts() > 0
                              ? `Bu tur +${myPts()}`
                              : "Bu tur puan yok"}
                      </p>
                    </div>
                    <ul class="tvk__bars" aria-label="Sayıların seçilme sayıları">
                      <For each={values()}>
                        {(n) => (
                          <li
                            class="tvk__bar"
                            data-k={columnOf(r(), n)}
                            aria-label={`${n}: ${COLUMN_NOTE[columnOf(r(), n)]}`}
                          >
                            <span class="tvk__stack">
                              <For each={pickersOf(r(), n)}>
                                {(id) => <Avatar index={byId().get(id)?.avatar ?? 0} size={20} />}
                              </For>
                            </span>
                            <span class="tvk__num">{n}</span>
                            <span class="tvk__mark" aria-hidden="true">
                              {COLUMN_MARK[columnOf(r(), n)]}
                            </span>
                          </li>
                        )}
                      </For>
                    </ul>
                    <ul class="tvk__tot" aria-label="Toplam puanlar">
                      <For each={crew()}>
                        {(id) => (
                          <li class="tvk__totItem" data-me={id === props.selfId ? "1" : undefined}>
                            <Avatar index={byId().get(id)?.avatar ?? 0} size={22} />
                            {v().totals[id] ?? 0}
                          </li>
                        )}
                      </For>
                    </ul>
                  </>
                )}
              </Show>
            </div>
            <Show when={v().phase === "choose"}>
              <div class="tvk__pick">
                <TamamBar
                  spectator={props.spectator === true}
                  locked={locked()}
                  disabled={mine() === null || closed()}
                  ready={v().lockedIds.length}
                  readyIds={v().lockedIds}
                  total={crew().length}
                  onLock={lock}
                />
              </div>
            </Show>
          </>
        )}
      </Show>
    </Screen>
  );
}

export default function TekVeKucukScreen(props: GameScreenProps) {
  const round = createMemo(() => parseTekView(props.match.publicView, props.match.view)?.round ?? 0);
  return (
    <Show when={round() > 0} fallback={<Screen class="tvk">{null}</Screen>}>
      <For each={[round()]}>{() => <RoundScreen {...props} />}</For>
    </Show>
  );
}
