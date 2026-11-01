import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { formatScore } from "../../screens/ranking.js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { Corridor, Lamps } from "./Corridor.js";
import { Timeline } from "./Timeline.js";
import "./son-kisi.css";
import {
  alarmLine,
  CueGate,
  parseSonKisiPublicView,
  pointsText,
  roundHeadline,
  sonKisiCues,
} from "./view.js";

const W = 1600;
const H = 800;

/**
 * Son Kişi, büyük ekran (SK-U14): solda oyuncu sütunu (genel skor ve tur puanları), ortada geniş koridor, tavanda üç
 * büyük lamba, "SON İKİ" / "SON KİŞİ" bandı; alarmda flaş ve kepenk, ardından tam ekran zaman çizelgesi. Sahip kararı
 * gereği oyun sırasında kimin kaçtığı TV'de de yoktur (yalnız sayı); alarm anı hiçbir zaman önceden gösterilmez.
 * Yalnız herkese açık görünüm; ses ve dokunma yok.
 */
export default function SonKisiStageView(props: GameScreenProps) {
  const pub = createMemo(() => parseSonKisiPublicView(props.match.publicView));
  const crew = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const nameOf = (id: string) => playerOf(id)?.nickname ?? "Oyuncu";
  const phase = () => pub()?.phase ?? "play";
  const inside = () => crew().length - (pub()?.escapedCount ?? 0);
  const result = () => {
    const p = pub();
    return p && p.phase !== "play" ? (p.results[p.round] ?? null) : null;
  };
  const [phaseStart, setPhaseStart] = createSignal(props.now());
  createEffect(
    on(
      () => `${pub()?.round}:${phase()}`,
      () => setPhaseStart(untrack(props.now)),
      { defer: true },
    ),
  );
  const elapsed = () => props.now() - phaseStart();

  const [band, setBand] = createSignal<string | null>(null);
  let t: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(t));
  const gate = new CueGate();
  onMount(() => {
    const p = pub();
    if (p) gate.prime(sonKisiCues(p, crew().length));
  });
  createEffect(() => {
    const p = pub();
    if (!p) return;
    for (const c of gate.fresh(sonKisiCues(p, crew().length))) {
      if (c.kind !== "band") continue;
      setBand(c.text);
      clearTimeout(t);
      t = setTimeout(() => setBand(null), 1_400);
    }
  });
  const bg = worldAllowed() ? worldSrc("son-kisi", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div class="sktv" data-phase={phase()} data-tension={pub()?.tension ?? 0}>
        <Show when={bg}>{(src) => <img class="sktv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <aside class="sktv__left">
          <For each={crew()}>
            {(p) => (
              <div class="sktv__row" data-off={p.connected ? undefined : "1"}>
                <Avatar index={p.avatar} size={52} connected={p.connected} />
                <span class="sktv__who">
                  <b>{p.nickname}</b>
                  <small>
                    Genel {formatScore(p.score)} · Alarm puanı {pub()?.totals[p.id] ?? 0}
                  </small>
                </span>
              </div>
            )}
          </For>
        </aside>
        <main class="sktv__main">
          <div class="sktv__top">
            <span class="sktv__round">
              {pub() && pub()?.round === (pub()?.rounds ?? 3) - 1
                ? "SON ALARM"
                : `ALARM ${(pub()?.round ?? 0) + 1}/3`}
            </span>
            <Lamps level={pub()?.tension ?? 0} class="sklamps--tv" />
          </div>
          <Show
            when={phase() !== "play" && result()}
            fallback={
              <div class="sktv__hall">
                <Corridor shut={false} shutter={false} />
                <p class="sktv__head">Koridoru izliyorsun · son kaçan kazanır</p>
                <p class="sktv__count">
                  İçeride <b>{inside()}</b> · Kaçtı <b>{pub()?.escapedCount ?? 0}</b>
                </p>
              </div>
            }
          >
            {(r) => (
              <div class="sktv__open">
                <Show when={!reducedMotion() && elapsed() < 1_200}>
                  <div class="sktv__flash" aria-hidden="true" />
                </Show>
                <p class="sktv__alarm">{alarmLine(r())}</p>
                <p class="sktv__win">{roundHeadline(r(), nameOf, false)}</p>
                <Timeline
                  result={r()}
                  playerOf={playerOf}
                  selfId=""
                  elapsed={reducedMotion() ? null : elapsed() - 1_200}
                  avatar={64}
                />
                <Show when={phase() === "over" && pub()?.final}>
                  {(fin) => (
                    <ol class="sktv__rank">
                      <For each={fin()}>
                        {(s) => (
                          <li>
                            <b>{s.rank}.</b> {nameOf(s.playerId)} ·{" "}
                            {s.roundPoints.map(pointsText).join(" · ")} = {s.total}
                          </li>
                        )}
                      </For>
                    </ol>
                  )}
                </Show>
              </div>
            )}
          </Show>
          <Show when={band()}>{(b) => <div class="sktv__band">{b()}</div>}</Show>
        </main>
      </div>
    </TvFit>
  );
}
