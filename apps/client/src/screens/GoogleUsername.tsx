import { createSignal } from "solid-js";
import { completeGoogle, googlePending } from "../net/account.js";
import { usernameError } from "../net/accountRules.js";
import { setState } from "../net/store.js";
import { AccountForm } from "./AccountForm.js";

/** Google ile ilk giriş: hesap için kullanıcı adı seçtirir (öneri e-postanın başından gelir). */
export function GoogleUsername() {
  const [name, setName] = createSignal(googlePending()?.suggestion ?? "");
  const submit = async (): Promise<string | null> => {
    const bad = usernameError(name());
    if (bad) return bad;
    const reply = await completeGoogle(name());
    return reply.ok ? null : reply.message;
  };
  return (
    <AccountForm
      title="Kullanıcı adı seç"
      lead="Arkadaşların seni bu adla bulacak."
      submit={submit}
      submitLabel="Devam"
      back={() => setState("nav", "login")}
    >
      <input
        class="field"
        type="text"
        name="username"
        autocomplete="username"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        maxLength={20}
        enterkeyhint="go"
        placeholder="Kullanıcı adı"
        aria-label="Kullanıcı adı"
        value={name()}
        onInput={(e) => setName(e.currentTarget.value)}
      />
    </AccountForm>
  );
}
