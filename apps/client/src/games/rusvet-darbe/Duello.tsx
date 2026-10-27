import { SIGNS, type Sign } from "@glix/engine";
import { createEffect, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticMatch, hapticTap, hapticTick } from "../../fx/haptics.js";
import { fail, tap, tick, unlockAudio } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { CbState } from "../../ui/CbState.js";
import { SignIcon } from "./SignIcon.js";
import { handOutcome, type RusvetScreenView, SIGN_LABEL } from "./view.js";

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  onSign: (sign: Sign) => void;
}

/** Darbe düellosu: adaylar karşı karşıya, işaretler kapalı kartlarda; süre bitince aynı anda açılır. */
export function Duello(props: Props) {
  const duel = () => props.view.duel;
  const cand = () => {
    const d = duel();
    return d ? d.candidates.flatMap((id) => props.crew.filter((m) => m.id === id)) : [];
  };
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
  // Yeni el: yerel seçim sıfırlanır.
  createEffect(() => {
    void duel()?.hand;
    untrack(() => setPending(null));
  });
  const choose = (s: Sign): void => {
    // İşaret tek seferliktir: ilk seçim kesindir.
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

  // Açılışta ses.
  let announced = -1;
  createEffect(() => {
    const d = duel();
    if (!d || d.signs === null || announced === d.hand) return;
    announced = d.hand;
    untrack(() => {
      tick();
      hapticTick();
      const o = outcome();
      if (o && !o.replay && isCandidate() && o.advance.includes(props.selfId)) hapticMatch();
    });
  });

  const last = () => {
    const h = duel()?.history ?? [];
    return h.length > 0 ? h[h.length - 1] : null;
  };
  const statusOf = (id: string): "win" | "out" | undefined => {
    const o = outcome();
    if (!o || o.replay) return undefined;
    return o.advance.includes(id) ? "win" : "out";
  };

  return (
    <Show when={duel()}>
      {(d) => (
        <>
          <div class="rd__head">
            <span class="overline">Darbe düellosu · {d().hand}. el</span>
            <span class="rd__title">
              {shown() === null
                ? isCandidate()
                  ? "İşaretini seç"
                  : "İşaretler seçiliyor"
                : outcome()?.replay
                  ? "Sonuç yok, yeniden"
                  : "İşaretler açıldı"}
            </span>
          </div>

          <div class="rd__duel" data-n={cand().length}>
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
                  <Show when={statusOf(m.id) === "win" || statusOf(m.id) === "out"}>
                    <CbState kind={statusOf(m.id) === "win" ? "ok" : "bad"} size={16} />
                  </Show>
                  <span class="rd__card" data-open={shown() ? "1" : undefined}>
                    <span class="rd__card-back">?</span>
                    <span class="rd__card-front">
                      <Show when={shown()?.[m.id]}>{(s) => <SignIcon sign={s()} size="62%" />}</Show>
                    </span>
                  </span>
                </div>
              )}
            </For>
          </div>

          <Show when={last()?.replay && shown() === null}>
            <p class="rd__hint rd__hint--replay" role="status">
              Önceki elde sonuç çıkmadı
            </p>
          </Show>

          <Show
            when={isCandidate()}
            fallback={
              <p class="rd__hint" role="status">
                {shown() === null
                  ? `${props.view.ready.length}/${d().candidates.length} hazır`
                  : props.spectator
                    ? "Düello bitince başkan belli olur"
                    : "Eşit kalan adaylar düello yapıyor"}
              </p>
            }
          >
            <div class="rd__signs">
              <For each={SIGNS}>
                {(s) => (
                  <button
                    type="button"
                    class="rd__sign"
                    data-on={mine() === s ? "1" : undefined}
                    disabled={shown() !== null || mine() !== null}
                    aria-pressed={mine() === s}
                    onClick={() => choose(s)}
                  >
                    <SignIcon sign={s} size={34} />
                    <span>{SIGN_LABEL[s]}</span>
                  </button>
                )}
              </For>
            </div>
            <p class="rd__hint" role="status">
              {shown() !== null
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
