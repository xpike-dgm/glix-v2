import type { KontrolPublicView } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { propSrc } from "../../ui/props.js";
import { bombPulseHaptic, bombTick, bzzzt } from "./bombSounds.js";
import type { Crew } from "./KontrolScreen.js";
import { clockDigits, remainingMs, waveName } from "./view.js";

/** 7 segment: a üst, b sağ üst, c sağ alt, d alt, e sol alt, f sol üst, g orta. */
const SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"] as const;
const DIGIT_SEGS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};
/** Son bu kadar sürede saat kırmızı nabız atar, tik hızlanır, telefon her saniye hafif titrer. */
export const URGENT_MS = 10_000;
/** Saat atlaması gösterimi (kırmızı flaş ve "-5"). */
const JUMP_FLASH_MS = 700;

function Digit(props: { d: string }) {
  const on = () => DIGIT_SEGS[props.d] ?? "";
  return (
    <span class="kp7__d">
      <For each={SEGMENTS}>
        {(s) => <i class={`kp7__s kp7__s--${s}`} data-on={on().includes(s) ? "1" : undefined} />}
      </For>
    </span>
  );
}

/** CSS ile çizilmiş 7 segmentli kırmızı dijital saat: saniye ve salise ("SS.cc", ondalık noktalı). */
export function SevenSeg(props: { digits: string; label: string }) {
  const d = (i: number) => props.digits.charAt(i) || "0";
  return (
    <span class="kp7" role="timer" aria-label={props.label}>
      <Digit d={d(0)} />
      <Digit d={d(1)} />
      <span class="kp7__dp" aria-hidden="true" />
      <Digit d={d(2)} />
      <Digit d={d(3)} />
    </span>
  );
}

const Scissors = (p: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="2.2" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2.2" />
    <path d="M8.5 7.8L20 17M8.5 16.2L20 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
  </svg>
);

interface Props {
  view: KontrolPublicView;
  crew: Crew[];
  now: () => number;
  /** İzleyici/TV: büyük saat. */
  big?: boolean;
  /** Ses ve titreşim çalsın mı (varsayılan evet). */
  sound?: boolean;
}

/**
 * Ekranın üstündeki bomba: gövde (görsel varsa o, yoksa CSS), yanıp sönen LED, 7 segmentli ortak saat, dalga
 * numarası ve kimin kestiği (makas). Her saniye tik; son 10 sn'de hızlanan tik, kırmızı nabız ve hafif titreşim.
 * Yanlış kesimde saat 5 sn atlarken "bzzzt" ve kısa kırmızı flaş (hangi kesim olduğu söylenmez).
 */
export function Bomb(props: Props) {
  const [now, setNow] = createSignal(props.now());
  const [art, setArt] = createSignal(false);
  const [flash, setFlash] = createSignal(false);
  const playing = () => props.view.stage === "play";
  // Saat yalnız dalga sürerken akar; eski telefonlarda da hafif kalsın diye saniyede ~15 kez.
  createEffect(() => {
    if (!playing()) {
      setNow(props.now());
      return;
    }
    const id = setInterval(() => setNow(props.now()), 66);
    onCleanup(() => clearInterval(id));
  });
  const left = () => (playing() ? remainingMs(props.view.endsAt, now()) : 0);
  const urgent = () => playing() && left() > 0 && left() <= URGENT_MS;
  const sound = () => props.sound !== false;

  // Tik: her saniye; son 10 sn'de yarım saniyede bir (hızlanır), her saniye hafif titreşim.
  const beat = createMemo(() => {
    if (!playing() || left() <= 0) return -1;
    const ms = left();
    return ms <= URGENT_MS ? Math.ceil(ms / 500) : Math.ceil(ms / 1000) * 2;
  });
  createEffect(
    on(beat, (b, prev) => {
      if (b < 0 || prev === undefined || prev < 0 || b === prev || !sound()) return;
      const isUrgent = urgent();
      bombTick(isUrgent);
      if (isUrgent && b % 2 === 0) bombPulseHaptic();
    }),
  );

  // Saat atlaması: atlama sayısı arttıkça (aynı dalgada) bzzzt + flaş.
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(flashTimer));
  createEffect(
    on(
      () => [props.view.wave, props.view.jumps] as const,
      ([wave, jumps], prev) => {
        if (!prev || prev[0] !== wave || jumps <= prev[1]) return;
        if (sound()) bzzzt();
        setFlash(true);
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => setFlash(false), JUMP_FLASH_MS);
      },
    ),
  );

  const label = () => {
    const s = Math.ceil(left() / 1000);
    return playing() ? `Bomba saati: ${s} saniye` : "Bomba saati durdu";
  };
  const cutters = () => props.crew.filter((m) => props.view.done.includes(m.id));

  return (
    <div
      class="kpb"
      data-big={props.big ? "1" : undefined}
      data-urgent={urgent() ? "1" : undefined}
      data-flash={flash() ? "1" : undefined}
      data-art={art() ? "1" : undefined}
      data-stage={props.view.stage}
    >
      <img
        class="kpb__art"
        src={propSrc("kontrol-paneli-kaosu/bomba-govde")}
        alt=""
        aria-hidden="true"
        draggable={false}
        onLoad={() => setArt(true)}
        onError={() => setArt(false)}
      />
      <div class="kpb__body">
        <i class="kpb__screw" data-at="tl" />
        <i class="kpb__screw" data-at="tr" />
        <i class="kpb__screw" data-at="bl" />
        <i class="kpb__screw" data-at="br" />
        <i class="kpb__lead" data-side="l" />
        <i class="kpb__lead" data-side="r" />
        <div class="kpb__top">
          <span class="kpb__wave">
            Dalga {props.view.wave + 1}/{props.view.waves}
            <b>{waveName(props.view.wave)}</b>
          </span>
          <i class="kpb__led" aria-hidden="true" />
        </div>
        <Show when={flash()}>
          <i class="kpb__flash" aria-hidden="true" />
        </Show>
        <div class="kpb__screen">
          <SevenSeg digits={clockDigits(left())} label={label()} />
          <Show when={flash()}>
            <span class="kpb__jump" aria-hidden="true">
              −5
            </span>
          </Show>
        </div>
      </div>
      <span class="sr-only">{`${cutters().length} kişi kesti`}</span>
      <div class="kpb__cutters" aria-hidden="true">
        <For each={props.crew}>
          {(m) => (
            <span
              class="kpb__who"
              data-cut={props.view.done.includes(m.id) ? "1" : undefined}
              title={m.nickname}
            >
              <Avatar index={m.avatar} size={props.big ? 30 : 22} connected={m.connected} />
              <Show when={props.view.done.includes(m.id)}>
                <span class="kpb__snip">
                  <Scissors size={props.big ? 14 : 11} />
                </span>
              </Show>
            </span>
          )}
        </For>
      </div>
    </div>
  );
}
