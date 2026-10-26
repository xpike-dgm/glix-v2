import { APP_VERSION, normalizeNickname } from "@glix/engine";
import { createSignal, type JSX, onMount, Show } from "solid-js";
import { applyAudioSession, getPlayInSilent, setPlayInSilent } from "../fx/audioSession.js";
import { hapticTap } from "../fx/haptics.js";
import { muted, setMuted, setVolume, tap, unlockAudio, volume } from "../fx/sound.js";
import { readAvatarChoice } from "../net/storage.js";
import { goHome, setNickname, state, toast } from "../net/store.js";
import { checkForUpdate } from "../pwa/pwa.js";
import {
  dataSaver,
  haptics,
  MOTION_CHOICES,
  type MotionPref,
  motion,
  setDataSaver,
  setHaptics,
  setMotion,
  setTelemetry,
  setTextSize,
  TEXT_CHOICES,
  type TextSize,
  telemetry,
  textSize,
} from "../settings/settings.js";
import { formatMegabytes, hasAudioSession, hasVibrate } from "../settings/support.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon } from "../ui/Icons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";

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
  const [confirmClear, setConfirmClear] = createSignal(false);
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
  onMount(refreshUsage);

  const onNick = (value: string): void => {
    setNick(value);
    const clean = normalizeNickname(value);
    if (clean !== null) setNickname(clean);
  };

  const clearCache = (): void => {
    setConfirmClear(false);
    const done = (): void => {
      toast("Önbellek temizlendi");
      refreshUsage();
    };
    if (typeof caches === "undefined") {
      done();
      return;
    }
    caches
      .delete("glix-art")
      .catch(() => false)
      .then(done);
  };

  const check = (): void => {
    setChecking(true);
    checkForUpdate()
      .then((r) => {
        if (r === "hazir") toast("Yeni sürüm hazır");
        else if (r === "guncel") toast("Uygulama güncel");
        else toast("Şu an denetlenemedi");
      })
      .finally(() => setChecking(false));
  };

  const avatar = (): number => readAvatarChoice() ?? avatarFromName(state.nickname);

  return (
    <Screen class="set">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={goHome}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Ayarlar</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body">
        <Group title="Ses">
          <Slider
            label="Ses düzeyi"
            value={volume()}
            onInput={(v) => setVolume(v)}
            onDone={() => {
              unlockAudio();
              tap();
            }}
          />
          <Toggle label="Sesi kapat" on={muted()} onChange={(on) => setMuted(on)} />
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
        </Group>

        <Group title="Veri">
          <Toggle
            label="Veri tasarrufu"
            hint="Arka plan ve kart görselleri indirilmez"
            on={dataSaver()}
            onChange={setDataSaver}
          />
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

        <Group title="Profil">
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
          <div class="set__row">
            <Avatar index={avatar()} size={48} />
            <span class="set__text">
              <span class="set__label">Karakterin</span>
              <span class="set__hint">Lobide avatarına dokunarak değiştirebilirsin</span>
            </span>
          </div>
        </Group>

        <Group title="Gizlilik">
          <Toggle
            label="Anonim performans ölçümü"
            hint="Oyunun akıcılığını iyileştirmek için kimliksiz ölçüm gönderilir"
            on={telemetry()}
            onChange={setTelemetry}
          />
        </Group>

        <Group title="Hakkında">
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
    </Screen>
  );
}
