import { createEffect, createSignal, type JSX, on, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { CloseIcon } from "./Icons.js";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Başlık yerine özel üst alan (örn. avatar + ad); `title` yine ekran okuyucu adı olarak kalır. */
  header?: JSX.Element;
  children: JSX.Element;
}

const FOCUSABLE = 'button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

export function BottomSheet(props: Props) {
  const [mounted, setMounted] = createSignal(props.open);
  const [closing, setClosing] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sheet: HTMLDivElement | undefined;
  let opener: Element | null = null;

  createEffect(
    on(
      () => props.open,
      (open) => {
        clearTimeout(timer);
        if (open) {
          opener = document.activeElement;
          setClosing(false);
          setMounted(true);
          // Odak sayfaya taşınır (klavye ve ekran okuyucu); giriş alanı varsa kendi odaklanır.
          queueMicrotask(() => {
            if (sheet && !sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
          });
        } else if (mounted()) {
          setClosing(true);
          timer = setTimeout(() => {
            setMounted(false);
            setClosing(false);
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
            opener = null;
          }, 220);
        }
      },
      { defer: true },
    ),
  );
  onCleanup(() => clearTimeout(timer));

  const onKey = (e: KeyboardEvent): void => {
    if (!props.open || !sheet) return;
    if (e.key === "Escape") {
      props.onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Tab sayfanın içinde döner.
    const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheet)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
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
          <div
            class="sheet"
            data-scroll
            role="dialog"
            aria-modal="true"
            aria-label={props.title}
            tabIndex={-1}
            ref={sheet}
          >
            <div class="sheet__grip" aria-hidden="true" />
            <div class="sheet__head">
              <Show
                when={props.header}
                fallback={
                  <Show when={props.title} fallback={<span />}>
                    <h2 class="sheet__title">{props.title}</h2>
                  </Show>
                }
              >
                <div class="sheet__who">{props.header}</div>
              </Show>
              <button
                type="button"
                class="icon-btn sheet__close"
                aria-label="Kapat"
                onClick={() => props.onClose()}
              >
                <CloseIcon size={22} />
              </button>
            </div>
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}
