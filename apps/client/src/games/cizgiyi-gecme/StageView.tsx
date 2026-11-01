import { createMemo, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import "./cizgiyi-gecme.css";
import { Crew, entriesOf, SCAN_MS } from "./CizgiyiGecmeScreen.js";
import { Sonuc } from "./Sonuc.js";
import { ChooseTower } from "./Tower.js";
import { parseCizgiView } from "./view.js";

const W = 1600;
const H = 900;
/** TV'de açılış biraz yavaş oynar; son turun 7 sn'sine sığar. */
const TV_SLOW = 1.25;

/**
 * Çizgiyi Geçme, büyük ekran (CZ-U12): ortada ekran boyu kule, solda oyuncu sütunu (avatar, ad, kilit, iki turun
 * toplamı), sağda büyük süre, "Tur 1/2" ve radar. Yalnız herkese açık görünüm: açılıştan önce hiçbir pin yoktur;
 * radar herkese açık bilgi olduğu için görünür. Dokunma, ses ve "Devam et" yok.
 */
export default function CizgiStageView(props: GameScreenProps) {
  const view = createMemo(() => parseCizgiView(props.match.publicView, { myChoice: null, locked: false }));
  const entries = createMemo(() => entriesOf(props));
  const reduced = () => reducedMotion();
  const secs = () => {
    const v = view();
    return v ? Math.max(0, Math.ceil((v.endsAt - props.now()) / 1000)) : 0;
  };
  return (
    <TvFit w={W} h={H}>
      <Show when={view()}>
        {(v) => (
          <div class="cztv" data-open={v().reveal ? "1" : undefined}>
            <aside class="cztv__left">
              <Crew
                entries={entries()}
                lockedIds={v().reveal ? [] : v().lockedIds}
                totals={v().totals}
                awards={v().final}
                tv
              />
            </aside>
            <main class="cztv__center">
              <Show
                when={v().reveal}
                fallback={
                  <ChooseTower
                    width={v().zoneWidth}
                    value={null}
                    readonly
                    avatar={0}
                    radar={v().radar}
                    scan={v().radar !== null && !reduced() && props.now() - (v().radar?.at ?? 0) < SCAN_MS}
                    urgent={v().endsAt - props.now() <= 5_000}
                    tv
                  />
                }
              >
                <Sonuc
                  view={v()}
                  entries={entries()}
                  selfId=""
                  now={props.now}
                  reduced={reduced()}
                  tv
                  slow={TV_SLOW}
                />
              </Show>
            </main>
            <aside class="cztv__right">
              <b class="cztv__round">
                Tur {v().round}/{v().rounds}
              </b>
              <Show when={!v().reveal}>
                <b class="cztv__time" data-urgent={secs() <= 5 ? "1" : undefined}>
                  {secs()}
                </b>
                <span class="cztv__ready">
                  {v().lockedIds.length}/{entries().length} kilitledi
                </span>
              </Show>
              <span class="cztv__width">her platform {v().zoneWidth} sayı · 100 Zirve</span>
              <Show when={v().radar}>
                {(r) => (
                  <p class="cztv__radar">
                    {r().zones.length === 0
                      ? "RADAR: kimse yan yana değil"
                      : `🔥 RADAR: ${r().zones.length} platform kalabalık!`}
                  </p>
                )}
              </Show>
            </aside>
          </div>
        )}
      </Show>
    </TvFit>
  );
}
