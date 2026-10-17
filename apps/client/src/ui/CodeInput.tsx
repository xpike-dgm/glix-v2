import { ROOM_CODE_LENGTH } from "@glix/engine";
import { createEffect, createSignal, For, on, onMount } from "solid-js";
import { normalizeCode } from "../net/code.js";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  /** Artınca kutular kırmızı titrer. */
  shake: number;
  autofocus?: boolean;
}

export function CodeInput(props: Props) {
  let input: HTMLInputElement | undefined;
  let boxes: HTMLDivElement | undefined;
  const [focused, setFocused] = createSignal(false);
  const [invalid, setInvalid] = createSignal(false);

  createEffect(
    on(
      () => props.shake,
      () => {
        setInvalid(true);
        boxes?.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-9px)" },
            { transform: "translateX(8px)" },
            { transform: "translateX(-6px)" },
            { transform: "translateX(4px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 380, easing: "ease-out" },
        );
      },
      { defer: true },
    ),
  );
  onMount(() => {
    if (props.autofocus) setTimeout(() => input?.focus(), 320);
  });

  const slots = Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => i);
  const active = () => Math.min(props.value.length, ROOM_CODE_LENGTH - 1);

  return (
    <div
      class="code"
      ref={boxes}
      data-invalid={invalid() ? "1" : undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        input?.focus();
      }}
    >
      <For each={slots}>
        {(i) => (
          <div
            class="code__box"
            data-filled={props.value[i] ? "1" : undefined}
            data-active={focused() && i === active() ? "1" : undefined}
          >
            {props.value[i] ?? ""}
          </div>
        )}
      </For>
      <input
        ref={input}
        class="code__input"
        type="text"
        inputmode="text"
        enterkeyhint="go"
        autocapitalize="characters"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        aria-label="Oda kodu"
        value={props.value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={(e) => {
          const v = normalizeCode(e.currentTarget.value);
          e.currentTarget.value = v;
          setInvalid(false);
          props.onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") props.onSubmit?.();
        }}
      />
    </div>
  );
}
