import { createSignal, type JSX, Show } from "solid-js";
import { goHome } from "../net/store.js";
import { BackIcon } from "../ui/Icons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";

interface Props {
  title: string;
  lead: string;
  /** Doğrulama ve gönderim; hata metni ya da null (başarı: ekranı kapatmayı çağıran yapar). */
  submit: () => Promise<string | null> | string | null;
  submitLabel: string;
  children: JSX.Element;
  footer?: JSX.Element;
  /** Forma gelmeden önce oluşmuş bir sorunun metni (ör. Google dönüşü); hata satırı gibi gösterilir. */
  notice?: string | null | undefined;
  back?: () => void;
}

/** Giriş ve Kayıt ekranlarının ortak kabuğu: başlık, alanlar, hata satırı, gönder düğmesi. */
export function AccountForm(props: Props) {
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const onSubmit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      setError(await props.submit());
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen class="acct">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={() => (props.back ?? goHome)()}>
          <BackIcon size={26} />
        </button>
        <span />
      </header>
      <form class="acct__body" onSubmit={onSubmit} novalidate data-scroll>
        <h1 class="display h-title rise" style={{ "--i": 0 }}>
          {props.title}
        </h1>
        <p class="lead rise" style={{ "--i": 1 }}>
          {props.lead}
        </p>
        <Show when={props.notice}>
          {(text) => (
            <p class="acct__error" role="alert">
              {text()}
            </p>
          )}
        </Show>
        <div class="acct__fields">{props.children}</div>
        <Show when={error()}>
          {(text) => (
            <p class="acct__error" role="alert">
              {text()}
            </p>
          )}
        </Show>
        {props.footer}
        <PrimaryButton type="submit" busy={busy()}>
          {props.submitLabel}
        </PrimaryButton>
      </form>
    </Screen>
  );
}
