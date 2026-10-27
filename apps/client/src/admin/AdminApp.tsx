import { createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { AccountsPanel } from "./AccountsPanel.js";
import { AuditPanel } from "./AuditPanel.js";
import { type Gate, loadGate, logout, sendCode, verifyCode } from "./api.js";
import { ErrorsPanel } from "./ErrorsPanel.js";
import { LivePanel } from "./LivePanel.js";
import { StatsPanel } from "./StatsPanel.js";

type Tab = "canli" | "istatistik" | "hatalar" | "hesaplar" | "kayit";
const TABS: { id: Tab; label: string }[] = [
  { id: "canli", label: "Canlı durum" },
  { id: "istatistik", label: "Oyun istatistikleri" },
  { id: "hatalar", label: "Hatalar ve performans" },
  { id: "hesaplar", label: "Hesaplar" },
  { id: "kayit", label: "İşlem kaydı" },
];
/** "Yeniden gönder" için bekleme (sunucu da 60 sn sınırı uygular). */
const RESEND_WAIT_S = 60;

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as Tab) : "canli";
}

function Notice(props: { title: string; text?: string; link?: { href: string; label: string } }) {
  return (
    <main class="adm-center">
      <div class="adm-card adm-card--narrow">
        <h1 class="adm-title">{props.title}</h1>
        <Show when={props.text}>
          <p class="adm-muted">{props.text}</p>
        </Show>
        <Show when={props.link}>
          {(l) => (
            <a class="adm-btn" href={l().href}>
              {l().label}
            </a>
          )}
        </Show>
      </div>
    </main>
  );
}

function CodeGate(props: { onReady: () => void }) {
  const [sent, setSent] = createSignal(false);
  const [code, setCode] = createSignal("");
  const [message, setMessage] = createSignal<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [wait, setWait] = createSignal(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(timer));

  async function send(): Promise<void> {
    setBusy(true);
    setMessage(null);
    const r = await sendCode();
    setBusy(false);
    setMessage({ text: r.message, bad: !r.ok });
    if (!r.ok) return;
    setSent(true);
    setWait(RESEND_WAIT_S);
    clearInterval(timer);
    timer = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
  }

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy()) return;
    setBusy(true);
    setMessage(null);
    const r = await verifyCode(code().replace(/\s/g, ""));
    setBusy(false);
    if (r.ok) props.onReady();
    else {
      setMessage({ text: r.message, bad: true });
      setCode("");
    }
  }

  return (
    <main class="adm-center">
      <div class="adm-card adm-card--narrow">
        <h1 class="adm-title">Yönetim girişi</h1>
        <p class="adm-muted">Güvenlik için hesabının e-postasına tek kullanımlık bir kod gönderilir.</p>
        <Show
          when={sent()}
          fallback={
            <button type="button" class="adm-btn" disabled={busy()} onClick={() => void send()}>
              {busy() ? "Gönderiliyor..." : "Kod gönder"}
            </button>
          }
        >
          <form class="adm-form" onSubmit={(e) => void submit(e)}>
            <label for="adm-code">Altı haneli kod</label>
            <input
              id="adm-code"
              class="adm-input"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="7"
              pattern="[0-9 ]*"
              placeholder="000000"
              value={code()}
              onInput={(e) => setCode(e.currentTarget.value)}
              required
            />
            <button type="submit" class="adm-btn" disabled={busy() || code().replace(/\s/g, "").length !== 6}>
              {busy() ? "Denetleniyor..." : "Giriş yap"}
            </button>
            <button
              type="button"
              class="adm-btn adm-btn--ghost"
              disabled={busy() || wait() > 0}
              onClick={() => void send()}
            >
              {wait() > 0 ? `Yeni kod için ${wait()} sn` : "Kodu yeniden gönder"}
            </button>
          </form>
        </Show>
        <Show when={message()}>
          {(m) => (
            <p class={m().bad ? "adm-banner adm-banner--bad" : "adm-banner adm-banner--ok"} role="status">
              {m().text}
            </p>
          )}
        </Show>
      </div>
    </main>
  );
}

export function AdminApp() {
  const [gate, setGate] = createSignal<Gate | "loading">("loading");
  const [tab, setTab] = createSignal<Tab>(tabFromHash());

  async function check(): Promise<void> {
    setGate(await loadGate());
  }
  onMount(() => {
    void check();
    const onHash = (): void => {
      setTab(tabFromHash());
    };
    window.addEventListener("hashchange", onHash);
    onCleanup(() => window.removeEventListener("hashchange", onHash));
  });

  const select = (t: Tab): void => {
    window.location.hash = t;
    setTab(t);
  };

  return (
    <Switch>
      <Match when={gate() === "loading"}>
        <Notice title="Yükleniyor..." />
      </Match>
      <Match when={gate() === "login"}>
        <Notice
          title="Giriş gerekli"
          text="Yönetim paneline girmek için önce oyunda hesabınla giriş yap, sonra bu sayfaya dön."
          link={{ href: "/", label: "Oyuna git" }}
        />
      </Match>
      <Match when={gate() === "notfound"}>
        <Notice title="Bulunamadı" />
      </Match>
      <Match when={gate() === "error"}>
        <main class="adm-center">
          <div class="adm-card adm-card--narrow">
            <h1 class="adm-title">Bağlantı sorunu</h1>
            <p class="adm-muted">Sunucuya ulaşılamadı.</p>
            <button type="button" class="adm-btn" onClick={() => void check()}>
              Tekrar dene
            </button>
          </div>
        </main>
      </Match>
      <Match when={gate() === "need_otp"}>
        <CodeGate onReady={() => void check()} />
      </Match>
      <Match when={gate() === "ready"}>
        <div class="adm-shell">
          <header class="adm-top">
            <span class="adm-brand">
              GLIX <b>Yönetim</b>
            </span>
            <div class="adm-tabs" role="tablist" aria-label="Bölümler">
              {TABS.map((t) => (
                <button
                  type="button"
                  role="tab"
                  id={`adm-tab-${t.id}`}
                  aria-selected={tab() === t.id}
                  aria-controls="adm-view"
                  class="adm-tab"
                  classList={{ "adm-tab--on": tab() === t.id }}
                  onClick={() => select(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              class="adm-btn adm-btn--ghost adm-btn--small"
              onClick={() => void logout().then(check)}
            >
              Çıkış
            </button>
          </header>
          <main id="adm-view" class="adm-view" role="tabpanel" aria-labelledby={`adm-tab-${tab()}`}>
            <Switch>
              <Match when={tab() === "canli"}>
                <LivePanel onOtp={() => void check()} />
              </Match>
              <Match when={tab() === "istatistik"}>
                <StatsPanel onOtp={() => void check()} />
              </Match>
              <Match when={tab() === "hatalar"}>
                <ErrorsPanel onOtp={() => void check()} />
              </Match>
              <Match when={tab() === "hesaplar"}>
                <AccountsPanel onOtp={() => void check()} />
              </Match>
              <Match when={tab() === "kayit"}>
                <AuditPanel onOtp={() => void check()} />
              </Match>
            </Switch>
          </main>
        </div>
      </Match>
    </Switch>
  );
}
