import { MAX_NICKNAME_LENGTH } from "@glix/engine";
import { createEffect, createSignal, on } from "solid-js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";

interface Props {
  open: boolean;
  initial: string;
  onClose: () => void;
  onDone: (name: string) => void;
}

export function NicknameSheet(props: Props) {
  const [value, setValue] = createSignal(props.initial);
  let input: HTMLInputElement | undefined;
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setValue(props.initial);
        setTimeout(() => input?.focus(), 280);
      },
    ),
  );
  const clean = () => value().trim();
  const submit = (e?: Event): void => {
    e?.preventDefault();
    if (clean().length > 0) props.onDone(clean());
  };
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Takma adın ne?">
      <p class="sheet__text">Arkadaşların seni böyle görecek.</p>
      <form class="sheet__actions" onSubmit={submit}>
        <input
          ref={input}
          class="field"
          type="text"
          maxLength={MAX_NICKNAME_LENGTH}
          placeholder="Takma ad"
          autocomplete="off"
          autocapitalize="words"
          spellcheck={false}
          enterkeyhint="done"
          aria-label="Takma ad"
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
        <div style={{ height: "12px" }} />
        <PrimaryButton type="submit" disabled={clean().length === 0}>
          Tamam
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
