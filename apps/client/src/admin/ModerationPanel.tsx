import type {
  AdminBannedAccounts,
  AdminBannedWords,
  AdminReportDetail,
  AdminReportRow,
  ReportStatus,
} from "@glix/engine";
import { createSignal, For, onMount, Show } from "solid-js";
import { Detail } from "./AccountsPanel.js";
import {
  addBannedWord,
  fetchBannedAccounts,
  fetchBannedWords,
  fetchReport,
  fetchReports,
  kickPlayer,
  removeBannedWord,
  setReportStatus,
} from "./api.js";
import { Confirm } from "./Confirm.js";
import { fmtDateTime, fmtInt } from "./format.js";
import {
  adminNoteProblem,
  BANNED_WORDS_MAX,
  bannedWordProblem,
  QUEUE_FILTERS,
  type QueueFilter,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  targetKind,
} from "./moderationRules.js";

type Counts = Record<ReportStatus, number>;
const EMPTY: Counts = { new: 0, reviewed: 0, actioned: 0, rejected: 0 };

function Banner(props: { text: string | null; kind?: "bad" | "ok" }) {
  return (
    <Show when={props.text}>
      {(t) => (
        <p
          class={props.kind === "ok" ? "adm-banner adm-banner--ok" : "adm-banner adm-banner--bad"}
          role="alert"
        >
          {t()}
        </p>
      )}
    </Show>
  );
}

const statusLevel = (s: ReportStatus): "ok" | "warn" | "bad" | undefined =>
  s === "new" ? "warn" : s === "rejected" ? undefined : "ok";

type Step = { op: "status"; status: ReportStatus } | { op: "kick" } | { op: "remove-word"; word: string };

function stepText(step: Step, r: AdminReportDetail | null): string {
  switch (step.op) {
    case "status":
      return `Bildirim "${REPORT_STATUS_LABELS[step.status]}" olarak işaretlenecek. Bildiren kişiye bir şey gitmez.`;
    case "kick":
      return `"${r?.targetName ?? ""}" odadan atılacak ve o odaya 10 dakika giremeyecek.`;
    case "remove-word":
      return `"${step.word}" yasaklı kelime listesinden silinecek.`;
  }
}

function ReportDetail(props: { id: number; onClose: () => void; onChanged: () => void; onOtp: () => void }) {
  const [r, setR] = createSignal<AdminReportDetail | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [step, setStep] = createSignal<Step | null>(null);
  const [note, setNote] = createSignal("");
  const [accountOpen, setAccountOpen] = createSignal(false);

  async function load(): Promise<void> {
    const res = await fetchReport(props.id);
    if (res.kind === "otp") props.onOtp();
    else if (res.kind === "error") setError(res.message);
    else {
      setError(null);
      setR(res.data);
      setNote(res.data.adminNote);
    }
  }
  onMount(() => void load());

  async function confirm(): Promise<void> {
    const s = step();
    const rep = r();
    if (!s || !rep || busy()) return;
    setBusy(true);
    const res =
      s.op === "status"
        ? await setReportStatus(rep.id, s.status, note().trim())
        : s.op === "kick"
          ? await kickPlayer(rep.roomCode, rep.targetPlayerId)
          : { ok: false, message: "" };
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setStep(null);
      return;
    }
    setStep(null);
    setError(null);
    setDone(res.message);
    props.onChanged();
    await load();
  }

  const noteProblem = () => adminNoteProblem(note());
  const ask = (s: Step): void => {
    setDone(null);
    setError(null);
    setStep(s);
  };

  return (
    <section class="adm-card adm-detail" aria-labelledby="adm-rep-h">
      <header class="adm-section__head">
        <h3 id="adm-rep-h" class="adm-h3">
          Bildirim #{props.id}
        </h3>
        <button type="button" class="adm-btn adm-btn--ghost adm-btn--small" onClick={props.onClose}>
          Kapat
        </button>
      </header>
      <Banner text={error()} />
      <Banner text={done()} kind="ok" />
      <Show when={r()} fallback={<Show when={!error()}>{<p class="adm-muted">Yükleniyor...</p>}</Show>}>
        {(rep) => (
          <>
            <dl class="adm-dl">
              <div>
                <dt>Hedef</dt>
                <dd class="adm-wrap">
                  {rep().targetName}{" "}
                  <span class="adm-muted">
                    ({rep().targetAccountId === null ? "misafir" : `hesap #${rep().targetAccountId}`}
                    {" — bildirim anındaki ad)"}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Bildiren</dt>
                <dd>{rep().reporterAccountId === null ? "Misafir" : `Hesap #${rep().reporterAccountId}`}</dd>
              </div>
              <div>
                <dt>Sebep</dt>
                <dd>{REPORT_REASON_LABELS[rep().reason]}</dd>
              </div>
              <div>
                <dt>Oda / oyun</dt>
                <dd>
                  <span class="mono">{rep().roomCode}</span> · {rep().gameId ?? "oyun yok"}
                </dd>
              </div>
              <div>
                <dt>Zaman</dt>
                <dd>{fmtDateTime(rep().createdAt)}</dd>
              </div>
              <div>
                <dt>Durum</dt>
                <dd data-level={statusLevel(rep().status)}>
                  {REPORT_STATUS_LABELS[rep().status]}
                  <Show when={rep().reviewedAt !== null}>
                    <span class="adm-muted"> · {fmtDateTime(rep().reviewedAt ?? 0)}</span>
                  </Show>
                </dd>
              </div>
            </dl>

            <h4 class="adm-h4">Bildirenin notu</h4>
            <p class="adm-wrap">{rep().note === "" ? "—" : rep().note}</p>

            <h4 class="adm-h4">Kanıt</h4>
            <Show
              when={rep().evidence}
              fallback={
                <p class="adm-muted">
                  Eklenmiş metin yok. Yalnız oyunda herkese gösterilmiş metinler eklenir; gizli bilgi
                  eklenmez.
                </p>
              }
            >
              {(ev) => (
                <>
                  <p class="adm-muted">
                    {ev().gameId} oyununda herkese gösterilmiş, hedefin yazdığı metinler:
                  </p>
                  <ul class="adm-evidence">
                    <For each={ev().texts}>{(t) => <li class="adm-wrap">{t}</li>}</For>
                  </ul>
                </>
              )}
            </Show>

            <label for="adm-rep-note">Yönetici notu (yalnız burada görünür)</label>
            <textarea
              id="adm-rep-note"
              class="adm-field adm-textarea"
              maxlength="300"
              value={note()}
              onInput={(e) => setNote(e.currentTarget.value)}
            />
            <Show when={noteProblem()}>
              {(p) => (
                <p class="adm-count" data-over>
                  {p()}
                </p>
              )}
            </Show>

            <Show
              when={step()}
              fallback={
                <div class="adm-actions">
                  <div class="adm-inline">
                    <button
                      type="button"
                      class="adm-btn adm-btn--small"
                      disabled={noteProblem() !== null || rep().status === "reviewed"}
                      onClick={() => ask({ op: "status", status: "reviewed" })}
                    >
                      İncelendi
                    </button>
                    <button
                      type="button"
                      class="adm-btn adm-btn--small"
                      disabled={noteProblem() !== null || rep().status === "actioned"}
                      onClick={() => ask({ op: "status", status: "actioned" })}
                    >
                      İşlem yapıldı
                    </button>
                    <button
                      type="button"
                      class="adm-btn adm-btn--ghost adm-btn--small"
                      disabled={noteProblem() !== null || rep().status === "rejected"}
                      onClick={() => ask({ op: "status", status: "rejected" })}
                    >
                      Reddet
                    </button>
                    <Show when={rep().status !== "new"}>
                      <button
                        type="button"
                        class="adm-btn adm-btn--ghost adm-btn--small"
                        disabled={noteProblem() !== null}
                        onClick={() => ask({ op: "status", status: "new" })}
                      >
                        Yeniden aç
                      </button>
                    </Show>
                  </div>

                  <Show when={targetKind(rep()) === "account"}>
                    <Show
                      when={!rep().targetProtected}
                      fallback={
                        <p class="adm-banner adm-banner--warn">
                          Hedef yönetici hesabı: ad değiştirme ve askı kapalı.
                        </p>
                      }
                    >
                      <button
                        type="button"
                        class="adm-btn adm-btn--ghost adm-btn--small"
                        onClick={() => setAccountOpen(!accountOpen())}
                      >
                        {accountOpen()
                          ? "Hesap işlemlerini gizle"
                          : "Hesap işlemleri (ad değiştir, askıya al)"}
                      </button>
                    </Show>
                  </Show>
                  <Show when={targetKind(rep()) === "guest-in-room"}>
                    <button
                      type="button"
                      class="adm-btn adm-btn--danger adm-btn--small"
                      onClick={() => ask({ op: "kick" })}
                    >
                      Odadan at
                    </button>
                  </Show>
                  <Show when={targetKind(rep()) === "guest-gone"}>
                    <p class="adm-muted">Misafir artık odada değil; yapılacak işlem yok.</p>
                  </Show>
                </div>
              }
            >
              {(s) => (
                <Confirm
                  text={stepText(s(), rep())}
                  danger={s().op === "kick"}
                  busy={busy()}
                  onConfirm={() => void confirm()}
                  onCancel={() => setStep(null)}
                />
              )}
            </Show>

            <Show when={accountOpen() && rep().targetAccountId !== null}>
              <Detail
                id={rep().targetAccountId ?? 0}
                onClose={() => setAccountOpen(false)}
                onChanged={props.onChanged}
                onOtp={props.onOtp}
              />
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}

function Queue(props: { onOtp: () => void }) {
  const [filter, setFilter] = createSignal<QueueFilter>("new");
  const [rows, setRows] = createSignal<AdminReportRow[]>([]);
  const [counts, setCounts] = createSignal<Counts>(EMPTY);
  const [next, setNext] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [open, setOpen] = createSignal<number | null>(null);

  async function load(more = false): Promise<void> {
    setLoading(true);
    const r = await fetchReports(filter(), more ? next() : null);
    setLoading(false);
    if (r.kind === "otp") return props.onOtp();
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setRows(more ? [...rows(), ...r.data.reports] : r.data.reports);
    setCounts(r.data.counts);
    setNext(r.data.nextBefore);
  }
  onMount(() => void load());

  const pick = (f: QueueFilter): void => {
    setFilter(f);
    setOpen(null);
    void load();
  };
  const countOf = (f: QueueFilter): number =>
    f === "all" ? counts().new + counts().reviewed + counts().actioned + counts().rejected : counts()[f];

  return (
    <>
      <header class="adm-section__head">
        <h3 class="adm-h3">Bildirim kuyruğu</h3>
        <button type="button" class="adm-btn adm-btn--ghost" disabled={loading()} onClick={() => void load()}>
          {loading() ? "Yenileniyor..." : "Yenile"}
        </button>
      </header>
      <Banner text={error()} />
      <fieldset class="adm-seg adm-seg--wrap">
        <legend class="adm-sr">Durum süzgeci</legend>
        <For each={QUEUE_FILTERS}>
          {(f) => (
            <button
              type="button"
              class="adm-seg__opt"
              classList={{ "adm-seg__opt--on": filter() === f.id }}
              aria-pressed={filter() === f.id}
              onClick={() => pick(f.id)}
            >
              {f.label} ({fmtInt(countOf(f.id))})
            </button>
          )}
        </For>
      </fieldset>

      <Show when={rows().length > 0} fallback={<p class="adm-muted">Bu durumda bildirim yok.</p>}>
        <div class="adm-table-wrap">
          <table class="adm-table adm-stack">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Hedef</th>
                <th>Sebep</th>
                <th>Oda</th>
                <th>Oyun</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              <For each={rows()}>
                {(r) => (
                  <tr>
                    <td data-label="Zaman">{fmtDateTime(r.createdAt)}</td>
                    <td data-label="Hedef">
                      <button type="button" class="adm-link" onClick={() => setOpen(r.id)}>
                        {r.targetName}
                      </button>{" "}
                      <small class="adm-muted">{r.targetAccountId === null ? "misafir" : "hesap"}</small>
                    </td>
                    <td data-label="Sebep">{REPORT_REASON_LABELS[r.reason]}</td>
                    <td data-label="Oda" class="mono">
                      {r.roomCode}
                    </td>
                    <td data-label="Oyun">{r.gameId ?? "—"}</td>
                    <td data-label="Durum" data-level={statusLevel(r.status)}>
                      {REPORT_STATUS_LABELS[r.status]}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
        <Show when={next() !== null}>
          <button
            type="button"
            class="adm-btn adm-btn--ghost"
            disabled={loading()}
            onClick={() => void load(true)}
          >
            Daha eski bildirimler
          </button>
        </Show>
      </Show>

      <Show when={open()} keyed>
        {(id) => (
          <ReportDetail
            id={id}
            onClose={() => setOpen(null)}
            onOtp={props.onOtp}
            onChanged={() => void load()}
          />
        )}
      </Show>
    </>
  );
}

function BannedWords(props: { onOtp: () => void }) {
  const [data, setData] = createSignal<AdminBannedWords | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  const [word, setWord] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [step, setStep] = createSignal<Step | null>(null);
  const [matched, setMatched] = createSignal<AdminBannedAccounts | null>(null);

  async function load(): Promise<void> {
    const r = await fetchBannedWords();
    if (r.kind === "otp") props.onOtp();
    else if (r.kind === "error") setError(r.message);
    else {
      setError(null);
      setData(r.data);
    }
  }
  onMount(() => void load());

  const count = () => data()?.words.length ?? 0;
  const problem = () => (word().trim() === "" ? null : bannedWordProblem(word(), count()));

  async function add(e: Event): Promise<void> {
    e.preventDefault();
    if (busy() || word().trim() === "" || problem()) return;
    setBusy(true);
    const r = await addBannedWord(word().trim());
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    setDone(r.message);
    setWord("");
    setMatched(null);
    await load();
  }

  async function remove(): Promise<void> {
    const s = step();
    if (s?.op !== "remove-word" || busy()) return;
    setBusy(true);
    const r = await removeBannedWord(s.word);
    setBusy(false);
    setStep(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    setDone(r.message);
    setMatched(null);
    await load();
  }

  async function scan(): Promise<void> {
    setBusy(true);
    const r = await fetchBannedAccounts();
    setBusy(false);
    if (r.kind === "otp") return props.onOtp();
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setMatched(r.data);
  }

  return (
    <>
      <header class="adm-section__head">
        <h3 class="adm-h3">Yasaklı kelimeler</h3>
        <span class="adm-muted">
          {fmtInt(count())} / {BANNED_WORDS_MAX}
        </span>
      </header>
      <p class="adm-muted adm-note">
        Kullanıcı adı (kayıt, değiştirme, Google) ve misafir takma adı bu listeyle denetlenir; takılana "Bu ad
        kullanılamaz." denir. Harf büyüklüğü, Türkçe harfler (ı/i, ş/s, ğ/g...), 0→o 1→i 3→e 4→a 5→s 7→t ve
        araya konan işaretler yok sayılır. 3 harf ve altı kelimeler yalnız bütün ad ya da ayrı sözcük olarak
        takılır. Oyun içi yazılar engellenmez. Yönetici ad değiştirmesi muaftır; mevcut adlar kendiliğinden
        değişmez.
      </p>
      <Banner text={error()} />
      <Banner text={done()} kind="ok" />

      <form class="adm-card adm-inline" onSubmit={(e) => void add(e)}>
        <label for="adm-word">Yeni kelime</label>
        <input
          id="adm-word"
          class="adm-field"
          maxlength="40"
          autocomplete="off"
          value={word()}
          onInput={(e) => setWord(e.currentTarget.value)}
        />
        <button
          type="submit"
          class="adm-btn adm-btn--small"
          disabled={busy() || word().trim() === "" || problem() !== null}
        >
          Ekle
        </button>
        <Show when={problem()}>
          {(p) => (
            <p class="adm-count" data-over>
              {p()}
            </p>
          )}
        </Show>
      </form>

      <Show when={data()} fallback={<p class="adm-muted">Yükleniyor...</p>}>
        {(d) => (
          <Show when={d().words.length > 0} fallback={<p class="adm-muted">Liste boş.</p>}>
            <ul class="adm-words">
              <For each={d().words}>
                {(w) => (
                  <li class="adm-word">
                    <span class="adm-wrap">{w.word}</span>
                    <button
                      type="button"
                      class="adm-btn adm-btn--ghost adm-btn--small"
                      aria-label={`${w.word} kelimesini sil`}
                      onClick={() => setStep({ op: "remove-word", word: w.word })}
                    >
                      Sil
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )}
      </Show>

      <Show when={step()}>
        {(s) => (
          <Confirm
            text={stepText(s(), null)}
            danger
            busy={busy()}
            onConfirm={() => void remove()}
            onCancel={() => setStep(null)}
          />
        )}
      </Show>

      <div class="adm-card">
        <h4 class="adm-h4">Listeye takılan mevcut hesaplar</h4>
        <p class="adm-muted adm-note">
          Salt okunur yardımcı: hiçbir ad değişmez. Gerekirse Hesaplar sekmesinden elle değiştir.
        </p>
        <button
          type="button"
          class="adm-btn adm-btn--ghost adm-btn--small"
          disabled={busy()}
          onClick={() => void scan()}
        >
          Hesapları tara
        </button>
        <Show when={matched()}>
          {(m) => (
            <Show
              when={m().accounts.length > 0}
              fallback={<p class="adm-muted">Listeye takılan hesap yok.</p>}
            >
              <ul class="adm-words">
                <For each={m().accounts}>
                  {(a) => (
                    <li class="adm-word">
                      <span class="adm-wrap">{a.username}</span>
                      <span class="adm-muted mono">#{a.id}</span>
                    </li>
                  )}
                </For>
              </ul>
              <Show when={m().truncated}>
                <p class="adm-muted adm-note">İlk 50 hesap gösteriliyor; listeyi daraltınca azalır.</p>
              </Show>
            </Show>
          )}
        </Show>
      </div>
    </>
  );
}

export function ModerationPanel(props: { onOtp: () => void }) {
  return (
    <section class="adm-section" aria-labelledby="adm-mod-h">
      <header class="adm-section__head">
        <h2 id="adm-mod-h">Moderasyon</h2>
      </header>
      <Queue onOtp={props.onOtp} />
      <BannedWords onOtp={props.onOtp} />
    </section>
  );
}
