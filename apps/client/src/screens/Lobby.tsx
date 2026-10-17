import { MAX_PLAYERS, type PlayerInfo, type RoomSnapshot } from "@glix/engine";
import { createMemo, createSignal, For, Show } from "solid-js";
import { kick, setGames, startMatch } from "../net/client.js";
import { inviteLink } from "../net/code.js";
import { toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { CheckIcon, ChevronIcon, PlusIcon, ShareIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";

async function share(code: string): Promise<void> {
  const url = inviteLink(location.origin, code);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "GLIX", text: `GLIX'te oyna! Oda kodu: ${code}`, url });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Bağlantı kopyalandı", "success");
  } catch {
    toast(`Arkadaşlarına kodu söyle: ${code}`);
  }
}

export function Lobby(props: { snap: RoomSnapshot }) {
  const snap = () => props.snap;
  const isHost = () => snap().hostId === snap().selfId;
  let scroller: HTMLDivElement | undefined;
  const [open, setOpen] = createSignal(false);
  const [kickTarget, setKickTarget] = createSignal<PlayerInfo | null>(null);
  const [kickOpen, setKickOpen] = createSignal(false);

  const seats = createMemo(() => {
    const list: (PlayerInfo | null)[] = [...snap().players];
    while (list.length < MAX_PLAYERS) list.push(null);
    return list;
  });
  const selected = () => snap().catalog.filter((g) => snap().gameIds.includes(g.id));
  const connected = () => snap().players.filter((p) => p.connected).length;
  const need = () => selected().reduce((m, g) => Math.max(m, g.minPlayers), 2);
  const blocker = (): string | undefined => {
    if (selected().length === 0) return "En az bir oyun seç";
    if (connected() < need()) return `En az ${need()} oyuncu gerekli`;
    return undefined;
  };

  const toggleGame = (id: string): void => {
    if (!isHost()) return;
    const ids = snap().gameIds;
    if (ids.includes(id)) {
      if (ids.length === 1) {
        toast("En az bir oyun seçili olmalı");
        return;
      }
      setGames(ids.filter((x) => x !== id));
    } else {
      setGames([...ids, id]);
    }
  };

  return (
    <Screen>
      <header class="topbar">
        <LeaveButton />
        <SoundToggle />
      </header>

      <div class="lobby__head rise">
        <div>
          <p class="overline">Oda kodu</p>
          <p class="roomcode">{snap().code}</p>
        </div>
        <button type="button" class="share" onClick={() => void share(snap().code)}>
          <ShareIcon size={22} />
          <span>Paylaş</span>
        </button>
      </div>

      <div class="lobby__scroll" data-scroll ref={scroller}>
        <div class="seats">
          <For each={seats()}>
            {(p, i) => (
              <Show
                when={p}
                fallback={
                  <div class="seat seat--empty" style={{ "--i": i() }}>
                    <div class="seat__empty">
                      <PlusIcon size="34%" />
                    </div>
                    <span class="seat__name seat__name--empty">&nbsp;</span>
                  </div>
                }
              >
                {(player) => {
                  const mine = () => player().id === snap().selfId;
                  const kickable = () => isHost() && !mine();
                  return (
                    <button
                      type="button"
                      class="seat rise"
                      style={{ "--i": i() }}
                      disabled={!kickable()}
                      onClick={() => {
                        setKickTarget(player());
                        setKickOpen(true);
                      }}
                    >
                      <Avatar
                        index={player().avatar}
                        size="var(--seat-av, clamp(64px, 19vw, 88px))"
                        host={player().id === snap().hostId}
                        connected={player().connected}
                        self={mine()}
                        pip
                      />
                      <span class="seat__name">{player().nickname}</span>
                    </button>
                  );
                }}
              </Show>
            )}
          </For>
        </div>

        <section class="games" data-open={open() ? "1" : undefined}>
          <button
            type="button"
            class="games__head"
            aria-expanded={open()}
            onClick={() => {
              const next = !open();
              setOpen(next);
              if (next)
                setTimeout(() => scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" }), 120);
            }}
          >
            <span class="games__title">Minigame Seçimi</span>
            <span class="games__count">{selected().length} oyun</span>
            <ChevronIcon size={22} class="games__chev" />
          </button>
          <div class="games__panel">
            <div class="games__inner">
              <For each={snap().catalog}>
                {(g) => {
                  const on = () => snap().gameIds.includes(g.id);
                  return (
                    <button
                      type="button"
                      class="gcard"
                      data-on={on() ? "1" : undefined}
                      disabled={!isHost()}
                      aria-pressed={on()}
                      onClick={() => toggleGame(g.id)}
                    >
                      <span class="gcard__text">
                        <span class="gcard__name">{g.name}</span>
                        <span class="gcard__tag">
                          {g.minPlayers}–{g.maxPlayers} oyuncu
                        </span>
                      </span>
                      <span class="gcard__check">
                        <Show when={on()}>
                          <CheckIcon size={16} />
                        </Show>
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </section>
      </div>

      <footer class="lobby__foot">
        <Show
          when={isHost()}
          fallback={
            <p class="waiting">
              <span class="waiting__dots" aria-hidden="true" />
              Oyunu host başlatacak
            </p>
          }
        >
          <PrimaryButton disabled={blocker() !== undefined} reason={blocker()} onClick={() => startMatch()}>
            Başlat
          </PrimaryButton>
        </Show>
      </footer>

      <BottomSheet
        open={kickOpen()}
        onClose={() => setKickOpen(false)}
        title={`${kickTarget()?.nickname ?? ""} odadan çıkarılsın mı?`}
      >
        <div class="sheet__actions">
          <PrimaryButton
            variant="danger"
            onClick={() => {
              const t = kickTarget();
              if (t) kick(t.id);
              setKickOpen(false);
            }}
          >
            Çıkar
          </PrimaryButton>
          <GhostButton size="small" onClick={() => setKickOpen(false)}>
            Vazgeç
          </GhostButton>
        </div>
      </BottomSheet>
    </Screen>
  );
}
