import { APP_VERSION, normalizeNickname } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, type JSX, Match, on, Show, Switch } from "solid-js";
import { applyAudioSession, getPlayInSilent, setPlayInSilent } from "../fx/audioSession.js";
import { hapticTap } from "../fx/haptics.js";
import {
  musicVolume,
  muted,
  setMusicVolume,
  setMuted,
  setVolume,
  tap,
  unlockAudio,
  volume,
} from "../fx/sound.js";
import { changePassword, logout, resendVerification, startGoogle } from "../net/account.js";
import { passwordError } from "../net/accountRules.js";
import { readAvatarChoice } from "../net/storage.js";
import { goHome, ownName, setNickname, setState, state, toast } from "../net/store.js";
import { clearPack, downloadAll, packProgress, packRunning, storageEpoch } from "../pwa/packController.js";
import { fraction, megabytes } from "../pwa/packPolicy.js";
import { disablePush, enablePush, pushMode } from "../pwa/push.js";
import { checkForUpdate } from "../pwa/pwa.js";
import {
  colorBlind,
  dataSaver,
  haptics,
  MOTION_CHOICES,
  type MotionPref,
  motion,
  notifyOn,
  setColorBlind,
  setDataSaver,
  setHaptics,
  setMotion,
  setTelemetry,
  setTextSize,
  setWifiOnly,
  TEXT_CHOICES,
  type TextSize,
  telemetry,
  textSize,
  wifiOnly,
} from "../settings/settings.js";
import { formatMegabytes, hasAudioSession, hasVibrate } from "../settings/support.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon, BellIcon, ChevronRightIcon, InfoIcon, KeyIcon, PhoneIcon, UserIcon } from "../ui/Icons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { pageTitle, type SettingsCategory, settingsCategories, visiblePage } from "./settingsPages.js";
import { UsernameSheet } from "./UsernameSheet.js";

const CATEGORY_ICON: Record<SettingsCategory["id"], (p: { size?: number }) => JSX.Element> = {
  oyuncu: UserIcon,
  cihaz: PhoneIcon,
  bildirim: BellIcon,
  hesap: KeyIcon,
  hakkinda: InfoIcon,
};

const MOTION_LABEL: Record<MotionPref, string> = { reduce: "Açık", full: "Kapalı", auto: "Cihaza göre" };
const TEXT_LABEL: Record<TextSize, string> = { normal: "Normal", large: "Büyük" };

function Group(props: { title: string; children: JSX.Element }) {
  return (
    <section class="set__group">
      <h2 class="set__head">{props.title}</h2>
      <div class="set__card">{props.children}</div>
    </section>
  );
}

function Toggle(props: {
  label: string;
  hint?: string | undefined;
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      class="set__row set__row--btn"
      role="switch"
      aria-checked={props.on}
      disabled={props.disabled}
      onClick={() => {
        unlockAudio();
        props.onChange(!props.on);
      }}
    >
      <span class="set__text">
        <span class="set__label">{props.label}</span>
        <Show when={props.hint}>
          <span class="set__hint">{props.hint}</span>
        </Show>
      </span>
      <span class="switch" data-on={props.on && !props.disabled ? "1" : undefined} aria-hidden="true" />
    </button>
  );
}

function Slider(props: { label: string; value: number; onInput: (v: number) => void; onDone?: () => void }) {
  return (
    <label class="set__row set__row--slider">
      <span class="set__label">{props.label}</span>
      <input
        class="slider"
        type="range"
        min="0"
        max="100"
        step="5"
        value={Math.round(props.value * 100)}
        style={{ "--fill": `${Math.round(props.value * 100)}%` }}
        aria-valuetext={`yüzde ${Math.round(props.value * 100)}`}
        onInput={(e) => props.onInput(Number(e.currentTarget.value) / 100)}
        onChange={() => props.onDone?.()}
      />
    </label>
  );
}

function Choice<T extends string>(props: {
  label: string;
  choices: readonly T[];
  names: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div class="set__row set__row--col">
      <span class="set__label">{props.label}</span>
      <div class="seg set__seg" style={{ "grid-template-columns": `repeat(${props.choices.length}, 1fr)` }}>
        {props.choices.map((c) => (
          <button
            type="button"
            class="seg__opt"
            aria-pressed={props.value === c}
            data-on={props.value === c ? "1" : "0"}
            onClick={() => props.onChange(c)}
          >
            {props.names[c]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings() {
  const [silent, setSilent] = createSignal(getPlayInSilent());
  const [used, setUsed] = createSignal<number | null>(null);
  const [pwOpen, setPwOpen] = createSignal(false);
  const [pwCurrent, setPwCurrent] = createSignal("");
  const [pwNew, setPwNew] = createSignal("");
  const [pwError, setPwError] = createSignal<string | null>(null);
  const [pwBusy, setPwBusy] = createSignal(false);
  const closePw = (): void => {
    setPwOpen(false);
    setPwCurrent("");
    setPwNew("");
    setPwError(null);
  };
  const submitPw = async (): Promise<void> => {
    if (pwBusy()) return;
    const bad = pwCurrent().length === 0 ? "Mevcut şifreni yaz." : passwordError(pwNew());
    if (bad) {
      setPwError(bad);
      return;
    }
    setPwBusy(true);
    try {
      const reply = await changePassword(pwCurrent(), pwNew());
      if (!reply.ok) {
        setPwError(reply.message);
        return;
      }
      closePw();
      toast("Şifren değişti.", "success");
    } finally {
      setPwBusy(false);
    }
  };
  const [confirmClear, setConfirmClear] = createSignal(false);
  const [confirmOut, setConfirmOut] = createSignal(false);
  const [nameOpen, setNameOpen] = createSignal(false);
  const categories = createMemo(() =>
    settingsCategories({ loggedIn: state.account !== null, pushVisible: pushMode() !== "hidden" }),
  );
  const page = createMemo(() => visiblePage(state.settingsPage, categories()));
  // Ayrıntıdan ana listeye, listeden ana sayfaya.
  const back = (): void => {
    if (page() === "main") goHome();
    else setState("settingsPage", "main");
  };
  const signOut = (): void => {
    setConfirmOut(false);
    void logout().finally(() => {
      goHome();
      toast("Çıkış yaptın.");
    });
  };
  const [checking, setChecking] = createSignal(false);
  const [nick, setNick] = createSignal(state.nickname);
  const nickOk = (): boolean => normalizeNickname(nick()) !== null;
  const canStore = typeof navigator !== "undefined" && navigator.storage?.estimate !== undefined;

  const refreshUsage = (): void => {
    if (!canStore) return;
    navigator.storage
      .estimate()
      .then((e) => setUsed(e.usage ?? null))
      .catch(() => setUsed(null));
  };
  // Açılışta ve her indirme/temizlemeden sonra yeniden okunur.
  createEffect(on(storageEpoch, refreshUsage));
  const [packMsg, setPackMsg] = createSignal("");
  const [packSettled, setPackSettled] = createSignal<number | null>(null);

  const onNick = (value: string): void => {
    setNick(value);
    const clean = normalizeNickname(value);
    if (clean !== null) setNickname(clean);
  };

  const clearCache = (): void => {
    setConfirmClear(false);
    setPackMsg("");
    setPackSettled(null);
    const done = (): void => {
      toast("Önbellek temizlendi");
      refreshUsage();
    };
    if (typeof caches === "undefined") {
      done();
      return;
    }
    void clearPack().then(done);
  };

  const downloadEverything = (): void => {
    setPackMsg("");
    setPackSettled(null);
    void downloadAll().then((r) => {
      if (r === null || r.failed > 0 || r.aborted) {
        setPackMsg("İndirilemedi. Bağlantını kontrol edip tekrar dene.");
        return;
      }
      setPackSettled(r.downloaded);
      setPackMsg(r.downloaded === 0 ? "Her şey zaten indirilmiş" : "Tüm içerik indirildi");
    });
  };
  const packRatio = (): number => {
    const p = packProgress();
    return p ? fraction(p.bytes, p.totalBytes) : 0;
  };
  const packLine = (): string => {
    const p = packProgress();
    return p ? `${megabytes(p.bytes)} / ${megabytes(p.totalBytes)} MB` : "Hazırlanıyor";
  };

  const check = (): void => {
    setChecking(true);
    checkForUpdate()
      .then((r) => toast(r === "updating" ? "Yeni sürüm yükleniyor" : "Uygulama güncel"))
      .catch(() => toast("Şu an denetlenemedi"))
      .finally(() => setChecking(false));
  };

  const toggleNotify = (on: boolean): void => {
    if (!on) {
      void disablePush();
      return;
    }
    void enablePush().then((r) => {
      if (r === "denied") toast("Bildirim izni verilmedi", "error");
      else if (r === "failed") toast("Bildirimler şu an açılamadı", "error");
    });
  };

  const avatar = (): number => readAvatarChoice() ?? avatarFromName(ownName());

  return (
    <Screen class="set">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={back}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">{pageTitle(page(), categories())}</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body" data-scroll>
        <Switch>
          <Match when={page() === "main"}>
            <ul class="set__cats">
              <For each={categories()}>
                {(c) => {
                  const Icon = CATEGORY_ICON[c.id];
                  return (
                    <li>
                      <button
                        type="button"
                        class="set__cat"
                        data-cat={c.id}
                        onClick={() => setState("settingsPage", c.id)}
                      >
                        <span class="set__caticon" aria-hidden="true">
                          <Icon size={26} />
                        </span>
                        <span class="set__text">
                          <span class="set__catname">{c.title}</span>
                          <span class="set__hint">{c.summary}</span>
                        </span>
                        <ChevronRightIcon size={22} class="hub__chev" />
                      </button>
                    </li>
                  );
                }}
              </For>
            </ul>
            <Show when={state.account}>
              <div class="set__card set__logout">
                <button
                  type="button"
                  class="set__row set__row--btn set__row--danger"
                  onClick={() => setConfirmOut(true)}
                >
                  <span class="set__label">Çıkış yap</span>
                </button>
              </div>
            </Show>
          </Match>
          <Match when={page() === "oyuncu"}>
            <Group title="Oyuncu">
              <Show
                when={state.account}
                fallback={
                  <div class="set__row set__row--col">
                    <label class="set__label" for="set-nick">
                      Takma ad
                    </label>
                    <input
                      id="set-nick"
                      class="field set__field"
                      type="text"
                      maxLength={16}
                      autocomplete="off"
                      autocapitalize="words"
                      spellcheck={false}
                      enterkeyhint="done"
                      value={nick()}
                      aria-invalid={!nickOk()}
                      onInput={(e) => onNick(e.currentTarget.value)}
                      onBlur={() => setNick(state.nickname)}
                    />
                    <Show when={!nickOk()}>
                      <span class="set__hint set__hint--warn" role="status">
                        1–16 harf ya da rakam kullan
                      </span>
                    </Show>
                  </div>
                }
              >
                {(account) => (
                  <div class="set__row">
                    <span class="set__text">
                      <span class="set__label">Adın</span>
                      <span class="set__hint set__hint--wrap">
                        Oyunda kullanıcı adınla görünürsün: {account().username}
                      </span>
                    </span>
                  </div>
                )}
              </Show>
              <div class="set__row">
                <Avatar index={avatar()} size={48} />
                <span class="set__text">
                  <span class="set__label">Karakterin</span>
                  <span class="set__hint">Lobide avatarına dokunarak değiştirebilirsin</span>
                </span>
              </div>
            </Group>
          </Match>
          <Match when={page() === "cihaz"}>
            <Group title="Ses">
              <Slider
                label="Müzik"
                value={musicVolume()}
                onInput={(v) => setMusicVolume(v)}
                onDone={() => unlockAudio()}
              />
              <Slider
                label="Efektler"
                value={volume()}
                onInput={(v) => setVolume(v)}
                onDone={() => {
                  unlockAudio();
                  tap();
                }}
              />
              <Toggle
                label="Sesi kapat"
                hint="Müziği ve efektleri birlikte kapatır"
                on={muted()}
                onChange={(on) => setMuted(on)}
              />
              <Show when={hasAudioSession()}>
                <Toggle
                  label="Sessiz modda da çal"
                  hint="iPhone'un sessiz düğmesi açıkken de ses gelir"
                  on={silent()}
                  onChange={(on) => {
                    setPlayInSilent(on);
                    if (on) applyAudioSession();
                    setSilent(on);
                  }}
                />
              </Show>
            </Group>

            <Group title="Titreşim">
              <Toggle
                label="Titreşim"
                hint={hasVibrate() ? undefined : "Bu cihaz titreşimi desteklemiyor"}
                on={haptics()}
                disabled={!hasVibrate()}
                onChange={(on) => {
                  setHaptics(on);
                  if (on) hapticTap();
                }}
              />
            </Group>

            <Group title="Görünüm">
              <Choice
                label="Hareketi azalt"
                choices={MOTION_CHOICES}
                names={MOTION_LABEL}
                value={motion()}
                onChange={setMotion}
              />
              <Choice
                label="Yazı boyutu"
                choices={TEXT_CHOICES}
                names={TEXT_LABEL}
                value={textSize()}
                onChange={setTextSize}
              />
              <Toggle
                label="Renk körlüğü dostu mod"
                hint="Renklere şekil, desen ve yazı ekler"
                on={colorBlind()}
                onChange={setColorBlind}
              />
            </Group>

            <Group title="Veri">
              <Toggle
                label="Veri tasarrufu"
                hint="Arka plan ve kart görselleri indirilmez"
                on={dataSaver()}
                onChange={setDataSaver}
              />
              <Toggle
                label="Yalnız Wi-Fi'de indir"
                hint="Mobil veride içerik kendiliğinden inmez"
                on={wifiOnly()}
                onChange={setWifiOnly}
              />
              <div class="set__row set__row--action">
                <GhostButton size="small" onClick={downloadEverything} disabled={packRunning()}>
                  Tüm içeriği indir
                </GhostButton>
              </div>
              <Show when={packRunning() || packMsg() !== ""}>
                <div class="set__row" role="status" data-pack-result={packSettled() ?? undefined}>
                  <Show when={packRunning()} fallback={<span class="set__hint">{packMsg()}</span>}>
                    <span class="set__text">
                      <span class="set__label">{packLine()}</span>
                      <span class="set__meter" aria-hidden="true">
                        <span class="set__meter-fill" style={{ transform: `scaleX(${packRatio()})` }} />
                      </span>
                    </span>
                  </Show>
                </div>
              </Show>
              <Show when={canStore}>
                <div class="set__row">
                  <span class="set__label">Kullanılan yer</span>
                  <span class="set__value">{used() === null ? "—" : formatMegabytes(used() ?? 0)}</span>
                </div>
              </Show>
              <div class="set__row set__row--action">
                <GhostButton size="small" onClick={() => setConfirmClear(true)}>
                  Önbelleği temizle
                </GhostButton>
              </div>
            </Group>
          </Match>
          <Match when={page() === "bildirim"}>
            <Show when={pushMode() !== "hidden"}>
              <Group title="Bildirimler">
                <Show
                  when={pushMode() === "hint"}
                  fallback={
                    <Toggle
                      label="Bildirimler"
                      hint={
                        pushMode() === "denied"
                          ? "İzin kapalı. Tarayıcı ayarlarından açabilirsin"
                          : "Başka uygulamadayken oyun başlayınca ve sıra sana gelince haber verir"
                      }
                      on={notifyOn() && pushMode() === "toggle"}
                      disabled={pushMode() === "denied"}
                      onChange={toggleNotify}
                    />
                  }
                >
                  <div class="set__row">
                    <span class="set__text">
                      <span class="set__label">Bildirimler</span>
                      <span class="set__hint">Ana ekrana ekleyince açılabilir</span>
                    </span>
                  </div>
                </Show>
              </Group>
            </Show>
          </Match>
          <Match when={page() === "hesap"}>
            <Show when={state.account}>
              {(account) => (
                <Group title="Hesap">
                  <div class="set__row">
                    <span class="set__text">
                      <span class="set__label">Kullanıcı adı</span>
                      <span class="set__hint set__hint--wrap">{account().username}</span>
                    </span>
                  </div>
                  <div class="set__row set__row--action">
                    <GhostButton size="small" onClick={() => setNameOpen(true)}>
                      Kullanıcı adını değiştir
                    </GhostButton>
                  </div>
                  <div class="set__row">
                    <span class="set__text">
                      <span class="set__label">E-posta</span>
                      <span class="set__hint set__hint--wrap">{account().email}</span>
                    </span>
                    <Show when={state.mail.enabled}>
                      <span class="set__value">{state.mail.verified ? "Doğrulandı" : "Doğrulanmadı"}</span>
                    </Show>
                  </div>
                  <Show when={state.mail.enabled && !state.mail.verified}>
                    <div class="set__row">
                      <span class="set__text">
                        <span class="set__hint set__hint--wrap">
                          Doğrulama maili gelmediyse spam (gereksiz) klasörüne bak; "Spam değil" olarak
                          işaretle.
                        </span>
                      </span>
                    </div>
                    <div class="set__row set__row--action">
                      <GhostButton size="small" onClick={() => void resendVerification()}>
                        E-postanı doğrula — Tekrar gönder
                      </GhostButton>
                    </div>
                  </Show>
                  <Show
                    when={state.mail.hasPassword}
                    fallback={
                      <Show when={state.mail.enabled}>
                        <div class="set__row">
                          <span class="set__text">
                            <span class="set__label">Şifre yok</span>
                            <span class="set__hint set__hint--wrap">
                              Şifre belirlemek için çıkış yapıp girişte "Şifremi unuttum"u kullan.
                            </span>
                          </span>
                        </div>
                      </Show>
                    }
                  >
                    <div class="set__row set__row--action">
                      <GhostButton size="small" onClick={() => setPwOpen(true)}>
                        Şifre değiştir
                      </GhostButton>
                    </div>
                  </Show>
                  <Show when={state.google.enabled}>
                    <Show
                      when={!state.google.linked}
                      fallback={
                        <div class="set__row">
                          <span class="set__text">
                            <span class="set__label">Google hesabı bağlı</span>
                            <span class="set__hint">Google ile tek dokunuşla giriş yapabilirsin</span>
                          </span>
                        </div>
                      }
                    >
                      <div class="set__row set__row--action">
                        <GhostButton size="small" onClick={startGoogle}>
                          Google hesabını bağla
                        </GhostButton>
                      </div>
                    </Show>
                  </Show>
                </Group>
              )}
            </Show>
          </Match>
          <Match when={page() === "hakkinda"}>
            <Group title="Gizlilik">
              <Toggle
                label="Anonim performans ölçümü"
                hint="Oyunun akıcılığını iyileştirmek için kimliksiz ölçüm gönderilir"
                on={telemetry()}
                onChange={setTelemetry}
              />
            </Group>

            <Group title="Yasal">
              <a class="set__row set__row--link" href="/gizlilik.html" target="_blank" rel="noopener">
                <span class="set__label">Gizlilik Politikası</span>
                <ChevronRightIcon size={20} class="hub__chev" />
              </a>
              <a class="set__row set__row--link" href="/kosullar.html" target="_blank" rel="noopener">
                <span class="set__label">Kullanım Koşulları</span>
                <ChevronRightIcon size={20} class="hub__chev" />
              </a>
            </Group>

            <Group title="Sürüm">
              <div class="set__row">
                <span class="set__label">Sürüm</span>
                <span class="set__value">{APP_VERSION}</span>
              </div>
              <div class="set__row set__row--action">
                <GhostButton size="small" onClick={check} disabled={checking()}>
                  Güncellemeleri denetle
                </GhostButton>
              </div>
            </Group>
          </Match>
        </Switch>
      </div>

      <BottomSheet
        open={confirmClear()}
        onClose={() => setConfirmClear(false)}
        title="Önbellek temizlensin mi?"
      >
        <p class="sheet__text">
          İndirilen görseller silinir, gerektiğinde yeniden iner. Takma adın ve ayarların korunur.
        </p>
        <div class="sheet__actions">
          <PrimaryButton onClick={clearCache}>Temizle</PrimaryButton>
          <div style={{ height: "8px" }} />
          <GhostButton onClick={() => setConfirmClear(false)}>Vazgeç</GhostButton>
        </div>
      </BottomSheet>

      <BottomSheet open={pwOpen()} onClose={closePw} title="Şifre değiştir">
        <form
          class="sheet__form"
          novalidate
          onSubmit={(e) => {
            e.preventDefault();
            void submitPw();
          }}
        >
          <input
            class="field"
            type="password"
            name="current-password"
            autocomplete="current-password"
            maxLength={128}
            placeholder="Mevcut şifre"
            aria-label="Mevcut şifre"
            value={pwCurrent()}
            onInput={(e) => setPwCurrent(e.currentTarget.value)}
          />
          <input
            class="field"
            type="password"
            name="new-password"
            autocomplete="new-password"
            maxLength={128}
            enterkeyhint="go"
            placeholder="Yeni şifre (8+)"
            aria-label="Yeni şifre"
            value={pwNew()}
            onInput={(e) => setPwNew(e.currentTarget.value)}
          />
          <Show when={pwError()}>
            {(text) => (
              <p class="acct__error" role="alert">
                {text()}
              </p>
            )}
          </Show>
          <p class="sheet__text">Diğer cihazlardaki oturumların kapanır.</p>
          <div class="sheet__actions">
            <PrimaryButton type="submit" busy={pwBusy()}>
              Kaydet
            </PrimaryButton>
            <div style={{ height: "8px" }} />
            <GhostButton onClick={closePw}>Vazgeç</GhostButton>
          </div>
        </form>
      </BottomSheet>
      <BottomSheet open={confirmOut()} onClose={() => setConfirmOut(false)} title="Çıkış yapılsın mı?">
        <p class="sheet__text">Bu cihazda hesabından çıkarsın. İstediğin zaman tekrar girebilirsin.</p>
        <div class="sheet__actions">
          <PrimaryButton onClick={signOut}>Çıkış yap</PrimaryButton>
          <div style={{ height: "8px" }} />
          <GhostButton onClick={() => setConfirmOut(false)}>Vazgeç</GhostButton>
        </div>
      </BottomSheet>

      <UsernameSheet open={nameOpen()} onClose={() => setNameOpen(false)} />
    </Screen>
  );
}
