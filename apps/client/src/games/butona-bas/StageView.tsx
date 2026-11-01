import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { formatScore } from "../../screens/ranking.js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import { CrownIcon } from "../../ui/Icons.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { ArcadeButton } from "./ArcadeButton.js";
import { FinalReveal, GapSummary, RoundBadge } from "./parts.js";
import {
  gapStep,
  leadersOf,
  maxWindowIndex,
  newWindows,
  parseButonaBasView,
  resultOf,
  roundClockAt,
  roundStar,
  urgentSecs,
} from "./view.js";
import "./butona.css";

const W = 1600;
const H = 700;
/** Çember: merkez ve yarıçap (sahne mantıksal pikseli). */
const CX = 560;
const CY = 385;
const R = 215;

interface Line {
  id: number;
  tone: "match" | "crowd" | "solo";
  ids: string[];
}

/**
 * Butona Bas, büyük ekran (BB-U11): ortada büyük buton, çevresinde çember hâlinde bütün oyuncular (avatar, ad, bu
 * oyundaki puan büyük). Pencere puanlanınca eşleşenler arasında neon çizgiler çakar; kalabalıkta bütün çember yanar,
 * tek basışta avatar kırmızı titrer. Sağda "Bu oyunda" sıralaması (genel skor küçük, ikinci satırda). Tur arası özet ve
 * son açılış tam ekran. Yalnız herkese açık görünüm kullanılır; dokunma ve "Devam et" yoktur.
 */
export default function ButonaBasStageView(props: GameScreenProps) {
  const view = createMemo(() => parseButonaBasView(props.match.publicView, null));
  const crew = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const order = () => crew().map((p) => p.id);
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const clock = createMemo(() => {
    const v = view();
    return v ? roundClockAt(v.startedAt, v.endsAt, props.now()) : null;
  });
  const scores = () => view()?.scores ?? {};
  const leaders = createMemo(() => leadersOf(scores()));
  const urgent = () => {
    const c = clock();
    return c ? urgentSecs(c, props.now()) : null;
  };
  const [flashes, setFlashes] = createSignal<Record<string, "match" | "crowd" | "solo">>({});
  const [lines, setLines] = createSignal<Line[]>([]);
  const [crowd, setCrowd] = createSignal(0);
  let lastSeen: number | null = null;
  let n = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });
  createEffect(() => {
    const v = view();
    if (!v) return;
    untrack(() => {
      if (lastSeen === null) {
        lastSeen = maxWindowIndex(v.recent, null) ?? -1;
        return;
      }
      const fresh = newWindows(v.recent, lastSeen);
      lastSeen = maxWindowIndex(v.recent, lastSeen);
      for (const w of fresh) {
        const tone = resultOf(w).tone;
        const id = ++n;
        setFlashes((f) => {
          const next = { ...f };
          for (const p of w.pressers) next[p] = tone;
          return next;
        });
        if (w.pressers.length >= 2) setLines((l) => [...l.slice(-3), { id, tone, ids: w.pressers }]);
        if (tone === "crowd") setCrowd(id);
        const t = setTimeout(() => {
          timers.delete(t);
          setFlashes((f) => {
            const next = { ...f };
            for (const p of w.pressers) delete next[p];
            return next;
          });
          setLines((l) => l.filter((x) => x.id !== id));
          setCrowd((c) => (c === id ? 0 : c));
        }, 800);
        timers.add(t);
      }
    });
  });

  const pos = (id: string): { x: number; y: number } => {
    const i = order().indexOf(id);
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, order().length);
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  };
  const points = (ids: string[]): string =>
    [...ids]
      .sort((a, b) => order().indexOf(a) - order().indexOf(b))
      .map((id) => {
        const p = pos(id);
        return `${p.x.toFixed(0)},${p.y.toFixed(0)}`;
      })
      .join(" ");
  const gap = createMemo(() => {
    const c = clock();
    const v = view();
    if (!c || !v || c.phase !== "gap") return null;
    const star = roundStar(v.roundScores, c.round - 1, order());
    return {
      step: gapStep(props.now() - c.phaseStartsAt),
      round: c.round,
      star: star ? { player: playerOf(star.id), points: star.points } : null,
    };
  });
  const over = () => clock()?.phase === "over" && view()?.final != null;
  const ranked = createMemo(() =>
    [...crew()].sort(
      (a, b) =>
        (scores()[b.id] ?? 0) - (scores()[a.id] ?? 0) || order().indexOf(a.id) - order().indexOf(b.id),
    ),
  );
  const left = () => {
    const c = clock();
    return c && c.phase === "play" ? Math.max(0, Math.ceil((c.phaseEndsAt - props.now()) / 1_000)) : null;
  };
  const progress = () => {
    const c = clock();
    return c && c.phase === "play" ? Math.min(1, Math.max(0, 1 - (c.phaseEndsAt - props.now()) / 15_000)) : 0;
  };
  const bg = worldAllowed() ? worldSrc("butona-bas", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div class="bbtv" data-crowd={crowd() > 0 ? "1" : undefined}>
        <Show when={bg}>{(src) => <img class="bbtv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <div class="bbtv__scrim" aria-hidden="true" />
        <Show when={view()}>
          {(v) => (
            <>
              <div class="bbtv__top">
                <RoundBadge
                  round={Math.min(v().rounds - 1, clock()?.round ?? 0)}
                  rounds={v().rounds}
                  live={clock()?.phase === "play"}
                  urgent={urgent() !== null}
                  progress={progress()}
                />
                <Show when={left()}>{(s) => <span class="bbtv__left">{s()} sn</span>}</Show>
              </div>
              <Show
                when={!over()}
                fallback={
                  <Show when={v().final}>
                    {(fin) => (
                      <div class="bbtv__final">
                        <FinalReveal
                          players={crew()}
                          scores={scores()}
                          roundScores={v().roundScores}
                          final={fin()}
                          elapsed={props.now() - v().endsAt}
                          selfId=""
                          comment={props.match.comment ?? null}
                          tv
                        />
                      </div>
                    )}
                  </Show>
                }
              >
                <div class="bbtv__ring">
                  <svg class="bbtv__lines" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
                    <For each={lines()}>
                      {(l) => <polygon class="bbtv__line" data-tone={l.tone} points={points(l.ids)} />}
                    </For>
                  </svg>
                  <div class="bbtv__btn" style={{ left: `${CX}px`, top: `${CY}px` }}>
                    <ArcadeButton
                      label="BAS"
                      disabled
                      ring={Math.min(2, clock()?.round ?? 0)}
                      urgent={urgent() !== null}
                    />
                  </div>
                  <For each={crew()}>
                    {(p) => (
                      <div
                        class="bbtv__seat"
                        data-flash={flashes()[p.id]}
                        data-off={p.connected ? undefined : "1"}
                        style={{ left: `${pos(p.id).x}px`, top: `${pos(p.id).y}px` }}
                      >
                        <span class="bbtv__av">
                          <Avatar
                            index={p.avatar}
                            size={96}
                            connected={p.connected}
                            flash={
                              flashes()[p.id] === "solo" ? "solo" : flashes()[p.id] ? "match" : undefined
                            }
                          />
                          <Show when={leaders().includes(p.id)}>
                            <span class="bbtv__crown" role="img" aria-label="Önde">
                              <CrownIcon size={34} />
                            </span>
                          </Show>
                        </span>
                        <span class="bbtv__name">{p.connected ? p.nickname : "koptu"}</span>
                        <b class="bbtv__pts">{scores()[p.id] ?? 0}</b>
                      </div>
                    )}
                  </For>
                </div>
                <aside class="bbtv__side" aria-label="Bu oyunda">
                  <p class="bbtv__sideTitle">Bu oyunda</p>
                  <ol class="bbtv__board">
                    <For each={ranked()}>
                      {(p) => (
                        <li class="bbtv__row" data-lead={leaders().includes(p.id) ? "1" : undefined}>
                          <Avatar index={p.avatar} size={52} connected={p.connected} />
                          <span class="bbtv__rowName">
                            <span>{p.nickname}</span>
                            <small>Genel {formatScore(p.score)}</small>
                          </span>
                          <b class="bbtv__rowPts">{scores()[p.id] ?? 0}</b>
                        </li>
                      )}
                    </For>
                  </ol>
                </aside>
                <Show when={gap()}>
                  {(g) => (
                    <div class="bbtv__gap">
                      <GapSummary step={g().step} done={g().round} next={g().round} star={g().star} />
                    </div>
                  )}
                </Show>
              </Show>
            </>
          )}
        </Show>
      </div>
    </TvFit>
  );
}
