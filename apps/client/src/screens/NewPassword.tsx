import { createSignal } from "solid-js";
import { confirmReset } from "../net/account.js";
import { passwordError } from "../net/accountRules.js";
import { goHome } from "../net/store.js";
import { AccountForm } from "./AccountForm.js";

/** Sıfırlama bağlantısından açılır: yeni şifreyi alır ve kullanıcıyı içeri alır. */
export function NewPassword() {
  const [password, setPassword] = createSignal("");
  const submit = async (): Promise<string | null> => {
    const bad = passwordError(password());
    if (bad) return bad;
    const reply = await confirmReset(password());
    if (!reply.ok) return reply.message;
    setPassword("");
    return null;
  };
  return (
    <AccountForm
      title="Yeni şifre"
      lead="Yeni şifreni yaz. Diğer cihazlardaki oturumların kapanır."
      submit={submit}
      submitLabel="Şifreyi kaydet"
      back={goHome}
    >
      <input
        class="field"
        type="password"
        name="password"
        autocomplete="new-password"
        maxLength={128}
        enterkeyhint="go"
        placeholder="Yeni şifre (8+)"
        aria-label="Yeni şifre"
        value={password()}
        onInput={(e) => setPassword(e.currentTarget.value)}
      />
    </AccountForm>
  );
}
