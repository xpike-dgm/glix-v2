import { createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import "./gizli-kareler.css";
import { KareSonuc, type SonucEntry } from "./KareSonuc.js";
import { Secim } from "./Secim.js";
import { parseKarelerView, readyLine, screenPhase } from "./view.js";

const W = 1600;
const H = 900;

/**
 * Gizli Kareler, büyük ekran (GK-U14). Yalnız herkese açık görünüm: ortada büyük koordinatlı ızgara, solda oyuncu
 * sütunu (ad, aşama durumu, Tamam ✓, toplam), sağda aşama ve süre. Açılışlar ve özet tablosu tam boy. Seçimler ve
 * pusulalar TV'ye hiç gelmez (izleyici görünümü).
 */
export default function GizliKarelerStageView(props: GameScreenProps) {
  const view = createMemo(() =>
    parseKarelerView(props.match.publicView, { myChoice: null, locked: false, compass: null }),
  );
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));
  const entries = createMemo<SonucEntry[]>(() =>
    props.match.participants.map((id) => {
      const p = props.players.find((x) => x.id === id);
      return {
        id,
        avatar: p?.avatar ?? 0,
        nickname: p?.nickname ?? "Oyuncu",
        connected: p?.connected ?? true,
      };
    }),
  );
  const phase = createMemo(() => {
    const v = view();
    return v ? screenPhase(v, clock()) : null;
  });
  const choosing = () => phase() === "choose1" || phase() === "choose2";
  const stageNo = () => (phase() === "choose1" || phase() === "reveal1" ? 1 : 2);
  const secsLeft = () => {
    const v = view();
    if (!v || !choosing()) return null;
    const end = phase() === "choose1" ? v.endsAt : (v.stage2?.endsAt ?? v.endsAt);
    return Math.max(0, Math.ceil((end - clock()) / 1000));
  };
  const statusOf = (id: string): string => {
    const v = view();
    if (!v?.stage1) return "seçiyor";
    if (stageNo() === 1) {
      const s = v.stage1.status[id];
      return s === "solo" ? "tek kaldı" : s === "clash" ? "çakıştı" : "seçmedi";
    }
    const s2 = v.stage2Reveal?.status[id];
    if (s2)
      return s2 === "solo"
        ? "tek kaldı"
        : s2 === "haunted"
          ? "hayalete çarptı"
          : s2 === "clash"
            ? "çakıştı"
            : "seçmedi";
    if (v.stage2?.players.includes(id)) return "yarışıyor";
    if (v.stage2?.ghosts.includes(id)) return "👻 hayalet";
    return v.stage1.status[id] === "solo" ? "tek kaldı" : "elendi";
  };
  const crew = () => {
    const v = view();
    if (!v) return 0;
    return phase() === "choose2"
      ? (v.stage2?.players.length ?? 0) + (v.stage2?.ghosts.length ?? 0)
      : entries().length;
  };

  return (
    <TvFit w={W} h={H}>
      <div class="kktv" data-urgent={(secsLeft() ?? 9) <= 5 && choosing() ? "1" : undefined}>
        <Show when={view()}>
          {(v) => (
            <>
              <aside class="kktv__left">
                <ul class="kktv__players">
                  <For each={entries()}>
                    {(e) => (
                      <li
                        class="kktv__p"
                        data-off={e.connected ? undefined : "1"}
                        data-ready={choosing() && v().ready.includes(e.id) ? "1" : undefined}
                      >
                        <Avatar index={e.avatar} size="56px" connected={e.connected} />
                        <span class="kktv__pname">{e.nickname}</span>
                        <span class="kktv__pstate">{statusOf(e.id)}</span>
                        <Show when={choosing() && v().ready.includes(e.id)}>
                          <span class="kktv__ok" title="Tamam">
                            ✓
                          </span>
                        </Show>
                        <span class="kktv__pts">+{v().points?.[e.id] ?? 0}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </aside>
              <div class="kktv__stage kk">
                <Switch>
                  <Match when={phase() === "choose1"}>
                    <Secim
                      v={v()}
                      stage={1}
                      who="spectator"
                      entries={entries()}
                      selfId=""
                      now={clock}
                      band={false}
                      urgent={false}
                      tv
                    />
                  </Match>
                  <Match when={phase() === "reveal1"}>
                    <KareSonuc v={v()} final={false} entries={entries()} selfId="" spectator now={clock} tv />
                  </Match>
                  <Match when={phase() === "band" || phase() === "choose2"}>
                    <Secim
                      v={v()}
                      stage={2}
                      who="spectator"
                      entries={entries()}
                      selfId=""
                      now={clock}
                      band={phase() === "band"}
                      urgent={false}
                      tv
                    />
                  </Match>
                  <Match when={phase() === "reveal2"}>
                    <KareSonuc v={v()} final={true} entries={entries()} selfId="" spectator now={clock} tv />
                  </Match>
                </Switch>
                <Show when={phase() === "band"}>
                  <div class="kband" role="status">
                    <i class="kband__sweep" aria-hidden="true" />
                    <b class="kband__title">2. AŞAMA</b>
                    <span class="kband__sub">Gizli bir ödül karesi saklandı</span>
                  </div>
                </Show>
              </div>
              <aside class="kktv__right">
                <p class="kktv__stageno">{stageNo()}. aşama</p>
                <Show when={secsLeft()} fallback={<p class="kktv__time kktv__time--dim">Açılış</p>}>
                  {(s) => <p class="kktv__time">{s()}</p>}
                </Show>
                <Show when={choosing()}>
                  <p class="kktv__ready">{readyLine(v().ready.length, crew())}</p>
                </Show>
                <Show when={stageNo() === 2}>
                  <p class="kktv__note">Gizli bir ödül karesi var</p>
                </Show>
              </aside>
            </>
          )}
        </Show>
      </div>
    </TvFit>
  );
}
