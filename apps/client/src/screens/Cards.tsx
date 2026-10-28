import type { CardId, MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap, unlockAudio } from "../fx/sound.js";
import { discardCard, pickCard } from "../net/client.js";
import { createServerNow } from "../net/time.js";
import { Avatar } from "../ui/Avatar.js";
import { CardBack, CardFace } from "../ui/CardFace.js";
import { Clock } from "../ui/Clock.js";
import { picksLeftText } from "../ui/cards.js";
import { CheckIcon, EyeIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { WorldBackdrop } from "../ui/WorldBackdrop.js";
import { playersOnly } from "./ranking.js";

/**
 * Kart seçimi (docs/KURALLAR.md K2, K3): 15 sn, gizli 3 (ya da 4) seçenek, dokununca seç. El doluyken iyi kart seçilirse
 * aynı süre içinde "hangisini atacaksın" adımı gelir. İzleyiciler ve kartı olmayanlar herkese açık "kart seçiyor" ekranını görür.
 */
export function Cards(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const mine = () => props.match.mine ?? null;
  const pick = () => mine()?.pick ?? null;
  const crew = createMemo(() =>
    playersOnly(props.snap.players).filter((p) => props.match.participants.includes(p.id)),
  );
  const done = () => props.match.cards?.phase?.done ?? [];
  const silenced = () => props.match.cards?.phase?.silenced ?? [];
  const win = () => ({
    startedAt: props.match.phaseStartedAt,
    endsAt: props.match.phaseEndsAt ?? props.match.phaseStartedAt,
    urgency: true,
  });
  // Dokununca anında geri bildirim; sunucu seçimi onaylayana dek aynı seçenek bir daha gönderilmez.
  const [sent, setSent] = createSignal<number[]>([]);
  createEffect(
    on(
      () => pick()?.taken.length ?? 0,
      () => setSent([]),
    ),
  );
  const choose = (i: number): void => {
    if (sent().includes(i)) return;
    unlockAudio();
    tap();
    hapticTap();
    setSent((s) => [...s, i]);
    pickCard(i);
  };
  const drop = (index: number | null): void => {
    unlockAudio();
    tap();
    hapticTap();
    discardCard(index);
  };
  const state = (): "watch" | "silent" | "discard" | "wait" | "pick" => {
    const p = pick();
    if (!p) return "watch";
    if (p.silenced) return "silent";
    if (p.held) return "discard";
    if (p.done) return "wait";
    return "pick";
  };
  const left = () => {
    const p = pick();
    return p ? picksLeftText(p.total, p.got.length) : "";
  };

  return (
    <>
      <WorldBackdrop gameId="lobi" />
      <Screen class="kcards">
        <header class="kc-head">
          <div class="kc-head__row">
            <p class="overline">Kart seçimi</p>
            <div class="kc-head__clock">
              <Clock tension={false} win={win()} now={now} />
            </div>
            <div class="kc-head__tools">
              <SoundToggle />
              <LeaveButton />
            </div>
          </div>
          <h1 class="display kc-title" aria-live="polite">
            <Show when={state() === "pick"}>{left()}</Show>
            <Show when={state() === "discard"}>Elin dolu</Show>
            <Show when={state() === "wait"}>Seçtin</Show>
            <Show when={state() === "silent"}>Bu turu kaçırdın</Show>
            <Show when={state() === "watch"}>Oyuncular kart seçiyor</Show>
          </h1>
        </header>

        <div class="kc-body" data-state={state()}>
          <Show when={state() === "pick"}>
            <div class="kc-opts" data-n={pick()?.options.length ?? 3}>
              <For each={pick()?.options ?? []}>
                {(card, i) => (
                  <Show
                    when={!pick()?.taken.includes(i())}
                    fallback={<div class="kc-slot" aria-hidden="true" />}
                  >
                    <Show
                      when={card}
                      fallback={
                        <CardBack
                          label={`Kapalı kart ${i() + 1}`}
                          disabled={sent().includes(i())}
                          onClick={() => choose(i())}
                        />
                      }
                    >
                      {(id) => (
                        <CardFace
                          id={id()}
                          layout="tile"
                          disabled={sent().includes(i())}
                          on={sent().includes(i())}
                          onClick={() => choose(i())}
                        />
                      )}
                    </Show>
                  </Show>
                )}
              </For>
            </div>
            <Show when={pick()?.blind}>
              <p class="kc-note">Kör Seçim: kartlar ters geldi, görmeden seçiyorsun.</p>
            </Show>
          </Show>

          <Show when={state() === "discard"}>
            <p class="kc-note">Yeni kartı almak için birini at. Yeni kartı atmak için ona dokun.</p>
            <div class="kc-opts" data-n={3}>
              <For each={mine()?.hand ?? []}>
                {(id, i) => <CardFace id={id} layout="tile" onClick={() => drop(i())} note={<DropMark />} />}
              </For>
              <Show when={pick()?.held}>
                {(held) => (
                  <CardFace
                    id={held()}
                    layout="tile"
                    badge="Yeni"
                    onClick={() => drop(null)}
                    note={<DropMark />}
                  />
                )}
              </Show>
            </div>
          </Show>

          <Show when={state() === "wait" || state() === "silent"}>
            <div class="kc-wait">
              <Show when={state() === "silent"}>
                <p class="kc-note">Sessizlik yüzünden bu turda kart seçemezsin.</p>
              </Show>
              <Show when={state() === "wait" && (pick()?.got.length ?? 0) > 0}>
                <p class="kc-note">Seçtiğin kart{(pick()?.got.length ?? 0) > 1 ? "lar" : ""}:</p>
                <div class="kc-opts" data-n={pick()?.got.length ?? 1}>
                  <For each={pick()?.got ?? []}>{(id) => <CardFace id={id as CardId} layout="tile" />}</For>
                </div>
              </Show>
              <p class="kc-note">Diğerleri bekleniyor…</p>
            </div>
          </Show>

          <Show when={state() === "watch"}>
            <div class="kc-wait">
              <p class="kc-note">
                <EyeIcon size={18} /> Herkes gizlice kart seçiyor. Kartlar oyun başında açıklanır.
              </p>
            </div>
          </Show>
        </div>

        <footer class="kc-foot">
          <div class="strip kc-strip" style={{ "--n": crew().length }}>
            <For each={crew()}>
              {(p) => (
                <span class="kc-who" data-done={done().includes(p.id) ? "1" : undefined}>
                  <Avatar
                    index={p.avatar}
                    size="var(--strip-av, 44px)"
                    connected={p.connected}
                    ready={done().includes(p.id)}
                    ring={done().includes(p.id) ? "#B6FF3B" : undefined}
                    class={done().includes(p.id) || silenced().includes(p.id) ? "" : "av--wait"}
                  />
                  <span class="sr-only">
                    {p.nickname}
                    {done().includes(p.id) ? " seçti" : " seçiyor"}
                  </span>
                </span>
              )}
            </For>
          </div>
          <Show when={(mine()?.hand.length ?? 0) > 0 && state() !== "discard"}>
            <div class="kc-hand">
              <span class="overline">Elin</span>
              <For each={mine()?.hand ?? []}>{(id) => <CardFace id={id} layout="mini" />}</For>
            </div>
          </Show>
          <Show when={state() === "wait"}>
            <p class="kc-ok">
              <CheckIcon size={18} /> Hazır
            </p>
          </Show>
        </footer>
      </Screen>
    </>
  );
}

function DropMark() {
  return <span class="kc-card__drop">At</span>;
}
