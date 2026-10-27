import { createSignal, Show } from "solid-js";
import { requestReset } from "../net/account.js";
import { emailError } from "../net/accountRules.js";
import { setState } from "../net/store.js";
import { AccountForm } from "./AccountForm.js";

/** "Şifremi unuttum": e-posta ister, bağlantı gönderildi mesajı gösterir (hesap olup olmadığı söylenmez). */
export function ForgotPassword() {
  const [email, setEmail] = createSignal("");
  const [sent, setSent] = createSignal(false);
  const submit = async (): Promise<string | null> => {
    if (sent()) {
      setState("nav", "login");
      return null;
    }
    const bad = emailError(email());
    if (bad) return bad;
    const reply = await requestReset(email());
    if (!reply.ok) return reply.message;
    setSent(true);
    return null;
  };
  return (
    <AccountForm
      title={sent() ? "Bağlantı gönderildi" : "Şifremi unuttum"}
      lead={
        sent()
          ? "Bu e-posta ile bir hesap varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu ve gereksiz klasörünü kontrol et. Bağlantı 1 saat geçerli."
          : "Hesabındaki e-postayı yaz, sana yeni şifre belirleme bağlantısı gönderelim."
      }
      submit={submit}
      submitLabel={sent() ? "Girişe dön" : "Bağlantı gönder"}
      back={() => setState("nav", "login")}
    >
      <Show when={!sent()}>
        <input
          class="field"
          type="email"
          name="email"
          autocomplete="email"
          autocapitalize="off"
          autocorrect="off"
          spellcheck={false}
          enterkeyhint="go"
          placeholder="E-posta"
          aria-label="E-posta"
          value={email()}
          onInput={(e) => setEmail(e.currentTarget.value)}
        />
      </Show>
    </AccountForm>
  );
}
