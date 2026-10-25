// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { BOZUK_VOTE_MS, type PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticReady, hapticResult, hapticSolo } from "../../fx/haptics.js";
import {
  match as matchSound,
  ready as readySound,
  roundResult,
  solo as soloSound,
  tick,
} from "../../fx/sound.js";
import { sendAction } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon } from "../../ui/Icons.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { DrawingCanvas } from "../karalama-defteri/DrawingCanvas.js";
import { StepHeader } from "./StepHeader.js";
import type { BozukScreenView, ParsedDrawing, ParsedReveal, ParsedStep } from "./view.js";

interface Props {
  view: BozukScreenView;
  reveal: ParsedReveal;
  players: PlayerInfo[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

const GAP = 10;

/** Kare hücrelerin en büyük çıkacağı sütun düzeni. */
export function cellLayout(count: number, w: number, h: number): { cols: number; cell: number } {
  let best = { cols: 1, cell: 0 };
  if (count <= 0 || w <= 0 || h <= 0) return best;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cell = Math.floor(Math.min((w - (cols - 1) * GAP) / cols, (h - (rows - 1) * GAP) / rows));
    if (cell > best.cell) best = { cols, cell };
  }
  return { ...best, cell: Math.max(0, best.cell) };
}

const drawOf = (s: ParsedStep): ParsedDrawing | null => (s.kind === "draw" ? s.drawing : null);
const textOf = (s: ParsedStep): string => (s.kind === "write" ? s.text : "");

const lenOf = (t: string): "s" | "m" | "l" => {
  const n = Array.from(t).length;
  return n > 38 ? "l" : n > 20 ? "m" : "s";
};

/**
 * Gösteri: zincir adım adım açılır (3 sn), sonra herkes en komik adıma oy verir (tek seferlik), en sonda oy
 * dağılımı ve "sağlam zincir" görünür. Tüm adımlar sabit bir ızgarada durur; yeni açılan adım parlar.
 */
export function Gosteri(props: Props) {
  const r = () => props.reveal;
  const total = () => props.view.steps;
  const person = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const mine = (i: number): boolean => r().steps[i]?.author === props.selfId;

  const [picked, setPicked] = createSignal<number | null>(null);
  const [sent, setSent] = createSignal(false);
  // Zincir değişince seçim sıfırlanır.
  createEffect(
    on(
      () => r().chain,
      () => {
        setPicked(null);
        setSent(false);
      },
    ),
  );
  const myVote = () => props.view.myVote ?? (sent() ? picked() : null);
  const voted = () => myVote() !== null;
  const canVote = () => !props.spectator && r().stage === "vote" && !voted();
  const pick = (i: number): void => {
    if (!canVote() || mine(i)) return;
    tick();
    setPicked(i);
  };
  const confirm = (): void => {
    const i = picked();
    if (i === null || !canVote()) return;
    if (sendAction({ kind: "vote", step: i })) {
      setSent(true);
      readySound();
      hapticReady();
    }
  };

  // Sesler: her yeni adımda tık; sonuçta sağlam zincir fanfarı.
  createEffect(
    on(
      () => `${r().chain}:${r().stage === "show" ? r().shown : "x"}`,
      () => {
        if (r().stage === "show") tick();
      },
      { defer: true },
    ),
  );
  createEffect(
    on(
      () => `${r().chain}:${r().stage}`,
      () => {
        if (r().stage !== "result") return;
        if (r().robust) {
          matchSound();
          hapticMatch();
        } else if ((r().tally ?? []).some((n) => n > 0)) {
          roundResult();
          hapticResult();
        } else {
          soloSound();
          hapticSolo();
        }
      },
      { defer: true },
    ),
  );

  // Izgara boyutu
  let grid: HTMLDivElement | undefined;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  onMount(() => {
    if (!grid) return;
    const read = (): void => {
      setSize({ w: grid?.clientWidth ?? 0, h: grid?.clientHeight ?? 0 });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(grid);
    onCleanup(() => ro.disconnect());
  });
  const layout = createMemo(() => cellLayout(total(), size().w, size().h));

  const winner = createMemo(() => {
    const t = r().tally;
    if (!t) return -1;
    const top = Math.max(...t);
    return top > 0 ? t.indexOf(top) : -1;
  });
  const starter = () => person(r().starter);
  const stageStart = () => (r().stage === "vote" ? r().stageEndsAt - BOZUK_VOTE_MS : r().chainStartedAt);
  const title = () =>
    r().stage === "show" ? "Zincir açılıyor" : r().stage === "vote" ? "En komik adım hangisi?" : "Sonuç";
  const hint = (): string => {
    if (r().stage === "show")
      return `${Math.min(r().shown, total())}. adım · ${person(r().steps[r().shown - 1]?.author ?? "")?.nickname ?? ""}`;
    if (r().stage === "vote") {
      if (props.spectator) return `${r().voted.length}/${props.players.length} oy verdi`;
      if (voted()) return `Oyun verdin · ${r().voted.length}/${props.players.length}`;
      if (picked() !== null) return "Emin misin? Onaylayınca değişmez";
      return "Bir adıma dokun (kendi adımına oy yok)";
    }
    return r().robust
      ? "Sağlam zincir! Zincirdeki herkes +1"
      : winner() >= 0
        ? "En komik adım seçildi"
        : "Kimse oy vermedi";
  };

  const totalVotes = () => (r().tally ?? []).reduce((a, b) => a + b, 0);

  return (
    <>
      <StepHeader
        chip={`ZİNCİR ${r().chain + 1}/${r().chains}`}
        title={title()}
        startedAt={stageStart()}
        endsAt={r().stageEndsAt}
        now={props.now}
        sound={!props.spectator}
      />
      <div class="bt__who">
        <Show when={starter()}>
          {(p) => <Avatar index={p().avatar} size={34} connected={p().connected} />}
        </Show>
        <span class="bt__whotext">
          <b>{r().starter === props.selfId ? "Sen" : (starter()?.nickname ?? "?")}</b> başlattı
        </span>
        <Show when={r().stage === "result" && r().robust}>
          <span class="bt__robust rise">Sağlam +1</span>
        </Show>
      </div>
      <div
        class="bt__grid"
        ref={grid}
        style={{
          "--cols": layout().cols,
          "--cell": `${layout().cell}px`,
          visibility: layout().cell > 0 ? "visible" : "hidden",
        }}
      >
        <For each={Array.from({ length: total() }, (_, i) => i)}>
          {(i) => {
            const step = () => r().steps[i];
            const author = () => person(step()?.author ?? "");
            const votes = () => r().tally?.[i] ?? 0;
            return (
              <button
                type="button"
                class="bt__card"
                data-hidden={step() ? undefined : "1"}
                data-fresh={r().stage === "show" && r().shown === i + 1 ? "1" : undefined}
                data-mine={mine(i) ? "1" : undefined}
                data-picked={(myVote() ?? picked()) === i ? "1" : undefined}
                data-win={r().stage === "result" && winner() === i ? "1" : undefined}
                data-kind={step()?.kind}
                disabled={!canVote() || mine(i) || !step()}
                aria-pressed={(myVote() ?? picked()) === i}
                aria-label={
                  step()
                    ? `${i + 1}. adım, ${author()?.nickname ?? ""}${mine(i) ? " (sen)" : ""}`
                    : `${i + 1}. adım henüz açılmadı`
                }
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
              >
                <Show
                  when={step()}
                  fallback={
                    <span class="bt__q" aria-hidden="true">
                      ?
                    </span>
                  }
                >
                  {(s) => (
                    <>
                      <Show
                        when={drawOf(s())}
                        fallback={
                          <span class="bt__text" data-len={lenOf(textOf(s()))}>
                            {textOf(s())}
                          </span>
                        }
                      >
                        {(d) => (
                          <>
                            <DrawingCanvas strokes={d().strokes} version={d().key} />
                            <Show when={d().strokes.length === 0}>
                              <span class="bt__blank">Boş tuval</span>
                            </Show>
                          </>
                        )}
                      </Show>
                      <span class="bt__by">
                        <Show when={author()}>
                          {(a) => <Avatar index={a().avatar} size={26} connected={a().connected} />}
                        </Show>
                      </span>
                      <Show when={(myVote() ?? picked()) === i && r().stage !== "result"}>
                        <span class="bt__tick">
                          <CheckIcon size={16} />
                        </span>
                      </Show>
                      <Show when={r().stage === "result" && votes() > 0}>
                        <span class="bt__votes rise">+{votes()}</span>
                      </Show>
                    </>
                  )}
                </Show>
              </button>
            );
          }}
        </For>
      </div>
      <p class="bt__hint" role="status">
        {hint()}
      </p>
      <Show
        when={r().stage === "result"}
        fallback={
          <Show when={r().stage === "vote" && !props.spectator} fallback={<div class="bt__spacer" />}>
            <PrimaryButton
              disabled={voted() || picked() === null}
              variant={voted() ? "done" : "cyan"}
              onClick={confirm}
            >
              {voted() ? "OY VERİLDİ" : "EN KOMİK BU"}
            </PrimaryButton>
          </Show>
        }
      >
        <ul class="bt__scores" aria-label="Puanlar">
          <For each={props.view.players}>
            {(id) => {
              const p = () => person(id);
              return (
                <li data-me={id === props.selfId ? "1" : undefined}>
                  <Show when={p()}>
                    {(pp) => <Avatar index={pp().avatar} size={30} connected={pp().connected} />}
                  </Show>
                  <b>{props.view.scores?.[id] ?? 0}</b>
                </li>
              );
            }}
          </For>
        </ul>
        <span class="sr-only">{totalVotes()} oy</span>
      </Show>
    </>
  );
}
