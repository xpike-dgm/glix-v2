import { createMemo, For, Show } from "solid-js";
import { formatScore } from "../../screens/ranking.js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import "./ortalamanin-yarisi.css";
import { NumberRoad } from "./NumberRoad.js";
import { CARD_LEAVE_MS, entriesOf } from "./OrtalamaninYarisiScreen.js";
import { RoundCard, RoundsTable } from "./parts.js";
import { Sonuc } from "./Sonuc.js";
import { multiplierLabel, multiplierWord, parseOrtalamaPublicView, roundPhase } from "./view.js";

const W = 1600;
const H = 800;

/**
 * Ortalamaya En Yakın, büyük ekran (OY-U13): üstte büyük "TUR 2/3 · ⅔", ortada ekran genişliğinde 0–100 yolu (önceki
 * turun ortalaması ve hedefi), sağda oyuncu sütunu (avatar, ad, kilit, toplam). Açılış tam genişlikte; son turda üç
 * turun tablosu büyük. Yalnız herkese açık görünüm: açılıştan önce hiçbir sayı yok; ses ve dokunma yok.
 */
export default function OrtalamaStageView(props: GameScreenProps) {
  const pub = createMemo(() => parseOrtalamaPublicView(props.match.publicView));
  const entries = createMemo(() => entriesOf(props));
  const phase = () => {
    const p = pub();
    return p ? roundPhase(p, props.now()) : "card";
  };
  const prev = () => {
    const p = pub()?.previous ?? [];
    return p[p.length - 1] ?? null;
  };
  return (
    <TvFit w={W} h={H}>
      <Show when={pub()}>
        {(p) => (
          <div class="ortv" data-phase={phase()}>
            <header class="ortv__top">
              <b>
                TUR {p().round}/{p().rounds}
              </b>
              <span class="ortv__frac">{multiplierLabel(p().multiplier)}</span>
              <span>hedef ortalamanın {multiplierWord(p().multiplier)}</span>
            </header>
            <main class="ortv__main">
              <Show when={phase() === "card"}>
                <RoundCard
                  round={p().round}
                  rounds={p().rounds}
                  multiplier={p().multiplier}
                  leaving={p().roundStartedAt - props.now() < CARD_LEAVE_MS}
                />
              </Show>
              <Show
                when={p().reveal}
                fallback={
                  <div class="ortv__choose">
                    <NumberRoad
                      value={null}
                      readonly
                      prev={prev()}
                      mine={null}
                      color="#2ef2ff"
                      caption={p().previous.length === 0 ? "Herkes gizlice seçiyor" : undefined}
                      label="Sayı yolu"
                    />
                    <Show when={p().previous.length > 0}>
                      <RoundsTable
                        entries={entries()}
                        selfId=""
                        played={p().previous}
                        rounds={p().rounds}
                        final={null}
                        tv
                      />
                    </Show>
                  </div>
                }
              >
                {(r) => (
                  <Sonuc
                    reveal={r()}
                    round={p().round}
                    rounds={p().rounds}
                    multiplier={p().multiplier}
                    totals={p().totals}
                    final={p().final}
                    previous={p().previous}
                    endsAt={p().endsAt}
                    revealEndsAt={p().revealEndsAt}
                    entries={entries()}
                    selfId=""
                    spectator
                    tv
                    now={props.now}
                  />
                )}
              </Show>
            </main>
            <aside class="ortv__crew">
              <For each={entries()}>
                {(e) => (
                  <div class="ortv__row" data-off={e.connected ? undefined : "1"}>
                    <Avatar index={e.avatar} size={52} connected={e.connected} />
                    <span class="ortv__name">{e.nickname}</span>
                    <span class="ortv__lock">
                      {p().lockedIds.includes(e.id) ? "✓" : e.connected ? "" : "kopuk"}
                    </span>
                    <span class="ortv__total" title="Bu oyunda">
                      {p().totals[e.id] ?? 0}
                    </span>
                    <span class="ortv__score">
                      {formatScore(props.players.find((x) => x.id === e.id)?.score ?? 0)}
                    </span>
                  </div>
                )}
              </For>
            </aside>
          </div>
        )}
      </Show>
    </TvFit>
  );
}
