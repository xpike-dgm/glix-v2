import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { joinFriend } from "../net/client.js";
import { friendAction, friendsData, friendsLoad, loadFriends } from "../net/friends.js";
import {
  canJoinFriend,
  cleanUsername,
  EMPTY_FRIENDS,
  type Friend,
  statusShape,
  statusText,
} from "../net/friendsRules.js";
import { setProfileOf } from "../net/profile.js";
import { goHome, ownName, setState, state, toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon } from "../ui/Icons.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";

/** Durum noktası: renge ek olarak şekil (halka, daire, kare, üçgen) ve yazıyla belli edilir. */
export function StatusDot(props: { status: Friend["status"] }) {
  return (
    <span
      class="fr__dot"
      data-status={props.status}
      data-shape={statusShape(props.status)}
      aria-hidden="true"
    />
  );
}

/** Katılırken kullanılacak ad: hesapta kullanıcı adı. */
function myNickname(): string {
  return ownName() || "Oyuncu";
}

type Step = "menu" | "remove" | "block";

export function Friends() {
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [adding, setAdding] = createSignal(false);
  /** İşlemi süren satır (çift dokunmayı önler). */
  const [working, setWorking] = createSignal<string | null>(null);
  const [picked, setPicked] = createSignal<string | null>(null);
  const [step, setStep] = createSignal<Step>("menu");

  onMount(() => void loadFriends());
  // Oturum düşerse (başka sekmede çıkış) ana sayfaya dönülür.
  createEffect(() => {
    if (!state.account) goHome();
  });

  const data = () => friendsData() ?? EMPTY_FRIENDS;
  const current = (): Friend | null => data().friends.find((f) => f.username === picked()) ?? null;
  const empty = () =>
    data().friends.length === 0 &&
    data().incoming.length === 0 &&
    data().outgoing.length === 0 &&
    friendsLoad() === "ready";

  const closeSheet = (): void => void setPicked(() => null);
  const openFriend = (f: Friend): void => {
    setStep("menu");
    setPicked(f.username);
  };

  const add = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (adding()) return;
    const clean = cleanUsername(name());
    if (clean === null) {
      setError("Kullanıcı adı 3-20 karakter olmalı; yalnız harf, rakam ve alt çizgi.");
      return;
    }
    setAdding(true);
    setError(null);
    const r = await friendAction("request", clean);
    setAdding(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setName("");
    toast(r.result === "accepted" ? `Artık ${clean} ile arkadaşsınız!` : "İstek gönderildi", "success");
  };

  /** Satır işlemi: kısa süre kilitler, hata olursa metni gösterir. */
  const run = async (
    key: string,
    action: Parameters<typeof friendAction>[0],
    user: string,
  ): Promise<boolean> => {
    if (working()) return false;
    setWorking(key);
    const r = await friendAction(action, user);
    setWorking(null);
    if (!r.ok) toast(r.message, "error");
    return r.ok;
  };

  const join = (f: Friend): void => {
    closeSheet();
    joinFriend(f.username, myNickname());
  };

  const viewProfile = (f: Friend): void => {
    closeSheet();
    setProfileOf(f.username);
    setState("nav", "profile");
  };

  return (
    <Screen class="set fr">
      <header class="topbar">
        <button
          type="button"
          class="icon-btn"
          aria-label="Geri"
          onClick={() => {
            // Arkadaşlar, Profil'den açılır; geri oraya döner.
            setProfileOf(null);
            setState("nav", "profile");
          }}
        >
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Arkadaşlar</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body" data-scroll>
        <form class="fr__add rise" style={{ "--i": 0 }} onSubmit={add} novalidate>
          <input
            class="field fr__field"
            type="text"
            name="friend"
            aria-label="Arkadaşının kullanıcı adı"
            placeholder="Kullanıcı adı"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck={false}
            maxLength={21}
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value);
              setError(null);
            }}
          />
          <button type="submit" class="fr__addbtn" disabled={adding()}>
            Ekle
          </button>
        </form>
        <Show when={error()}>
          {(text) => (
            <p class="acct__error" role="alert">
              {text()}
            </p>
          )}
        </Show>

        <Show when={friendsLoad() === "error" && friendsData() === null}>
          <div class="pf__empty" role="alert">
            <Mascot pose="baglanti-koptu" size="var(--mascot-sm, 72px)" />
            <p class="pf__note">Arkadaş listesi şu an yüklenemedi.</p>
            <GhostButton onClick={() => void loadFriends()}>Tekrar dene</GhostButton>
          </div>
        </Show>

        <Show when={data().incoming.length > 0}>
          <section class="set__group">
            <h2 class="set__head">Gelen istekler</h2>
            <ul class="set__card pf__list">
              <For each={data().incoming}>
                {(r) => (
                  <li class="fr__row">
                    <Avatar index={avatarFromName(r.username)} size={36} />
                    <span class="pf__text">
                      <span class="pf__name">{r.username}</span>
                    </span>
                    <span class="fr__acts">
                      <button
                        type="button"
                        class="fr__btn fr__btn--yes"
                        disabled={working() !== null}
                        aria-label={`${r.username} isteğini kabul et`}
                        onClick={() => void run(`a:${r.username}`, "accept", r.username)}
                      >
                        Kabul
                      </button>
                      <button
                        type="button"
                        class="fr__btn"
                        disabled={working() !== null}
                        aria-label={`${r.username} isteğini reddet`}
                        onClick={() => void run(`d:${r.username}`, "decline", r.username)}
                      >
                        Reddet
                      </button>
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>

        <Show when={data().outgoing.length > 0}>
          <section class="set__group">
            <h2 class="set__head">Gönderdiğin istekler</h2>
            <ul class="set__card pf__list">
              <For each={data().outgoing}>
                {(r) => (
                  <li class="fr__row">
                    <Avatar index={avatarFromName(r.username)} size={36} />
                    <span class="pf__text">
                      <span class="pf__name">{r.username}</span>
                      <span class="pf__meta">Yanıt bekleniyor</span>
                    </span>
                    <button
                      type="button"
                      class="fr__btn"
                      disabled={working() !== null}
                      aria-label={`${r.username} isteğini iptal et`}
                      onClick={() => void run(`c:${r.username}`, "cancel", r.username)}
                    >
                      İptal
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>

        <Show when={data().friends.length > 0}>
          <section class="set__group">
            <h2 class="set__head">Arkadaşların</h2>
            <ul class="set__card pf__list">
              <For each={data().friends}>
                {(f) => (
                  <li class="fr__row fr__row--friend" data-status={f.status}>
                    <button
                      type="button"
                      class="fr__main"
                      aria-label={`${f.username}, ${statusText(f.status)}`}
                      onClick={() => openFriend(f)}
                    >
                      <Avatar index={avatarFromName(f.username)} size={36} />
                      <span class="pf__text">
                        <span class="pf__name">{f.username}</span>
                        <span class="fr__status">
                          <StatusDot status={f.status} />
                          {statusText(f.status)}
                        </span>
                      </span>
                    </button>
                    <Show when={canJoinFriend(f)}>
                      <button
                        type="button"
                        class="fr__btn fr__btn--yes"
                        aria-label={`${f.username} odasına katıl`}
                        onClick={() => join(f)}
                      >
                        Katıl
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>

        <Show when={empty()}>
          <div class="pf__empty rise" style={{ "--i": 1 }}>
            <Mascot pose="merhaba" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
            <p class="pf__note">Henüz arkadaşın yok. Yukarıya kullanıcı adını yazıp istek gönder.</p>
          </div>
        </Show>

        <Show when={data().blocked.length > 0}>
          <section class="set__group">
            <h2 class="set__head">Engellediklerin</h2>
            <ul class="set__card pf__list">
              <For each={data().blocked}>
                {(u) => (
                  <li class="fr__row">
                    <Avatar index={avatarFromName(u)} size={36} />
                    <span class="pf__text">
                      <span class="pf__name">{u}</span>
                    </span>
                    <button
                      type="button"
                      class="fr__btn"
                      disabled={working() !== null}
                      aria-label={`${u} engelini kaldır`}
                      onClick={() => void run(`u:${u}`, "unblock", u)}
                    >
                      Engeli kaldır
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
      </div>

      <BottomSheet
        open={current() !== null}
        onClose={closeSheet}
        title={
          step() === "remove"
            ? "Arkadaşlıktan çıkarılsın mı?"
            : step() === "block"
              ? "Engellensin mi?"
              : (current()?.username ?? "")
        }
      >
        <Show when={current()}>
          {(f) => (
            <>
              <Show when={step() === "menu"}>
                <p class="fr__sheetstatus">
                  <StatusDot status={f().status} />
                  {statusText(f().status)}
                </p>
                <div class="sheet__actions">
                  <Show when={canJoinFriend(f())}>
                    <PrimaryButton onClick={() => join(f())}>Lobisine katıl</PrimaryButton>
                  </Show>
                  <GhostButton size="small" onClick={() => viewProfile(f())}>
                    Profilini gör
                  </GhostButton>
                  <div class="fr__sheetrow">
                    <GhostButton size="small" variant="danger" onClick={() => setStep("remove")}>
                      Arkadaşlıktan çıkar
                    </GhostButton>
                    <GhostButton size="small" variant="danger" onClick={() => setStep("block")}>
                      Engelle
                    </GhostButton>
                  </div>
                </div>
              </Show>
              <Show when={step() === "remove"}>
                <p class="sheet__text">
                  {f().username} arkadaş listenden çıkar. İstersen sonra yeniden istek gönderebilirsin.
                </p>
                <div class="sheet__actions">
                  <PrimaryButton
                    variant="danger"
                    onClick={async () => {
                      const user = f().username;
                      closeSheet();
                      await run(`r:${user}`, "remove", user);
                    }}
                  >
                    Çıkar
                  </PrimaryButton>
                  <GhostButton size="small" onClick={closeSheet}>
                    Vazgeç
                  </GhostButton>
                </div>
              </Show>
              <Show when={step() === "block"}>
                <p class="sheet__text">
                  {f().username} arkadaşlıktan çıkar ve sana istek gönderemez ya da seni davet edemez. Engeli
                  istediğin zaman kaldırabilirsin.
                </p>
                <div class="sheet__actions">
                  <PrimaryButton
                    variant="danger"
                    onClick={async () => {
                      const user = f().username;
                      closeSheet();
                      await run(`b:${user}`, "block", user);
                    }}
                  >
                    Engelle
                  </PrimaryButton>
                  <GhostButton size="small" onClick={closeSheet}>
                    Vazgeç
                  </GhostButton>
                </div>
              </Show>
            </>
          )}
        </Show>
      </BottomSheet>
    </Screen>
  );
}
