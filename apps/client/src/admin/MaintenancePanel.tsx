import type { AdminMaintenance } from "@glix/engine";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { downloadBackup, fetchMaintenance, logout, setMaintenance } from "./api.js";
import { Confirm } from "./Confirm.js";
import { backupQuotaText, maintenanceOnWarning } from "./contentRules.js";
import { fmtDateTime, fmtDuration, fmtInt, type Level, releaseStateLabel, shortRevision } from "./format.js";

/** Bakım ekranı 5 sn'de bir yenilenir: yönetici süren maç sayısını canlı görür. */
export const MAINTENANCE_REFRESH_MS = 5000;

type Step = "maintenance" | "backup" | null;

export function MaintenancePanel(props: { onOtp: () => void }) {
  const [data, setData] = createSignal<AdminMaintenance | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  const [step, setStep] = createSignal<Step>(null);
  const [busy, setBusy] = createSignal(false);
  const [needFresh, setNeedFresh] = createSignal(false);
  const [now, setNow] = createSignal(Date.now());

  let inFlight = false;
  async function refresh(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    const r = await fetchMaintenance();
    inFlight = false;
    setNow(Date.now());
    if (r.kind === "otp") {
      props.onOtp();
      return;
    }
    if (r.kind === "error") {
      setError(r.message);
      return;
    }
    setError(null);
    setData(r.data);
  }
  onMount(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, MAINTENANCE_REFRESH_MS);
    onCleanup(() => clearInterval(timer));
  });

  async function confirm(): Promise<void> {
    const s = step();
    const d = data();
    if (!s || !d || busy()) return;
    setBusy(true);
    setError(null);
    setDone(null);
    setNeedFresh(false);
    if (s === "maintenance") {
      const r = await setMaintenance(!d.on);
      if (r.ok) setDone(r.message);
      else setError(r.message);
    } else {
      const r = await downloadBackup();
      if (r.ok) setDone(r.message);
      else {
        setError(r.message);
        if (r.code === "fresh_required") setNeedFresh(true);
      }
    }
    setBusy(false);
    setStep(null);
    await refresh();
  }

  const matchLevel = (d: AdminMaintenance): Level => (d.activeMatches > 0 ? "warn" : "ok");

  return (
    <section class="adm-section" aria-labelledby="adm-maint-h">
      <header class="adm-section__head">
        <h2 id="adm-maint-h">Bakım</h2>
        <button type="button" class="adm-btn adm-btn--ghost" onClick={() => void refresh()}>
          Yenile
        </button>
      </header>
      <Show when={error()}>
        {(e) => (
          <p class="adm-banner adm-banner--bad" role="alert">
            {e()}
          </p>
        )}
      </Show>
      <Show when={needFresh()}>
        <p class="adm-banner adm-banner--warn" role="status">
          Yedek e-posta adresleri içerdiği için yakın zamanda girilmiş kodla alınır.{" "}
          <button type="button" class="adm-link" onClick={() => void logout().then(() => props.onOtp())}>
            Çıkış yap ve kodu yeniden gir
          </button>
        </p>
      </Show>
      <Show when={done()}>
        {(t) => (
          <p class="adm-banner adm-banner--ok" role="status">
            {t()}
          </p>
        )}
      </Show>

      <Show when={data()} fallback={<p class="adm-muted">Yükleniyor...</p>}>
        {(d) => (
          <>
            <div class="adm-card adm-detail">
              <h3 class="adm-h3">Bakım kipi</h3>
              <div class="adm-tiles">
                <div class="adm-tile" data-level={d().on ? "warn" : "ok"}>
                  <span class="adm-tile__label">Durum</span>
                  <strong class="adm-tile__value">{d().on ? "Açık" : "Kapalı"}</strong>
                  <span class="adm-tile__sub">{d().on ? "Yeni oda ve maç yok" : "Normal çalışıyor"}</span>
                </div>
                <div class="adm-tile" data-level={matchLevel(d())}>
                  <span class="adm-tile__label">Süren maç</span>
                  <strong class="adm-tile__value">{fmtInt(d().activeMatches)}</strong>
                  <span class="adm-tile__sub">
                    {d().activeMatches === 0 ? "Yeniden başlatmak güvenli" : "Bitmesini bekle"}
                  </span>
                </div>
                <div class="adm-tile">
                  <span class="adm-tile__label">Oda / oyuncu</span>
                  <strong class="adm-tile__value">
                    {fmtInt(d().rooms)} / {fmtInt(d().players)}
                  </strong>
                </div>
              </div>
              <Show when={d().draining}>
                <p class="adm-banner adm-banner--warn">Sunucu boşaltılıyor (güncelleme bekleniyor).</p>
              </Show>
              <p class="adm-muted">
                Açıkken yeni oda kurulamaz ve yeni maç başlamaz; süren maçlar normal biter, odalara katılım
                sürer. Ana sayfada ve lobide otomatik bir bakım bandı görünür. Ayar yeniden başlatmada da
                korunur; işin bitince kapatmayı unutma.
              </p>
              <div class="adm-inline">
                <button
                  type="button"
                  class="adm-btn adm-btn--small"
                  classList={{ "adm-btn--danger": !d().on }}
                  disabled={busy()}
                  onClick={() => {
                    setDone(null);
                    setStep("maintenance");
                  }}
                >
                  {d().on ? "Bakım kipini kapat" : "Bakım kipini aç"}
                </button>
              </div>
            </div>

            <div class="adm-card adm-detail">
              <h3 class="adm-h3">Veritabanı yedeği</h3>
              <p class="adm-banner adm-banner--warn">
                Yedek oyuncuların e-posta adreslerini ve hesap verisini içerir. Güvenli bir yerde sakla, işin
                bitince sil; başkasıyla paylaşma.
              </p>
              <p class="adm-muted">
                İki veritabanının tutarlı bir kopyası tek bir <span class="mono">.tar</span> dosyası olarak
                iner (içinde <span class="mono">.db</span> dosyaları). Sunucu çalışırken alınır. Her indirme
                işlem kaydına yazılır.
              </p>
              <p class="adm-muted">{backupQuotaText(d().backup, now())}</p>
              <div class="adm-inline">
                <button
                  type="button"
                  class="adm-btn adm-btn--small"
                  disabled={busy() || d().backup.usedToday >= d().backup.limit}
                  onClick={() => {
                    setDone(null);
                    setStep("backup");
                  }}
                >
                  Yedeği indir
                </button>
              </div>
            </div>

            <div class="adm-card">
              <h3 class="adm-h3">Son yayınlar</h3>
              <p class="adm-muted adm-note">
                Sunucunun her başlangıcı. "Kapanış kaydı yok": süreç çöktü ya da zorla durduruldu; süre en geç
                sonraki başlangıca kadardır.
              </p>
              <div class="adm-table-wrap">
                <table class="adm-table adm-stack">
                  <thead>
                    <tr>
                      <th>Başlangıç</th>
                      <th>Revizyon</th>
                      <th>Sürüm</th>
                      <th class="num">Süre</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().releases}>
                      {(r) => (
                        <tr>
                          <td data-label="Başlangıç">{fmtDateTime(r.startedAt)}</td>
                          <td data-label="Revizyon" class="mono">
                            {shortRevision(r.revision)}
                          </td>
                          <td data-label="Sürüm">{r.version}</td>
                          <td data-label="Süre" class="num">
                            {r.durationSec === null ? "—" : fmtDuration(r.durationSec)}
                          </td>
                          <td data-label="Durum" data-level={r.state === "unclean" ? "warn" : undefined}>
                            {releaseStateLabel(r.state)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>

            <Show when={step()}>
              {(s) => (
                <Confirm
                  text={
                    s() === "maintenance"
                      ? d().on
                        ? "Bakım kipi kapatılacak: yeni oda ve maçlar yeniden başlayabilir, bant kalkar."
                        : `Bakım kipi açılacak. ${maintenanceOnWarning(d().activeMatches)}`
                      : "Veritabanı yedeği indirilecek. Dosya e-posta adreslerini içerir; güvenli sakla."
                  }
                  confirmLabel={s() === "backup" ? "Yedeği indir" : "Onayla"}
                  danger={s() === "maintenance" && !d().on}
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
