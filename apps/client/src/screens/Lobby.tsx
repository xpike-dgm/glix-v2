import {
  AVATAR_COUNT,
  allReady,
  LOBBY_EMOJIS,
  MAX_NICKNAME_LENGTH,
  MAX_PLAYERS,
  normalizeNickname,
  type PlayerInfo,
  REACTION_MIN_GAP_MS,
  type ReactionId,
  type RoomSnapshot,
} from "@glix/engine";
import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticReady, hapticTap } from "../fx/haptics.js";
import { ready as readySound, tap as tapSound } from "../fx/sound.js";
import { chooseAvatar, renameSelf, sendReaction, setLobbyReady, startMatch } from "../net/client.js";
import { inviteLink } from "../net/code.js";
import { setNickname, state, toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { frameOf, PlayerName, PlayerTitle } from "../ui/Cosmetic.js";
import { EmojiFan } from "../ui/EmojiFan.js";
import { ChevronRightIcon, GearIcon, PlusIcon, QrIcon, ShareIcon, UsersIcon } from "../ui/Icons.js";
import { LeaveButton } from "../ui/LeaveButton.js";
import { createLongPress } from "../ui/longPress.js";
import { Mascot } from "../ui/Mascot.js";
import { createOptimistic } from "../ui/optimistic.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { QrCode } from "../ui/QrCode.js";
import { ReactionLayer } from "../ui/ReactionLayer.js";
import { Screen } from "../ui/Screen.js";
import { SiteBanner } from "../ui/SiteBanner.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { WorldBackdrop } from "../ui/WorldBackdrop.js";
import { FriendInviteSheet } from "./FriendInviteSheet.js";
import { GameThumb, LobbySettings } from "./LobbySettings.js";
import {
  cardsActive,
  emptySeats,
  friendsHint,
  inRandomPool,
  minPlayersNeeded,
  playerCounter,
  poolSizeOf,
  randomCountOf,
  settingsLine,
} from "./lobbyHints.js";
import { PlayerMenu } from "./PlayerMenu.js";

/** Giriş efektinin koltukta kalma süresi (ms); CSS animasyonu bundan kısadır. */
const ENTRY_FX_MS = 1300;

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

/** "Seçilen oyunlar" şeridi (yalnız "Ben seçeyim" kipinde): seçilen oyunların küçük kartları; herkes görür. */
function ChosenStrip(props: { ids: string[]; names: string[]; crowded: boolean }) {
  return (
    <Show when={props.ids.length > 0}>
      <section
        class="tonight"
        data-crowded={props.crowded ? "1" : undefined}
        aria-label={`Seçilen oyunlar: ${props.ids.length}`}
      >
        <span class="tonight__label">Seçilen oyunlar: {props.ids.length}</span>
        <ul class="tonight__strip" data-scroll>
          <For each={props.ids}>
            {(id, i) => (
              <li class="tonight__card" title={props.names[i()]}>
                <GameThumb id={id} eager />
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}

export function Lobby(props: { snap: RoomSnapshot }) {
  const snap = () => props.snap;
  const isHost = () => snap().hostId === snap().selfId;
  // Oyuncu menüsü: dokunulan oyuncu.
  const [menuTarget, setMenuTarget] = createSignal<PlayerInfo | null>(null);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [inviteOpen, setInviteOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
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

  // Giriş efekti (mağaza): lobiye ilk görünen oyuncunun koltuğunda ~1 sn oynar; herkes görür. Açılışta yalnız
  // kendimiz (lobiye yeni girdik), sonradan gelenler için hepsi. Efekti olmayan oyuncu için bir şey çizilmez.
  const [entryIds, setEntryIds] = createSignal<ReadonlySet<string>>(new Set());
  let entrySeen: Set<string> | null = null;
  const entryTimers: ReturnType<typeof setTimeout>[] = [];
  onCleanup(() => {
    for (const t of entryTimers) clearTimeout(t);
  });
  createEffect(
    on(
      () => snap().players.map((p) => p.id),
      (ids) => {
        const first = entrySeen === null;
        const seen: Set<string> = entrySeen ?? new Set();
        const arrived = ids.filter((id) => !seen.has(id) && (!first || id === snap().selfId));
        entrySeen = new Set(ids);
        const fx = arrived.filter((id) => snap().players.find((p) => p.id === id)?.cosmetics?.entry);
        if (fx.length === 0) return;
        setEntryIds((cur) => new Set([...cur, ...fx]));
        entryTimers.push(
          setTimeout(() => {
            setEntryIds((cur) => new Set([...cur].filter((id) => !fx.includes(id))));
          }, ENTRY_FX_MS),
        );
      },
    ),
  );

  const empty = () => emptySeats(snap().players.length, MAX_PLAYERS);
  const solo = () => snap().players.length < 2;
  const selected = () => snap().catalog.filter((g) => snap().gameIds.includes(g.id));
  const connected = () => snap().players.filter((p) => p.connected).length;
  const sel = () => snap().selection;
  const need = () => minPlayersNeeded(snap().catalog, sel().mode, selected());
  const randomCount = () => randomCountOf(sel(), poolSizeOf(snap().catalog));
  const eligible = () =>
    snap().catalog.filter((g) => g.minPlayers <= connected() && connected() <= g.maxPlayers);
  const missing = () => Math.max(0, need() - connected());
  const blocker = (): string | undefined => {
    if (sel().mode === "random") {
      if (missing() > 0) return friendsHint(missing());
      return eligible().filter(inRandomPool).length === 0 ? "Bu kalabalığa uygun oyun bulunamadı" : undefined;
    }
    if (selected().length === 0) return "En az bir oyun seçili olmalı";
    if (missing() > 0) return friendsHint(missing());
    return undefined;
  };
  const line = (): string =>
    settingsLine({
      mode: sel().mode,
      randomCount: randomCount(),
      selectedCount: selected().length,
      cardsOn: cardsActive(snap().cardSettings),
      joinPolicy: snap().joinPolicy,
    });
  // Boş koltuk yalnız çağırabilenlere (ev sahibi, hesaplı) düğmedir; misafire amaçsız düğme gösterilmez.
  const canInvite = () => isHost() || state.account !== null;

  // "Hazırım" ve emoji.
  const isReady = (): boolean => snap().lobbyReady.includes(snap().selfId);
  const everyoneReady = (): boolean => allReady(snap());
  let lastReact = Number.NEGATIVE_INFINITY;
  const react = (emoji: ReactionId): void => {
    const now = Date.now();
    if (now - lastReact < REACTION_MIN_GAP_MS) return;
    lastReact = now;
    sendReaction(emoji);
  };

  const openMenu = (player: PlayerInfo): void => {
    hapticTap();
    setMenuTarget(player);
    setMenuOpen(true);
  };

  return (
    <>
      <WorldBackdrop gameId="lobi" />
      <Show when={settingsOpen()}>
        <LobbySettings snap={snap()} host={isHost()} onBack={() => setSettingsOpen(false)} />
      </Show>
      <Show when={!settingsOpen()}>
        <Screen class="lobby">
          <header class="topbar">
            <LeaveButton />
            <SoundToggle />
          </header>

          <div class="lobby__head rise" classList={{ "lobby__head--3": !!state.account && !solo() }}>
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
                <Avatar
                  index={myAvatar()}
                  size={56}
                  host
                  hostMark="house"
                  connected
                  live="breathe"
                  frame={frameOf(me()?.cosmetics)}
                />
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
                  <span>QR</span>
                </button>
                <button
                  type="button"
                  class="share"
                  aria-label="Bağlantıyı paylaş"
                  onClick={() => void share(snap().code)}
                >
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

          <div class="lobby__scroll" data-scroll>
            <SiteBanner compact />
            <Show when={solo()}>
              <div class="solo rise" style={{ "--i": 2 }}>
                <button
                  type="button"
                  class="solo__qr"
                  aria-label="QR kodu büyüt"
                  onClick={() => setInviteOpen(true)}
                >
                  <QrCode text={link()} label="Odaya katılma QR kodu" />
                </button>
                <div class="solo__side">
                  <Mascot pose="oda-bos" size="var(--solo-mascot, 56px)" class="solo__mascot" />
                  <p class="solo__text">Arkadaşların QR'ı okutunca ya da kodu girince burada belirir.</p>
                </div>
              </div>
              <div class="solo__actions rise" style={{ "--i": 3 }}>
                <button type="button" class="solo__call" onClick={() => void share(snap().code)}>
                  <ShareIcon size={24} />
                  <span>Bağlantıyı paylaş</span>
                </button>
                <Show when={state.account}>
                  <button type="button" class="solo__call" onClick={() => setFriendOpen(true)}>
                    <UsersIcon size={24} />
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
                    // Başkasına dokunmak (ev sahibi için basılı tutmak da) oyuncu menüsünü açar.
                    const press = createLongPress(
                      () => {
                        if (!mine()) openMenu(player);
                      },
                      () => {
                        if (mine()) setPickOpen(true);
                        else openMenu(player);
                      },
                    );
                    return (
                      <button
                        type="button"
                        class="seat rise"
                        classList={{ "seat--self": mine(), "seat--new": freshIds().has(player.id) }}
                        style={{ "--i": i() }}
                        data-pid={player.id}
                        aria-label={mine() ? "Karakterini değiştir" : `${player.nickname}: seçenekler`}
                        onPointerDown={(e) => !mine() && press.onPointerDown(e)}
                        onPointerMove={(e) => press.onPointerMove(e)}
                        onPointerUp={() => press.onPointerEnd()}
                        onPointerCancel={() => press.onPointerEnd()}
                        onPointerLeave={() => press.onPointerEnd()}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={(e) => press.onClick(e.detail === 0)}
                      >
                        {/* Karakter simgesi (ok, kalp…) lobide gösterilmez: anlamı yok, renk yeter. Renk körü kipinde Avatar yine ekler. */}
                        <Avatar
                          index={mine() ? myAvatar() : player.avatar}
                          size="var(--seat-av, clamp(52px, 17vw, 84px))"
                          host={player.id === snap().hostId}
                          hostMark="house"
                          ready={snap().lobbyReady.includes(player.id)}
                          connected={player.connected}
                          self={mine()}
                          live="breathe"
                          frame={frameOf(player.cosmetics)}
                          entry={entryIds().has(player.id) ? player.cosmetics?.entry : undefined}
                        />
                        <span class="seat__name">
                          <PlayerName name={player.nickname} cosmetics={player.cosmetics} />
                        </span>
                        <PlayerTitle cosmetics={player.cosmetics} class="seat__title" />
                      </button>
                    );
                  }}
                </For>
                <For each={Array.from({ length: empty().shown }, (_, n) => n)}>
                  {(n) => (
                    <Show
                      when={canInvite()}
                      fallback={
                        <div class="seat seat--empty seat--still" aria-hidden="true">
                          <div class="seat__empty" />
                          <span class="seat__name seat__name--empty">&nbsp;</span>
                        </div>
                      }
                    >
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
                    </Show>
                  )}
                </For>
              </div>
              <Show when={empty().more > 0}>
                <p class="seats__more">+{empty().more} yer daha</p>
              </Show>
            </Show>

            <button type="button" class="lrow" onClick={() => setSettingsOpen(true)}>
              <GearIcon size={24} class="lrow__icon" />
              <span class="lrow__text">
                <b>Lobi ayarları</b>
                <span class="lrow__line">
                  <For each={line().split(" · ")}>{(part) => <span class="lrow__seg">{part}</span>}</For>
                </span>
              </span>
              <ChevronRightIcon size={20} class="lrow__chev" />
            </button>
            <Show when={sel().mode === "manual"}>
              <ChosenStrip
                ids={selected().map((g) => g.id)}
                names={selected().map((g) => g.name)}
                crowded={snap().players.length > 4}
              />
            </Show>
          </div>

          <footer class="lobby__foot">
            <div class="lobby__main">
              <Show
                when={isHost()}
                fallback={
                  <PrimaryButton
                    variant={isReady() ? "done" : "cyan"}
                    onClick={() => setLobbyReady(!isReady())}
                  >
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
            </div>
            <Show when={!solo()}>
              <EmojiFan emojis={LOBBY_EMOJIS} onPick={react} />
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

          <PlayerMenu
            open={menuOpen()}
            onClose={() => setMenuOpen(false)}
            target={menuTarget()}
            host={isHost()}
            targetIsHost={menuTarget()?.id === snap().hostId}
          />

          <ReactionLayer />
        </Screen>
      </Show>
    </>
  );
}
