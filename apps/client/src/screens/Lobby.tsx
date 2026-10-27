import {
  AVATAR_COUNT,
  allReady,
  CONTENT_TONE_LABELS,
  CONTENT_TONES,
  type ContentTone,
  type JoinPolicy,
  type LobbyEmoji,
  MAX_NICKNAME_LENGTH,
  MAX_PLAYERS,
  normalizeNickname,
  type PlayerInfo,
  REACTION_MIN_GAP_MS,
  type RoomSnapshot,
} from "@glix/engine";
import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticReady, hapticTap } from "../fx/haptics.js";
import { ready as readySound, tap as tapSound } from "../fx/sound.js";
import {
  chooseAvatar,
  kick,
  renameSelf,
  sendReaction,
  setGames,
  setJoinPolicy,
  setLobbyReady,
  setRandom,
  setTone,
  startMatch,
  transferHost,
} from "../net/client.js";
import { inviteLink } from "../net/code.js";
import { setNickname, state, toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { EmojiBar } from "../ui/EmojiBar.js";
import { GhostButton } from "../ui/GhostButton.js";
import { CheckIcon, ChevronIcon, MinusIcon, PlusIcon, QrIcon, ShareIcon, UsersIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { createLongPress } from "../ui/longPress.js";
import { Mascot } from "../ui/Mascot.js";
import { createOptimistic } from "../ui/optimistic.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { QrCode } from "../ui/QrCode.js";
import { ReactionLayer } from "../ui/ReactionLayer.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { WorldBackdrop } from "../ui/WorldBackdrop.js";
import { worldAllowed } from "../ui/world.js";
import { FriendInviteSheet } from "./FriendInviteSheet.js";
import {
  friendsHint,
  gameTag,
  inRandomPool,
  isGameDim,
  minPlayersNeeded,
  playerCounter,
  selectionSummary,
} from "./lobbyHints.js";

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

const JOIN_OPTIONS: readonly { policy: JoinPolicy; label: string }[] = [
  { policy: "izleyici", label: "İzleyici" },
  { policy: "kapali", label: "Kapalı" },
];

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

/** "Bu gece" şeridi: seçilen oyunların küçük kartları (rastgele modda "?" kartları); herkes görür. */
function TonightStrip(props: {
  mode: "random" | "manual";
  count: number;
  ids: string[];
  names: string[];
  crowded: boolean;
}) {
  const n = () => (props.mode === "random" ? props.count : props.ids.length);
  return (
    <Show when={n() > 0}>
      <section
        class="tonight"
        data-crowded={props.crowded ? "1" : undefined}
        aria-label={`Bu gece: ${n()} oyun`}
      >
        <span class="tonight__label">Bu gece: {n()} oyun</span>
        <ul class="tonight__strip" data-scroll>
          <Show
            when={props.mode === "manual"}
            fallback={
              <For each={Array.from({ length: Math.min(n(), 8) }, (_, i) => i)}>
                {() => (
                  <li class="tonight__card tonight__card--rnd" aria-hidden="true">
                    ?
                  </li>
                )}
              </For>
            }
          >
            <For each={props.ids}>
              {(id, i) => (
                <li class="tonight__card" title={props.names[i()]}>
                  <GameThumb id={id} />
                </li>
              )}
            </For>
          </Show>
        </ul>
      </section>
    </Show>
  );
}

export function Lobby(props: { snap: RoomSnapshot }) {
  const snap = () => props.snap;
  const isHost = () => snap().hostId === snap().selfId;
  let scroller: HTMLDivElement | undefined;
  const [open, setOpen] = createSignal(false);
  // Ev sahibinin oyuncu menüsü: basılı tutulan oyuncu + adım (menü → onay).
  const [hostTarget, setHostTarget] = createSignal<PlayerInfo | null>(null);
  const [hostStep, setHostStep] = createSignal<"menu" | "kick" | "transfer">("menu");
  const [hostOpen, setHostOpen] = createSignal(false);
  const [inviteOpen, setInviteOpen] = createSignal(false);
  const [friendOpen, setFriendOpen] = createSignal(false);
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
  // Takma ad düzenleme (karakter penceresinde). Ad kabul edilince cihazda da saklanır; Ayarlar aynı adı kullanır.
  const [nickDraft, setNickDraft] = createSignal(me()?.nickname ?? "");
  const [pendingNick, setPendingNick] = createSignal<string | null>(null);
  const nickClean = (): string | null => normalizeNickname(nickDraft());
  const nickChanged = (): boolean => {
    const c = nickClean();
    return c !== null && c !== me()?.nickname;
  };
  createEffect(
    on(
      () => pickOpen(),
      (isOpen) => {
        if (isOpen) setNickDraft(me()?.nickname ?? "");
      },
    ),
  );
  createEffect(() => {
    const want = pendingNick();
    if (want !== null && me()?.nickname === want) {
      setNickname(want);
      setPendingNick(null);
    }
  });
  const saveNick = (e?: Event): void => {
    e?.preventDefault();
    const clean = nickClean();
    if (clean === null || !nickChanged()) return;
    tapSound();
    hapticTap();
    setPendingNick(clean);
    renameSelf(clean);
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
  // Tek bir yer artacaksa "+1 yer daha" yazmak yerine o daireyi de göster (aynı satıra sığar).
  const shownEmpty = () => (emptyCount() <= MAX_EMPTY_SLOTS + 1 ? emptyCount() : MAX_EMPTY_SLOTS);
  const moreEmpty = () => emptyCount() - shownEmpty();
  const solo = () => snap().players.length < 2;
  const selected = () => snap().catalog.filter((g) => snap().gameIds.includes(g.id));
  const connected = () => snap().players.filter((p) => p.connected).length;
  const need = () => minPlayersNeeded(snap().catalog, sel().mode, selected());
  const sel = () => snap().selection;
  /** Rastgele seçime giren oyun sayısı (elle seçilebilen ama havuz dışı oyunlar sayılmaz). */
  const poolSize = () => snap().catalog.filter(inRandomPool).length;
  const randomCount = (): number => {
    const s = sel();
    return s.mode === "random" ? Math.min(s.count, poolSize()) : 0;
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
      return eligible().filter(inRandomPool).length === 0 ? "Bu kalabalığa uygun oyun bulunamadı" : undefined;
    }
    if (selected().length === 0) return "En az bir oyun seç";
    if (missing() > 0) return friendsHint(missing());
    return undefined;
  };

  // "Hazırım" ve emoji.
  const isReady = (): boolean => snap().lobbyReady.includes(snap().selfId);
  const everyoneReady = (): boolean => allReady(snap());
  let lastReact = Number.NEGATIVE_INFINITY;
  const react = (emoji: LobbyEmoji): void => {
    const now = Date.now();
    if (now - lastReact < REACTION_MIN_GAP_MS) return;
    lastReact = now;
    sendReaction(emoji);
  };

  const openHostMenu = (player: PlayerInfo): void => {
    hapticTap();
    setHostTarget(player);
    setHostStep("menu");
    setHostOpen(true);
  };

  const chooseRandom = (): void => {
    if (!isHost() || sel().mode === "random") return;
    setRandom(Math.min(lastCount.n, poolSize()));
  };
  const chooseManual = (): void => {
    if (!isHost() || sel().mode === "manual") return;
    lastCount.n = randomCount();
    const fit = eligible()
      .filter(inRandomPool)
      .map((g) => g.id);
    const first = snap().catalog[0]?.id;
    setGames(fit.length > 0 ? fit : first ? [first] : []);
  };
  const step = (delta: number): void => {
    if (!isHost()) return;
    const next = Math.min(poolSize(), Math.max(1, randomCount() + delta));
    if (next === randomCount()) return;
    lastCount.n = next;
    setRandom(next);
  };

  const chooseTone = (tone: ContentTone): void => {
    if (!isHost() || snap().tone === tone) return;
    setTone(tone);
  };

  const choosePolicy = (policy: JoinPolicy): void => {
    if (!isHost() || snap().joinPolicy === policy) return;
    setJoinPolicy(policy);
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
    <>
      <WorldBackdrop gameId="lobi" />
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
              data-pid={snap().selfId}
              onClick={() => setPickOpen(true)}
            >
              <Avatar index={myAvatar()} size={56} host connected live="breathe" />
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
              <button type="button" class="share" aria-label="Paylaş" onClick={() => void share(snap().code)}>
                <ShareIcon size={22} />
                <span>Paylaş</span>
              </button>
              <Show when={state.account}>
                <button
                  type="button"
                  class="share"
                  aria-label="Arkadaş davet et"
                  onClick={() => setFriendOpen(true)}
                >
                  <UsersIcon size={22} />
                  <span>Arkadaş</span>
                </button>
              </Show>
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
              <Show when={state.account}>
                <button type="button" class="solo__call" onClick={() => setFriendOpen(true)}>
                  <UsersIcon size={22} />
                  <span>Arkadaş davet et</span>
                </button>
              </Show>
            </div>
          </Show>

          <Show when={!solo()}>
            <div class="seats">
              <For each={snap().players}>
                {(player, i) => {
                  const mine = () => player.id === snap().selfId;
                  const manageable = () => isHost() && !mine();
                  const press = createLongPress(
                    () => {
                      if (manageable()) openHostMenu(player);
                    },
                    () => {
                      if (mine()) setPickOpen(true);
                      else if (manageable()) toast("Basılı tutarak oyuncuyu yönetebilirsin");
                    },
                  );
                  return (
                    <button
                      type="button"
                      class="seat rise"
                      classList={{ "seat--self": mine(), "seat--new": freshIds().has(player.id) }}
                      style={{ "--i": i() }}
                      data-pid={player.id}
                      disabled={!mine() && !manageable()}
                      aria-label={
                        mine()
                          ? "Karakterini değiştir"
                          : manageable()
                            ? `${player.nickname}: yönet (basılı tut)`
                            : undefined
                      }
                      onPointerDown={(e) => manageable() && press.onPointerDown(e)}
                      onPointerMove={(e) => press.onPointerMove(e)}
                      onPointerUp={() => press.onPointerEnd()}
                      onPointerCancel={() => press.onPointerEnd()}
                      onPointerLeave={() => press.onPointerEnd()}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={(e) => press.onClick(e.detail === 0)}
                    >
                      <Avatar
                        index={mine() ? myAvatar() : player.avatar}
                        size="var(--seat-av, clamp(52px, 17vw, 84px))"
                        host={player.id === snap().hostId}
                        ready={snap().lobbyReady.includes(player.id)}
                        connected={player.connected}
                        self={mine()}
                        live="breathe"
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
                    aria-label="Kodla ya da QR ile çağır"
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

          <Show when={!isHost()}>
            <section class="games games--summary" aria-label="Oyunlar">
              <span class="games__title">Oyunlar</span>
              <span class="games__count">
                {selectionSummary(sel().mode, randomCount(), selected().length)} ·{" "}
                {CONTENT_TONE_LABELS[snap().tone]}
              </span>
            </section>
          </Show>
          <Show when={isHost()}>
            <section class="games" data-open={open() ? "1" : undefined}>
              <button
                type="button"
                class="games__head"
                aria-expanded={open()}
                onClick={() => {
                  const next = !open();
                  setOpen(next);
                  if (next)
                    setTimeout(
                      () => scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" }),
                      340,
                    );
                }}
              >
                <span class="games__title">Oyunlar</span>
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
                  <div class="joinset">
                    <span class="tone__label">Oyun sırasında katılım</span>
                    <div class="seg seg--join">
                      <For each={JOIN_OPTIONS}>
                        {(o) => (
                          <button
                            type="button"
                            class="seg__opt"
                            aria-pressed={snap().joinPolicy === o.policy}
                            data-on={snap().joinPolicy === o.policy ? "1" : undefined}
                            disabled={!isHost()}
                            onClick={() => choosePolicy(o.policy)}
                          >
                            {o.label}
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
                            disabled={randomCount() >= poolSize()}
                            onClick={() => step(1)}
                          >
                            <PlusIcon size={26} />
                          </button>
                        </Show>
                      </div>
                      <p class="rnd__hint">Başlarken oyuncu sayısına uygun {randomCount()} oyun seçilir</p>
                      <Show when={eligible().length < randomCount()}>
                        <p class="rnd__hint rnd__hint--warn">
                          Şu an{" "}
                          {eligible().length === 0 ? "uygun oyun yok" : `${eligible().length} oyun uygun`}
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
                            classList={{ "gcard--dim": isGameDim(g, connected()) }}
                            data-on={on() ? "1" : undefined}
                            disabled={!isHost()}
                            aria-pressed={on()}
                            onClick={() => toggleGame(g.id)}
                          >
                            <GameThumb id={g.id} />
                            <span class="gcard__text">
                              <span class="gcard__name">{g.name}</span>
                              <span class="gcard__tag">{gameTag(g, connected())}</span>
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
          </Show>
          <TonightStrip
            mode={sel().mode}
            count={randomCount()}
            ids={selected().map((g) => g.id)}
            names={selected().map((g) => g.name)}
            crowded={snap().players.length > 4}
          />
        </div>

        <Show when={!solo()}>
          <EmojiBar onPick={react} />
        </Show>

        <footer class="lobby__foot">
          <Show
            when={isHost()}
            fallback={
              <PrimaryButton variant={isReady() ? "done" : "cyan"} onClick={() => setLobbyReady(!isReady())}>
                {isReady() ? "Hazırsın" : "Hazırım"}
              </PrimaryButton>
            }
          >
            <PrimaryButton
              class={everyoneReady() && blocker() === undefined ? "pbtn--glow" : ""}
              disabled={blocker() !== undefined}
              reason={blocker()}
              onClick={() => startMatch()}
            >
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
              <button
                type="button"
                class="roomcode roomcode--sheet"
                onClick={() => void copyCode(snap().code)}
              >
                {snap().code}
              </button>
              <PrimaryButton onClick={() => void share(snap().code)}>Paylaş</PrimaryButton>
            </div>
          </div>
        </BottomSheet>

        <FriendInviteSheet
          open={friendOpen()}
          onClose={() => setFriendOpen(false)}
          people={snap().players.length}
        />

        <BottomSheet open={pickOpen()} onClose={() => setPickOpen(false)} title="Sen">
          <div class="pickersheet">
            {/* Hesaplıda ad kullanıcı adıdır; odada ayrı takma ad yoktur. */}
            <Show when={!state.account}>
              <form class="nickedit" onSubmit={saveNick}>
                <input
                  class="field nickedit__field"
                  type="text"
                  maxLength={MAX_NICKNAME_LENGTH}
                  placeholder="Takma ad"
                  autocomplete="off"
                  autocapitalize="words"
                  spellcheck={false}
                  enterkeyhint="done"
                  aria-label="Takma ad"
                  aria-invalid={nickDraft().length > 0 && nickClean() === null}
                  value={nickDraft()}
                  onInput={(e) => setNickDraft(e.currentTarget.value)}
                />
                <button type="submit" class="nickedit__save" disabled={!nickChanged()}>
                  Kaydet
                </button>
              </form>
            </Show>
            <div class="pickersheet__pick">
              <p class="picker__label">Karakterini seç</p>
              <div class="picker">
                <For each={Array.from({ length: AVATAR_COUNT }, (_, n) => n)}>
                  {(n) => {
                    const owner = () => ownerOf(n);
                    const chosen = () => myAvatar() === n;
                    return (
                      <button
                        type="button"
                        class="picker__opt"
                        classList={{
                          "picker__opt--taken": owner() !== undefined,
                          "picker__opt--on": chosen(),
                        }}
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
            </div>
          </div>
        </BottomSheet>

        <BottomSheet
          open={hostOpen()}
          onClose={() => setHostOpen(false)}
          title={
            hostStep() === "kick"
              ? `${hostTarget()?.nickname ?? ""} odadan çıkarılsın mı?`
              : hostStep() === "transfer"
                ? "Ev sahipliği devredilsin mi?"
                : (hostTarget()?.nickname ?? "")
          }
        >
          <Show when={hostStep() === "menu"}>
            <div class="sheet__actions">
              <PrimaryButton variant="danger" onClick={() => setHostStep("kick")}>
                Odadan çıkar
              </PrimaryButton>
              <GhostButton size="small" onClick={() => setHostStep("transfer")}>
                Ev sahipliğini devret
              </GhostButton>
              <GhostButton size="small" onClick={() => setHostOpen(false)}>
                Vazgeç
              </GhostButton>
            </div>
          </Show>
          <Show when={hostStep() === "kick"}>
            <div class="sheet__actions">
              <PrimaryButton
                variant="danger"
                onClick={() => {
                  const t = hostTarget();
                  if (t) kick(t.id);
                  setHostOpen(false);
                }}
              >
                Çıkar
              </PrimaryButton>
              <GhostButton size="small" onClick={() => setHostOpen(false)}>
                Vazgeç
              </GhostButton>
            </div>
          </Show>
          <Show when={hostStep() === "transfer"}>
            <p class="sheet__text">Yeni ev sahibi {hostTarget()?.nickname ?? ""} olur; oyunu o başlatır.</p>
            <div class="sheet__actions">
              <PrimaryButton
                onClick={() => {
                  const t = hostTarget();
                  if (t) transferHost(t.id);
                  setHostOpen(false);
                }}
              >
                Devret
              </PrimaryButton>
              <GhostButton size="small" onClick={() => setHostOpen(false)}>
                Vazgeç
              </GhostButton>
            </div>
          </Show>
        </BottomSheet>

        <ReactionLayer />
      </Screen>
    </>
  );
}
