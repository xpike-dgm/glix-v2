import type { AdminAuditEntry } from "@glix/engine";
import { createSignal, For, onMount, Show } from "solid-js";
import { fetchAudit } from "./api.js";
import { auditDetail, auditLabel, fmtDateTime } from "./format.js";

export function AuditPanel(props: { onOtp: () => void }) {
  const [entries, setEntries] = createSignal<AdminAuditEntry[]>([]);
  const [next, setNext] = createSignal<number | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);

  async function load(more: boolean): Promise<void> {
    setLoading(true);
    const r = await fetchAudit(more ? next() : null);
    setLoading(false);
    if (r.kind === "otp") {
      props.onOtp();
      return;
    }
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setLoaded(true);
    setEntries(more ? [...entries(), ...r.data.entries] : r.data.entries);
    setNext(r.data.nextBefore);
  }
  onMount(() => void load(false));

  return (
    <section class="adm-section" aria-labelledby="adm-audit-h">
      <header class="adm-section__head">
        <h2 id="adm-audit-h">İşlem kaydı</h2>
        <button
          type="button"
          class="adm-btn adm-btn--ghost"
          disabled={loading()}
          onClick={() => void load(false)}
        >
          {loading() ? "Yenileniyor..." : "Yenile"}
        </button>
      </header>
      <p class="adm-muted">
        Yönetici işlemleri, en yeni üstte. Kayıtlar 1 yıl saklanır; e-posta ve kod yazılmaz.
      </p>
      <Show when={error()}>
        {(e) => (
          <p class="adm-banner adm-banner--bad" role="alert">
            {e()}
          </p>
        )}
      </Show>
      <Show when={loaded() && entries().length === 0}>
        <p class="adm-muted">Henüz kayıt yok.</p>
      </Show>
      <Show when={entries().length > 0}>
        <div class="adm-table-wrap">
          <table class="adm-table adm-stack">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>İşlem</th>
                <th>Hedef hesap</th>
                <th>Yönetici</th>
                <th>Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              <For each={entries()}>
                {(e) => (
                  <tr>
                    <td data-label="Zaman">{fmtDateTime(e.at)}</td>
                    <td data-label="İşlem">{auditLabel(e.action)}</td>
                    <td data-label="Hedef hesap" class="mono">
                      {e.targetId === null ? "—" : `#${e.targetId}`}
                    </td>
                    <td data-label="Yönetici" class="mono">
                      #{e.actorId}
                    </td>
                    <td data-label="Ayrıntı">{auditDetail(e.action, e.detail) || "—"}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
      <Show when={next() !== null}>
        <button
          type="button"
          class="adm-btn adm-btn--ghost"
          disabled={loading()}
          onClick={() => void load(true)}
        >
          {loading() ? "Yükleniyor..." : "Daha eski kayıtlar"}
        </button>
      </Show>
    </section>
  );
}
