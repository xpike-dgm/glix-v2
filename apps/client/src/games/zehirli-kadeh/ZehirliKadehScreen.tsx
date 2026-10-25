import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticReady, hapticTap, hapticTick } from "../../fx/haptics.js";
import { fail, tap, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import type { GameScreenProps } from "../registry.js";
import { Cup } from "./Cup.js";
import { swapSound } from "./sounds.js";
import "./zehirli-kadeh.css";
import { clockFractions, cupColor, gridColumns, parseZehirliKadehView, secondsLeft } from "./view.js";

const AMBER = "#FFC23B";

export default function ZehirliKadehScreen(props: GameScreenProps) {
  const view = createMemo(() => parseZehirliKadehView(props.match.publicView, props.match.view));
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));

  const crew = createMemo(() => {
    const v = view();
    if (!v) return [];
    return v.pub.players.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [p] : [];
    });
  });
  const nameOf = (id: string): string =>
    id === props.selfId ? "Sen" : (crew().find((p) => p.id === id)?.nickname ?? "Oyuncu");

  const player = () => !props.spectator && view()?.priv.role === "player";
  // Takas: dokununca kadehler hemen yer değiştirir; sunucu aynı takası onaylar, reddederse geri döner.
  const serverSwap = (): string | null =>
    view()?.pub.swaps.find((w) => w.from === props.selfId)?.to ??
    (view()?.pub.swapped.includes(props.selfId) ? props.selfId : null);
  let localSwapDone = false;
  const [mySwap, setMySwap] = createOptimistic<string | null>(serverSwap, {
    onReject: () => {
      localSwapDone = false;
      setFlash(null);
      fail();
      hapticError();
    },
  });
  /** Sunucu henüz onaylamadı: yalnız bu sürede yerel yer değiştirme kadehlere uygulanır. */
  const swapOverlay = (): string | null => {
    const t = mySwap();
    return t !== null && serverSwap() === null ? t : null;
  };
  const used = () => (view()?.pub.swapped.includes(props.selfId) ?? false) || mySwap() !== null;
  const closed = () => {
    const v = view();
    return !v || v.pub.ended || clock() >= v.pub.endsAt;
  };
  const canSwap = () => player() && !used() && !closed();

  const [sel, setSel] = createSignal<string | null>(null);

  const pick = (id: string): void => {
    if (!canSwap() || id === props.selfId) return;
    unlockAudio();
    tap();
    hapticTap();
    setSel(sel() === id ? null : id);
  };
  const doSwap = (): void => {
    const target = sel();
    if (!canSwap() || target === null) return;
    localSwapDone = true;
    swapSound();
    hapticReady();
    setSel(null);
    setFlash({ seq: -1, from: props.selfId, to: target });
    flashTimer = setTimeout(() => setFlash(null), 1400);
    setMySwap(target, () => sendActionAck({ kind: "swap", target }));
  };

  // Yeni takas: ses ve ışık tüneli; ilk açılışta tekrar çalmaz.
  let seen: number | null = null;
  const [flash, setFlash] = createSignal<{ seq: number; from: string; to: string } | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(flashTimer));
  createEffect(
    on(
      () => view()?.pub.swaps.length ?? 0,
      (count) => {
        const prev = seen;
        seen = count;
        const last = untrack(view)?.pub.swaps[count - 1];
        if (prev === null || !last || count <= prev) return;
        if (last.from === props.selfId) setSel(null);
        setFlash({ seq: last.seq, from: last.from, to: last.to });
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => setFlash(null), 1400);
        // Kendi takasımın sesi dokunuşta zaten çalındı.
        if (last.from === props.selfId && localSwapDone) {
          localSwapDone = false;
          return;
        }
        swapSound();
        if (last.from === props.selfId || last.to === props.selfId) hapticReady();
        else hapticTick();
      },
    ),
  );

  const fractions = () => {
    const v = view();
    return v
      ? clockFractions(v.pub.startedAt, v.pub.endsAt, v.pub.swaps.length, clock())
      : { left: 0, bonus: 0 };
  };
  const lastSwap = () => {
    const swaps = view()?.pub.swaps ?? [];
    return swaps[swaps.length - 1] ?? null;
  };

  const head = (): { text: string; sub: string } => {
    if (props.spectator) return { text: "Kadehleri izliyorsun", sub: "Zehir sonda açılır" };
    if (used()) return { text: "Takasını yaptın", sub: "Şimdi sonucu bekle" };
    return { text: "Zehir kimde?", sub: "İstersen bir takas yap, istersen bekle" };
  };

  return (
    <Screen class="game zk">
      <header class="game__top">
        <div class="pbar" />
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <div class="zk__text">
        <span class="overline">Zehirli Kadeh</span>
        <h2 class="zk__head">{head().text}</h2>
        <p class="zk__sub">{head().sub}</p>
      </div>

      <div class="zk__stage">
        <div class="zk__clock" data-bump={flash() ? String(flash()?.seq) : undefined}>
          <svg viewBox="0 0 128 128" aria-hidden="true" role="presentation">
            <title>Süre</title>
            <circle class="zk__track" cx="64" cy="64" r="52" />
            <circle
              class="zk__left"
              cx="64"
              cy="64"
              r="52"
              pathLength="100"
              stroke-dasharray={`${(fractions().left * 100).toFixed(1)} 100`}
              transform="rotate(-90 64 64)"
            />
            <circle
              class="zk__bonus"
              cx="64"
              cy="64"
              r="60"
              pathLength="100"
              stroke-dasharray={`${(fractions().bonus * 100).toFixed(1)} 100`}
              transform="rotate(-90 64 64)"
            />
          </svg>
          <span class="zk__secs">{secondsLeft(view()?.pub.endsAt ?? 0, clock())}</span>
        </div>
        <p class="zk__last" role="status">
          <Show when={lastSwap()} fallback="Henüz takas yok">
            {(s) => `${nameOf(s().from)} ⇄ ${nameOf(s().to)}`}
          </Show>
        </p>
      </div>

      <div
        class="zk__grid"
        data-cols={gridColumns(crew().length)}
        style={{ "--cols": gridColumns(crew().length) }}
      >
        <For each={crew()}>
          {(p) => {
            const mine = () => p.id === props.selfId && !props.spectator;
            const cup = () => {
              const h = view()?.pub.holdings ?? {};
              const t = swapOverlay();
              const id =
                t !== null && p.id === props.selfId ? t : t !== null && p.id === t ? props.selfId : p.id;
              return h[id] ?? 0;
            };
            const swapFx = () => {
              const f = flash();
              return f !== null && (f.from === p.id || f.to === p.id) ? String(f.seq) : undefined;
            };
            const picked = () => sel() === p.id;
            const press = pressable(() => pick(p.id));
            return (
              <button
                type="button"
                class="zk__cell"
                data-me={mine() ? "1" : undefined}
                data-picked={picked() ? "1" : undefined}
                data-swap={swapFx()}
                data-used={
                  view()?.pub.swapped.includes(p.id) || (p.id === props.selfId && used()) ? "1" : undefined
                }
                disabled={!canSwap() || mine()}
                aria-pressed={picked()}
                aria-label={`${nameOf(p.id)} ile takas`}
                onPointerDown={press.onPointerDown}
                onClick={press.onClick}
              >
                <Cup color={cupColor(cup())} class="zk__cup" />
                <span class="zk__who">
                  <Avatar
                    index={p.avatar}
                    size={24}
                    connected={p.connected}
                    ring={picked() ? AMBER : undefined}
                  />
                  <span class="zk__name">{nameOf(p.id)}</span>
                </span>
              </button>
            );
          }}
        </For>
      </div>

      <footer class="zk__foot">
        <Show
          when={player() && !used() && !closed()}
          fallback={
            <p class="zk__note" role="status">
              {props.spectator ? "Takaslar herkese açık" : used() ? "Takas hakkın bitti" : "Süre doldu"}
            </p>
          }
        >
          <PrimaryButton
            disabled={sel() === null}
            reason={sel() === null ? "Takas için bir kadeh seç" : `Takas: ${nameOf(sel() as string)}`}
            onClick={doSwap}
          >
            TAKAS ET
          </PrimaryButton>
        </Show>
      </footer>
    </Screen>
  );
}
