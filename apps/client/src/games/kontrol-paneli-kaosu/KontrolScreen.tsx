import { createEffect, createMemo, Match, on, Show, Switch } from "solid-js";
import type { GameScreenProps } from "../registry.js";
import { Ara } from "./Ara.js";
import { Bomb } from "./Bomb.js";
import { waveAlarm } from "./bombSounds.js";
import { Oyun } from "./Oyun.js";
import { Sonuc } from "./Sonuc.js";
import { parseKontrolView } from "./view.js";
import "./kontrol.css";

export interface Crew {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

/**
 * Kontrol Paneli Kaosu: üstte ortak bomba saati; altta dalga sürerken kendi panelin ve ipucu notun, dalgalar arasında
 * kısa sonuç, sonda üç dalganın açılışı. İzleyici ve TV paneli ya da ipucunu görmez; büyük saat, dalga ve kimin
 * kestiğini görür.
 */
export default function KontrolScreen(props: GameScreenProps) {
  const view = createMemo(() => parseKontrolView(props.match.publicView, props.match.view));
  const crew = createMemo<Crew[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [{ id, nickname: p.nickname, avatar: p.avatar, connected: p.connected }] : [];
    }),
  );
  const spectator = () => props.spectator === true;
  // Dalga anahtarı: yeni dalgada seçim ve iyimser kesim sıfırdan başlar.
  const playKey = createMemo(() => {
    const v = view();
    return v && v.stage === "play" ? `w${v.wave}` : null;
  });
  // Yeni dalga başlarken alarm (ilk dalga geri sayımın "başla" sesiyle açılır).
  createEffect(
    on(playKey, (key, prev) => {
      if (key && prev !== undefined && key !== prev && key !== "w0") waveAlarm();
    }),
  );
  const lastResult = () => {
    const v = view();
    return v ? v.results[v.results.length - 1] : undefined;
  };
  return (
    <section class="screen game kp" data-spectator={spectator() ? "1" : undefined}>
      <div class="col">
        <Show when={view()}>
          {(v) => (
            <>
              <Bomb view={v()} crew={crew()} now={props.now} big={spectator()} />
              <Switch>
                <Match when={playKey()} keyed>
                  {(_wave) => <Oyun view={v()} total={crew().length} spectator={spectator()} />}
                </Match>
                <Match when={v().stage === "break" && lastResult()}>
                  {(r) => (
                    <Ara
                      result={r()}
                      crew={crew()}
                      selfId={props.selfId}
                      spectator={spectator()}
                      next={v().wave + 2}
                      sound
                    />
                  )}
                </Match>
                <Match when={v().reveal}>
                  {(rev) => (
                    <Sonuc
                      reveal={rev()}
                      results={v().results}
                      crew={crew()}
                      selfId={props.selfId}
                      spectator={spectator()}
                      comment={props.match.comment ?? null}
                      sound
                    />
                  )}
                </Match>
              </Switch>
            </>
          )}
        </Show>
      </div>
    </section>
  );
}
