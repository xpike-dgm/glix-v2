import { createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { YY_PLAN } from "./timeline.js";

interface Props {
  /** Yalnız ilk değer (yeniden bağlanınca alan dolu gelir); kilitliyken gösterilen değer. */
  value: string;
  /** Ham girişi alır, ekranda görünecek biçimi döner (Türkçe büyük harf, en çok 24). */
  onInput: (raw: string) => string;
  onEnter?: () => void;
  label: string;
  placeholder: string;
  locked?: boolean;
  disabled?: boolean;
  variant: "sign" | "plain";
  /** Görünen biçim değişince (ör. harf kutucukları için). */
  onText?: (text: string) => void;
}

/**
 * Gizli pano (YY-U1): yazılan her harf kısa süre görünür, sonra ● olur (telefon şifresi gibi); Tamam'dan sonra
 * yalnız noktalar kalır. Panoya basılı tutunca kelimenin tamamı görünür, bırakınca kapanır. Yan bakan biri ne rolü ne
 * kelimeyi okuyabilir: MASUM da 5 nokta görünür.
 */
export function SecretBoard(props: Props) {
  const [text, setText] = createSignal(untrack(() => props.value));
  const [fresh, setFresh] = createSignal(-1);
  const [held, setHeld] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  let maskTimer: ReturnType<typeof setTimeout> | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(maskTimer);
    clearTimeout(holdTimer);
  });

  const shown = () => (props.locked ? props.value : text());
  const chars = () => Array.from(shown());
  const input = (raw: string): void => {
    const prev = Array.from(text()).length;
    const next = props.onInput(raw);
    setText(next);
    props.onText?.(next);
    const n = Array.from(next).length;
    clearTimeout(maskTimer);
    // Yalnız yeni yazılan son harf kısa süre görünür; silmede hiçbir harf açılmaz.
    if (n > prev) {
      setFresh(n - 1);
      maskTimer = setTimeout(() => setFresh(-1), YY_PLAN.maskDelayMs);
    } else setFresh(-1);
  };
  const down = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => setHeld(true), YY_PLAN.holdRevealMs);
  };
  const up = (): void => {
    clearTimeout(holdTimer);
    setHeld(false);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: basılı tutma yalnız görsel açıklamadır; alanın kendisi bir input.
    <div
      class={`yyb yyb--${props.variant}`}
      data-locked={props.locked ? "1" : undefined}
      data-held={held() ? "1" : undefined}
      data-focus={focused() ? "1" : undefined}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <input
        class="yyb__input"
        type="text"
        lang="tr"
        inputmode="text"
        enterkeyhint="done"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck={false}
        maxlength={24}
        aria-label={props.label}
        disabled={props.disabled === true || props.locked === true}
        value={untrack(() => props.value)}
        onInput={(e) => input(e.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            props.onEnter?.();
          }
        }}
      />
      <span class="yyb__show" aria-hidden="true">
        <Show when={chars().length > 0} fallback={<span class="yyb__ph">{props.placeholder}</span>}>
          <For each={chars()}>
            {(ch, i) => (
              <span class="yyb__ch" data-open={held() || i() === fresh() ? "1" : undefined}>
                {held() || i() === fresh() ? ch : "●"}
              </span>
            )}
          </For>
        </Show>
        <Show when={focused() && !props.locked}>
          <i class="yyb__caret" />
        </Show>
      </span>
      <Show when={props.locked}>
        <span class="yyb__seal" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="3" fill="currentColor" />
            <path
              d="M8 11V8a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
            />
          </svg>
        </span>
      </Show>
    </div>
  );
}
