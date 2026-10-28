import { CARDS, type CardId, type MatchSnapshot, type RoomSnapshot } from "@glix/engine";
import { createMemo, createSignal, For, Show } from "solid-js";
import { playCard, unplayCard } from "../net/client.js";
import { Avatar } from "./Avatar.js";
import { BottomSheet } from "./BottomSheet.js";
import { CardFace } from "./CardFace.js";
import { targetPrompt } from "./cards.js";
import { GhostButton } from "./GhostButton.js";
import { PrimaryButton } from "./PrimaryButton.js";

/**
 * Anlatım ekranındaki el çekmecesi (docs/KURALLAR.md K4): "Kart oyna" → kart seç → gerekirse hedef (oyuncu ya da oyun) seç.
 * Oynanan kart anlatım bitene dek geri alınabilir. Eli olmayan oyuncuya ve izleyiciye hiçbir şey çizilmez.
 */
export function HandTray(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const mine = () => props.match.mine ?? null;
  const [open, setOpen] = createSignal(false);
  const [chosen, setChosen] = createSignal<CardId | null>(null);
  const hand = () => mine()?.hand ?? [];
  const staged = () => mine()?.staged ?? null;
  const nick = (id: string): string => props.snap.players.find((p) => p.id === id)?.nickname ?? "";
  const gameName = (id: string): string =>
    props.match.mine?.choices.veto.concat(props.match.mine.choices.pick).find((g) => g.id === id)?.name ??
    props.snap.catalog.find((g) => g.id === id)?.name ??
    id;
  const crew = createMemo(() =>
    props.snap.players
      .filter((p) => props.match.participants.includes(p.id) && !p.spectator)
      .map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, connected: p.connected })),
  );
  const close = (): void => {
    setOpen(false);
    setChosen(null);
  };
  const play = (card: CardId, extra: { target?: string; gameId?: string } = {}): void => {
    playCard(card, extra);
    close();
  };
  const select = (card: CardId): void => {
    if (CARDS[card].target === "none") play(card);
    else setChosen(card);
  };
  const choices = () => {
    const c = chosen();
    if (!c) return [];
    return (c === "veto" ? mine()?.choices.veto : mine()?.choices.pick) ?? [];
  };
  const title = () => {
    const c = chosen();
    return c ? (targetPrompt(c) ?? "") : "Hangi kartı oynayacaksın?";
  };
  const staging = () => {
    const s = staged();
    if (!s) return "";
    const name = CARDS[s.cardId].name;
    if (s.target) return `${name} → ${nick(s.target)}`;
    if (s.gameId) return `${name} → ${gameName(s.gameId)}`;
    return name;
  };

  return (
    <Show when={hand().length > 0 || staged()}>
      <div class="kc-tray">
        <Show
          when={staged()}
          fallback={
            <>
              <PrimaryButton class="kc-tray__btn" onClick={() => setOpen(true)}>
                Kart oyna
              </PrimaryButton>
              <span class="kc-count" role="img" aria-label={`${hand().length} kartın var`}>
                {hand().length}
              </span>
            </>
          }
        >
          <button type="button" class="kc-tray__played" onClick={() => unplayCard()}>
            <span class="overline">Oynadın · geri al</span>
            <b>{staging()}</b>
          </button>
        </Show>
      </div>
      <BottomSheet open={open()} onClose={close} title={title()}>
        <Show
          when={chosen()}
          fallback={
            <div class="kc-pick">
              <For each={hand()}>{(id) => <CardFace id={id} layout="tile" onClick={() => select(id)} />}</For>
              <div class="sheet__actions">
                <GhostButton size="small" onClick={close}>
                  Vazgeç
                </GhostButton>
              </div>
            </div>
          }
        >
          {(card) => (
            <>
              <Show when={CARDS[card()].target === "game"}>
                <Show
                  when={choices().length > 0}
                  fallback={<p class="sheet__text">Şu an seçilebilecek oyun yok.</p>}
                >
                  <ul class="kc-games">
                    <For each={choices()}>
                      {(g) => (
                        <li>
                          <button
                            type="button"
                            class="kc-games__btn"
                            onClick={() => play(card(), { gameId: g.id })}
                          >
                            {g.name}
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </Show>
              <Show when={CARDS[card()].target !== "game"}>
                <ul class="kc-games">
                  <For
                    each={crew().filter(
                      (p) => p.id !== props.snap.selfId || CARDS[card()].target === "playerOrSelf",
                    )}
                  >
                    {(p) => (
                      <li>
                        <button
                          type="button"
                          class="kc-games__btn kc-games__btn--player"
                          onClick={() => play(card(), { target: p.id })}
                        >
                          <Avatar index={p.avatar} size={36} connected={p.connected} />
                          <span>{p.id === props.snap.selfId ? `${p.nickname} (sen)` : p.nickname}</span>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <div class="sheet__actions">
                <GhostButton size="small" onClick={() => setChosen(null)}>
                  Başka kart seç
                </GhostButton>
              </div>
            </>
          )}
        </Show>
      </BottomSheet>
    </Show>
  );
}
