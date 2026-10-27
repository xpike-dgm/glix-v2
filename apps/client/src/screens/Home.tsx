import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { mountBackdrop } from "../backdrop/hero.js";
import { reducedMotion } from "../fx/motion.js";
import { logout } from "../net/account.js";
import { createRoom } from "../net/client.js";
import { incomingCount } from "../net/friends.js";
import { badgeText } from "../net/friendsRules.js";
import { setProfileOf } from "../net/profile.js";
import { setNickname, setState, state } from "../net/store.js";
import { InstallHint } from "../pwa/InstallHint.js";
import { isOfflineHome } from "../pwa/offline.js";
import { isOnline } from "../pwa/pwa.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { ChevronIcon, GearIcon } from "../ui/Icons.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { SoundToggle } from "../ui/SoundToggle.js";
import { NicknameSheet } from "./NicknameSheet.js";

/** Ana sayfadaki karakter grubu: [avatar sırası, boy]. */
const CREW: readonly (readonly [number, number])[] = [
  [7, 50],
  [1, 60],
  [0, 74],
  [3, 60],
  [5, 50],
];

type Sheet = "nick" | "how" | null;
type After = "create" | "join" | null;

export function Home() {
  let bg: HTMLDivElement | undefined;
  const [sheet, setSheet] = createSignal<Sheet>(null);
  const [after, setAfter] = createSignal<After>(null);
  const offline = createMemo(() =>
    isOfflineHome({ online: isOnline(), conn: state.conn, failedAttempts: state.failedAttempts }),
  );

  onMount(() => {
    if (!bg || reducedMotion()) return;
    let dispose: (() => void) | undefined;
    let gone = false;
    mountBackdrop(bg)
      .then((d) => {
        if (gone) {
          d();
          return;
        }
        dispose = d;
        document.documentElement.dataset.pixi = "1";
      })
      .catch(() => {
        // Pixi açılamazsa CSS zemini kalır
      });
    onCleanup(() => {
      gone = true;
      delete document.documentElement.dataset.pixi;
      dispose?.();
    });
  });

  const create = (): void => {
    if (!state.account) {
      setState("nav", "login");
      return;
    }
    if (!state.nickname) {
      setAfter("create");
      setSheet("nick");
      return;
    }
    createRoom(state.nickname);
  };
  const join = (): void => {
    if (!state.nickname) {
      setAfter("join");
      setSheet("nick");
      return;
    }
    setState("nav", "join");
  };
  const nickDone = (name: string): void => {
    setNickname(name);
    setSheet(null);
    const next = after();
    setAfter(null);
    if (next === "create") createRoom(name);
    else if (next === "join") setState("nav", "join");
  };

  return (
    <Screen class="home">
      <div class="home__bg" ref={bg} aria-hidden="true" />
      <header class="topbar">
        <Show when={state.nickname} fallback={<span />}>
          <button
            type="button"
            class="chip"
            onClick={() => {
              setAfter(null);
              setSheet("nick");
            }}
          >
            <Avatar index={avatarFromName(state.nickname)} size={32} />
            <span class="chip__name">{state.nickname}</span>
          </button>
        </Show>
        <div class="topbar__end">
          <button
            type="button"
            class="icon-btn"
            aria-label="Ayarlar"
            onClick={() => setState("nav", "settings")}
          >
            <GearIcon size={22} />
          </button>
          <SoundToggle />
        </div>
      </header>

      <div class="home__hero">
        <h1 class="wordmark" aria-label="GLIX">
          <img
            class="wordmark__img"
            src="/assets/brand/logo-512.webp"
            srcset="/assets/brand/logo-512.webp 512w, /assets/brand/logo.webp 1024w"
            sizes="(orientation: landscape) and (max-height: 520px) 300px, min(80vw, 420px)"
            width="1024"
            height="512"
            alt=""
            aria-hidden="true"
            decoding="async"
            fetchpriority="high"
          />
        </h1>
        <p class="tagline">Arkadaşlarınla telefondan parti oyunu</p>
        <div class="crew" aria-hidden="true">
          <For each={CREW}>
            {([avatar, size], i) => (
              <div class="crew__one" style={{ "--i": i() }}>
                <Avatar index={avatar} size={size} />
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="home__actions">
        <Show when={offline()} fallback={<InstallHint />}>
          <div class="offline-wrap">
            <Mascot pose="baglanti-koptu" size="var(--mascot-sm, 64px)" />
            <p class="offline" role="status">
              İnternet bağlantısı yok — bağlanınca oyuna katılabilirsin
            </p>
          </div>
        </Show>
        <Show
          when={state.account}
          fallback={
            <>
              <PrimaryButton onClick={join} busy={state.busy} disabled={offline()}>
                Kodla katıl
              </PrimaryButton>
              <div class="home__auth">
                <GhostButton size="small" onClick={() => setState("nav", "login")}>
                  Giriş yap
                </GhostButton>
                <GhostButton size="small" onClick={() => setState("nav", "register")}>
                  Kayıt ol
                </GhostButton>
              </div>
            </>
          }
        >
          {(account) => (
            <>
              <PrimaryButton onClick={create} busy={state.busy} disabled={offline()}>
                Oda kur
              </PrimaryButton>
              <GhostButton onClick={join} disabled={offline()}>
                Odaya katıl
              </GhostButton>
              <div class="home__auth">
                <button
                  type="button"
                  class="home__userbtn"
                  aria-label="Profilim"
                  onClick={() => {
                    setProfileOf(null);
                    setState("nav", "profile");
                  }}
                >
                  <span>{account().username}</span>
                  <ChevronIcon size={16} />
                </button>
                <button
                  type="button"
                  class="home__userbtn home__friends"
                  aria-label={
                    incomingCount() > 0 ? `Arkadaşlar, ${incomingCount()} yeni istek` : "Arkadaşlar"
                  }
                  onClick={() => setState("nav", "friends")}
                >
                  <span>Arkadaşlar</span>
                  <Show when={badgeText(incomingCount())}>
                    {(text) => (
                      <b class="home__badge" aria-hidden="true">
                        {text()}
                      </b>
                    )}
                  </Show>
                </button>
              </div>
              <div class="home__auth">
                <GhostButton size="small" onClick={() => setSheet("how")}>
                  Nasıl oynanır?
                </GhostButton>
                <GhostButton size="small" onClick={() => void logout()}>
                  Çıkış yap
                </GhostButton>
              </div>
            </>
          )}
        </Show>
        <Show when={!state.account}>
          <GhostButton size="small" onClick={() => setSheet("how")}>
            Nasıl oynanır?
          </GhostButton>
        </Show>
      </div>

      <NicknameSheet
        open={sheet() === "nick"}
        initial={state.nickname}
        onClose={() => setSheet(null)}
        onDone={nickDone}
      />
      <BottomSheet open={sheet() === "how"} onClose={() => setSheet(null)} title="Nasıl oynanır?">
        <ol class="how">
          <li>
            <b>1</b>
            <span>Hesabınla oda kur ve kodu arkadaşlarınla paylaş.</span>
          </li>
          <li>
            <b>2</b>
            <span>Herkes kendi telefonundan katılır. Minigameleri sen seç.</span>
          </li>
          <li>
            <b>3</b>
            <span>Her oyunda puan topla. En çok puanı alan kazanır.</span>
          </li>
        </ol>
        <PrimaryButton onClick={() => setSheet(null)}>Anladım</PrimaryButton>
      </BottomSheet>
    </Screen>
  );
}
