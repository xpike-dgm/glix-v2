import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import { TvFit } from "../../stage/TvParts.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { Outro, OutsMeter, ShotStrip } from "./parts.js";
import { bang, click } from "./sounds.js";
import { Table } from "./Table.js";
import "./rus-ruleti.css";
import {
  bamLine,
  dative,
  displayPub,
  genitive,
  parseRusRuletiView,
  riskLine,
  seatPositions,
  shownRisk,
  stageOf,
} from "./view.js";

const W = 1600;
const H = 800;

/**
 * Rus Ruleti, büyük ekran (RR-U14). Yalnız herkese açık görünüm: hedef seçimi ve tahminler hiç gösterilmez. Ortada
 * büyük masa (RR-U1), solda başlık, risk satırı ve bitiş sayacı, sağda atış geçmişi. Tambur dönüşü ve BAM tam ekran.
 */
export default function RusRuletiStageView(props: GameScreenProps) {
  const view = createMemo(() => parseRusRuletiView(props.match.publicView, { role: "spectator" }));
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));
  const stage = createMemo(() => {
    const v = view();
    return v ? stageOf(v.pub, clock()) : "deciding";
  });
  const seats = createMemo(() => seatPositions(view()?.pub.players ?? [], ""));
  const pub = createMemo(() => {
    const v = view();
    return v ? displayPub(v.pub, clock()) : undefined;
  });
  const playerOf = (id: string) => props.players.find((p) => p.id === id);
  const nick = (id: string): string => playerOf(id)?.nickname ?? "Oyuncu";

  let seen: number | null = null;
  createEffect(
    on(
      () => view()?.pub.last?.seq ?? 0,
      (seq) => {
        const prev = seen;
        seen = seq;
        const l = view()?.pub.last;
        if (prev === null || !l || seq <= prev) return;
        const wait = Math.max(0, l.at + 1_200 - props.now());
        setTimeout(() => (l.exploded ? bang() : click()), wait);
      },
    ),
  );

  const head = (): { text: string; sub: string; tone: string } => {
    const v = view();
    if (!v) return { text: "", sub: "", tone: "dim" };
    const p = v.pub;
    const l = p.last;
    switch (stage()) {
      case "over":
        return { text: "Oyun bitti", sub: "Hayatta kalanlar +1 alır", tone: "safe" };
      case "spin":
        return {
          text: "Tambur dönüyor…",
          sub: l
            ? `${nick(l.shooter)} → ${l.shooter === l.target ? "kendine" : nick(l.target)} · %${l.risk}`
            : "",
          tone: "dim",
        };
      case "result":
        if (l?.exploded) return { text: "BAM!", sub: bamLine(l, nick, ""), tone: "boom" };
        return { text: "Klik!", sub: l ? `Silah ${dative(nick(l.target))} geçti` : "", tone: "safe" };
      case "lastWord":
        return {
          text: `${nick(p.lastWord?.from ?? "")} son sözünü söylüyor…`,
          sub: "Silahı kime verecek?",
          tone: "dim",
        };
      case "handoff":
        return p.handoff?.chosen
          ? {
              text: `${nick(p.handoff.from)} silahı ${dative(nick(p.handoff.to))} verdi`,
              sub: "",
              tone: "hold",
            }
          : {
              text: `Silah ${dative(nick(p.handoff?.to ?? p.holder))} geçti`,
              sub: "Kura çekildi",
              tone: "dim",
            };
      default:
        return {
          text: `${genitive(nick(p.holder))} elinde · %${p.risk}`,
          sub: playerOf(p.holder)?.connected === false ? `${nick(p.holder)} bağlı değil` : riskLine(p.risk),
          tone: "hold",
        };
    }
  };
  const bg = worldAllowed() ? worldSrc("rus-ruleti", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div
        class="rrtv"
        data-stage={stage()}
        data-boom={stage() === "result" && view()?.pub.last?.exploded ? "1" : undefined}
      >
        <Show when={bg}>{(src) => <img class="rrtv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <div class="rrtv__scrim" aria-hidden="true" />
        <Show when={view()}>
          {(v) => (
            <>
              <aside class="rrtv__left">
                <h2 class="rrtv__head" data-tone={head().tone}>
                  {head().text}
                </h2>
                <p class="rrtv__sub">{head().sub}</p>
                <Show when={stage() !== "over"}>
                  <OutsMeter pub={pub() ?? v().pub} class="rrtv__outs" />
                </Show>
              </aside>
              <div class="rrtv__table">
                <Table
                  pub={pub() ?? v().pub}
                  stage={stage()}
                  seats={seats()}
                  playerOf={playerOf}
                  label={nick}
                  risk={shownRisk(v().pub, clock())}
                  aim={null}
                  size="104px"
                  tv
                />
                <Show when={stage() === "over"}>
                  <Outro pub={v().pub} playerOf={playerOf} nameOf={nick} avatar="88px" class="rrtv__outro" />
                </Show>
              </div>
              <aside class="rrtv__right">
                <h3 class="rrtv__label">Atışlar</h3>
                <ShotStrip
                  history={(pub() ?? v().pub).history}
                  nameOf={nick}
                  count={10}
                  class="rrtv__shots"
                />
              </aside>
            </>
          )}
        </Show>
      </div>
    </TvFit>
  );
}
