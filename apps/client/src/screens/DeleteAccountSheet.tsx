import { createEffect, createSignal, on, Show } from "solid-js";
import { deleteMyAccount } from "../net/account.js";
import { canDeleteAccount, deleteFormError } from "../net/kvkkRules.js";
import { goHome, state, toast } from "../net/store.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { GhostButton } from "../ui/GhostButton.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Hesabımı sil" penceresi (Ayarlar > Hesap). Neyin silineceğini söyler; kullanıcı adını (şifreli hesapta ayrıca
 * şifreyi) yazdırır. Silme anında ve geri alınamaz; başarıda misafir olarak ana sayfaya dönülür.
 */
export function DeleteAccountSheet(props: Props) {
  const [typed, setTyped] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setTyped("");
        setPassword("");
        setError(null);
      },
    ),
  );

  const username = (): string => state.account?.username ?? "";
  const hasPassword = (): boolean => state.mail.hasPassword;
  const form = () => ({
    typed: typed(),
    username: username(),
    hasPassword: hasPassword(),
    password: password(),
  });
  const ready = (): boolean => canDeleteAccount(form());

  const submit = async (e?: Event): Promise<void> => {
    e?.preventDefault();
    if (busy()) return;
    const bad = deleteFormError(form());
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    try {
      const reply = await deleteMyAccount(form());
      if (!reply.ok) {
        setError(reply.message);
        return;
      }
      props.onClose();
      goHome();
      toast("Hesabın silindi.", "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Hesabın silinsin mi?">
      <form class="sheet__form" novalidate onSubmit={(e) => void submit(e)}>
        <p class="sheet__text">Bu işlem hemen yapılır ve geri alınamaz. Şunlar kalıcı olarak silinir:</p>
        <ul class="sheet__list">
          <li>İstatistiklerin</li>
          <li>Rozetlerin</li>
          <li>Arkadaşların ve arkadaşlık isteklerin</li>
          <li>Hesabın (kullanıcı adın ve e-postan)</li>
        </ul>
        <p class="sheet__text">Önce verilerini indirmek istersen "Verimi indir"i kullanabilirsin.</p>
        <Show when={state.session?.roomCode}>
          <p class="sheet__text">Bir odadaysan oyunda misafir olarak kalırsın.</p>
        </Show>
        <label class="sheet__label" for="del-confirm">
          Onaylamak için kullanıcı adını yaz: <b>{username()}</b>
        </label>
        <input
          id="del-confirm"
          class="field"
          type="text"
          name="username"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck={false}
          maxLength={64}
          enterkeyhint={hasPassword() ? "next" : "done"}
          placeholder="Kullanıcı adın"
          value={typed()}
          onInput={(e) => {
            setTyped(e.currentTarget.value);
            setError(null);
          }}
        />
        <Show
          when={hasPassword()}
          fallback={
            <p class="sheet__text" data-google-only="1">
              Google ile giriş yaptığın için şifre istemiyoruz; ama güvenlik için yakın zamanda giriş yapmış
              olman gerekir. Silme reddedilirse çıkış yapıp tekrar giriş yap, sonra sil.
            </p>
          }
        >
          <input
            class="field"
            type="password"
            name="current-password"
            autocomplete="current-password"
            maxLength={128}
            enterkeyhint="go"
            placeholder="Şifren"
            aria-label="Şifren"
            value={password()}
            onInput={(e) => {
              setPassword(e.currentTarget.value);
              setError(null);
            }}
          />
        </Show>
        <Show when={error()}>
          {(text) => (
            <p class="acct__error" role="alert">
              {text()}
            </p>
          )}
        </Show>
        <div class="sheet__actions">
          <PrimaryButton type="submit" variant="danger" busy={busy()} disabled={!ready()}>
            Hesabımı sil
          </PrimaryButton>
          <div style={{ height: "8px" }} />
          <GhostButton onClick={props.onClose}>Vazgeç</GhostButton>
        </div>
      </form>
    </BottomSheet>
  );
}
