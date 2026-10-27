import type { AdminErrors } from "@glix/engine";
import { createSignal, For, onMount, Show } from "solid-js";
import { fetchErrors } from "./api.js";
import { Bars } from "./charts.js";
import { fmtAgo, fmtDateTime, fmtInt, fmtNum, PLATFORM_LABEL, shortDay } from "./format.js";

export function ErrorsPanel(props: { onOtp: () => void }) {
  const [data, setData] = createSignal<AdminErrors | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function load(): Promise<void> {
    setLoading(true);
    const r = await fetchErrors();
    setLoading(false);
    if (r.kind === "otp") props.onOtp();
    else if (r.kind === "error") setError(r.message);
    else {
      setError(null);
      setData(r.data);
    }
  }
  onMount(() => void load());

  return (
    <section class="adm-section" aria-labelledby="adm-err-h">
      <header class="adm-section__head">
        <h2 id="adm-err-h">Hatalar ve performans</h2>
        <button type="button" class="adm-btn adm-btn--ghost" disabled={loading()} onClick={() => void load()}>
          {loading() ? "Yenileniyor..." : "Yenile"}
        </button>
      </header>
      <Show when={error()}>
        {(e) => (
          <p class="adm-banner adm-banner--bad" role="alert">
            {e()}
          </p>
        )}
      </Show>
      <Show
        when={data()}
        fallback={
          <Show when={!error()}>
            <p class="adm-muted">Yükleniyor...</p>
          </Show>
        }
      >
        {(d) => (
          <Show
            when={d().enabled}
            fallback={
              <p class="adm-banner adm-banner--warn">İstatistik kaydı kapalı (STATS_DB ayarlı değil).</p>
            }
          >
            <p class="adm-muted">
              Hata metinleri adres sorgusu, e-posta ve belirteçlerden arındırılarak saklanır; 90 gün sonra
              silinir.
            </p>
            <div class="adm-card">
              <h3 class="adm-h3">Günlük istemci hatası (son 14 gün)</h3>
              <Bars
                data={d().perDay.map((x) => ({ label: shortDay(x.day), value: x.count }))}
                unit="hata"
                caption="Günlük istemci hatası"
                color="var(--red)"
              />
            </div>

            <h3 class="adm-h3">İstemci hataları (gruplu)</h3>
            <Show
              when={d().groups.length > 0}
              fallback={<p class="adm-muted">Kayıtlı istemci hatası yok.</p>}
            >
              <div class="adm-table-wrap">
                <table class="adm-table">
                  <thead>
                    <tr>
                      <th>Hata</th>
                      <th class="num">Adet</th>
                      <th>İlk / son görülme</th>
                      <th>Platform</th>
                      <th>Tarayıcı · sürüm</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().groups}>
                      {(g) => (
                        <tr>
                          <td class="adm-err">
                            <span>{g.message}</span>
                            <code class="mono adm-muted">{g.frame}</code>
                          </td>
                          <td class="num">{fmtInt(g.count)}</td>
                          <td>
                            <span>{fmtDateTime(g.firstSeen)}</span>
                            <br />
                            <span class="adm-muted">
                              {fmtAgo(g.lastSeen, Date.now())} · {fmtDateTime(g.lastSeen)}
                            </span>
                          </td>
                          <td>
                            <For each={Object.entries(g.platforms).filter(([, n]) => n > 0)}>
                              {([p, n]) => (
                                <span class="adm-chip">
                                  {PLATFORM_LABEL[p] ?? p} {fmtInt(n)}
                                </span>
                              )}
                            </For>
                          </td>
                          <td class="adm-muted">
                            {g.browsers.join(", ")} · {g.versions.join(", ")}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>

            <h3 class="adm-h3">Cihaz performansı (son 7 gün)</h3>
            <Show when={d().perf.length > 0} fallback={<p class="adm-muted">Performans kaydı yok.</p>}>
              <div class="adm-table-wrap">
                <table class="adm-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th class="num">Örnek</th>
                      <th class="num">Kopma / örnek</th>
                      <th class="num">Yenileme / örnek</th>
                      <th class="num">Onay p95 (ms)</th>
                      <th class="num">Dokunma p95 (ms)</th>
                      <th class="num">Uzun görev / örnek</th>
                      <th class="num">RTT medyan (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().perf}>
                      {(p) => (
                        <tr>
                          <td>{PLATFORM_LABEL[p.platform] ?? p.platform}</td>
                          <td class="num">{fmtInt(p.samples)}</td>
                          <td class="num" data-level={p.reconnectsPerSample >= 1 ? "warn" : "ok"}>
                            {fmtNum(p.reconnectsPerSample, 2)}
                          </td>
                          <td class="num">{fmtNum(p.reloadsPerSample, 2)}</td>
                          <td class="num" data-level={p.ackP95 >= 300 ? "warn" : "ok"}>
                            {fmtInt(p.ackP95)}
                          </td>
                          <td class="num" data-level={p.tapP95 >= 200 ? "warn" : "ok"}>
                            {fmtInt(p.tapP95)}
                          </td>
                          <td class="num">{fmtNum(p.longTasksPerSample, 2)}</td>
                          <td class="num">{fmtInt(p.rttMedian)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <p class="adm-muted adm-note">
                iOS Safari uzun görev ve dokunma süresi ölçümlerini desteklemez; o sütunlar iOS'ta 0 görünür.
              </p>
            </Show>

            <h3 class="adm-h3">Çöken oyunlar</h3>
            <Show when={d().failures.length > 0} fallback={<p class="adm-muted">Çöken oyun yok.</p>}>
              <div class="adm-table-wrap">
                <table class="adm-table">
                  <thead>
                    <tr>
                      <th>Zaman</th>
                      <th>Oyun</th>
                      <th>İşlev</th>
                      <th>Hata</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={d().failures}>
                      {(f) => (
                        <tr>
                          <td>{fmtDateTime(f.at)}</td>
                          <td>{f.gameId}</td>
                          <td class="mono">{f.fn}</td>
                          <td class="adm-err">
                            <span>{f.message}</span>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <p class="adm-muted adm-note">
                Maç kaydı (oyuncu eylemleri) panele yazılmaz; yalnız sunucu günlüğündedir.
              </p>
            </Show>
          </Show>
        )}
      </Show>
    </section>
  );
}
