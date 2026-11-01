import type { PlayerInfo } from "@glix/engine";
import { createMemo, For, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { TvFit } from "../../stage/TvParts.js";
import { Avatar } from "../../ui/Avatar.js";
import { worldAllowed, worldSrc } from "../../ui/world.js";
import type { GameScreenProps } from "../registry.js";
import { Dial } from "./Dial.js";
import { FinalRows, Track } from "./parts.js";
import {
  clockAt,
  formatSeconds,
  handWinners,
  NEEDLE,
  NEEDLE_TOTAL_MS,
  parseKorKronometreView,
  REDUCED_ROW_STEP_MS,
  targetSeconds,
} from "./view.js";
import "./kor-kronometre.css";

const W = 1600;
const H = 700;

/**
 * Kör Kronometre, büyük ekran (KR-U10). Sayarken: ortada dev kadran ve hedef, altta bütün oyuncular "?" rozetleriyle
 * (kimin bastığı gösterilmez — TV'yi herkes görür); arka plan kararmış, TV sessiz. El arasında "Bu el: Elif · 0,04 sn"
 * ve elin çizgisi; son açılışta TV genişliğinde ibre koşusu (büyük avatarlar), ardından toplam sıralaması. Yalnız
 * herkese açık görünüm kullanılır; dokunma, ses ve "Devam et" yoktur.
 */
export default function KorKronometreStageView(props: GameScreenProps) {
  const view = createMemo(() => parseKorKronometreView(props.match.publicView, { pressed: false }));
  const crew = () => props.players.filter((p) => props.match.participants.includes(p.id));
  const playerOf = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const clock = createMemo(() => {
    const v = view();
    return v ? clockAt(v, props.now()) : null;
  });
  const phase = () => clock()?.phase ?? "ready";
  const current = () => clock()?.current ?? null;
  const target = () => current()?.targetMs ?? 10_000;
  const elapsed = () => props.now() - (current()?.endsAt ?? props.now());
  const winner = () => {
    const r = current()?.reveal;
    const w = r ? handWinners(r) : null;
    return w
      ? `Bu el: ${w.ids.map((id) => playerOf(id)?.nickname ?? "Oyuncu").join(", ")} · ${formatSeconds(w.distance)} sn`
      : "Bu elde kimse basmadı";
  };
  const bg = worldAllowed() ? worldSrc("kor-kronometre", "landscape") : null;

  return (
    <TvFit w={W} h={H}>
      <div class="krotv" data-phase={phase()}>
        <Show when={bg}>{(src) => <img class="krotv__bg" src={src()} alt="" aria-hidden="true" />}</Show>
        <div class="krotv__scrim" aria-hidden="true" />
        <Show when={view()}>
          {(v) => (
            <>
              <div class="krotv__top">
                <span class="krotv__hand">
                  {(clock()?.hand ?? 0) + 1}. el / {v().hands}
                </span>
                <span class="krotv__target">
                  Hedef <b>{targetSeconds(target())}</b> saniye
                </span>
              </div>
              <Show when={phase() === "ready" || phase() === "count"}>
                <div class="krotv__dial">
                  <Dial
                    pulse={phase() === "count"}
                    digit={phase() === "ready" ? targetSeconds(target()) : null}
                  />
                  <Show when={phase() === "ready"}>
                    <span class="krotv__ready">Hazır ol</span>
                  </Show>
                </div>
                <ul class="krotv__crew">
                  <For each={crew()}>
                    {(p) => (
                      <li class="krotv__seat" data-off={p.connected ? undefined : "1"}>
                        <span class="krotv__av">
                          <Avatar index={p.avatar} size={96} connected={p.connected} />
                          <b class="krotv__q" aria-hidden="true">
                            ?
                          </b>
                        </span>
                        <span class="krotv__name">{p.nickname}</span>
                        <span class="krotv__pts">{v().totals[p.id] ?? 0}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <Show when={phase() === "gap"}>
                <div class="krotv__gap">
                  <p class="krotv__win">{current()?.reveal ? winner() : "Açılıyor…"}</p>
                  <Show when={current()?.reveal}>
                    {(r) => (
                      <Track
                        entries={r().entries}
                        targetMs={target()}
                        elapsed={null}
                        playerOf={playerOf}
                        selfId=""
                        avatar={84}
                        tv
                      />
                    )}
                  </Show>
                  <Show when={clock()?.next}>
                    {(nx) => <p class="krotv__next">Sıradaki hedef: {targetSeconds(nx().targetMs)} saniye</p>}
                  </Show>
                </div>
              </Show>
              <Show when={phase() === "over" && v().final}>
                {(fin) => (
                  <div class="krotv__final">
                    <Track
                      entries={current()?.reveal?.entries ?? []}
                      targetMs={target()}
                      elapsed={reducedMotion() || elapsed() > NEEDLE_TOTAL_MS ? null : elapsed()}
                      playerOf={playerOf}
                      selfId=""
                      avatar={120}
                      tv
                    />
                    <Show when={reducedMotion() || elapsed() >= NEEDLE.lineIn + NEEDLE.run}>
                      <FinalRows
                        standings={fin().standings}
                        lastEntries={current()?.reveal?.entries ?? []}
                        lastTargetMs={target()}
                        playerOf={playerOf}
                        selfId=""
                        visible={
                          reducedMotion()
                            ? Math.floor(Math.max(0, elapsed()) / REDUCED_ROW_STEP_MS) + 1
                            : null
                        }
                        tv
                      />
                    </Show>
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
