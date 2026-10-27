import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { hapticReady, hapticTap } from "../../fx/haptics.js";
import { ready, tap, unlockAudio } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon, CloseIcon } from "../../ui/Icons.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { DrawingCanvas } from "./DrawingCanvas.js";
import { Header } from "./Header.js";
import type { KaralamaScreenView } from "./view.js";

interface Props {
  view: KaralamaScreenView;
  players: PlayerInfo[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

const GAP = 10;
/** Alttaki isim/oy çubuğu + boşluk için çizimin altında ayrılan yükseklik. */
const BAR = 54;

/** Duvarın boyutuna göre sütun sayısı: çizimlerin en büyük çıkacağı düzen. */
export function wallLayout(
  count: number,
  w: number,
  h: number,
): { cols: number; rows: number; colw: number; cell: number } {
  let best = { cols: 1, rows: Math.max(1, count), colw: 0, cell: 0 };
  if (count <= 0 || w <= 0 || h <= 0) return best;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const colw = (w - (cols - 1) * GAP) / cols;
    const cell = Math.floor(Math.min(colw, (h - (rows - 1) * GAP) / rows - BAR));
    if (cell > best.cell) best = { cols, rows, colw: Math.floor(colw), cell };
  }
  return { ...best, cell: Math.max(0, best.cell) };
}

/** Sergi duvarı: herkesin çizimi bir çerçevede; dokun büyüt, ismin üstüne dokun oyla. */
export function VoteWall(props: Props) {
  const crew = createMemo(() =>
    props.view.players
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is PlayerInfo => p !== undefined),
  );
  const [picked, setPicked] = createSignal<string | null>(props.view.myVote);
  const [zoom, setZoom] = createSignal<string | null>(null);
  /** Oyuncu başına çizim tekrarı sayacı; çizim duvara ilk çıktığında 1, dokununca artar. */
  const [replays, setReplays] = createSignal<Record<string, number>>({});
  const replayOf = (id: string): number => replays()[id] ?? 1;
  const replayAgain = (id: string): void => {
    setReplays((r) => ({ ...r, [id]: (r[id] ?? 1) + 1 }));
  };
  createEffect(
    on(
      () => props.view.myVote,
      (v) => {
        if (v !== null) setPicked(v);
      },
      { defer: true },
    ),
  );

  const [sentLock, setSentLock] = createSignal(false);
  const locked = (): boolean => props.view.locked || sentLock();
  const closed = (): boolean => props.spectator || locked() || props.now() >= props.view.voteEndsAt;
  const lockVote = (): AckLike => {
    if (props.spectator || locked() || picked() === null || props.now() >= props.view.voteEndsAt)
      return false;
    setSentLock(true);
    const ack = sendActionAck({ kind: "lock" });
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setSentLock(false);
    });
    return ack;
  };
  const canVote = (p: PlayerInfo): boolean => !closed() && p.id !== props.selfId && p.connected;
  const vote = (p: PlayerInfo): void => {
    if (!canVote(p)) return;
    unlockAudio();
    if (picked() === p.id) {
      tap();
      return;
    }
    setPicked(p.id);
    sendAction({ kind: "vote", target: p.id });
    ready();
    hapticReady();
  };

  const n = () => crew().length;
  let wall: HTMLDivElement | undefined;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  onMount(() => {
    if (!wall) return;
    const read = (): void => {
      setSize({ w: wall?.clientWidth ?? 0, h: wall?.clientHeight ?? 0 });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(wall);
    onCleanup(() => ro.disconnect());
  });
  const layout = () => wallLayout(n(), size().w, size().h);
  const votedCount = () => props.view.voted.length;
  const zoomed = () => crew().find((p) => p.id === zoom()) ?? null;
  const drawingOf = (id: string) => props.view.drawings?.[id];

  const hint = (): string => {
    if (props.spectator) return `${votedCount()} / ${n()} oy verdi`;
    if (locked()) return "Oyun kesinleşti.";
    if (picked()) return "Oyunu verdin. Değiştirebilir ya da Tamam diyebilirsin.";
    return "Bir çizime dokun, kelimeyi bilmeyene oy ver.";
  };

  return (
    <>
      <Header view={props.view} now={props.now} phase="vote" title="Kelimeyi bilmeyen kim?" />
      <div
        class="kd__wall"
        ref={wall}
        style={{
          "--cols": layout().cols,
          "--colw": `${layout().colw}px`,
          "--cell": `${layout().cell}px`,
          visibility: layout().cell > 0 ? "visible" : "hidden",
        }}
      >
        <For each={crew()}>
          {(p) => (
            <div
              class="kd__card"
              data-narrow={layout().colw < 130 ? "1" : undefined}
              data-picked={picked() === p.id ? "1" : undefined}
              data-me={p.id === props.selfId ? "1" : undefined}
            >
              <button
                type="button"
                class="kd__frame"
                aria-label={`${p.nickname} çizimini büyüt`}
                onClick={() => {
                  tap();
                  hapticTap();
                  replayAgain(p.id);
                  setZoom(p.id);
                }}
              >
                <DrawingCanvas
                  strokes={drawingOf(p.id)?.strokes ?? []}
                  version={drawingOf(p.id)?.key ?? "0"}
                  replay={replayOf(p.id)}
                />
              </button>
              <button
                type="button"
                class="kd__bar"
                disabled={!canVote(p)}
                aria-pressed={picked() === p.id}
                aria-label={p.id === props.selfId ? `${p.nickname} (sen)` : `${p.nickname} kişisine oy ver`}
                onClick={() => vote(p)}
              >
                <Avatar
                  index={p.avatar}
                  size={30}
                  connected={p.connected}
                  ring={props.view.lockedIds.includes(p.id) ? "var(--lime)" : undefined}
                />
                <span class="kd__name">{p.id === props.selfId ? "Sen" : p.nickname}</span>
                <Show when={picked() === p.id}>
                  <span class="kd__tick">
                    <CheckIcon size={16} />
                  </span>
                </Show>
              </button>
            </div>
          )}
        </For>
      </div>
      <p class="kd__hint" role="status">
        {hint()}
      </p>
      <TamamBar
        spectator={props.spectator}
        locked={locked()}
        disabled={picked() === null || props.now() >= props.view.voteEndsAt}
        ready={props.view.lockedIds.length}
        readyIds={props.view.lockedIds}
        total={n()}
        onLock={lockVote}
      />
      <Show when={zoomed()}>
        {(p) => (
          <Zoom
            view={props.view}
            player={p()}
            picked={picked()}
            canVote={canVote(p())}
            selfId={props.selfId}
            replay={replayOf(p().id)}
            onReplay={() => replayAgain(p().id)}
            onVote={() => vote(p())}
            onClose={() => setZoom(null)}
          />
        )}
      </Show>
    </>
  );
}

function Zoom(props: {
  view: KaralamaScreenView;
  player: PlayerInfo;
  picked: string | null;
  canVote: boolean;
  selfId: string;
  replay: number;
  onReplay: () => void;
  onVote: () => void;
  onClose: () => void;
}) {
  const d = () => props.view.drawings?.[props.player.id];
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") props.onClose();
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));
  const mine = () => props.player.id === props.selfId;
  return (
    <Portal>
      <div class="kd__zoom" role="dialog" aria-modal="true" aria-label={`${props.player.nickname} çizimi`}>
        <button type="button" class="kd__zoomback" aria-label="Kapat" onClick={props.onClose} />
        <div class="kd__zoombox">
          <div class="kd__zoomhead">
            <Avatar index={props.player.avatar} size={40} />
            <span class="kd__zoomname">{mine() ? "Sen" : props.player.nickname}</span>
            <button type="button" class="icon-btn" aria-label="Kapat" onClick={props.onClose}>
              <CloseIcon size={22} />
            </button>
          </div>
          <button type="button" class="kd__replay" aria-label="Çizimi tekrar izle" onClick={props.onReplay}>
            <DrawingCanvas
              class="kd__zoomcanvas"
              strokes={d()?.strokes ?? []}
              version={d()?.key ?? "0"}
              replay={props.replay}
            />
          </button>
          <Show when={!mine()}>
            <PrimaryButton
              variant={props.picked === props.player.id ? "done" : "cyan"}
              disabled={!props.canVote}
              onClick={() => {
                props.onVote();
              }}
            >
              {props.picked === props.player.id ? "OYUN BU" : "OY VER"}
            </PrimaryButton>
          </Show>
        </div>
      </div>
    </Portal>
  );
}
