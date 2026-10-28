import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createMemo } from "solid-js";
import { createServerNow } from "../net/time.js";
import { playersOnly } from "../screens/ranking.js";
import { Clock } from "../ui/Clock.js";
import { TvBoard } from "./TvParts.js";

/** Kart seçimi (TV): kartlar gizli seçilir; ekranda yalnız kimlerin seçimini bitirdiği görünür. */
export function TvCards(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const now = createServerNow(100);
  const crew = createMemo(() =>
    playersOnly(props.snap.players).filter((p) => props.match.participants.includes(p.id)),
  );
  const done = () => props.match.cards?.phase?.done ?? [];
  const silenced = () => props.match.cards?.phase?.silenced ?? [];
  const win = () => ({
    startedAt: props.match.phaseStartedAt,
    endsAt: props.match.phaseEndsAt ?? props.match.phaseStartedAt,
    urgency: true,
  });
  return (
    <div class="tv__cols">
      <main class="tv__cardsmain">
        <header class="tv__head">
          <div>
            <p class="tv__overline">
              Oyun {props.match.round + 1} / {props.match.total} bitti
            </p>
            <h1 class="tv__title">Kart seçimi</h1>
          </div>
          <div class="tv__clock">
            <Clock tension={false} win={win()} now={now} />
          </div>
        </header>
        <div class="tv__deck" aria-hidden="true">
          <span class="kc-card kc-card--back" data-layout="tile" style={{ "--k": -1 }}>
            <span class="kc-card__qmark">?</span>
          </span>
          <span class="kc-card kc-card--back" data-layout="tile" style={{ "--k": 0 }}>
            <span class="kc-card__qmark">?</span>
          </span>
          <span class="kc-card kc-card--back" data-layout="tile" style={{ "--k": 1 }}>
            <span class="kc-card__qmark">?</span>
          </span>
        </div>
        <p class="tv__lead">Oyuncular kart seçiyor. Kartlar bir sonraki oyunun başında açıklanır.</p>
      </main>
      <TvBoard
        title="Kim seçti?"
        hostId={props.snap.hostId}
        rows={crew().map((player) => ({
          player,
          ready: done().includes(player.id) && !silenced().includes(player.id),
          note: silenced().includes(player.id)
            ? "Turu kaçırdı"
            : done().includes(player.id)
              ? "Seçti"
              : "Seçiyor…",
        }))}
      />
    </div>
  );
}
