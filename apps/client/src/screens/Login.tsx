import { createSignal, Show } from "solid-js";
import { googleNotice, login, setGoogleNotice } from "../net/account.js";
import { loginError } from "../net/accountRules.js";
import { setState, state } from "../net/store.js";
import { GhostButton } from "../ui/GhostButton.js";
import { GoogleButton } from "../ui/GoogleButton.js";
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
      notice={googleNotice()}
      submit={submit}
      submitLabel="Giriş yap"
      footer={
        <>
          <Show when={state.mail.enabled}>
            <GhostButton
              size="small"
              onClick={() => {
                setGoogleNotice(null);
                setState("nav", "unuttum");
              }}
            >
              Şifremi unuttum
            </GhostButton>
          </Show>
          <GhostButton
            size="small"
            onClick={() => {
              setGoogleNotice(null);
              setState("nav", "register");
            }}
          >
            Hesabın yok mu? Kayıt ol
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
