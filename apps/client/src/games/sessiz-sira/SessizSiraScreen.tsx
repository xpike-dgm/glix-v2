import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import "./sessiz-sira.css";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { beatsOf, parseSessizView, roundVerdict } from "./view.js";

function Heart(props: { off: boolean }) {
  return (
    <svg class="ssr__life" data-off={props.off ? "1" : undefined} viewBox="0 0 24 24" aria-hidden="true">
      <title>Can</title>
      <path
        d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z"
        fill={props.off ? "none" : "currentColor"}
        stroke="currentColor"
        stroke-width="2"
      />
    </svg>
  );
}

const MARK = { ok: "✓", wrong: "✕", missed: "–" } as const;
const KIND_NAME = { ok: "doğru", wrong: "hatalı", missed: "açıldı" } as const;

/** Tur numarası değişince ekran yeniden kurulur. */
export default function SessizSiraScreen(props: GameScreenProps) {
  const view = createMemo(() => parseSessizView(props.match.publicView, props.match.view));
  const byId = createMemo(() => new Map(props.players.map((p) => [p.id, p])));
  const crew = () => props.match.participants;
  const [sending, setSending] = createSignal(false);
  const nextCard = () => view()?.hand[0] ?? null;
  const canPlay = () => {
    const v = view();
    return (
      !props.spectator &&
      !!v &&
      v.phase === "play" &&
      v.hand.length > 0 &&
      !sending() &&
      props.now() < v.phaseEndsAt
    );
  };
  const play = (): void => {
    if (!canPlay()) return;
    hapticTap();
    setSending(true);
    void sendActionAck({ kind: "play" }).then(() => {
      setSending(false);
    });
  };
  const beats = () => {
    const v = view();
    return v ? beatsOf(v) : [];
  };
  const verdict = () => {
    const v = view();
    return v && v.phase === "reveal" ? roundVerdict(v) : null;
  };
  const final = () => view()?.final ?? null;
  const myFinal = () => final()?.[props.selfId] ?? 0;

  return (
    <Screen class="ssr">
      <Show when={view()}>
        {(v) => (
          <>
            <div class="ssr__stage">
              <div class="ssr__top" role="status">
                <b class="ssr__roundNo">
                  Tur {v().round}/{v().rounds}
                </b>
                <ul class="ssr__lives" aria-label={`${v().lives} can kaldı`}>
                  <For each={Array.from({ length: v().maxLives }, (_, i) => i)}>
                    {(i) => (
                      <li>
                        <Heart off={i >= v().lives} />
                      </li>
                    )}
                  </For>
                </ul>
              </div>

              <Show when={verdict()}>
                {(d) => (
                  <>
                    <div class="ssr__verdict" data-tone={d().tone}>
                      {d().text}
                    </div>
                    <Show when={final()}>
                      <p class="ssr__msg">
                        <Show when={!v().dead} fallback={<>Takım battı: bu oyundan genel skora puan yok.</>}>
                          {props.spectator ? (
                            "Takım ayakta kaldı."
                          ) : myFinal() > 0 ? (
                            <>
                              Genel skora <b>+{myFinal()}</b>
                            </>
                          ) : (
                            "Takım ayakta kaldı."
                          )}
                        </Show>
                      </p>
                    </Show>
                  </>
                )}
              </Show>

              <Show when={v().phase !== "reveal"}>
                <p class="ssr__msg">
                  {props.spectator ? (
                    "Kartlar küçükten büyüğe, konuşmadan oynanıyor"
                  ) : v().phase === "look" ? (
                    <>
                      <b>Kartlarına bak.</b> Konuşmak yok!
                    </>
                  ) : v().hand.length > 0 ? (
                    <>
                      Sırası gelince <b>OYNA</b> — en küçük kartın gider
                    </>
                  ) : (
                    "Kartların bitti, takımı izle"
                  )}
                </p>
                <Show when={!props.spectator}>
                  <div class="ssr__hand">
                    <For each={v().hand}>
                      {(card, i) => (
                        <div class="ssr__card" data-next={i() === 0 ? "1" : "0"}>
                          {card}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>

              <Show when={beats().length > 0}>
                <ul class="ssr__log" aria-label="Oynanan kartlar">
                  <For each={beats()}>
                    {(b) => (
                      <li class="ssr__beat" data-k={b.kind} aria-label={`${KIND_NAME[b.kind]} ${b.card}`}>
                        <Avatar index={byId().get(b.playerId)?.avatar ?? 0} size={22} />
                        {b.card}
                        <span class="ssr__mark" aria-hidden="true">
                          {MARK[b.kind]}
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>

              <ul class="ssr__pods" aria-label="Eldeki kartlar ve puanlar">
                <For each={crew()}>
                  {(id) => (
                    <li class="ssr__pod" data-me={id === props.selfId ? "1" : undefined}>
                      <Avatar index={byId().get(id)?.avatar ?? 0} size={22} />
                      {v().counts[id] ?? 0} kart · {v().totals[id] ?? 0}
                    </li>
                  )}
                </For>
              </ul>
            </div>
            <Show when={!props.spectator && v().phase !== "reveal"}>
              <div class="ssr__act">
                <PrimaryButton instant disabled={!canPlay()} onClick={play}>
                  {v().phase === "look" ? "Hazırlan…" : nextCard() === null ? "Kartın kalmadı" : "OYNA"}
                </PrimaryButton>
              </div>
            </Show>
          </>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}
