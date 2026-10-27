import { createEffect, createMemo, For, on, onCleanup, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { createSequence } from "../../fx/sequence.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { type CrewMember, type RevealCard, revealCards, revealPlan, type SozlukScreenView } from "./view.js";
import { Term } from "./Write.js";

interface Props {
  view: SozlukScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

export function Sonuc(props: Props) {
  const reveal = () => props.view.reveal;
  const cards = createMemo<RevealCard[]>(() => {
    const r = reveal();
    return r ? revealCards(props.view.cards ?? [], r, props.view.players) : [];
  });
  const member = (id: string | null) => props.crew.find((m) => m.id === id);
  const mine = () => reveal()?.scores[props.selfId] ?? 0;
  const foundReal = () => {
    const r = reveal();
    return r !== null && r !== undefined && r.picks[props.selfId] === r.realCard;
  };
  const fooled = () => {
    const r = reveal();
    if (!r) return 0;
    const mineCard = Object.entries(r.authors).find(([, a]) => a === props.selfId)?.[0];
    return mineCard === undefined ? 0 : Object.values(r.picks).filter((c) => c === mineCard).length;
  };

  // Sıralı açılış: sahte tanımlar azdan çoğa, en çok kandıran en son. Süre açılış aşamasına sığar.
  const plan = createMemo(() => revealPlan(cards()));
  const seq = createSequence({
    steps: () => plan().steps,
    startAt: () => props.view.pickEndsAt,
    budgetMs: () => props.view.finishAt - props.view.pickEndsAt,
  });

  // Dizi bitince bir kez: puan aldıysan eşleşme sesi, almadıysan alçak ses.
  createEffect(
    on(seq.done, (done, was) => {
      if (!done || was || props.spectator || !reveal()) return;
      const t = setTimeout(() => {
        if (mine() > 0) {
          matchSound();
          hapticMatch();
        } else {
          soloSound();
          hapticSolo();
        }
      }, 300);
      onCleanup(() => clearTimeout(t));
    }),
  );

  return (
    <Show when={reveal()}>
      <div class="sb__head sb__head--res">
        <Term word={props.view.word} small />
        <Show when={!props.spectator} fallback={<span class="sb__verdict">Gerçek anlam açıldı</span>}>
          <div
            class="sb__me"
            data-zero={mine() === 0 ? "1" : undefined}
            data-seq={seq.attr(plan().steps - 1)}
          >
            <span class="sb__score">+{mine()}</span>
            <span class="sb__says">
              {foundReal() ? "Gerçeği buldun!" : "Gerçeği bulamadın"}
              <Show when={fooled() > 0}>
                <em>{fooled() === 1 ? "1 kişiyi kandırdın" : `${fooled()} kişiyi kandırdın`}</em>
              </Show>
            </span>
          </div>
        </Show>
      </div>

      <ul class="sbres" data-scroll aria-label="Tanımlar">
        <For each={cards()}>
          {(c, i) => {
            const author = () => member(c.author);
            const mineCard = () => c.author === props.selfId;
            return (
              <li
                class="sbres__card"
                data-real={c.real ? "1" : undefined}
                data-me={mineCard() ? "1" : undefined}
                data-seq={seq.attr(plan().step[c.id] ?? 0)}
                data-final={c.id === plan().champion ? "1" : undefined}
                style={{ "--i": i(), "--ac": look(author()?.avatar ?? 0).color }}
              >
                <div class="sbres__top">
                  <Show
                    when={c.real}
                    fallback={
                      <>
                        <Show when={author()}>
                          {(a) => <Avatar index={a().avatar} size={26} connected={a().connected} />}
                        </Show>
                        <span class="sbres__who">{mineCard() ? "Sen" : (author()?.nickname ?? "?")}</span>
                        <span class="sbres__pts" data-zero={c.pickers.length === 0 ? "1" : undefined}>
                          +{c.pickers.length}
                        </span>
                      </>
                    }
                  >
                    <span class="sbres__tag">Gerçek anlam</span>
                    <span class="sbres__found">
                      {c.pickers.length === 0 ? "Kimse bulamadı" : `${c.pickers.length} kişi buldu`}
                    </span>
                  </Show>
                </div>
                <p class="sbres__text">{c.text}</p>
                <Show when={c.pickers.length > 0}>
                  <div class="sbres__pickers">
                    <For each={c.pickers}>
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
    </Show>
  );
}
