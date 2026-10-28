import type { AdminEconomy } from "@glix/engine";
import { createSignal, For, onMount, Show } from "solid-js";
import { fetchEconomy } from "./api.js";
import { Bars, HBars } from "./charts.js";
import { fmtDateTime, fmtInt, shortDay } from "./format.js";

const RANGES = [
  { days: 7, label: "Son 7 gün" },
  { days: 30, label: "Son 30 gün" },
];
const signed = (n: number): string => (n > 0 ? `+${fmtInt(n)}` : fmtInt(n));

export function EconomyPanel(props: { onOtp: () => void }) {
  const [days, setDays] = createSignal(7);
  const [data, setData] = createSignal<AdminEconomy | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function load(): Promise<void> {
    setLoading(true);
    const r = await fetchEconomy(days());
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
    <section class="adm-section" aria-labelledby="adm-eco-h">
      <header class="adm-section__head">
        <h2 id="adm-eco-h">Glix ekonomisi</h2>
        <fieldset class="adm-seg">
          <legend class="adm-sr">Aralık</legend>
          <For each={RANGES}>
            {(r) => (
              <button
                type="button"
                class="adm-seg__opt"
                classList={{ "adm-seg__opt--on": days() === r.days }}
                aria-pressed={days() === r.days}
                onClick={() => {
                  setDays(r.days);
                  void load();
                }}
              >
                {r.label}
              </button>
            )}
          </For>
        </fieldset>
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
            <p class="adm-muted">Günler İstanbul saatine göredir. Kişi bilgisi gösterilmez.</p>
            <div class="adm-tiles">
              <div class="adm-tile">
                <span class="adm-tile__label">Dolaşımdaki Glix</span>
                <strong class="adm-tile__value">{fmtInt(d().circulation.total)}</strong>
                <span class="adm-tile__sub">tüm hesapların bakiyesi</span>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">Bakiyesi olan hesap</span>
                <strong class="adm-tile__value">{fmtInt(d().circulation.holders)}</strong>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">Kazanılan ({d().days} gün)</span>
                <strong class="adm-tile__value">{fmtInt(d().totals.kazanilan)}</strong>
                <span class="adm-tile__sub">
                  maç {fmtInt(d().totals.mac)} · rozet {fmtInt(d().totals.rozet)} · yönetici{" "}
                  {fmtInt(d().totals.yonetici)}
                </span>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">Harcanan ({d().days} gün)</span>
                <strong class="adm-tile__value">{fmtInt(d().totals.harcanan)}</strong>
                <span class="adm-tile__sub">yöneticinin düştüğü {fmtInt(d().totals.yoneticiEksi)}</span>
              </div>
              <div class="adm-tile" data-level={d().totals.net < 0 ? "warn" : undefined}>
                <span class="adm-tile__label">Net ({d().days} gün)</span>
                <strong class="adm-tile__value">{signed(d().totals.net)}</strong>
              </div>
              <div class="adm-tile">
                <span class="adm-tile__label">Günlük sınıra ulaşan</span>
                <strong class="adm-tile__value">{fmtInt(d().totals.sinirdaki)}</strong>
                <span class="adm-tile__sub">hesap-gün (sınır {fmtInt(d().dailyCap)} Glix)</span>
              </div>
            </div>

            <div class="adm-grid">
              <div class="adm-card">
                <h3 class="adm-h3">Günlük kazanılan Glix</h3>
                <Bars
                  data={d().daily.map((x) => ({ label: shortDay(x.day), value: x.kazanilan }))}
                  unit="Glix"
                  caption="Günlük kazanılan Glix"
                />
              </div>
              <div class="adm-card">
                <h3 class="adm-h3">Günlük harcanan Glix</h3>
                <Bars
                  data={d().daily.map((x) => ({ label: shortDay(x.day), value: x.harcanan }))}
                  unit="Glix"
                  caption="Günlük harcanan Glix"
                  color="var(--magenta)"
                />
              </div>
              <div class="adm-card">
                <h3 class="adm-h3">Günlük sınıra ulaşan hesap</h3>
                <Bars
                  data={d().daily.map((x) => ({ label: shortDay(x.day), value: x.sinirdaki }))}
                  unit="hesap"
                  caption="Günlük maç sınırına ulaşan hesap sayısı"
                  color="var(--amber)"
                />
              </div>
            </div>

            <h3 class="adm-h3">Günlük döküm</h3>
            <div class="adm-table-wrap">
              <table class="adm-table">
                <thead>
                  <tr>
                    <th>Gün</th>
                    <th class="num">Maç</th>
                    <th class="num">Rozet</th>
                    <th class="num">Yönetici +</th>
                    <th class="num">Yönetici -</th>
                    <th class="num">Harcanan</th>
                    <th class="num">Net</th>
                    <th class="num">Sınırda</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={[...d().daily].reverse()}>
                    {(x) => (
                      <tr>
                        <td>{shortDay(x.day)}</td>
                        <td class="num">{fmtInt(x.mac)}</td>
                        <td class="num">{fmtInt(x.rozet)}</td>
                        <td class="num">{fmtInt(x.yonetici)}</td>
                        <td class="num">{fmtInt(x.yoneticiEksi)}</td>
                        <td class="num">{fmtInt(x.harcanan)}</td>
                        <td class="num">{signed(x.net)}</td>
                        <td class="num">{fmtInt(x.sinirdaki)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            <h3 class="adm-h3">
              Mağaza satışları ({d().days} gün): {fmtInt(d().sales.count)} ürün, {fmtInt(d().sales.glix)} Glix
            </h3>
            <div class="adm-grid">
              <div class="adm-card">
                <h3 class="adm-h3">En çok satan 10 ürün</h3>
                <Show
                  when={d().topItems.length > 0}
                  fallback={<p class="adm-muted">Bu aralıkta satış yok.</p>}
                >
                  <div class="adm-table-wrap">
                    <table class="adm-table">
                      <thead>
                        <tr>
                          <th>Ürün</th>
                          <th>Tür</th>
                          <th class="num">Adet</th>
                          <th class="num">Glix</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={d().topItems}>
                          {(i) => (
                            <tr>
                              <td>{i.name}</td>
                              <td>{i.typeName}</td>
                              <td class="num">{fmtInt(i.count)}</td>
                              <td class="num">{fmtInt(i.glix)}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </div>
              <div class="adm-card">
                <h3 class="adm-h4">Nadirliğe göre (Glix)</h3>
                <Show
                  when={d().byRarity.length > 0}
                  fallback={<p class="adm-muted">Bu aralıkta satış yok.</p>}
                >
                  <HBars
                    rows={d().byRarity.map((g) => ({
                      label: g.label,
                      value: g.glix,
                      note: `${g.count} adet`,
                    }))}
                  />
                </Show>
                <h3 class="adm-h4">Türe göre (Glix)</h3>
                <Show when={d().byType.length > 0} fallback={<p class="adm-muted">Bu aralıkta satış yok.</p>}>
                  <HBars
                    color="var(--magenta)"
                    rows={d().byType.map((g) => ({ label: g.label, value: g.glix, note: `${g.count} adet` }))}
                  />
                </Show>
              </div>
            </div>

            <h3 class="adm-h3">Günün fırsatı</h3>
            <p class="adm-muted">{fmtDateTime(d().dealEndsAt)} tarihine kadar geçerli.</p>
            <div class="adm-table-wrap">
              <table class="adm-table">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th class="num">Liste</th>
                    <th class="num">Fırsat</th>
                    <th class="num">Bugün satılan</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={d().deals}>
                    {(x) => (
                      <tr>
                        <td>{x.name}</td>
                        <td class="num">{fmtInt(x.listPrice)}</td>
                        <td class="num">{fmtInt(x.price)}</td>
                        <td class="num">{fmtInt(x.soldToday)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}
