import { type JSX, Show, untrack } from "solid-js";
import "./word-field.css";

interface Props {
  /** Yalnız ilk değer (yeniden bağlanınca alan dolu gelir); sonra alan kendi durumunu tutar. */
  value: string;
  onInput: (raw: string) => unknown;
  onEnter?: () => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  /** Kilitlendi: alan yalnız okunur ve mühürlü görünür. */
  locked?: boolean;
  variant: "sign" | "plain";
  ref?: (el: HTMLInputElement) => void;
  children?: JSX.Element;
}

/** Tek satır kelime alanı; yazılan her şey Türkçe büyük harfe çevrilir (dil işareti `tr`). */
export function WordField(props: Props) {
  return (
    <div class={`wfield wfield--${props.variant}`} data-locked={props.locked ? "1" : undefined}>
      <input
        ref={(el) => props.ref?.(el)}
        class="wfield__input"
        type="text"
        lang="tr"
        inputmode="text"
        enterkeyhint="done"
        autocomplete="off"
        autocapitalize="characters"
        autocorrect="off"
        spellcheck={false}
        maxlength={24}
        placeholder={props.placeholder}
        aria-label={props.label}
        disabled={props.disabled === true || props.locked === true}
        value={untrack(() => props.value)}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            props.onEnter?.();
          }
        }}
      />
      <Show when={props.locked}>
        <span class="wfield__seal" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
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
      {props.children}
    </div>
  );
}
