import {
  AVATAR_COUNT,
  CONTENT_TONE_LABELS,
  CONTENT_TONES,
  type ContentTone,
  MAX_PLAYERS,
  type PlayerInfo,
  type RoomSnapshot,
} from "@glix/engine";
import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticReady, hapticTap } from "../fx/haptics.js";
import { ready as readySound, tap as tapSound } from "../fx/sound.js";
import { chooseAvatar, kick, setGames, setRandom, setTone, startMatch } from "../net/client.js";
import { inviteLink } from "../net/code.js";
import { toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { CheckIcon, ChevronIcon, MinusIcon, PlusIcon, QrIcon, ShareIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { Mascot } from "../ui/Mascot.js";
import { createOptimistic } from "../ui/optimistic.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { QrCode } from "../ui/QrCode.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { worldAllowed } from "../ui/world.js";
import { friendsHint, minPlayersNeeded, playerCounter } from "./lobbyHints.js";

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

/** Oda kodunu panoya kopyalar; pano yoksa eski yönteme, o da olmazsa kodu ekranda gösterir. */
async function copyCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    toast("Kopyalandı", "success");
    return;
  } catch {
    // pano kapalı: aşağıdaki yedek yol
  }
  try {
    const box = document.createElement("textarea");
    box.value = code;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const done = document.execCommand("copy");
    box.remove();
    if (done) {
      toast("Kopyalandı", "success");
      return;
    }
  } catch {
    // desteklenmiyor
  }
  toast(`Oda kodu: ${code}`);
}

/** Boş koltukta en çok kaç daire gösterilir; kalanı "+N yer daha" olur. */
const MAX_EMPTY_SLOTS = 3;

/** Oyun kartı görseli; yüklenemezse (ya da veri tasarrufunda) boş çerçeve kalır. */
function GameThumb(props: { id: string }) {
  const [ok, setOk] = createSignal(worldAllowed());
  return (
    <Show when={ok()}>
      <span class="gcard__art" aria-hidden="true">
        <img
          src={`/assets/cards/${props.id}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          width="800"
          height="450"
          onError={() => setOk(false)}
        />
      </span>
    </Show>
  );
}

export function Lobby(props: { snap: RoomSnapshot }) {
  const snap = () => props.snap;
  const isHost = () => snap().hostId === snap().selfId;
  let scroller: HTMLDivElement | undefined;
  const [open, setOpen] = createSignal(false);
  const [kickTarget, setKickTarget] = createSignal<PlayerInfo | null>(null);
  const [kickOpen, setKickOpen] = createSignal(false);
  const [inviteOpen, setInviteOpen] = createSignal(false);
  const [pickOpen, setPickOpen] = createSignal(false);
  const [freshIds, setFreshIds] = createSignal<ReadonlySet<string>>(new Set());

  const me = () => snap().players.find((p) => p.id === snap().selfId);
  const [myAvatar, setMyAvatar] = createOptimistic(() => me()?.avatar ?? 0, {
    // Çakışma uyarısını sunucunun hatası zaten gösterir; ayrıca ses/titreşim eklenmez.
    onReject: () => {},
  });
  const pick = (n: number): void => {
    setPickOpen(false);
    if (n === myAvatar()) return;
    tapSound();
    hapticTap();
    setMyAvatar(n, () => chooseAvatar(n));
  };
  const ownerOf = (n: number): PlayerInfo | undefined =>
    snap().players.find((p) => p.avatar === n && p.id !== snap().selfId);
  const link = () => inviteLink(location.origin, snap().code);

  // Katılma anı: yeni gelen avatar oynak girer, kısa ses + titreşim. İlk çizimde ve kendimiz için sessiz.
  let known: Set<string> | null = null;
  const freshTimers: ReturnType<typeof setTimeout>[] = [];
  onCleanup(() => {
    for (const t of freshTimers) clearTimeout(t);
  });
  createEffect(
    on(
      () => snap().players.map((p) => p.id),
      (ids) => {
        const prev = known;
        known = new Set(ids);
        if (!prev) return;
        const joined = ids.filter((id) => !prev.has(id) && id !== snap().selfId);
        if (joined.length === 0) return;
        readySound();
        hapticReady();
        setFreshIds((cur) => new Set([...cur, ...joined]));
        freshTimers.push(
          setTimeout(() => {
            setFreshIds((cur) => new Set([...cur].filter((id) => !joined.includes(id))));
          }, 900),
        );
      },
    ),
  );

  const emptyCount = () => Math.max(0, MAX_PLAYERS - snap().players.length);
  const shownEmpty = () => Math.min(MAX_EMPTY_SLOTS, emptyCount());
  const moreEmpty = () => emptyCount() - shownEmpty();
  const solo = () => snap().players.length < 2;
  const selected = () => snap().catalog.filter((g) => snap().gameIds.includes(g.id));
  const connected = () => snap().players.filter((p) => p.connected).length;
  const need = () => minPlayersNeeded(snap().catalog, sel().mode, selected());
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
  const missing = () => Math.max(0, need() - connected());
  const blocker = (): string | undefined => {
    if (sel().mode === "random") {
      if (missing() > 0) return friendsHint(missing());
      return eligible().length === 0 ? "Bu kalabalığa uygun oyun bulunamadı" : undefined;
    }
    if (selected().length === 0) return "En az bir oyun seç";
    if (missing() > 0) return friendsHint(missing());
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
    <Screen class="lobby">
      <header class="topbar">
        <LeaveButton />
        <SoundToggle />
      </header>

      <div class="lobby__head rise">
        <div class="lobby__code">
          <p class="overline">Oda kodu</p>
          <button
            type="button"
            class="roomcode"
            aria-label={`Oda kodu ${snap().code.split("").join(" ")}, kopyalamak için dokun`}
            onClick={() => void copyCode(snap().code)}
          >
            {snap().code}
          </button>
        </div>
        <Show when={solo() && me()}>
          <button
            type="button"
            class="solo__me"
            aria-label="Karakterini değiştir"
            onClick={() => setPickOpen(true)}
          >
            <Avatar index={myAvatar()} size={56} host connected />
          </button>
        </Show>
        <Show when={!solo()}>
          <div class="lobby__invite">
            <button
              type="button"
              class="share share--qr"
              aria-label="QR göster"
              onClick={() => setInviteOpen(true)}
            >
              <QrIcon size={22} />
              <span>QR göster</span>
            </button>
            <button type="button" class="share" onClick={() => void share(snap().code)}>
              <ShareIcon size={22} />
              <span>Paylaş</span>
            </button>
          </div>
        </Show>
        <p class="lobby__count">{playerCounter(snap().players.length, MAX_PLAYERS, need())}</p>
      </div>

      <div class="lobby__scroll" data-scroll ref={scroller}>
        <Show when={solo()}>
          <div class="solo rise" style={{ "--i": 2 }}>
            <Mascot pose="oda-bos" size="var(--solo-mascot, 120px)" />
            <button
              type="button"
              class="solo__qr"
              aria-label="QR kodu büyüt"
              onClick={() => setInviteOpen(true)}
            >
              <QrCode text={link()} label="Odaya katılma QR kodu" />
            </button>
            <p class="solo__text">Arkadaşların QR'ı okutunca ya da kodu girince burada belirir.</p>
            <button type="button" class="solo__call" onClick={() => void share(snap().code)}>
              <ShareIcon size={22} />
              <span>Arkadaşlarını çağır</span>
            </button>
          </div>
        </Show>

        <Show when={!solo()}>
          <div class="seats">
            <For each={snap().players}>
              {(player, i) => {
                const mine = () => player.id === snap().selfId;
                const kickable = () => isHost() && !mine();
                return (
                  <button
                    type="button"
                    class="seat rise"
                    classList={{ "seat--self": mine(), "seat--new": freshIds().has(player.id) }}
                    style={{ "--i": i() }}
                    disabled={!mine() && !kickable()}
                    aria-label={mine() ? "Karakterini değiştir" : undefined}
                    onClick={() => {
                      if (mine()) {
                        setPickOpen(true);
                        return;
                      }
                      setKickTarget(player);
                      setKickOpen(true);
                    }}
                  >
                    <Avatar
                      index={mine() ? myAvatar() : player.avatar}
                      size="var(--seat-av, clamp(52px, 17vw, 84px))"
                      host={player.id === snap().hostId}
                      connected={player.connected}
                      self={mine()}
                      pip
                    />
                    <span class="seat__name">{player.nickname}</span>
                  </button>
                );
              }}
            </For>
            <For each={Array.from({ length: shownEmpty() }, (_, n) => n)}>
              {(n) => (
                <button
                  type="button"
                  class="seat seat--empty"
                  style={{ "--i": snap().players.length + n }}
                  aria-label="Arkadaş davet et"
                  onClick={() => setInviteOpen(true)}
                >
                  <div class="seat__empty">
                    <PlusIcon size="34%" />
                  </div>
                  <span class="seat__name seat__name--empty">&nbsp;</span>
                </button>
              )}
            </For>
          </div>
          <Show when={moreEmpty() > 0}>
            <p class="seats__more">+{moreEmpty()} yer daha</p>
          </Show>
        </Show>

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
                        <GameThumb id={g.id} />
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

      <BottomSheet open={inviteOpen()} onClose={() => setInviteOpen(false)} title="Arkadaşlarını çağır">
        <div class="invite">
          <div class="invite__qr">
            <QrCode text={link()} label="Odaya katılma QR kodu" />
          </div>
          <div class="invite__side">
            <p class="sheet__text">Kameranı QR'a tut ya da kodu gir:</p>
            <button type="button" class="roomcode roomcode--sheet" onClick={() => void copyCode(snap().code)}>
              {snap().code}
            </button>
            <PrimaryButton onClick={() => void share(snap().code)}>Paylaş</PrimaryButton>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={pickOpen()} onClose={() => setPickOpen(false)} title="Karakterini seç">
        <div class="picker">
          <For each={Array.from({ length: AVATAR_COUNT }, (_, n) => n)}>
            {(n) => {
              const owner = () => ownerOf(n);
              const chosen = () => myAvatar() === n;
              return (
                <button
                  type="button"
                  class="picker__opt"
                  classList={{ "picker__opt--taken": owner() !== undefined, "picker__opt--on": chosen() }}
                  aria-pressed={chosen()}
                  aria-disabled={owner() !== undefined}
                  onClick={() => {
                    const o = owner();
                    if (o) toast(`Bu karakteri ${o.nickname} aldı`);
                    else pick(n);
                  }}
                >
                  <Avatar index={n} size="var(--pick-av, 60px)" />
                  <span class="picker__name">{owner()?.nickname ?? (chosen() ? "Sen" : "Boş")}</span>
                </button>
              );
            }}
          </For>
        </div>
      </BottomSheet>

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
