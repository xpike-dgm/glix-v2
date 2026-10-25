import { createEffect, createSignal, For, Show } from "solid-js";
import { hapticError, hapticReady } from "../../fx/haptics.js";
import { fail, ready as readySound, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { CheckIcon } from "../../ui/Icons.js";
import { CrewStrip } from "./Crew.js";
import type { CrewMember, LafScreenView } from "./view.js";
import { PromptBubble } from "./Write.js";

interface Props {
  view: LafScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

/** Oylama: isimsiz kartlar; dokununca oy verilir (tek seferlik). Cevap sahipleri oy vermez. */
export function Vote(props: Props) {
  const duel = () => props.view.duel;
  const final = () => props.view.phase === "finalVote";
  const cards = () => duel()?.cards ?? [];
  const canVote = () => !props.spectator && props.view.voters.includes(props.selfId);
  const [sent, setSent] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  // Yeni soruya geçince yerel işaret sıfırlanır.
  createEffect(() => {
    void duel()?.id;
    setSent(null);
    setError("");
  });
  const chosen = () => props.view.myVote ?? sent();
  const closed = () => !canVote() || chosen() !== null;

  const vote = async (card: string): Promise<void> => {
    if (closed() || busy()) return;
    unlockAudio();
    setBusy(true);
    setSent(card);
    const ack = await sendActionAck({ kind: "vote", card });
    setBusy(false);
    if (ack.ok || ack.reason === "already_voted") {
      readySound();
      hapticReady();
    } else {
      setSent(null);
      setError("Oyun gitmedi, tekrar dene.");
      fail();
      hapticError();
    }
  };

  const status = (): string => {
    if (props.spectator) return "Oylama sürüyor";
    if (props.view.myCard !== null && !canVote()) return "Bu soruda cevap yazdın · oylar bekleniyor";
    if (!canVote()) return "Oylar bekleniyor";
    if (chosen() !== null) return "Oyun verildi · diğerleri bekleniyor";
    return final() ? "En komik cevaba dokun" : "Hangisi daha komik?";
  };

  return (
    <>
      <div class="lf__head lf__head--vote">
        <PromptBubble
          label={
            final() ? "Final · en komik hangisi?" : `Soru ${(props.view.index ?? 0) + 1}/${props.view.total}`
          }
          prompt={duel()?.prompt ?? ""}
          final={final()}
          small
        />
      </div>

      <ul class="lf__cards" data-scroll data-n={cards().length} aria-label="Cevaplar">
        <For each={cards()}>
          {(c, i) => {
            const own = () => props.view.myCard === c.id;
            const picked = () => chosen() === c.id;
            const empty = () => c.text === null;
            return (
              <li style={{ "--i": i() }}>
                <button
                  type="button"
                  class="lf__card"
                  data-side={i() % 2 === 0 ? "a" : "b"}
                  data-picked={picked() ? "1" : undefined}
                  data-own={own() ? "1" : undefined}
                  data-empty={empty() ? "1" : undefined}
                  data-dim={chosen() !== null && !picked() ? "1" : undefined}
                  disabled={closed() || own() || empty()}
                  aria-pressed={picked()}
                  onClick={() => void vote(c.id)}
                >
                  <span class="lf__card-text">{c.text ?? "Cevap yok"}</span>
                  <Show when={own()}>
                    <span class="lf__card-tag">Senin cevabın</span>
                  </Show>
                  <Show when={picked()}>
                    <span class="lf__card-tick" aria-hidden="true">
                      <CheckIcon size="70%" />
                    </span>
                  </Show>
                </button>
              </li>
            );
          }}
        </For>
      </ul>

      <p class="lf__status" role="status" data-err={error() !== "" ? "1" : undefined}>
        {error() !== "" ? error() : status()}
      </p>
      <CrewStrip crew={props.crew} ready={props.view.ready} only={props.view.voters} label="Oy verenler" />
    </>
  );
}
