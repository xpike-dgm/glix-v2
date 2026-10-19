import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticMatch, hapticSolo, hapticTap } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound, tap, unlockAudio } from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./acgozluluk-limiti.css";
import { Tank, type TankEntry } from "./Tank.js";
import { chipColumns, parseAcgozlulukView, pointsOf } from "./view.js";

export default function AcgozlulukLimitiScreen(props: GameScreenProps) {
  const view = createMemo(() => parseAcgozlulukView(props.match.publicView, props.match.view));
  const entries = createMemo<TankEntry[]>(() =>
    props.match.participants.map((id) => ({
      id,
      avatar: props.players.find((p) => p.id === id)?.avatar ?? 0,
    })),
  );
  const reveal = () => view()?.reveal ?? null;
  const lockedIds = () => view()?.lockedIds ?? [];
  const locked = () => view()?.locked ?? false;
  const closed = () => {
    const v = view();
    return !v || props.now() >= v.endsAt || v.reveal !== null;
  };

  // Dokunuşa anında yanıt: sunucu onayı gelene kadar yerel seçim gösterilir.
  const [local, setLocal] = createSignal<number | null>(null);
  const mine = (): number | null => {
    const r = reveal();
    if (r) return r.choices[props.selfId] ?? 0;
    return local() ?? view()?.myChoice ?? null;
  };
  createEffect(
    on(
      () => view()?.myChoice,
      (server) => {
        if (server !== undefined && server !== null) setLocal(server);
      },
    ),
  );

  const choose = (value: number): void => {
    if (props.spectator || closed() || locked()) return;
    unlockAudio();
    tap();
    hapticTap();
    if (mine() === value) return;
    setLocal(value);
    sendAction({ kind: "choose", value });
  };

  const lock = (): void => {
    if (props.spectator || closed() || locked() || mine() === null) return;
    sendAction({ kind: "lock" });
  };

  // Sonuç açılınca bir kez ses ve titreşim.
  let revealed = false;
  createEffect(() => {
    const r = reveal();
    if (!r || revealed) return;
    revealed = true;
    if (r.over) {
      soloSound();
      hapticSolo();
    } else {
      matchSound();
      hapticMatch();
    }
  });

  const options = () => Array.from({ length: (view()?.maxChoice ?? 0) + 1 }, (_, i) => i);
  const myPoints = () => {
    const r = reveal();
    return r ? pointsOf(r, props.selfId) : 0;
  };

  return (
    <Screen class="lim">
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          {(v) => <ProgressBar startedAt={v().startedAt} endsAt={v().endsAt} now={serverNow} urgency />}
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <Show when={view()}>
        {(v) => (
          <>
            <div class="lim__stats">
              <div class="lim__stat">
                <span class="overline">Limit</span>
                <span class="lim__num lim__num--limit">{v().limit}</span>
              </div>
              <Show
                when={reveal()}
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
                  <div class="lim__stat" data-over={r().over ? "1" : "0"}>
                    <span class="overline">Toplam</span>
                    <span class="lim__num lim__num--total">{r().total}</span>
                  </div>
                )}
              </Show>
            </div>

            <div class="lim__stage">
              <Tank
                limit={v().limit}
                entries={entries()}
                selfId={props.selfId}
                mine={mine()}
                choices={reveal()?.choices ?? null}
                over={reveal()?.over ?? false}
                lockedIds={lockedIds()}
              />
            </div>

            <Show
              when={reveal()}
              fallback={
                <div class="lim__pick">
                  <Show
                    when={!props.spectator}
                    fallback={
                      <>
                        <p class="lim__hint">Herkes gizlice seçiyor…</p>
                        <TamamBar
                          spectator
                          locked={false}
                          ready={lockedIds().length}
                          total={entries().length}
                          onLock={lock}
                        />
                      </>
                    }
                  >
                    <p class="lim__hint">
                      {locked()
                        ? "Seçimin kesinleşti"
                        : mine() === null
                          ? "Bir sayı seç"
                          : "Değiştirebilir ya da Tamam diyebilirsin"}
                    </p>
                    <div class="lim-chips" style={{ "--cols": chipColumns(options().length) }}>
                      <For each={options()}>
                        {(n) => (
                          <button
                            type="button"
                            class="lim-chip"
                            aria-pressed={mine() === n}
                            disabled={closed() || locked()}
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
                            {n}
                          </button>
                        )}
                      </For>
                    </div>
                    <TamamBar
                      locked={locked()}
                      disabled={closed() || mine() === null}
                      ready={lockedIds().length}
                      total={entries().length}
                      onLock={lock}
                    />
                  </Show>
                </div>
              }
            >
              {(r) => (
                <div class="lim__result" data-over={r().over ? "1" : "0"}>
                  <p class="lim__verdict" role="status">
                    {r().over ? "Taştı!" : "Altın!"}
                  </p>
                  <Show when={!props.spectator}>
                    <p class="lim__points">{myPoints() > 0 ? `+${myPoints()} puan` : "Bu sefer puan yok"}</p>
                  </Show>
                  <div class="lim__strip">
                    <For each={entries()}>
                      {(e) => {
                        const player = () => props.players.find((p) => p.id === e.id);
                        return (
                          <div class="lim__who" data-me={e.id === props.selfId ? "1" : undefined}>
                            <Avatar
                              index={e.avatar}
                              size="min(44px, calc((100cqw - 42px) / 8))"
                              connected={player()?.connected ?? true}
                            />
                            <span class="lim__pick-num">{r().choices[e.id] ?? 0}</span>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </>
        )}
      </Show>
    </Screen>
  );
}
