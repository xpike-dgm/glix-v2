import { createEffect, createSignal, type JSX, on, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
}

export function BottomSheet(props: Props) {
  const [mounted, setMounted] = createSignal(props.open);
  const [closing, setClosing] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(
      () => props.open,
      (open) => {
        clearTimeout(timer);
        if (open) {
          setClosing(false);
          setMounted(true);
        } else if (mounted()) {
          setClosing(true);
          timer = setTimeout(() => {
            setMounted(false);
            setClosing(false);
          }, 220);
        }
      },
      { defer: true },
    ),
  );
  onCleanup(() => clearTimeout(timer));

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && props.open) props.onClose();
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  return (
    <Show when={mounted()}>
      <Portal>
        <div class="sheet-root" data-closing={closing() ? "1" : undefined}>
          <button
            type="button"
            class="sheet-backdrop"
            tabIndex={-1}
            aria-label="Kapat"
            onClick={() => props.onClose()}
          />
          <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title}>
            <div class="sheet__grip" aria-hidden="true" />
            <Show when={props.title}>
              <h2 class="sheet__title">{props.title}</h2>
            </Show>
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}
