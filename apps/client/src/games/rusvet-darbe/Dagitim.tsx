import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { fail, tap, unlockAudio } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { CrewMember } from "./Duello.js";
import { nextTokenCount, type RusvetScreenView, tokenMap, tokensToAllocations, tokenTotal } from "./view.js";

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  onGive: (tokens: { to: string; n: number }[]) => void;
  /** Başkan "Bitti" dedi. */
  onDone: () => AckLike;
}

/** Dağıtım: başkan jetonları gizlice verir; diğerleri başkanın koltuğunu ve jeton sayısını görür. */
export function Dagitim(props: Props) {
  const budget = () => props.view.budget ?? 0;
  const president = () => props.crew.find((m) => m.id === props.view.president) ?? null;
  const iAmPresident = () => !props.spectator && props.view.president === props.selfId;
  const order = createMemo(() => props.crew.map((m) => m.id));

  // Yerel (iyimser) dağıtım: sunucu aynı durumu onaylayana kadar gösterilir.
  const [local, setLocal] = createSignal<Record<string, number> | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const serverTokens = () => tokenMap(props.view.myTokens);
  const tokens = (): Record<string, number> => local() ?? serverTokens();
  createEffect(() => {
    const server = serverTokens();
    const l = untrack(local);
    if (
      l &&
      JSON.stringify(tokensToAllocations(l, untrack(order))) ===
        JSON.stringify(tokensToAllocations(server, untrack(order)))
    )
      setLocal(null);
  });
  const remaining = () => budget() - tokenTotal(tokens());

  const pick = (id: string): void => {
    if (!iAmPresident() || props.view.locked) return;
    const member = props.crew.find((m) => m.id === id);
    if (!member) return;
    unlockAudio();
    tap();
    hapticTap();
    const current = tokens()[id] ?? 0;
    const next = nextTokenCount(current, remaining(), member.connected);
    if (next === current) return;
    const updated = { ...tokens(), [id]: next };
    setLocal(updated);
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (local() !== null) {
        setLocal(null);
        fail();
      }
    }, 1600);
    props.onGive(tokensToAllocations(updated, order()));
  };

  return (
    <Show
      when={iAmPresident()}
      fallback={
        <>
          <div class="rd__head">
            <span class="overline">Rüşvet zamanı</span>
            <span class="rd__title">Jetonlar dağıtılıyor</span>
          </div>
          <div class="rd__throne-stage">
            <Show when={president()}>
              {(p) => (
                <div class="rd__throne" style={{ "--tc": look(p().avatar).color }}>
                  <span class="rd__crown" aria-hidden="true">
                    ♛
                  </span>
                  <Avatar index={p().avatar} size="clamp(72px, 26vw, 120px)" connected={p().connected} />
                  <span class="rd__name rd__name--big">{p().nickname}</span>
                  <span class="rd__budget">
                    <b>{budget()}</b> jeton
                  </span>
                </div>
              )}
            </Show>
            <div class="rd__coins" aria-hidden="true">
              <For each={Array.from({ length: Math.min(8, budget()) }, (_, i) => i)}>
                {(i) => <i class="rd__coin rd__coin--idle" style={{ "--i": i }} />}
              </For>
            </div>
          </div>
          <p class="rd__hint" role="status">
            {props.view.ready.length > 0
              ? "Başkan dağıtımı bitirdi"
              : props.spectator
                ? "Dağıtım süre bitince açılır"
                : "Kime kaç jeton gideceği gizli"}
          </p>
        </>
      }
    >
      <div class="rd__head">
        <span class="overline">Sen başkansın</span>
        <span class="rd__title rd__title--coins">
          <i class="rd__coin" aria-hidden="true" />
          {remaining()} jeton kaldı
        </span>
      </div>
      <PlayerPicker
        players={props.crew}
        selfId={props.selfId}
        counts={tokens()}
        countLabel="jeton"
        ring="#FFC23B"
        disabled={props.view.locked}
        canPick={(p) => p.connected || (tokens()[p.id] ?? 0) > 0}
        label={(p) => `${p.nickname} adlı oyuncuya jeton ver`}
        onPick={pick}
      />
      <TamamBar
        locked={props.view.locked}
        ready={props.view.ready.length}
        total={1}
        disabled={tokenTotal(tokens()) === 0}
        label="Bitti"
        doneLabel="Bitti"
        onLock={props.onDone}
      />
      <Show when={!props.view.locked}>
        <p class="rd__hint" role="status">
          {remaining() === 0
            ? "Hepsini dağıttın, Bitti'ye bas"
            : "Dokun: +1 jeton (kişi başı en çok 2). Kalanlar rastgele gider"}
        </p>
      </Show>
    </Show>
  );
}
