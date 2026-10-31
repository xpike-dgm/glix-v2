import { createSignal, type JSX, onCleanup, onMount, Show, untrack } from "solid-js";
import { atServerTime } from "../../net/serverTimer.js";

/** Kelime ekranda ilk bu kadar açık kalır, sonra buğulanır (SZ-U2). */
export const PEEK_OPEN_MS = 5_000;

interface Props {
  /** Buğulanma sayacının başladığı sunucu anı (ör. aşamanın başı); ekrana gelişten erken ise geliş anı sayılır. */
  since: number;
  now: () => number;
  /** false: koruma yok (izleyici, kelime yok). */
  enabled: boolean;
  class?: string;
  /** Kısa etiket ("Kelimeni gör" düğmesinin ekran okuyucu adı). */
  label?: string;
  children: JSX.Element;
}

/**
 * Gözetleme koruması: kelime ilk 5 sn açık, sonra buğulanır; basılı tutunca görünür, bırakınca kapanır.
 * Yan yana oturan komşunun büyük kelimeyi görmesini zorlaştırır. Hareket azaltmada da çalışır (yalnız geçiş yok).
 */
export function Peek(props: Props) {
  const [fogged, setFogged] = createSignal(false);
  const [held, setHeld] = createSignal(false);
  onMount(() => {
    const at =
      Math.max(
        untrack(() => props.since),
        untrack(props.now),
      ) + PEEK_OPEN_MS;
    const stop = atServerTime(at, () => setFogged(true), props.now);
    onCleanup(stop);
  });
  const hidden = () => props.enabled && fogged() && !held();
  const show = (): void => {
    setHeld(true);
  };
  const hide = (): void => {
    setHeld(false);
  };
  return (
    <div class={`szpeek ${props.class ?? ""}`} data-fog={hidden() ? "1" : undefined}>
      <div class="szpeek__body" aria-hidden={hidden() ? "true" : undefined}>
        {props.children}
      </div>
      <Show when={props.enabled && fogged()}>
        <button
          type="button"
          class="szpeek__hold"
          aria-label={props.label ?? "Kelimeni görmek için basılı tut"}
          aria-pressed={held()}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            show();
          }}
          onPointerUp={hide}
          onPointerCancel={hide}
          onLostPointerCapture={hide}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              show();
            }
          }}
          onKeyUp={hide}
          onBlur={hide}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Show when={!held()}>
            <span class="szpeek__tip">Basılı tut · kelimeni gör</span>
          </Show>
        </button>
      </Show>
    </div>
  );
}
