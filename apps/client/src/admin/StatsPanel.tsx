import type { AdminStats } from "@glix/engine";
import { createSignal, For, onMount, Show } from "solid-js";
import { fetchStats } from "./api.js";
import { Bars, HBars } from "./charts.js";
import { fmtDateTime, fmtInt, fmtNum, fmtPct, shortDay } from "./format.js";

const MODE_LABEL: Record<string, string> = { random: "Rastgele", manual: "Elle seçim" };

export function StatsPanel(props: { onOtp: () => void }) {
  const [data, setData] = createSignal<AdminStats | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function load(): Promise<void> {
    setLoading(true);
    const r = await fetchStats();
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
    <section class="adm-section" aria-labelledby="adm-stats-h">
      <header class="adm-section__head">
        <h2 id="adm-stats-h">Oyun istatistikleri</h2>
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
          <>
            <Show
              when={d().enabled}
              fallback={
                <p class="adm-banner adm-banner--warn">İstatistik kaydı kapalı (STATS_DB ayarlı değil).</p>
              }
            >
              <p class="adm-muted">Anonim kayıtlar, son {d().windowDays} gün. Kişi bilgisi tutulmaz.</p>

              <div class="adm-grid">
                <div class="adm-card">
                  <h3 class="adm-h3">Günlük maç (son 30 gün)</h3>
                  <Bars
                    data={d().daily.map((x) => ({ label: shortDay(x.day), value: x.matches }))}
                    unit="maç"
                    caption="Günlük maç sayısı"
                  />
                </div>
                <div class="adm-card">
                  <h3 class="adm-h3">Günlük oyuncu (son 30 gün)</h3>
                  <Bars
                    data={d().daily.map((x) => ({ label: shortDay(x.day), value: x.players }))}
                    unit="oyuncu"
                    caption="Günlük oyuncu sayısı"
                    color="var(--magenta)"
                  />
                </div>
              </div>

              <div class="adm-grid">
                <div class="adm-card">
                  <h3 class="adm-h3">Haftalık toplam (son 8 hafta)</h3>
                  <div class="adm-table-wrap">
                    <table class="adm-table adm-stack">
                      <thead>
                        <tr>
                          <th>Hafta başı</th>
                          <th class="num">Maç</th>
                          <th class="num">Oyuncu</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={[...d().weekly].reverse()}>
                          {(w) => (
                            <tr>
                              <td data-label="Hafta başı">{shortDay(w.weekStart)}</td>
                              <td data-label="Maç" class="num">
                                {fmtInt(w.matches)}
                              </td>
                              <td data-label="Oyuncu" class="num">
                                {fmtInt(w.players)}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div class="adm-card">
                  <h3 class="adm-h3">Oyuncu sayısı dağılımı (maç)</h3>
                  <Show
                    when={d().playerCounts.length > 0}
                    fallback={<p class="adm-muted">Henüz kayıt yok.</p>}
                  >
                    <HBars
                      rows={d().playerCounts.map((p) => ({ label: `${p.players} kişi`, value: p.matches }))}
                    />
                  </Show>
                </div>
              </div>

              <h3 class="adm-h3">Oyunlar</h3>
              <Show when={d().games.length > 0} fallback={<p class="adm-muted">Henüz oyun kaydı yok.</p>}>
                <div class="adm-table-wrap">
                  <table class="adm-table adm-stack">
                    <thead>
                      <tr>
                        <th>Oyun</th>
                        <th class="num">Oynanma</th>
                        <th class="num">Ort. süre</th>
                        <th class="num">Yarıda kalma</th>
                        <th class="num">Çöken</th>
                        <th class="num" title="Oyunun geçtiği maçların geri bildirim ortalaması">
                          Maç puanı
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={d().games}>
                        {(g) => (
                          <tr>
                            <td data-label="Oyun">{g.gameId}</td>
                            <td data-label="Oynanma" class="num">
                              {fmtInt(g.plays)}
                            </td>
                            <td data-label="Ort. süre" class="num">
                              {fmtNum(g.avgDurationSec, 0)} sn
                            </td>
                            <td
                              data-label="Yarıda kalma"
                              class="num"
                              data-level={g.abandonRate >= 0.3 ? "warn" : "ok"}
                            >
                              {fmtPct(g.abandonRate)}
                            </td>
                            <td data-label="Çöken" class="num" data-level={g.failed > 0 ? "bad" : "ok"}>
                              {g.failed}
                            </td>
                            <td data-label="Maç puanı" class="num">
                              {g.ratingAvg === null ? "—" : `${fmtNum(g.ratingAvg, 2)} (${g.ratingCount})`}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
                <p class="adm-muted adm-note">
                  Geri bildirim maç başına verildiği için oyun puanı, o oyunun oynandığı maçların
                  ortalamasıdır.
                </p>
              </Show>

              <div class="adm-grid">
                <div class="adm-card">
                  <h3 class="adm-h3">
                    Geri bildirim
                    <small class="adm-muted">
                      {" "}
                      {fmtInt(d().feedback.count)} adet · ortalama{" "}
                      {d().feedback.avg === null ? "—" : fmtNum(d().feedback.avg ?? 0, 2)} / 5
                    </small>
                  </h3>
                  <HBars
                    color="var(--amber)"
                    rows={d()
                      .feedback.byRating.map((n, i) => ({ label: `${i + 1} yıldız`, value: n }))
                      .reverse()}
                  />
                </div>
                <div class="adm-card">
                  <h3 class="adm-h3">Rastgele seçim</h3>
                  <Show when={d().selection.length > 0} fallback={<p class="adm-muted">Henüz kayıt yok.</p>}>
                    <ul class="adm-kv">
                      <For each={d().selection}>
                        {(s) => (
                          <li>
                            <span>{MODE_LABEL[s.mode] ?? s.mode}</span>
                            <b>
                              {fmtInt(s.matches)} maç{" "}
                              <small class="adm-muted">· ort. {fmtNum(s.avgGameCount)} oyun</small>
                            </b>
                          </li>
                        )}
                      </For>
                    </ul>
                    <h4 class="adm-h4">Maç başına oyun sayısı</h4>
                    <HBars
                      rows={d().gameCounts.map((g) => ({ label: `${g.count} oyun`, value: g.matches }))}
                    />
                  </Show>
                </div>
              </div>

              <h3 class="adm-h3">Son yazılı geri bildirimler</h3>
              <Show
                when={d().feedback.latest.length > 0}
                fallback={<p class="adm-muted">Yazılı geri bildirim yok.</p>}
              >
                <ul class="adm-feed">
                  <For each={d().feedback.latest}>
                    {(f) => (
                      <li>
                        <span class="adm-feed__rate" role="img" aria-label={`${f.rating} / 5`}>
                          {"★".repeat(f.rating)}
                        </span>
                        <span class="adm-feed__text">{f.text}</span>
                        <time class="adm-muted">{fmtDateTime(f.at)}</time>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>

            <h3 class="adm-h3">Hesaplar</h3>
            <div class="adm-tiles">
              <div class="adm-tile">
                <span class="adm-tile__label">Toplam hesap</span>
                <strong class="adm-tile__value">{fmtInt(d().accounts.total)}</strong>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">E-postası doğrulanmış</span>
                <strong class="adm-tile__value">
                  {d().accounts.total === 0 ? "—" : fmtPct(d().accounts.verified / d().accounts.total)}
                </strong>
                <span class="adm-tile__sub">{fmtInt(d().accounts.verified)} hesap</span>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">Google / şifre</span>
                <strong class="adm-tile__value">
                  {fmtInt(d().accounts.google)} / {fmtInt(d().accounts.password)}
                </strong>
                <span class="adm-tile__sub">ikisi birden olan sayılır</span>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">Arkadaşlık</span>
                <strong class="adm-tile__value">{fmtInt(d().accounts.friendships)}</strong>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">Verilen rozet</span>
                <strong class="adm-tile__value">{fmtInt(d().accounts.badgesAwarded)}</strong>
              </div>
            </div>
            <div class="adm-card">
              <h3 class="adm-h3">Yeni hesap (son 30 gün)</h3>
              <Bars
                data={d().accounts.newPerDay.map((x) => ({ label: shortDay(x.day), value: x.count }))}
                unit="hesap"
                caption="Günlük yeni hesap sayısı"
                color="var(--lime)"
              />
            </div>
          </>
        )}
      </Show>
    </section>
  );
}
