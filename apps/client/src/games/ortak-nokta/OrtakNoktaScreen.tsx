import type { OrtakTile } from "@glix/engine";
import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { cbShape } from "../../ui/cbShapes.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./ortak-nokta.css";
import { type OrtakScreenView, parseOrtakView, partnersOf, pointsOf, tileColor } from "./view.js";

function Shape(props: { tile: OrtakTile }) {
  const s = () => cbShape(props.tile.shape);
  return (
    <svg class="onk__shape" viewBox="0 0 24 24" aria-hidden="true">
      <title>{s().name}</title>
      <path
        d={s().path}
        fill={s().outline ? "none" : "currentColor"}
        stroke={s().outline ? "currentColor" : "rgba(0,0,0,0.5)"}
        stroke-width={s().outline ? 3.2 : 1.4}
        stroke-linejoin="round"
        paint-order="stroke"
      />
    </svg>
  );
}

/** Tek turun ekranı: yerel seçim ve kilit her turda sıfırdan kurulur. */
function RoundScreen(props: GameScreenProps) {
  const view = createMemo<OrtakScreenView | null>(() =>
    parseOrtakView(props.match.publicView, props.match.view),
  );
  const byId = createMemo(() => new Map(props.players.map((p) => [p.id, p])));
  const crew = () => props.match.participants;
  const [local, setLocal] = createSignal<number | null>(null);
  const [sentLock, setSentLock] = createSignal(false);
  const reveal = () => view()?.reveal ?? null;
  const locked = () => (view()?.locked ?? false) || sentLock();
  const mine = (): number | null => local() ?? view()?.myTile ?? null;
  const closed = () => {
    const v = view();
    return props.spectator === true || !v || locked() || v.phase !== "choose" || props.now() >= v.phaseEndsAt;
  };

  const choose = (tile: number): void => {
    if (closed()) return;
    hapticTap();
    setLocal(tile);
    sendAction({ kind: "choose", tile });
  };
  const lock = () => {
    const tile = mine();
    if (tile === null || closed()) return false;
    if (view()?.myTile !== tile) sendAction({ kind: "choose", tile });
    setSentLock(true);
    const ack = sendActionAck({ kind: "lock" });
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setSentLock(false);
    });
    return ack;
  };
  const pickersOf = (r: NonNullable<ReturnType<typeof reveal>>, tile: number): string[] =>
    r.groups.find((g) => g.tile === tile)?.ids ?? [];
  const myPts = () => {
    const r = reveal();
    return r ? pointsOf(r, props.selfId) : 0;
  };
  const myFinal = () => view()?.final?.[props.selfId] ?? 0;
  const isLast = () => (view()?.round ?? 0) >= (view()?.rounds ?? 99);

  return (
    <Screen class="onk">
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
            <div class="onk__stage">
              <div class="onk__round" role="status">
                <b class="onk__roundNo">
                  Tur {v().round}/{v().rounds}
                </b>
                <span class="onk__goal">Konuşmadan aynı kutuyu seç!</span>
              </div>
              <Show
                when={reveal()}
                fallback={
                  <p class="onk__hint">
                    {props.spectator
                      ? "Herkes gizlice seçiyor"
                      : mine() === null
                        ? "Başkalarının da seçeceği kutuyu tahmin et"
                        : locked()
                          ? "Seçimin kesinleşti"
                          : "Değiştirebilir ya da Tamam diyebilirsin"}
                  </p>
                }
              >
                {(r) => (
                  <div class="onk__head">
                    <Show
                      when={!props.spectator}
                      fallback={
                        <span class="onk__big">{r().topTile === null ? "Dağıldı" : "Ortak nokta!"}</span>
                      }
                    >
                      <span
                        class="onk__big"
                        data-pts={myPts()}
                        data-gold={isLast() && myFinal() > 0 ? "1" : undefined}
                      >
                        {isLast() && myFinal() > 0
                          ? `Genel +${myFinal()}`
                          : myPts() > 0
                            ? `+${myPts()}`
                            : "puan yok"}
                      </span>
                      <p class="onk__sub">
                        {r().picks[props.selfId] === undefined
                          ? "Seçim yapmadın"
                          : partnersOf(r(), props.selfId) === 0
                            ? "Yalnız kaldın"
                            : `${partnersOf(r(), props.selfId)} kişiyle eşleştin`}
                      </p>
                    </Show>
                  </div>
                )}
              </Show>
              <div class="onk__grid">
                <For each={v().layout}>
                  {(tile) => {
                    const t = () => v().board[tile];
                    const who = () => {
                      const r = reveal();
                      return r ? pickersOf(r, tile) : [];
                    };
                    return (
                      <Show when={t()}>
                        {(info) => (
                          <button
                            type="button"
                            class="onk__tile"
                            style={{ "--tc": tileColor(info().color) }}
                            data-mine={mine() === tile ? "1" : undefined}
                            data-top={reveal()?.topTile === tile ? "1" : undefined}
                            data-dim={reveal() && who().length === 0 ? "1" : undefined}
                            disabled={closed()}
                            aria-pressed={mine() === tile}
                            aria-label={cbShape(info().shape).name}
                            onPointerDown={() => choose(tile)}
                            onClick={(e) => {
                              // Klavye ile etkinleştirme (fare/dokunma zaten pointerdown ile geldi).
                              if (e.detail === 0) choose(tile);
                            }}
                          >
                            <Shape tile={info()} />
                            <Show when={reveal()}>
                              <span class="onk__who">
                                <For each={who()}>
                                  {(id) => <Avatar index={byId().get(id)?.avatar ?? 0} size={18} />}
                                </For>
                              </span>
                            </Show>
                          </button>
                        )}
                      </Show>
                    );
                  }}
                </For>
              </div>
              <Show
                when={reveal()}
                fallback={
                  <div class="onk__pods" aria-hidden="true">
                    <For each={crew()}>
                      {(id) => (
                        <span
                          class="onk__pod"
                          data-me={id === props.selfId ? "1" : undefined}
                          data-ready={v().lockedIds.includes(id) ? "1" : undefined}
                          style={{ "--c": look(byId().get(id)?.avatar ?? 0).color }}
                        >
                          {v().lockedIds.includes(id) ? "✓" : "?"}
                        </span>
                      )}
                    </For>
                  </div>
                }
              >
                <ul class="onk__tot" aria-label="Toplam puanlar">
                  <For each={crew()}>
                    {(id) => (
                      <li class="onk__totItem" data-me={id === props.selfId ? "1" : undefined}>
                        <Avatar index={byId().get(id)?.avatar ?? 0} size={22} />
                        {v().totals[id] ?? 0}
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
            <Show when={v().phase === "choose"}>
              <div class="onk__pick">
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

/** Tur numarası değişince ekran yeniden kurulur: önceki turun seçimi ve kilidi sonrakine taşınmaz. */
export default function OrtakNoktaScreen(props: GameScreenProps) {
  const round = createMemo(() => parseOrtakView(props.match.publicView, props.match.view)?.round ?? 0);
  return (
    <Show when={round() > 0} fallback={<Screen class="onk">{null}</Screen>}>
      <For each={[round()]}>{() => <RoundScreen {...props} />}</For>
    </Show>
  );
}
