import type {
  AdminPoolBulk,
  AdminPoolEntry,
  AdminPoolFilter,
  AdminPoolPage,
  AdminPoolSummary,
  AdminPools,
} from "@glix/engine";
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import {
  addPoolEntry,
  deletePoolEntry,
  editPoolEntry,
  fetchPoolPage,
  fetchPools,
  sendPoolLines,
  togglePoolEntry,
} from "./api.js";
import { Confirm } from "./Confirm.js";
import { fmtInt } from "./format.js";
import {
  badgesOf,
  bulkHint,
  emptyValues,
  entryText,
  LINE_STATUS_LABELS,
  minText,
  POOL_FILTERS,
  pageCount,
  poolStatus,
  splitPaste,
  valuesProblem,
} from "./poolRules.js";

type Step =
  | { op: "toggle"; entry: AdminPoolEntry; disabled: boolean }
  | { op: "delete"; entry: AdminPoolEntry }
  | { op: "save" }
  | { op: "bulk"; count: number };

const SEARCH_DEBOUNCE_MS = 300;

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

function stepText(s: Step, pool: AdminPoolSummary): string {
  switch (s.op) {
    case "toggle":
      return s.disabled
        ? `"${entryText(s.entry.fields, pool.fields)}" kapatılacak: bundan sonra başlayan maçlarda çıkmaz. Hazır girdi silinmez, istediğin zaman yeniden açılır.`
        : `"${entryText(s.entry.fields, pool.fields)}" yeniden açılacak.`;
    case "delete":
      return `Eklenen "${entryText(s.entry.fields, pool.fields)}" girdisi silinecek.`;
    case "save":
      return "Girdi kaydedilecek; değişiklik bundan sonra başlayan maçlara uygulanır, süren maçlar etkilenmez.";
    case "bulk":
      return `${s.count} girdi havuza eklenecek; değişiklik bundan sonra başlayan maçlara uygulanır.`;
  }
}

export function PoolsPanel(props: { onOtp: () => void }) {
  const [pools, setPools] = createSignal<AdminPools | null>(null);
  const [selected, setSelected] = createSignal<string | null>(null);
  const [page, setPage] = createSignal<AdminPoolPage | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  const [q, setQ] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal<AdminPoolFilter>("all");
  const [pageNo, setPageNo] = createSignal(1);
  const [busy, setBusy] = createSignal(false);
  const [step, setStep] = createSignal<Step | null>(null);
  /** Form: yeni girdi (editKey null) ya da düzenlenen eklenen/hazır girdi. */
  const [formOpen, setFormOpen] = createSignal(false);
  const [editKey, setEditKey] = createSignal<string | null>(null);
  const [values, setValues] = createSignal<Record<string, string>>({});
  const [bulkOpen, setBulkOpen] = createSignal(false);
  const [paste, setPaste] = createSignal("");
  const [preview, setPreview] = createSignal<AdminPoolBulk | null>(null);

  const current = (): AdminPoolSummary | null => {
    const id = selected();
    return pools()?.pools.find((p) => p.id === id) ?? null;
  };

  async function loadPools(): Promise<void> {
    const r = await fetchPools();
    if (r.kind === "otp") {
      props.onOtp();
      return;
    }
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setPools(r.data);
  }

  async function loadPage(): Promise<void> {
    const id = selected();
    if (id === null) return;
    const r = await fetchPoolPage(id, query(), filter(), pageNo());
    if (r.kind === "otp") {
      props.onOtp();
      return;
    }
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    // Sunucu sayfayı sınırlayabilir (silmeden sonra); gösterilen sayfaya uy.
    if (r.data.page !== pageNo()) setPageNo(r.data.page);
    setPage(r.data);
  }

  onMount(() => void loadPools());

  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const onSearch = (v: string): void => {
    setQ(v);
    clearTimeout(timer);
    timer = setTimeout(() => {
      setPageNo(1);
      setQuery(v);
    }, SEARCH_DEBOUNCE_MS);
  };

  createEffect(
    on([selected, query, filter, pageNo], () => {
      void loadPage();
    }),
  );

  function pick(id: string): void {
    if (selected() === id) return;
    setSelected(id);
    setPage(null);
    setQ("");
    setQuery("");
    setFilter("all");
    setPageNo(1);
    closeForms();
    setDone(null);
    setError(null);
  }

  function closeForms(): void {
    setFormOpen(false);
    setBulkOpen(false);
    setEditKey(null);
    setPreview(null);
    setPaste("");
    setStep(null);
  }

  function openAdd(): void {
    const p = current();
    if (!p) return;
    setBulkOpen(false);
    setEditKey(null);
    setValues(emptyValues(p.fields));
    setFormOpen(true);
  }

  function openEdit(e: AdminPoolEntry): void {
    setBulkOpen(false);
    setEditKey(e.key);
    setValues({ ...e.fields });
    setFormOpen(true);
  }

  function openBulk(): void {
    setFormOpen(false);
    setEditKey(null);
    setPreview(null);
    setBulkOpen(true);
  }

  const problem = (): string | null => {
    const p = current();
    return p ? valuesProblem(p.fields, values()) : null;
  };

  async function after(r: { ok: boolean; message?: string }, okText: string): Promise<void> {
    setBusy(false);
    setStep(null);
    if (!r.ok) {
      setError(r.message ?? "İşlem yapılamadı.");
      return;
    }
    setError(null);
    setDone(okText);
    await Promise.all([loadPools(), loadPage()]);
  }

  async function confirm(): Promise<void> {
    const s = step();
    const p = current();
    if (!s || !p || busy()) return;
    setBusy(true);
    switch (s.op) {
      case "toggle":
        return after(
          await togglePoolEntry(p.id, s.entry.key, s.disabled),
          s.disabled ? "Girdi kapatıldı." : "Girdi açıldı.",
        );
      case "delete":
        return after(await deletePoolEntry(p.id, s.entry.key), "Girdi silindi.");
      case "save": {
        const key = editKey();
        const r =
          key === null ? await addPoolEntry(p.id, values()) : await editPoolEntry(p.id, key, values());
        if (r.ok) setFormOpen(false);
        return after(r, key === null ? "Girdi eklendi." : "Girdi güncellendi.");
      }
      case "bulk": {
        const r = await sendPoolLines(p.id, splitPaste(paste()).lines, true);
        setBusy(false);
        setStep(null);
        if (!r.ok) {
          setError(r.message);
          return;
        }
        setError(null);
        setPreview(r.data);
        setDone(`${r.data.added} girdi eklendi, ${r.data.lines.length - r.data.ok} satır atlandı.`);
        if (r.data.added > 0) setPaste("");
        await Promise.all([loadPools(), loadPage()]);
        return;
      }
    }
  }

  async function check(): Promise<void> {
    const p = current();
    if (!p || busy()) return;
    const { lines, cut } = splitPaste(paste());
    if (lines.length === 0) {
      setError("Önce satırları yapıştır.");
      return;
    }
    setBusy(true);
    const r = await sendPoolLines(p.id, lines, false);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(cut ? "İlk 200 satır denetlendi; fazlası kesildi." : null);
    setDone(null);
    setPreview(r.data);
  }

  return (
    <section class="adm-section" aria-labelledby="adm-pools-h">
      <header class="adm-section__head">
        <h2 id="adm-pools-h">İçerik havuzları</h2>
      </header>
      <p class="adm-muted adm-note">
        Oyunların seçtiği kelime ve soru listeleri. Hazır girdiler silinmez, yalnız kapatılır; kendi
        girdilerini ekleyebilir, düzenleyebilir ve silebilirsin. Değişiklikler bundan sonra başlayan maçlara
        uygulanır; süren maçlar etkilenmez. Etkin girdi sayısı gereken asgarinin altına inerse oyun hazır
        havuzla devam eder.
      </p>
      <Banner text={error()} kind="bad" />
      <Banner text={done()} kind="ok" />

      <Show when={pools()} fallback={<p class="adm-muted">Yükleniyor...</p>}>
        {(d) => (
          <ul class="adm-poolpick" aria-label="Havuzlar">
            <For each={d().pools}>
              {(p) => (
                <li>
                  <button
                    type="button"
                    class="adm-poolpick__btn"
                    classList={{ "adm-poolpick__btn--on": selected() === p.id }}
                    aria-pressed={selected() === p.id}
                    onClick={() => pick(p.id)}
                  >
                    <span class="adm-poolpick__game">{p.gameName}</span>
                    <strong>{p.label}</strong>
                    <span class="adm-muted">{minText(p)}</span>
                    <Show when={p.belowMin}>
                      <span class="adm-badge adm-badge--off">Asgarinin altında</span>
                    </Show>
                    <Show when={p.applied}>
                      <span class="adm-badge adm-badge--added">Değiştirildi</span>
                    </Show>
                  </button>
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>

      <Show when={current()}>
        {(p) => (
          <>
            <div class="adm-card">
              <h3 class="adm-h3">{p().label}</h3>
              <p class="adm-muted adm-note">{p().hint}</p>
              <div class="adm-tiles">
                <div class="adm-tile">
                  <span class="adm-tile__label">Hazır</span>
                  <strong class="adm-tile__value">{fmtInt(p().builtin)}</strong>
                  <span class="adm-tile__sub">{fmtInt(p().disabled)} kapalı</span>
                </div>
                <div class="adm-tile">
                  <span class="adm-tile__label">Eklenen</span>
                  <strong class="adm-tile__value">{fmtInt(p().custom)}</strong>
                  <span class="adm-tile__sub">en çok {fmtInt(pools()?.customMax ?? 0)}</span>
                </div>
                <div class="adm-tile" data-level={p().active < p().min ? "bad" : "ok"}>
                  <span class="adm-tile__label">Etkin</span>
                  <strong class="adm-tile__value">{fmtInt(p().active)}</strong>
                  <span class="adm-tile__sub">
                    en az {fmtInt(p().min)} gerekli · maç başına {fmtInt(p().needed)} çekilir
                  </span>
                </div>
              </div>
              <Show when={poolStatus(p())}>
                {(s) => <Banner text={s().text} kind={s().level === "bad" ? "bad" : "ok"} />}
              </Show>
            </div>

            <div class="adm-card adm-search">
              <div class="adm-inline">
                <label for="adm-pool-q">Ara</label>
                <input
                  id="adm-pool-q"
                  class="adm-field"
                  type="search"
                  maxlength="80"
                  autocomplete="off"
                  placeholder="Girdi ara (harf büyüklüğü ve aksan fark etmez)"
                  value={q()}
                  onInput={(e) => onSearch(e.currentTarget.value)}
                />
              </div>
              <fieldset class="adm-seg adm-seg--wrap">
                <legend class="adm-sr">Süzgeç</legend>
                <For each={POOL_FILTERS}>
                  {(f) => (
                    <button
                      type="button"
                      class="adm-seg__opt"
                      classList={{ "adm-seg__opt--on": filter() === f.id }}
                      aria-pressed={filter() === f.id}
                      onClick={() => {
                        setPageNo(1);
                        setFilter(f.id);
                      }}
                    >
                      {f.label}
                    </button>
                  )}
                </For>
              </fieldset>
              <div class="adm-inline">
                <button type="button" class="adm-btn adm-btn--small" onClick={openAdd}>
                  Girdi ekle
                </button>
                <button type="button" class="adm-btn adm-btn--ghost adm-btn--small" onClick={openBulk}>
                  Toplu ekle
                </button>
              </div>
            </div>

            <Show when={formOpen()}>
              <form
                class="adm-card adm-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!problem()) setStep({ op: "save" });
                }}
              >
                <h4 class="adm-h4">{editKey() === null ? "Yeni girdi" : "Girdiyi düzenle"}</h4>
                <Show
                  when={
                    editKey() !== null &&
                    page()?.entries.find((e) => e.key === editKey())?.source === "builtin"
                  }
                >
                  <p class="adm-muted adm-note">
                    Hazır girdiyi düzenlersen hazır olan kapatılır, değişen hâli "Eklenen" olarak eklenir.
                  </p>
                </Show>
                <For each={p().fields}>
                  {(f) => (
                    <div class="adm-fieldrow">
                      <label for={`adm-pf-${f.key}`}>{f.label}</label>
                      <Show
                        when={f.long}
                        fallback={
                          <input
                            id={`adm-pf-${f.key}`}
                            class="adm-field"
                            autocomplete="off"
                            placeholder={f.hint}
                            value={values()[f.key] ?? ""}
                            onInput={(e) => setValues({ ...values(), [f.key]: e.currentTarget.value })}
                          />
                        }
                      >
                        <textarea
                          id={`adm-pf-${f.key}`}
                          class="adm-field adm-textarea"
                          placeholder={f.hint}
                          value={values()[f.key] ?? ""}
                          onInput={(e) => setValues({ ...values(), [f.key]: e.currentTarget.value })}
                        />
                      </Show>
                    </div>
                  )}
                </For>
                <Show when={problem()}>
                  {(m) => (
                    <p class="adm-count" data-over>
                      {m()}
                    </p>
                  )}
                </Show>
                <div class="adm-inline">
                  <button
                    type="submit"
                    class="adm-btn adm-btn--small"
                    disabled={busy() || problem() !== null}
                  >
                    Kaydet
                  </button>
                  <button type="button" class="adm-btn adm-btn--ghost adm-btn--small" onClick={closeForms}>
                    Vazgeç
                  </button>
                </div>
              </form>
            </Show>

            <Show when={bulkOpen()}>
              <div class="adm-card adm-form">
                <h4 class="adm-h4">Toplu ekle</h4>
                <p class="adm-muted adm-note">
                  {bulkHint(p().fields)} En çok 200 satır; önce önizleme yapılır, hatalı satırlar eklenmez.
                </p>
                <label class="adm-sr" for="adm-pool-paste">
                  Satırlar
                </label>
                <textarea
                  id="adm-pool-paste"
                  class="adm-field adm-textarea adm-textarea--tall"
                  spellcheck={false}
                  value={paste()}
                  onInput={(e) => {
                    setPaste(e.currentTarget.value);
                    setPreview(null);
                  }}
                />
                <div class="adm-inline">
                  <button
                    type="button"
                    class="adm-btn adm-btn--small"
                    disabled={busy()}
                    onClick={() => void check()}
                  >
                    Önizle
                  </button>
                  <Show when={preview() && preview()?.added === 0 && (preview()?.ok ?? 0) > 0}>
                    <button
                      type="button"
                      class="adm-btn adm-btn--small"
                      disabled={busy()}
                      onClick={() => setStep({ op: "bulk", count: preview()?.ok ?? 0 })}
                    >
                      {preview()?.ok} girdiyi kaydet
                    </button>
                  </Show>
                  <button type="button" class="adm-btn adm-btn--ghost adm-btn--small" onClick={closeForms}>
                    Kapat
                  </button>
                </div>
                <Show when={preview()}>
                  {(pv) => (
                    <>
                      <p class="adm-muted">
                        {pv().lines.length} satır: {pv().ok} {pv().added > 0 ? "eklendi" : "eklenecek"},{" "}
                        {pv().lines.length - pv().ok} atlanacak.
                      </p>
                      <div class="adm-table-wrap">
                        <table class="adm-table adm-stack">
                          <thead>
                            <tr>
                              <th>Satır</th>
                              <th>Girdi</th>
                              <th>Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={pv().lines}>
                              {(l) => (
                                <tr>
                                  <td data-label="Satır">{l.line}</td>
                                  <td data-label="Girdi" class="adm-wrap">
                                    {entryText(l.fields, p().fields) || "—"}
                                  </td>
                                  <td data-label="Durum" data-level={l.status === "ok" ? undefined : "bad"}>
                                    {LINE_STATUS_LABELS[l.status]}
                                    <Show when={l.status !== "ok"}>
                                      <small class="adm-muted"> {l.message}</small>
                                    </Show>
                                  </td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Show>
              </div>
            </Show>

            <Show when={page()} fallback={<p class="adm-muted">Yükleniyor...</p>}>
              {(pg) => (
                <>
                  <p class="adm-muted">
                    {fmtInt(pg().total)} girdi · sayfa {pg().page} / {pageCount(pg().total, pg().pageSize)}
                  </p>
                  <Show
                    when={pg().entries.length > 0}
                    fallback={<p class="adm-muted">Bu süzgeçle girdi yok.</p>}
                  >
                    <div class="adm-table-wrap">
                      <table class="adm-table adm-stack">
                        <thead>
                          <tr>
                            <For each={p().fields}>{(f) => <th>{f.label}</th>}</For>
                            <th>Durum</th>
                            <th>İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={pg().entries}>
                            {(e) => (
                              <tr data-closed={e.disabled ? "" : undefined}>
                                <For each={p().fields}>
                                  {(f) => (
                                    <td data-label={f.label} class="adm-wrap">
                                      {e.fields[f.key] ?? ""}
                                    </td>
                                  )}
                                </For>
                                <td data-label="Durum">
                                  <For each={badgesOf(e)}>
                                    {(b) => <span class={`adm-badge adm-badge--${b.tone}`}>{b.label}</span>}
                                  </For>
                                </td>
                                <td data-label="İşlemler">
                                  <span class="adm-inline">
                                    <button
                                      type="button"
                                      class="adm-btn adm-btn--ghost adm-btn--small"
                                      onClick={() => openEdit(e)}
                                    >
                                      Düzenle
                                    </button>
                                    <Show
                                      when={e.source === "builtin"}
                                      fallback={
                                        <button
                                          type="button"
                                          class="adm-btn adm-btn--ghost adm-btn--small adm-btn--danger"
                                          onClick={() => setStep({ op: "delete", entry: e })}
                                        >
                                          Sil
                                        </button>
                                      }
                                    >
                                      <button
                                        type="button"
                                        class="adm-btn adm-btn--ghost adm-btn--small"
                                        onClick={() =>
                                          setStep({ op: "toggle", entry: e, disabled: !e.disabled })
                                        }
                                      >
                                        {e.disabled ? "Aç" : "Kapat"}
                                      </button>
                                    </Show>
                                  </span>
                                </td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                    <div class="adm-inline">
                      <button
                        type="button"
                        class="adm-btn adm-btn--ghost adm-btn--small"
                        disabled={pg().page <= 1}
                        onClick={() => setPageNo(pg().page - 1)}
                      >
                        Önceki
                      </button>
                      <button
                        type="button"
                        class="adm-btn adm-btn--ghost adm-btn--small"
                        disabled={pg().page >= pageCount(pg().total, pg().pageSize)}
                        onClick={() => setPageNo(pg().page + 1)}
                      >
                        Sonraki
                      </button>
                    </div>
                  </Show>
                </>
              )}
            </Show>

            <Show when={step()}>
              {(s) => (
                <Confirm
                  text={stepText(s(), p())}
                  danger={s().op === "delete"}
                  busy={busy()}
                  onConfirm={() => void confirm()}
                  onCancel={() => setStep(null)}
                />
              )}
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}
