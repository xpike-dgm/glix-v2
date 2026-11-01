import { SIGNS, type Sign } from "@glix/engine";
import { createEffect, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticLong, hapticMatch, hapticTap, hapticTick } from "../../fx/haptics.js";
import { fail, tap, unlockAudio } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { Dice, SignArt } from "./Art.js";
import type { CrewMember } from "./Seats.js";
import { cardFlip, knockedOut, rhythm } from "./sounds.js";
import { handOutcome, handStrip, type RusvetScreenView, replayReason, SIGN_LABEL } from "./view.js";

export type { CrewMember } from "./Seats.js";

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  onSign: (sign: Sign) => void;
}

const BEATS = ["TAŞ", "KÂĞIT", "MAKAS!"] as const;

/**
 * Darbe düellosu (RD-U2, RD-U8): adaylar büyük ve karşılıklı, kartları portre genişliğinde; işaret düğmeleri renk ve
 * şekille ayrışır. Son 3 sn'de "TAŞ · KÂĞIT · MAKAS!" ritmi; açılışta kazanan işaret kaybedeni ezer, kaybedene
 * "ELENDİ" damgası; sonuçsuz elde neden yazılır ve kartlar sallanır; 6. elden sonra kura görünür.
 */
export function Duello(props: Props) {
  const duel = () => props.view.duel;
  const cand = () => {
    const d = duel();
    return d ? d.candidates.flatMap((id) => props.crew.filter((m) => m.id === id)) : [];
  };
  const nameOf = (id: string) => props.crew.find((m) => m.id === id)?.nickname ?? "Oyuncu";
  const isCandidate = () => !props.spectator && (duel()?.candidates.includes(props.selfId) ?? false);
  const shown = () => duel()?.signs ?? null;
  const outcome = () => {
    const d = duel();
    return d?.signs ? handOutcome(d.candidates, d.signs) : null;
  };

  // Seçim: sunucu onaylayana kadar yerel (iyimser) gösterilir.
  const [pending, setPending] = createSignal<Sign | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const mine = (): Sign | null => pending() ?? props.view.mySign;
  createEffect(() => {
    const confirmed = props.view.mySign;
    if (untrack(pending) !== null && confirmed === untrack(pending)) setPending(null);
  });
  createEffect(() => {
    void duel()?.hand;
    untrack(() => setPending(null));
  });
  const choose = (s: Sign): void => {
    if (!isCandidate() || shown() !== null || mine() !== null) return;
    unlockAudio();
    tap();
    hapticTap();
    setPending(s);
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (pending() !== null) {
        setPending(null);
        fail();
      }
    }, 1600);
    props.onSign(s);
  };

  // RD-U8: son 3 sn ritmi (her saniyede bir vuruş).
  const beat = (): number => {
    const d = duel();
    if (!d || d.signs !== null) return -1;
    const left = d.signEndsAt - props.now();
    if (left > 3_000 || left <= 0) return -1;
    return Math.min(2, Math.floor((3_000 - left) / 1_000));
  };
  let lastBeat = -1;
  createEffect(() => {
    const b = beat();
    if (b === lastBeat) return;
    lastBeat = b;
    if (b >= 0)
      untrack(() => {
        rhythm(b === 2);
        hapticTick();
      });
  });

  // Açılışta ses ve titreşim.
  let announced = -1;
  createEffect(() => {
    const d = duel();
    if (!d || d.signs === null || announced === d.hand) return;
    announced = d.hand;
    untrack(() => {
      cardFlip();
      const o = outcome();
      if (!o || o.replay || !isCandidate()) return;
      if (o.advance.includes(props.selfId)) hapticMatch();
      else {
        knockedOut();
        hapticLong();
      }
    });
  });

  const statusOf = (id: string): "win" | "out" | undefined => {
    const o = outcome();
    if (!o || o.replay) return undefined;
    return o.advance.includes(id) ? "win" : "out";
  };
  const strip = () => handStrip(duel()?.history ?? [], nameOf).slice(-1);
  const title = () => {
    const o = outcome();
    const b = beat();
    if (b >= 0) return BEATS.slice(0, b + 1).join(" · ");
    if (shown() === null) return isCandidate() ? "İşaretini seç" : "Kim kazanır?";
    if (o?.replay) return replayReason(o);
    return "İşaretler açıldı";
  };

  return (
    <Show when={duel()}>
      {(d) => (
        <>
          <div class="rd__head">
            <span class="overline">Darbe düellosu · {d().hand}. el</span>
            <span class="rd__title" data-beat={beat() >= 0 ? "1" : undefined}>
              {title()}
            </span>
            <Show when={strip().length > 0}>
              <span class="rd__strip">{strip().join(" · ")}</span>
            </Show>
          </div>

          <div
            class="rd__duel"
            data-n={cand().length}
            data-open={shown() ? "1" : undefined}
            data-replay={outcome()?.replay ? "1" : undefined}
          >
            <For each={cand()}>
              {(m, i) => (
                <div
                  class="rd__cand"
                  data-me={m.id === props.selfId ? "1" : undefined}
                  data-status={statusOf(m.id)}
                  style={{ "--tc": look(m.avatar).color, "--i": i() }}
                >
                  <Avatar
                    index={m.avatar}
                    size="var(--rd-cav)"
                    connected={m.connected}
                    ready={shown() === null && props.view.ready.includes(m.id)}
                  />
                  <span class="rd__name">{m.nickname}</span>
                  <span class="rd__card" data-open={shown() ? "1" : undefined}>
                    <span class="rd__card-back">?</span>
                    <span class="rd__card-front">
                      <Show when={shown()?.[m.id]}>
                        {(s) => (
                          <>
                            <SignArt sign={s()} size="70%" />
                            <span class="rd__card-label">{SIGN_LABEL[s()]}</span>
                          </>
                        )}
                      </Show>
                    </span>
                  </span>
                  <Show when={statusOf(m.id) === "out"}>
                    <span class="rd__stamp rd__stamp--out">ELENDİ</span>
                  </Show>
                </div>
              )}
            </For>
          </div>

          <Show when={d().lottery}>
            {(id) => (
              <p class="rd__lottery" role="status">
                <span class="rd__lottery-die">
                  <Dice size="26px" />
                </span>
                Kura ile: {nameOf(id())}
              </p>
            )}
          </Show>

          <Show
            when={isCandidate()}
            fallback={
              <p class="rd__hint" role="status" data-again={outcome()?.replay ? "1" : undefined}>
                {outcome()?.replay && !d().lottery
                  ? "Yeniden!"
                  : shown() === null
                    ? `${props.view.ready.length}/${d().candidates.length} aday hazır`
                    : props.spectator
                      ? "Düello bitince başkan belli olur"
                      : "Eşit kalan adaylar düello yapıyor"}
              </p>
            }
          >
            <div class="rd__signs" data-chosen={mine() ? "1" : undefined}>
              <For each={SIGNS}>
                {(s) => (
                  <button
                    type="button"
                    class="rd__sign rd__sign--hand"
                    data-sign={s}
                    data-on={mine() === s ? "1" : undefined}
                    data-off={mine() !== null && mine() !== s ? "1" : undefined}
                    disabled={shown() !== null || mine() !== null}
                    aria-pressed={mine() === s}
                    onClick={() => choose(s)}
                  >
                    <SignArt sign={s} size="40px" />
                    <span>{SIGN_LABEL[s]}</span>
                    <Show when={mine() === s}>
                      <span class="rd__lock" aria-hidden="true">
                        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                          <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
                          <path
                            d="M5 7V5a3 3 0 0 1 6 0v2"
                            stroke="currentColor"
                            stroke-width="1.8"
                            fill="none"
                          />
                        </svg>
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
            <p class="rd__hint" role="status" data-again={outcome()?.replay ? "1" : undefined}>
              {outcome()?.replay && !d().lottery
                ? "Yeniden!"
                : shown() !== null
                  ? "Kartlar açıldı"
                  : mine() === null
                    ? "İşaretin tek seferlik: dokununca kesinleşir"
                    : `Diğerleri bekleniyor · ${props.view.ready.length}/${d().candidates.length} hazır`}
            </p>
          </Show>
        </>
      )}
    </Show>
  );
}
