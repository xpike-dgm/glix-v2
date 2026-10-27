import { createSignal, Show } from "solid-js";
import { register } from "../net/account.js";
import { registerError } from "../net/accountRules.js";
import { setState, state } from "../net/store.js";
import { GhostButton } from "../ui/GhostButton.js";
import { GoogleButton } from "../ui/GoogleButton.js";
import { AccountForm } from "./AccountForm.js";

// Aydınlatma metnine gidip dönünce yazılanlar kaybolmasın diye modül düzeyinde tutulur.
const [username, setUsername] = createSignal("");
const [email, setEmail] = createSignal("");
const [password, setPassword] = createSignal("");

export function Register() {
  const submit = async (): Promise<string | null> => {
    const bad = registerError({ username: username(), email: email(), password: password() });
    if (bad) return bad;
    const reply = await register(username(), email(), password());
    if (!reply.ok) return reply.message;
    setPassword("");
    return null;
  };
  return (
    <AccountForm
      title="Kayıt ol"
      lead="Hesap açınca oda kurabilirsin."
      submit={submit}
      submitLabel="Kayıt ol"
      footer={
        <>
          <p class="acct__legal">
            Kayıt olarak{" "}
            <button type="button" class="acct__link" onClick={() => setState("nav", "aydinlatma")}>
              aydınlatma metnini
            </button>{" "}
            kabul edersin.
          </p>
          <GhostButton size="small" onClick={() => setState("nav", "login")}>
            Zaten hesabın var mı? Giriş yap
          </GhostButton>
        </>
      }
    >
      <Show when={state.google.enabled}>
        <GoogleButton />
        <p class="acct__or">veya</p>
      </Show>
      <input
        class="field"
        type="text"
        name="username"
        autocomplete="username"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        maxLength={20}
        enterkeyhint="next"
        placeholder="Kullanıcı adı"
        aria-label="Kullanıcı adı"
        value={username()}
        onInput={(e) => setUsername(e.currentTarget.value)}
      />
      <input
        class="field"
        type="email"
        name="email"
        autocomplete="email"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        enterkeyhint="next"
        placeholder="E-posta"
        aria-label="E-posta"
        value={email()}
        onInput={(e) => setEmail(e.currentTarget.value)}
      />
      <input
        class="field"
        type="password"
        name="password"
        autocomplete="new-password"
        maxLength={128}
        enterkeyhint="go"
        placeholder="Şifre (8+ karakter)"
        aria-label="Şifre"
        value={password()}
        onInput={(e) => setPassword(e.currentTarget.value)}
      />
    </AccountForm>
  );
}
