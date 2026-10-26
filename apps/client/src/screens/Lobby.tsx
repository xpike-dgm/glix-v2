import {
  CONTENT_TONE_LABELS,
  CONTENT_TONES,
  type ContentTone,
  MAX_PLAYERS,
  type PlayerInfo,
  type RoomSnapshot,
} from "@glix/engine";
import { createMemo, createSignal, For, Show } from "solid-js";
import { kick, setGames, setRandom, setTone, startMatch } from "../net/client.js";
import { inviteLink } from "../net/code.js";
import { toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { CheckIcon, ChevronIcon, MinusIcon, PlusIcon, ShareIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { Mascot } from "../ui/Mascot.js";
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
  const sel = () => snap().selection;
  const randomCount = (): number => {
    const s = sel();
    return s.mode === "random" ? Math.min(s.count, snap().catalog.length) : 0;
  };
  const eligible = () =>
    snap().catalog.filter((g) => g.minPlayers <= connected() && connected() <= g.maxPlayers);
  const lastCount = { n: 5 };
  const headCount = (): string =>
    sel().mode === "random" ? `Rastgele · ${randomCount()}` : `${selected().length} oyun`;
  const blocker = (): string | undefined => {
    if (sel().mode === "random") {
      return eligible().length === 0 ? "Bu oyuncu sayısıyla oynanabilecek oyun yok" : undefined;
    }
    if (selected().length === 0) return "En az bir oyun seç";
    if (connected() < need()) return `En az ${need()} oyuncu gerekli`;
    return undefined;
  };

  const chooseRandom = (): void => {
    if (!isHost() || sel().mode === "random") return;
    setRandom(Math.min(lastCount.n, snap().catalog.length));
  };
  const chooseManual = (): void => {
    if (!isHost() || sel().mode === "manual") return;
    lastCount.n = randomCount();
    const fit = eligible().map((g) => g.id);
    const first = snap().catalog[0]?.id;
    setGames(fit.length > 0 ? fit : first ? [first] : []);
  };
  const step = (delta: number): void => {
    if (!isHost()) return;
    const next = Math.min(snap().catalog.length, Math.max(1, randomCount() + delta));
    if (next === randomCount()) return;
    lastCount.n = next;
    setRandom(next);
  };

  const chooseTone = (tone: ContentTone): void => {
    if (!isHost() || snap().tone === tone) return;
    setTone(tone);
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
        <Show when={snap().players.length < 2}>
          <div class="alone rise" style={{ "--i": 3 }}>
            <Mascot pose="merhaba" size="var(--mascot-sm, 64px)" />
            <p class="alone__text">Arkadaşların kodu girince burada belirir.</p>
          </div>
        </Show>

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
                setTimeout(() => scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" }), 340);
            }}
          >
            <span class="games__title">Minigame Seçimi</span>
            <span class="games__count">{headCount()}</span>
            <ChevronIcon size={22} class="games__chev" />
          </button>
          <div class="games__panel">
            <div class="games__inner">
              <div class="seg">
                <button
                  type="button"
                  class="seg__opt"
                  aria-pressed={sel().mode === "random"}
                  data-on={sel().mode === "random" ? "1" : undefined}
                  disabled={!isHost()}
                  onClick={chooseRandom}
                >
                  Rastgele
                </button>
                <button
                  type="button"
                  class="seg__opt"
                  aria-pressed={sel().mode === "manual"}
                  data-on={sel().mode === "manual" ? "1" : undefined}
                  disabled={!isHost()}
                  onClick={chooseManual}
                >
                  Ben seçeyim
                </button>
              </div>
              <div class="tone">
                <span class="tone__label">Ton</span>
                <div class="seg seg--tone">
                  <For each={CONTENT_TONES}>
                    {(t) => (
                      <button
                        type="button"
                        class="seg__opt"
                        aria-pressed={snap().tone === t}
                        data-on={snap().tone === t ? "1" : undefined}
                        disabled={!isHost()}
                        onClick={() => chooseTone(t)}
                      >
                        {CONTENT_TONE_LABELS[t]}
                      </button>
                    )}
                  </For>
                </div>
              </div>
              <Show when={sel().mode === "random"}>
                <div class="rnd">
                  <div class="rnd__step">
                    <Show when={isHost()}>
                      <button
                        type="button"
                        class="rnd__btn"
                        aria-label="Oyun sayısını azalt"
                        disabled={randomCount() <= 1}
                        onClick={() => step(-1)}
                      >
                        <MinusIcon size={26} />
                      </button>
                    </Show>
                    <span class="rnd__num" aria-live="polite">
                      {randomCount()}
                    </span>
                    <Show when={isHost()}>
                      <button
                        type="button"
                        class="rnd__btn"
                        aria-label="Oyun sayısını artır"
                        disabled={randomCount() >= snap().catalog.length}
                        onClick={() => step(1)}
                      >
                        <PlusIcon size={26} />
                      </button>
                    </Show>
                  </div>
                  <p class="rnd__hint">Başlarken oyuncu sayısına uygun {randomCount()} oyun seçilir</p>
                  <Show when={eligible().length < randomCount()}>
                    <p class="rnd__hint rnd__hint--warn">
                      Şu an {eligible().length === 0 ? "uygun oyun yok" : `${eligible().length} oyun uygun`}
                    </p>
                  </Show>
                </div>
              </Show>
              <Show when={sel().mode === "manual"}>
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
              </Show>
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
