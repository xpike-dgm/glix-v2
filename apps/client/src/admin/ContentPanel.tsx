import type { AdminBroadcastStatus, AdminContent, AdminGameSwitch } from "@glix/engine";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  clearAnnouncement,
  fetchContent,
  fetchPushStatus,
  publishAnnouncement,
  setGameSwitch,
  startBroadcast,
} from "./api.js";
import { Confirm } from "./Confirm.js";
import {
  ANNOUNCEMENT_MAX,
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  charCount,
  endsAtFromInput,
  fmtRemaining,
  inputFromEndsAt,
  poolNote,
  sitePathProblem,
  textProblem,
} from "./contentRules.js";
import { fmtDateTime, fmtInt } from "./format.js";

type Pending =
  | { kind: "game"; game: AdminGameSwitch; patch: { open?: boolean; random?: boolean } }
  | { kind: "announce"; text: string; announceKind: "bilgi" | "uyari"; endsAt: number | null }
  | { kind: "clear" }
  | { kind: "broadcast"; title: string; body: string; url: string | null };

const KINDS = [
  { id: "bilgi", label: "Bilgi" },
  { id: "uyari", label: "Uyarı" },
] as const;

function pendingText(p: Pending, subscribers: number): string {
  switch (p.kind) {
    case "game": {
      const n = p.game.name;
      if (p.patch.open === false)
        return `"${n}" kapatılacak: yeni seçimlerde ve rastgele seçimde görünmez, lobide seçiliyse seçimden çıkarılır (odadakilere bildirim gider). Süren maçlar normal biter.`;
      if (p.patch.open === true) return `"${n}" yeniden açılacak.`;
      if (p.patch.random === false)
        return `"${n}" rastgele seçimin dışına alınacak; yalnız elle seçilebilir.`;
      return `"${n}" rastgele seçime eklenecek.`;
    }
    case "announce":
      return `Duyuru herkese gösterilecek (ana sayfa ve lobi, misafirler dahil): "${p.text}"${
        p.endsAt === null ? "" : ` Bitiş: ${fmtDateTime(p.endsAt)}.`
      }`;
    case "clear":
      return "Duyuru herkesten kaldırılacak.";
    case "broadcast":
      return `"${p.title}" bildirimi kayıtlı ${fmtInt(subscribers)} aboneliğe (ve açık odalardaki abonelere) gönderilecek. Saatte en çok bir kez gönderilebilir, geri alınamaz.`;
  }
}

function Banner(props: { text: string | null; kind: "bad" | "ok" }) {
  return (
    <Show when={props.text}>
      {(t) => (
        <p class={`adm-banner adm-banner--${props.kind}`} role="alert">
          {t()}
        </p>
      )}
    </Show>
  );
}

function Seg<T extends string | boolean>(props: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <fieldset class="adm-seg adm-seg--cell">
      <legend class="adm-sr">{props.label}</legend>
      <For each={props.options}>
        {(o) => (
          <button
            type="button"
            aria-pressed={props.value === o.id}
            class="adm-seg__opt"
            classList={{ "adm-seg__opt--on": props.value === o.id }}
            onClick={() => props.value !== o.id && props.onPick(o.id)}
          >
            {o.label}
          </button>
        )}
      </For>
    </fieldset>
  );
}

export function ContentPanel(props: { onOtp: () => void }) {
  const [content, setContent] = createSignal<AdminContent | null>(null);
  const [push, setPush] = createSignal<AdminBroadcastStatus | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal<Pending | null>(null);
  const [busy, setBusy] = createSignal(false);

  const [text, setText] = createSignal("");
  const [annKind, setAnnKind] = createSignal<"bilgi" | "uyari">("bilgi");
  const [endsInput, setEndsInput] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [body, setBody] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);

  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(pollTimer));

  async function loadContent(): Promise<void> {
    const r = await fetchContent();
    if (r.kind === "otp") {
      props.onOtp();
      return;
    }
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setContent(r.data);
  }

  async function loadPush(): Promise<void> {
    const r = await fetchPushStatus();
    if (r.kind === "otp") {
      props.onOtp();
      return;
    }
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setPush(r.data);
    clearTimeout(pollTimer);
    // Gönderim sürerken sonuç 2 sn'de bir yenilenir.
    if (r.data.last && !r.data.last.finished) pollTimer = setTimeout(() => void loadPush(), 2000);
  }

  onMount(() => {
    void loadContent();
    void loadPush();
  });

  const ask = (p: Pending): void => {
    setDone(null);
    setError(null);
    setPending(p);
  };

  async function confirm(): Promise<void> {
    const p = pending();
    if (!p || busy()) return;
    setBusy(true);
    let message = "";
    let ok = false;
    switch (p.kind) {
      case "game": {
        const r = await setGameSwitch(p.game.id, p.patch);
        ok = r.ok;
        message = r.ok ? `"${p.game.name}" güncellendi.` : r.message;
        if (r.ok) setContent((c) => (c ? { ...c, games: r.games } : c));
        break;
      }
      case "announce": {
        const r = await publishAnnouncement({ text: p.text, kind: p.announceKind, endsAt: p.endsAt });
        ok = r.ok;
        message = r.message;
        break;
      }
      case "clear": {
        const r = await clearAnnouncement();
        ok = r.ok;
        message = r.message;
        break;
      }
      case "broadcast": {
        const r = await startBroadcast({ title: p.title, body: p.body, url: p.url });
        ok = r.ok;
        message = r.message;
        break;
      }
    }
    setBusy(false);
    setPending(null);
    if (!ok) {
      setError(message);
      return;
    }
    setDone(message);
    if (p.kind === "announce" || p.kind === "clear") await loadContent();
    if (p.kind === "announce") setText("");
    if (p.kind === "broadcast") {
      setTitle("");
      setBody("");
      setUrl("");
      await loadPush();
    }
  }

  function askAnnounce(e: Event): void {
    e.preventDefault();
    const problem = textProblem(text(), ANNOUNCEMENT_MAX, "Duyuru metni");
    const ends = endsAtFromInput(endsInput(), Date.now());
    if (problem) {
      setFormError(problem);
      return;
    }
    if (!ends.ok) {
      setFormError(ends.message);
      return;
    }
    setFormError(null);
    ask({
      kind: "announce",
      text: text().replace(/\s+/gu, " ").trim(),
      announceKind: annKind(),
      endsAt: ends.endsAt,
    });
  }

  function askBroadcast(e: Event): void {
    e.preventDefault();
    const problem =
      textProblem(title(), BROADCAST_TITLE_MAX, "Başlık") ??
      textProblem(body(), BROADCAST_BODY_MAX, "Metin") ??
      sitePathProblem(url().trim());
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    ask({
      kind: "broadcast",
      title: title().replace(/\s+/gu, " ").trim(),
      body: body().replace(/\s+/gu, " ").trim(),
      url: url().trim() === "" ? null : url().trim(),
    });
  }

  const cooldown = () => {
    const at = push()?.nextAllowedAt ?? null;
    return at !== null && at > Date.now() ? at : null;
  };
  const broadcastRunning = () => push()?.last?.finished === false;

  return (
    <section class="adm-section" aria-labelledby="adm-content-h">
      <header class="adm-section__head">
        <h2 id="adm-content-h">İçerik</h2>
        <button
          type="button"
          class="adm-btn adm-btn--ghost"
          onClick={() => {
            void loadContent();
            void loadPush();
          }}
        >
          Yenile
        </button>
      </header>
      <Banner text={error()} kind="bad" />
      <Banner text={done()} kind="ok" />

      <div class="adm-card">
        <h3 class="adm-h3">Oyunlar</h3>
        <p class="adm-muted adm-note">
          Kapalı oyun yeni seçimlerde ve rastgele seçimde görünmez; lobide seçiliyse seçimden çıkarılır. Süren
          maçlar normal biter. "Rastgele seçimde" ayarı oyunun varsayılanını iki yönde de değiştirir.
        </p>
        <Show when={content()} fallback={<p class="adm-muted">Yükleniyor...</p>}>
          {(c) => (
            <div class="adm-table-wrap">
              <table class="adm-table adm-stack">
                <thead>
                  <tr>
                    <th>Oyun</th>
                    <th>Oyuncu</th>
                    <th>Durum</th>
                    <th>Rastgele seçim</th>
                    <th>Not</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={c().games}>
                    {(g) => (
                      <tr data-closed={g.open ? undefined : "1"}>
                        <td data-label="Oyun">
                          <b>{g.name}</b> <span class="adm-muted mono">{g.id}</span>
                        </td>
                        <td data-label="Oyuncu">
                          {g.minPlayers}-{g.maxPlayers}
                        </td>
                        <td data-label="Durum">
                          <Seg
                            label={`${g.name} durumu`}
                            value={g.open}
                            options={[
                              { id: true, label: "Açık" },
                              { id: false, label: "Kapalı" },
                            ]}
                            onPick={(open) => ask({ kind: "game", game: g, patch: { open } })}
                          />
                        </td>
                        <td data-label="Rastgele seçim">
                          <Seg
                            label={`${g.name} rastgele seçim`}
                            value={g.randomPool}
                            options={[
                              { id: true, label: "Rastgele seçimde" },
                              { id: false, label: "Dışında" },
                            ]}
                            onPick={(random) => ask({ kind: "game", game: g, patch: { random } })}
                          />
                        </td>
                        <td data-label="Not" class="adm-muted">
                          {poolNote(g)}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}
        </Show>
      </div>

      <div class="adm-grid">
        <div class="adm-card adm-detail">
          <h3 class="adm-h3">Duyuru bandı</h3>
          <Show when={content()?.announcement} fallback={<p class="adm-muted">Şu an yayında duyuru yok.</p>}>
            {(a) => (
              <div class="adm-live-ann" data-kind={a().kind}>
                <p>{a().text}</p>
                <p class="adm-muted adm-note">
                  {a().kind === "uyari" ? "Uyarı" : "Bilgi"} ·{" "}
                  {a().endsAt === null
                    ? "süresiz"
                    : `${fmtDateTime(a().endsAt ?? 0)} tarihinde biter (${fmtRemaining((a().endsAt ?? 0) - Date.now())} sonra)`}
                </p>
                <button
                  type="button"
                  class="adm-btn adm-btn--ghost adm-btn--small"
                  onClick={() => ask({ kind: "clear" })}
                >
                  Duyuruyu kaldır
                </button>
              </div>
            )}
          </Show>
          <form class="adm-form" onSubmit={askAnnounce}>
            <label for="adm-ann-text">Yeni duyuru (herkese gösterilir, düz metin)</label>
            <textarea
              id="adm-ann-text"
              class="adm-field adm-textarea"
              rows="3"
              maxlength="200"
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
            />
            <p class="adm-count" data-over={charCount(text()) > ANNOUNCEMENT_MAX ? "1" : undefined}>
              {charCount(text())}/{ANNOUNCEMENT_MAX}
            </p>
            <Seg
              label="Duyuru türü"
              value={annKind()}
              options={KINDS.map((k) => ({ id: k.id, label: k.label }))}
              onPick={setAnnKind}
            />
            <label for="adm-ann-ends">Bitiş zamanı (isteğe bağlı; boşsa kaldırana dek)</label>
            <div class="adm-inline">
              <input
                id="adm-ann-ends"
                class="adm-field"
                type="datetime-local"
                value={endsInput()}
                min={inputFromEndsAt(Date.now())}
                onInput={(e) => setEndsInput(e.currentTarget.value)}
              />
              <Show when={endsInput() !== ""}>
                <button
                  type="button"
                  class="adm-btn adm-btn--ghost adm-btn--small"
                  onClick={() => setEndsInput("")}
                >
                  Süresiz yap
                </button>
              </Show>
            </div>
            <Show when={text().trim() !== ""}>
              <p class="adm-muted adm-note">Önizleme</p>
              <p class="adm-preview" data-kind={annKind()}>
                {text().replace(/\s+/gu, " ").trim()}
              </p>
            </Show>
            <button type="submit" class="adm-btn adm-btn--small" disabled={text().trim() === ""}>
              Yayınla
            </button>
          </form>
        </div>

        <div class="adm-card adm-detail">
          <h3 class="adm-h3">Herkese bildirim</h3>
          <Show when={push()}>
            {(p) => (
              <>
                <Show
                  when={p().enabled}
                  fallback={<p class="adm-banner adm-banner--warn">Bildirim gönderimi bu sunucuda kapalı.</p>}
                >
                  <p class="adm-muted">
                    Kayıtlı abonelik: <b>{fmtInt(p().subscribers)}</b>. Bildirimi Ayarlar'dan kapatanlar abone
                    değildir. Saniyede 20 gönderilir; saatte en çok bir kez.
                  </p>
                </Show>
                <Show when={p().last}>
                  {(l) => (
                    <div class="adm-live-ann" data-kind={l().finished ? "bilgi" : "uyari"}>
                      <p>
                        <b>{l().title}</b> · {fmtDateTime(l().at)}
                      </p>
                      <p class="adm-note">
                        {l().finished ? "Bitti" : "Gönderiliyor"}: {fmtInt(l().sent)} gitti,{" "}
                        {fmtInt(l().failed)} gitmedi, {fmtInt(l().removed)} abonelik silindi (toplam{" "}
                        {fmtInt(l().total)}).
                      </p>
                    </div>
                  )}
                </Show>
              </>
            )}
          </Show>
          <form class="adm-form" onSubmit={askBroadcast}>
            <label for="adm-bc-title">Başlık</label>
            <input
              id="adm-bc-title"
              class="adm-field"
              maxlength="60"
              autocomplete="off"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
            <p class="adm-count" data-over={charCount(title()) > BROADCAST_TITLE_MAX ? "1" : undefined}>
              {charCount(title())}/{BROADCAST_TITLE_MAX}
            </p>
            <label for="adm-bc-body">Metin</label>
            <textarea
              id="adm-bc-body"
              class="adm-field adm-textarea"
              rows="2"
              maxlength="180"
              value={body()}
              onInput={(e) => setBody(e.currentTarget.value)}
            />
            <p class="adm-count" data-over={charCount(body()) > BROADCAST_BODY_MAX ? "1" : undefined}>
              {charCount(body())}/{BROADCAST_BODY_MAX}
            </p>
            <label for="adm-bc-url">Açılacak sayfa (isteğe bağlı, sitenin kendi yolu; boşsa ana sayfa)</label>
            <input
              id="adm-bc-url"
              class="adm-field"
              placeholder="/"
              maxlength="100"
              autocomplete="off"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
            />
            <Show when={cooldown()}>
              {(at) => (
                <p class="adm-banner adm-banner--warn">
                  Saatte bir sınırı: {fmtRemaining(at() - Date.now())} sonra yeniden gönderebilirsin.
                </p>
              )}
            </Show>
            <button
              type="submit"
              class="adm-btn adm-btn--small"
              disabled={
                title().trim() === "" ||
                body().trim() === "" ||
                cooldown() !== null ||
                broadcastRunning() ||
                push()?.enabled === false ||
                push()?.subscribers === 0
              }
            >
              Herkese gönder
            </button>
          </form>
        </div>
      </div>

      <Banner text={formError()} kind="bad" />
      <Show when={pending()}>
        {(p) => (
          <Confirm
            text={pendingText(p(), push()?.subscribers ?? 0)}
            danger={p().kind === "game" && (p() as { patch: { open?: boolean } }).patch.open === false}
            busy={busy()}
            onConfirm={() => void confirm()}
            onCancel={() => setPending(null)}
          />
        )}
      </Show>
    </section>
  );
}
