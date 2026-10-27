import { createEffect, createSignal, on, Show } from "solid-js";
import { changeUsername } from "../net/account.js";
import { USERNAME_MAX, usernameError, usernameLockedUntil, usernameNote } from "../net/accountRules.js";
import { serverNow, state, toast } from "../net/store.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Kullanıcı adı değiştirme penceresi (Profil ve Ayarlar > Hesap kullanır). 7 günde bir; tarihi gösterir. */
export function UsernameSheet(props: Props) {
  const [value, setValue] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  let input: HTMLInputElement | undefined;

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setValue(state.account?.username ?? "");
        setError(null);
        setTimeout(() => input?.focus(), 280);
      },
    ),
  );

  const locked = (): boolean => usernameLockedUntil(state.usernameAvailableAt, serverNow()) !== null;
  const unchanged = (): boolean => value() === state.account?.username;

  const submit = async (e?: Event): Promise<void> => {
    e?.preventDefault();
    if (busy() || locked()) return;
    const bad = usernameError(value());
    if (bad) {
      setError(bad);
      return;
    }
    if (unchanged()) {
      setError("Bu zaten kullanıcı adın.");
      return;
    }
    setBusy(true);
    try {
      const reply = await changeUsername(value());
      if (!reply.ok) {
        setError(reply.message);
        return;
      }
      props.onClose();
      toast("Kullanıcı adın değişti.", "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Kullanıcı adını değiştir">
      <form class="sheet__form" novalidate onSubmit={(e) => void submit(e)}>
        <input
          ref={input}
          class="field"
          type="text"
          name="username"
          autocomplete="username"
          autocapitalize="off"
          autocorrect="off"
          spellcheck={false}
          maxLength={USERNAME_MAX}
          enterkeyhint="done"
          placeholder="Kullanıcı adı"
          aria-label="Yeni kullanıcı adı"
          disabled={locked()}
          value={value()}
          onInput={(e) => {
            setValue(e.currentTarget.value);
            setError(null);
          }}
        />
        <Show when={error()}>
          {(text) => (
            <p class="acct__error" role="alert">
              {text()}
            </p>
          )}
        </Show>
        <p class="sheet__text" data-locked={locked() ? "1" : undefined} role="status">
          {usernameNote(state.usernameAvailableAt, serverNow())}
        </p>
        <div class="sheet__actions">
          <PrimaryButton type="submit" busy={busy()} disabled={locked()}>
            Kaydet
          </PrimaryButton>
          <div style={{ height: "8px" }} />
          <GhostButton onClick={props.onClose}>Vazgeç</GhostButton>
        </div>
      </form>
    </BottomSheet>
  );
}
