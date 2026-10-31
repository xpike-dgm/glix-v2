import { createEffect, createSignal, For, on, Show } from "solid-js";
import { hapticError, hapticReady } from "../../fx/haptics.js";
import { fail, ready as readySound, tap, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { CheckIcon } from "../../ui/Icons.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { CrewStrip } from "./Crew.js";
import { createVoteChoice } from "./choice.js";
import { CornerTag, RingSign, Spotlights, VsBadge } from "./Stage.js";
import type { CrewMember, LafScreenView } from "./view.js";

interface Props {
  view: LafScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

/**
 * Oylama. Düelloda iki isimsiz kart karşı karşıya (üstte kırmızı köşe, altta mavi köşe, ortada VS); finalde
 * herkesin kartı. Karta dokunmak seçer (büyür, çerçevesi parlar), "BU DAHA KOMİK" onaylar; onaydan önce seçim
 * değiştirilebilir, sonra kesin. Cevap sahipleri oy vermez.
 */
export function Vote(props: Props) {
  const duel = () => props.view.duel;
  const final = () => props.view.phase === "finalVote";
  const cards = () => duel()?.cards ?? [];
  const pair = () => !final() && cards().length === 2;
  const canVote = () => !props.spectator && props.view.voters.includes(props.selfId);
  const pickable = (id: string): boolean =>
    canVote() && props.view.myCard !== id && cards().some((c) => c.id === id && c.text !== null);
  const choice = createVoteChoice({
    canPick: pickable,
    serverVote: () => props.view.myVote,
    send: async (card) => {
      unlockAudio();
      readySound();
      hapticReady();
      const ack = await sendActionAck({ kind: "vote", card });
      if (ack.ok || ack.reason === "already_voted") return true;
      fail();
      hapticError();
      return false;
    },
  });
  const [errorShown, setErrorShown] = createSignal(false);
  // Yeni soruya geçince yerel seçim sıfırlanır.
  createEffect(
    on(
      () => duel()?.id,
      () => {
        choice.reset();
        setErrorShown(false);
      },
    ),
  );

  const status = (): string => {
    if (props.spectator) return "Oylama sürüyor";
    if (props.view.myCard !== null && !canVote()) return "Bu soruda cevap yazdın · oylar bekleniyor";
    if (!canVote()) return "Oylar bekleniyor";
    if (choice.confirmed()) return "Oyun verildi · diğerleri bekleniyor";
    if (errorShown()) return "Oyun gitmedi, tekrar dene.";
    if (choice.picked() !== null) return "Emin misin? Onayla";
    return pair() ? "Hangisi daha komik? Karta dokun" : "En komik cevaba dokun";
  };
  const statusErr = () => errorShown() && !choice.confirmed();

  const confirm = async (): Promise<void> => {
    setErrorShown(false);
    const ok = await choice.confirm();
    if (!ok) setErrorShown(true);
  };

  return (
    <>
      <div class="lf__head lf__head--vote">
        <RingSign
          label={
            final() ? "Final · en komik hangisi?" : `Soru ${(props.view.index ?? 0) + 1}/${props.view.total}`
          }
          prompt={duel()?.prompt ?? ""}
          final={final()}
        />
      </div>

      <div class="lf__ring" data-pair={pair() ? "1" : undefined} data-n={cards().length}>
        <Show when={pair()}>
          <Spotlights />
        </Show>
        <ul class="lf__cards" data-scroll={pair() ? undefined : "1"} aria-label="Cevaplar">
          <For each={cards()}>
            {(c, i) => {
              const own = () => props.view.myCard === c.id;
              const picked = () => choice.picked() === c.id;
              const empty = () => c.text === null;
              const side = (): "a" | "b" => (i() % 2 === 0 ? "a" : "b");
              return (
                <li style={{ "--i": i() }} data-side={pair() ? side() : undefined}>
                  <button
                    type="button"
                    class="lf__card"
                    data-side={pair() ? side() : "f"}
                    data-picked={picked() ? "1" : undefined}
                    data-locked={picked() && choice.confirmed() ? "1" : undefined}
                    data-own={own() ? "1" : undefined}
                    data-empty={empty() ? "1" : undefined}
                    data-dim={choice.picked() !== null && !picked() ? "1" : undefined}
                    disabled={!pickable(c.id) || choice.confirmed()}
                    aria-pressed={picked()}
                    onClick={() => {
                      if (choice.picked() !== c.id) tap();
                      setErrorShown(false);
                      choice.pick(c.id);
                    }}
                  >
                    <Show when={pair()}>
                      <CornerTag side={side()} />
                    </Show>
                    <span class="lf__card-text">{c.text ?? "Cevap yok"}</span>
                    <Show when={own()}>
                      <span class="lf__card-tag">Senin cevabın</span>
                    </Show>
                    <Show when={picked() && choice.confirmed()}>
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
        <Show when={pair()}>
          <VsBadge />
        </Show>
      </div>

      <div class="lf__actions lf__actions--vote">
        <Show when={canVote() && !choice.confirmed()}>
          <PrimaryButton
            instant
            class="lf__confirm"
            disabled={choice.picked() === null || choice.busy()}
            onClick={() => void confirm()}
          >
            Bu daha komik
          </PrimaryButton>
        </Show>
        <p class="lf__status" role="status" data-err={statusErr() ? "1" : undefined}>
          {status()}
        </p>
      </div>
      <CrewStrip
        crew={props.crew}
        ready={props.view.ready}
        scores={props.view.scores}
        dim={props.crew.filter((m) => !props.view.voters.includes(m.id)).map((m) => m.id)}
        selfId={props.selfId}
        label="Oy verenler ve kahkaha puanları"
      />
    </>
  );
}
