import type { PlayerInfo } from "@glix/engine";
import { createMemo, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { TvFit } from "../../stage/TvParts.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { Crew, Ledger, Strip } from "./parts.js";
import { Tank, type TankEntry } from "./Tank.js";
import {
  doorProgress,
  fillPlan,
  parseAcgozlulukView,
  runningTotal,
  shortName,
  tvSlow,
  VERDICT_TEXT,
  verdictOf,
  whatIfLine,
} from "./view.js";
import "./acgozluluk-limiti.css";

const W = 1600;
const H = 900;

/**
 * Açgözlülük Limiti, büyük ekran (AL-U12): ortada ekran boyu hazne, solda oyuncu sütunu (avatar, ad, kilit, mini puan,
 * 👁 Gözcü), sağda büyük LİMİT bandı, tur ve kasa defteri. Yalnız herkese açık görünüm kullanılır: Gözcü kelimesi,
 * açılıştan önce kimsenin seçimi ve "herkes senin kadar" çizgisi TV'de hiç yoktur. Dokunma, ses ve "Devam et" yok.
 */
export default function AcgozlulukStageView(props: GameScreenProps) {
  const view = createMemo(() =>
    parseAcgozlulukView(props.match.publicView, { myChoice: null, locked: false, scout: null }),
  );
  const ids = () => props.match.participants;
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const entries = createMemo<TankEntry[]>(() =>
    ids().map((id) => {
      const p = playerOf(id);
      return { id, avatar: p?.avatar ?? 0, name: p?.nickname ?? "Oyuncu", connected: p?.connected ?? true };
    }),
  );
  const open = createMemo(() => {
    const v = view();
    const r = v?.reveal;
    if (!v || !r) return null;
    const plan = fillPlan(r, reducedMotion());
    const slow = tvSlow(plan.whatIfAt, v.revealEndsAt - v.endsAt);
    return { reveal: r, plan, elapsed: (props.now() - v.endsAt) / slow };
  });
  const verdictShown = () => {
    const o = open();
    return o !== null && o.elapsed >= o.plan.verdictAt;
  };
  const peekAgo = () => {
    const at = view()?.scoutPeekedAt;
    return at === null || at === undefined ? null : props.now() - at;
  };
  const bg = worldAllowed() ? worldSrc("acgozluluk-limiti", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div class="limtv" data-mode={open() ? "open" : "closed"}>
        <Show when={bg}>{(src) => <img class="limtv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <div class="limtv__scrim" aria-hidden="true" />
        <Show when={view()}>
          {(v) => (
            <>
              <aside class="limtv__left">
                <Crew
                  ids={ids()}
                  playerOf={playerOf}
                  selfId=""
                  totals={v().totals}
                  lockedIds={v().reveal ? [] : v().lockedIds}
                  scoutId={v().reveal ? null : v().scoutId}
                  size={64}
                  names
                />
              </aside>
              <main class="limtv__center">
                <Tank
                  band={v().band}
                  entries={entries()}
                  selfId=""
                  mine={null}
                  lockedIds={v().lockedIds}
                  scoutId={v().scoutId}
                  peekAgo={peekAgo()}
                  peek={null}
                  everyone={null}
                  door={doorProgress(v(), props.now())}
                  open={open()}
                  reduced={reducedMotion()}
                  tv
                />
              </main>
              <aside class="limtv__right">
                <div class="limtv__round">
                  Tur {v().round}/{v().rounds}
                </div>
                <div class="limtv__limit">
                  <span class="overline">Limit</span>
                  <b>{verdictShown() ? v().reveal?.limit : `${v().band.low}–${v().band.high}`}</b>
                </div>
                <Show
                  when={open()}
                  fallback={
                    <p class="limtv__status">
                      {v().lockedIds.length}/{ids().length} hazır
                      <Show when={v().scoutId}>
                        {(id) => <span>👁 Gözcü: {shortName(playerOf(id())?.nickname ?? "Oyuncu", 10)}</span>}
                      </Show>
                    </p>
                  }
                >
                  {(o) => (
                    <div
                      class="limtv__total"
                      data-over={verdictShown() ? (o().reveal.over ? "1" : "0") : undefined}
                    >
                      <span class="overline">Toplam</span>
                      <b>{runningTotal(o().plan, o().elapsed) ?? "?"}</b>
                    </div>
                  )}
                </Show>
                <Ledger view={v()} playerOf={playerOf} participants={ids()} big tv />
              </aside>
              <Show when={open()}>
                {(o) => (
                  <div class="limtv__result" data-over={o().reveal.over ? "1" : "0"}>
                    <Show when={verdictShown()}>
                      <p class="limtv__verdict">{VERDICT_TEXT[verdictOf(o().reveal)]}</p>
                      <p class="limtv__whatif">
                        {whatIfLine(
                          o().reveal,
                          null,
                          v().maxChoice,
                          v().totals,
                          (id) => playerOf(id)?.nickname ?? "",
                        )}
                      </p>
                    </Show>
                    <Strip
                      reveal={o().reveal}
                      participants={ids()}
                      playerOf={playerOf}
                      selfId=""
                      totals={v().totals}
                      final={verdictShown() ? v().final : null}
                      stamped={verdictShown()}
                      tv
                    />
                  </div>
                )}
              </Show>
            </>
          )}
        </Show>
      </div>
    </TvFit>
  );
}
