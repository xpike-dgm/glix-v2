// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { createSignal, onCleanup, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { karalamaProp } from "../../ui/props.js";
import { shownWord } from "./view.js";

interface HoldProps {
  word: string;
  near: boolean;
}

/** Basılı tutma: dokunuş sürerken true (pointer yakalanır; parmak kayınca da açık kalır). */
function useHold(onOpen?: () => void) {
  const [held, setHeld] = createSignal(false);
  const down = (e: PointerEvent): void => {
    e.preventDefault();
    unlockAudio();
    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    if (!held()) hapticTap();
    setHeld(true);
    onOpen?.();
  };
  const up = (): void => {
    setHeld(false);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setHeld(e.type === "keydown");
      if (e.type === "keydown") onOpen?.();
    }
  };
  return {
    held,
    bind: {
      onPointerDown: down,
      onPointerUp: up,
      onPointerCancel: up,
      onLostPointerCapture: up,
      onKeyDown: onKey,
      onKeyUp: onKey,
      onContextMenu: (e: Event) => e.preventDefault(),
    },
  };
}

/** Kartın yüzü: kelime; bilgisizde üstünde sarı "yakın sinyal" (yalnız kart açıkken). */
function Face(props: HoldProps) {
  const len = () => props.word.length;
  return (
    <span class="kdcard__face">
      <Show when={props.near}>
        <span class="kd__sig" data-on="1">
          yakın sinyal
        </span>
      </Show>
      <span class="kd__word" data-len={len() > 10 ? "l" : len() > 7 ? "m" : "s"}>
        {shownWord(props.word)}
      </span>
    </span>
  );
}

/** Kartın arka yüzü: defter sayfası (görsel varsa o, yoksa CSS çizgili kâğıt). İki rolde birebir aynı. */
function Back(props: { text: string }) {
  const src = karalamaProp("kart-arka");
  return (
    <span class="kdcard__back" data-art={src ? "1" : undefined}>
      <Show when={src}>{(s) => <img src={s()} alt="" draggable={false} />}</Show>
      <span class="kdcard__hint">{props.text}</span>
    </span>
  );
}

/**
 * KD-U1 gizli kelime kartı (tam ekran): ters defter kartı; basılı tutunca döner, kelime görünür. Bırakınca kapanır ve
 * `onDone` çağrılır (çağıran kartı küçük "Kelimeni gör" çubuğuna çevirir). Arka yüz, boyut ve animasyon iki rolde aynı.
 */
export function WordIntroCard(props: HoldProps & { onSeen: () => void; onDone: () => void }) {
  let opened = false;
  const hold = useHold(() => {
    opened = true;
    props.onSeen();
  });
  const release = (): void => {
    if (opened) props.onDone();
  };
  return (
    <div class="kdcard" role="dialog" aria-label="Gizli kelime kartı">
      <button
        type="button"
        class="kdcard__card"
        data-open={hold.held() ? "1" : undefined}
        aria-label={hold.held() ? `Kelimen: ${props.word}` : "Kelimeni görmek için basılı tut"}
        {...hold.bind}
        onPointerUp={() => {
          hold.bind.onPointerUp();
          release();
        }}
        onPointerCancel={() => {
          hold.bind.onPointerCancel();
          release();
        }}
      >
        <span class="kdcard__inner">
          <Back text="Kelimeni görmek için basılı tut · ekranını sakla" />
          <Face word={props.word} near={props.near} />
        </span>
      </button>
      <button type="button" class="kdcard__skip" onClick={() => props.onDone()}>
        Sonra bakarım
      </button>
    </div>
  );
}

/** KD-U1 küçük çubuk: "Kelimeni gör"; kelime yalnız basılı tutulunca görünür (çizimde ve oylamada). */
export function WordBar(props: HoldProps & { onSeen?: () => void }) {
  const hold = useHold(props.onSeen);
  // Uzun basış bırakılmadan ekran değişirse kapalı kalsın.
  onCleanup(() => hold.bind.onPointerUp());
  return (
    <button
      type="button"
      class="kdbar"
      data-open={hold.held() ? "1" : undefined}
      aria-label={hold.held() ? `Kelimen: ${props.word}` : "Kelimeni görmek için basılı tut"}
      {...hold.bind}
    >
      <Show
        when={hold.held()}
        fallback={
          <span class="kdbar__closed">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            Kelimeni gör
          </span>
        }
      >
        <Face word={props.word} near={props.near} />
      </Show>
    </button>
  );
}
