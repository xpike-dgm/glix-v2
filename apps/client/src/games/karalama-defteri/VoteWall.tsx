import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { hapticTap } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon, CloseIcon } from "../../ui/Icons.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { DrawingCanvas } from "./DrawingCanvas.js";
import { Header } from "./Header.js";
import * as sfx from "./sounds.js";
import { type KaralamaScreenView, TAMAM_ARM_MS, UNVEIL_STEP_MS, wallColumns, wallName } from "./view.js";

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

/** Duvarın boyutuna göre sütun sayısı: çizimlerin en büyük çıkacağı düzen (TV). */
export function wallLayout(
  count: number,
  w: number,
  h: number,
): { cols: number; rows: number; colw: number; cell: number } {
  let best = { cols: 1, rows: Math.max(1, count), colw: 0, cell: 0 };
  if (count <= 0 || w <= 0 || h <= 0) return best;
  for (let cols = 1; cols <= count; cols++) {
    const next = fixedLayout(count, cols, w, h);
    if (next.cell > best.cell) best = next;
  }
  return { ...best, cell: Math.max(0, best.cell) };
}

/** Sütun sayısı belli düzen; hücre duvara sığmazsa duvar kaydırılır (en küçük hücre 120 px). */
export function fixedLayout(
  count: number,
  cols: number,
  w: number,
  h: number,
  minCell = 0,
): { cols: number; rows: number; colw: number; cell: number } {
  const rows = Math.max(1, Math.ceil(count / cols));
  const colw = (w - (cols - 1) * GAP) / cols;
  const fit = Math.floor(Math.min(colw, (h - (rows - 1) * GAP) / rows - BAR));
  return { cols, rows, colw: Math.floor(colw), cell: Math.max(0, Math.max(Math.min(minCell, colw), fit)) };
}

/** Telefon yatay mı (KD-U9). */
function useLandscape() {
  const q =
    typeof window !== "undefined"
      ? window.matchMedia("(orientation: landscape) and (max-height: 520px)")
      : null;
  const [land, setLand] = createSignal(q?.matches ?? false);
  const on = (): void => {
    setLand(q?.matches ?? false);
  };
  q?.addEventListener("change", on);
  onCleanup(() => q?.removeEventListener("change", on));
  return land;
}

/**
 * Sergi duvarı (KD-U4, KD-U6, KD-U9, KD-U12): kendi çizimin başlığın yanında küçük; diğerleri büyük, isimleri hep
 * görünür. Örtüler soldan sağa 0,3 sn arayla kalkar, Tamam ilk 3 sn pasif. Dokununca büyür; büyütmede kaydırarak
 * sonraki/önceki çizim ve "BU KİŞİ". Kopan oyuncunun kartında "bağlantı koptu" (oy verilebilir, KD-M3).
 */
export function VoteWall(props: Props) {
  const crew = createMemo(() =>
    props.view.players
      .map((id) => props.players.find((p) => p.id === id))
      .filter((p): p is PlayerInfo => p !== undefined),
  );
  /** Duvardakiler: kendi çizimin hariç (izleyicide herkes). */
  const wallCrew = createMemo(() => crew().filter((p) => p.id !== props.selfId || props.spectator));
  const self = createMemo(() => (props.spectator ? undefined : crew().find((p) => p.id === props.selfId)));
  const [picked, setPicked] = createSignal<string | null>(props.view.myVote);
  const [zoom, setZoom] = createSignal<string | null>(null);
  const [replays, setReplays] = createSignal<Record<string, number>>({});
  const replayOf = (id: string): number => replays()[id] ?? 0;
  const replayAgain = (id: string): void => {
    setReplays((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
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

  // Sergi açılışı: örtüler sırayla kalkar, kalkan çizim baştan çizilir (KD-U6).
  const voteStart = () => props.view.drawEndsAt;
  const unveiled = (i: number): boolean => props.now() >= voteStart() + i * UNVEIL_STEP_MS;
  createEffect(() => {
    wallCrew().forEach((p, i) => {
      if (unveiled(i) && replays()[p.id] === undefined) replayAgain(p.id);
    });
  });
  const armed = () => props.now() >= voteStart() + TAMAM_ARM_MS;

  const [sentLock, setSentLock] = createSignal(false);
  const locked = (): boolean => props.view.locked || sentLock();
  const closed = (): boolean => props.spectator || locked() || props.now() >= props.view.voteEndsAt;
  const lockVote = (): AckLike => {
    if (props.spectator || locked() || picked() === null || props.now() >= props.view.voteEndsAt || !armed())
      return false;
    setSentLock(true);
    sfx.frameKnock();
    const ack = sendActionAck({ kind: "lock" });
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setSentLock(false);
    });
    return ack;
  };
  const canVote = (p: PlayerInfo): boolean => !closed() && p.id !== props.selfId;
  const vote = (p: PlayerInfo): void => {
    if (!canVote(p)) return;
    unlockAudio();
    if (picked() === p.id) {
      tap();
      return;
    }
    setPicked(p.id);
    sendAction({ kind: "vote", target: p.id });
    sfx.pin();
  };

  const landscape = useLandscape();
  const n = () => wallCrew().length;
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
  const layout = () =>
    fixedLayout(n(), wallColumns(n(), landscape()), size().w, size().h, landscape() ? 0 : 120);
  const zoomed = () => wallCrew().find((p) => p.id === zoom()) ?? null;
  const drawingOf = (id: string) => props.view.drawings?.[id];
  const step = (dir: 1 | -1): void => {
    const list = wallCrew();
    const i = list.findIndex((p) => p.id === zoom());
    const next = list[(i + dir + list.length) % list.length];
    if (!next) return;
    tap();
    replayAgain(next.id);
    setZoom(next.id);
  };
  const connectedCount = () => crew().filter((p) => p.connected).length;
  const allVoted = () => props.view.voted.length >= connectedCount() && connectedCount() > 0;

  const hint = (): string => {
    if (allVoted() && props.view.voteEndsAt - props.now() <= 3_000)
      return "Herkes oy verdi · sergi kapanıyor";
    if (props.spectator) return `${props.view.voted.length} / ${crew().length} oy verdi`;
    if (locked()) return "Oyun kesinleşti.";
    if (picked()) return "Oyunu verdin. Değiştirebilir ya da Tamam diyebilirsin.";
    return "Bir çizime dokun, büyüt; kelimeyi bilmeyene oy ver.";
  };

  return (
    <div class="kd__vote" data-land={landscape() ? "1" : undefined}>
      <Header
        view={props.view}
        now={props.now}
        phase="vote"
        title="Kelimeyi bilmeyen kim?"
        aside={
          <Show when={self()}>
            {(me) => (
              <button
                type="button"
                class="kd__minethumb"
                aria-label="Senin çizimin, büyütmek için dokun"
                onClick={() => setZoom(me().id)}
              >
                <DrawingCanvas
                  strokes={drawingOf(me().id)?.strokes ?? []}
                  version={drawingOf(me().id)?.key ?? "0"}
                  halo={false}
                />
                <span>Senin çizimin</span>
              </button>
            )}
          </Show>
        }
      />
      <div
        class="kd__wall"
        data-scroll
        ref={wall}
        style={{
          "--cols": layout().cols,
          "--colw": `${layout().colw}px`,
          "--cell": `${layout().cell}px`,
          visibility: layout().cell > 0 ? "visible" : "hidden",
        }}
      >
        <For each={wallCrew()}>
          {(p, i) => (
            <div
              class="kd__card"
              data-picked={picked() === p.id ? "1" : undefined}
              data-veiled={unveiled(i()) ? undefined : "1"}
              data-away={p.connected ? undefined : "1"}
              data-narrow={layout().colw < 130 ? "1" : undefined}
              data-tight={layout().colw < 84 ? "1" : undefined}
              data-last={!landscape() && n() % 2 === 1 && n() > 3 && i() === n() - 1 ? "1" : undefined}
            >
              <button
                type="button"
                class="kd__frame"
                aria-label={`${p.nickname} çizimi, büyütmek için dokun`}
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
                <span class="kd__veil" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="kd__bar"
                disabled={!canVote(p)}
                aria-pressed={picked() === p.id}
                aria-label={`${p.nickname} kişisine oy ver${p.connected ? "" : " (bağlantı koptu)"}`}
                onClick={() => vote(p)}
              >
                <Avatar
                  index={p.avatar}
                  size={layout().colw < 130 ? 18 : 30}
                  connected={p.connected}
                  ring={props.view.lockedIds.includes(p.id) ? "var(--lime)" : undefined}
                />
                <span class="kd__namebox">
                  <span class="kd__name">{wallName(p.nickname)}</span>
                  <Show when={!p.connected}>
                    <span class="kd__away">{layout().colw < 160 ? "koptu" : "bağlantı koptu"}</span>
                  </Show>
                </span>
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
      <div class="kd__voteside">
        <p class="kd__hint" role="status">
          {hint()}
        </p>
        <TamamBar
          spectator={props.spectator}
          locked={locked()}
          disabled={picked() === null || props.now() >= props.view.voteEndsAt || !armed()}
          ready={props.view.lockedIds.length}
          readyIds={props.view.lockedIds}
          total={crew().length}
          onLock={lockVote}
        />
      </div>
      <Show when={zoom() === props.selfId ? self() : zoomed()}>
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
            onStep={p().id === props.selfId ? undefined : step}
            onClose={() => setZoom(null)}
          />
        )}
      </Show>
    </div>
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
  onStep: ((dir: 1 | -1) => void) | undefined;
  onClose: () => void;
}) {
  const d = () => props.view.drawings?.[props.player.id];
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") props.onClose();
    if (e.key === "ArrowRight") props.onStep?.(1);
    if (e.key === "ArrowLeft") props.onStep?.(-1);
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));
  // Sağa-sola kaydırma: sonraki/önceki çizim (KD-U4).
  let sx = 0;
  let sy = 0;
  let swiped = false;
  const down = (e: PointerEvent): void => {
    sx = e.clientX;
    sy = e.clientY;
    swiped = false;
  };
  const up = (e: PointerEvent): void => {
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - sy) * 1.5) {
      swiped = true;
      props.onStep?.(dx < 0 ? 1 : -1);
    }
  };
  const mine = () => props.player.id === props.selfId;
  return (
    <Portal>
      <div class="kd__zoom" role="dialog" aria-modal="true" aria-label={`${props.player.nickname} çizimi`}>
        <button type="button" class="kd__zoomback" aria-label="Kapat" onClick={props.onClose} />
        <div class="kd__zoombox">
          <div class="kd__zoomhead">
            <Avatar index={props.player.avatar} size={40} connected={props.player.connected} />
            <span class="kd__zoomname">{mine() ? "Senin çizimin" : props.player.nickname}</span>
            <button type="button" class="icon-btn" aria-label="Kapat" onClick={props.onClose}>
              <CloseIcon size={22} />
            </button>
          </div>
          <button
            type="button"
            class="kd__replay"
            aria-label="Çizimi tekrar izle"
            onPointerDown={down}
            onPointerUp={up}
            onClick={() => {
              if (!swiped) props.onReplay();
            }}
          >
            <DrawingCanvas
              class="kd__zoomcanvas"
              strokes={d()?.strokes ?? []}
              version={d()?.key ?? "0"}
              replay={props.replay}
            />
          </button>
          <Show when={props.onStep}>
            {(go) => (
              <div class="kd__zoomnav">
                <button
                  type="button"
                  class="icon-btn kd__navbtn"
                  aria-label="Önceki çizim"
                  onClick={() => go()(-1)}
                >
                  ‹
                </button>
                <span>Kaydırarak diğer çizimlere geç</span>
                <button
                  type="button"
                  class="icon-btn kd__navbtn"
                  aria-label="Sonraki çizim"
                  onClick={() => go()(1)}
                >
                  ›
                </button>
              </div>
            )}
          </Show>
          <Show when={!mine()}>
            <PrimaryButton
              variant={props.picked === props.player.id ? "done" : "cyan"}
              disabled={!props.canVote}
              onClick={() => {
                props.onVote();
              }}
            >
              {props.picked === props.player.id ? "OYUN BU" : "BU KİŞİ"}
            </PrimaryButton>
          </Show>
        </div>
      </div>
    </Portal>
  );
}
