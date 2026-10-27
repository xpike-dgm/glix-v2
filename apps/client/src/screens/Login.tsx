import { createSignal } from "solid-js";
import { login } from "../net/account.js";
import { loginError } from "../net/accountRules.js";
import { setState } from "../net/store.js";
import { GhostButton } from "../ui/GhostButton.js";
import { AccountForm } from "./AccountForm.js";

export function Login() {
  const [name, setName] = createSignal("");
  const [password, setPassword] = createSignal("");
  const submit = async (): Promise<string | null> => {
    const bad = loginError({ login: name(), password: password() });
    if (bad) return bad;
    const reply = await login(name(), password());
    return reply.ok ? null : reply.message;
  };
  return (
    <AccountForm
      title="Giriş yap"
      lead="Hesabınla oda kurabilirsin."
      submit={submit}
      submitLabel="Giriş yap"
      footer={
        <GhostButton size="small" onClick={() => setState("nav", "register")}>
          Hesabın yok mu? Kayıt ol
        </GhostButton>
      }
    >
      <input
        class="field"
        type="text"
        name="username"
        autocomplete="username"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        enterkeyhint="next"
        placeholder="Kullanıcı adı veya e-posta"
        aria-label="Kullanıcı adı veya e-posta"
        value={name()}
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <input
        class="field"
        type="password"
        name="password"
        autocomplete="current-password"
        enterkeyhint="go"
        placeholder="Şifre"
        aria-label="Şifre"
        value={password()}
        onInput={(e) => setPassword(e.currentTarget.value)}
      />
    </AccountForm>
  );
}
