import { createMemo, For, onMount, Show } from "solid-js";
import { hapticMatch, hapticResult, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, roundResult, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { StarIcon } from "../../ui/Icons.js";
import { type CrewMember, duelCards, type LafScreenView, myPoints } from "./view.js";
import { PromptBubble } from "./Write.js";

interface Props {
  view: LafScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

/** Açılış: cevap sahipleri, oylar, puanlar ve Laf Ustası. */
export function Reveal(props: Props) {
  const reveal = () => props.view.reveal;
  const final = () => props.view.phase === "finalReveal";
  const cards = createMemo(() => duelCards(reveal()?.cards ?? []));
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const mine = () => myPoints(reveal(), props.selfId);
  const topPoints = () => Math.max(0, ...cards().map((c) => c.points));
  const iAmMaster = () => reveal()?.cards.some((c) => c.author === props.selfId && c.master) === true;

  onMount(() => {
    if (props.spectator || !reveal()) return;
    const t = setTimeout(() => {
      if (iAmMaster()) {
        roundResult();
        hapticResult();
      } else if ((mine() ?? 0) > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    }, 900);
    return () => clearTimeout(t);
  });

  const verdict = (): string => {
    if (iAmMaster()) return "Laf Ustası sensin!";
    const p = mine();
    if (p === null) return "Cevaplar açıldı";
    return p > 0 ? (final() ? "Oy topladın!" : "Oy aldın!") : "Bu sefer oy gelmedi";
  };

  return (
    <Show when={reveal()}>
      {(r) => (
        <>
          <div class="lf__head lf__head--res">
            <PromptBubble
              label={final() ? "Final sonucu" : `Soru ${(props.view.index ?? 0) + 1}/${props.view.total}`}
              prompt={r().prompt}
              final={final()}
              small
            />
            <Show when={!props.spectator && mine() !== null}>
              <div class="lf__me" data-zero={(mine() ?? 0) === 0 ? "1" : undefined}>
                <span class="lf__score">+{mine()}</span>
                <span class="lf__says">{verdict()}</span>
              </div>
            </Show>
          </div>

          <ul class="lf__res" data-scroll aria-label="Sonuçlar">
            <For each={cards()}>
              {(c, i) => {
                const author = () => member(c.author);
                const self = () => c.author === props.selfId;
                return (
                  <li
                    class="lf__rcard"
                    data-win={c.points > 0 && c.points === topPoints() ? "1" : undefined}
                    data-me={self() ? "1" : undefined}
                    data-empty={c.text === null ? "1" : undefined}
                    style={{ "--i": i(), "--ac": look(author()?.avatar ?? 0).color }}
                  >
                    <div class="lf__rtop">
                      <Show when={author()}>
                        {(a) => <Avatar index={a().avatar} size={28} connected={a().connected} />}
                      </Show>
                      <span class="lf__who">{self() ? "Sen" : (author()?.nickname ?? "?")}</span>
                      <span class="lf__pts" data-zero={c.points === 0 ? "1" : undefined}>
                        +{c.points}
                      </span>
                    </div>
                    <p class="lf__rtext">{c.text ?? "Cevap yok"}</p>
                    <Show when={c.master}>
                      <p class="lf__master">
                        <StarIcon size={16} /> Laf Ustası · +1
                      </p>
                    </Show>
                    <Show when={c.voters.length > 0}>
                      <div class="lf__voters">
                        <For each={c.voters}>
                          {(id) => {
                            const m = member(id);
                            return m ? <Avatar index={m.avatar} size={24} connected={m.connected} /> : null;
                          }}
                        </For>
                      </div>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        </>
      )}
    </Show>
  );
}
