/** Arşiv (UM-İ9) ve canlıdaki öğeler (UM-F7 köken): alan, ad, tarih, durum ile arama; aktarımları geri alma. */
import { createResource, createSignal, For, type JSX, Show } from "solid-js";
import { ALANLAR } from "../../../src/ortak/alanlar.js";
import { DURUM_ADI, DURUMLAR } from "../../../src/ortak/durum.js";
import type { AktarimKaydi, Koken, OgeOzeti } from "../../../src/ortak/tipler.js";
import { TESLIM_TURU_ADI } from "../../../src/ortak/tipler.js";
import { al, gonder } from "../api.js";
import { goreliZaman, tarihSaat } from "../bicim.js";
import { AlanIsareti, Bos, DurumEtiketi, IskeletKartlar, Sekmeler } from "../bilesenler.js";
import { git, hataTost, sorgu, tost } from "../durum.js";
import { Simge } from "../simgeler.js";
import { GORUNUM_SIMGE } from "./Alan.js";

type Sekme = "arsiv" | "canli" | "aktarim";

export function Arsiv(): JSX.Element {
  const [sekme, setSekme] = createSignal<Sekme>(
    sorgu().get("sekme") === "canli" ? "canli" : sorgu().get("sekme") === "aktarim" ? "aktarim" : "arsiv",
  );
  const [alan, setAlan] = createSignal("");
  const [ad, setAd] = createSignal("");
  const [durum, setDurum] = createSignal("");
  const [tarihten, setTarihten] = createSignal("");
  const [tarihe, setTarihe] = createSignal("");
  const [sayfa, setSayfa] = createSignal(0);
  const sorguMetni = (): string => {
    const q = new URLSearchParams();
    if (alan()) q.set("alan", alan());
    if (ad().trim()) q.set("ad", ad().trim());
    if (durum()) q.set("durum", durum());
    if (tarihten()) q.set("tarihten", tarihten());
    if (tarihe()) q.set("tarihe", tarihe());
    q.set("sayfa", String(sayfa()));
    return q.toString();
  };
  const [sonuc] = createResource(sorguMetni, (q) => al<{ ogeler: OgeOzeti[]; toplam: number }>(`arsiv?${q}`));
  const [canli] = createResource(
    () => (sekme() === "canli" ? alan() || "hepsi" : null),
    (a) =>
      al<{ ogeler: (OgeOzeti & { koken: Koken })[] }>(`canlidakiler${a !== "hepsi" ? `?alan=${a}` : ""}`),
  );
  const [aktarimlar, { refetch: aktarimYenile }] = createResource(
    () => (sekme() === "aktarim" ? 1 : null),
    () => al<{ aktarimlar: AktarimKaydi[] }>("aktarimlar"),
  );
  const geriAl = async (a: AktarimKaydi): Promise<void> => {
    try {
      await gonder(`aktarim/${a.id}/geri-al`);
      tost("Aktarım geri alındı; eklenenler oyunda kapatıldı");
      void aktarimYenile();
    } catch (e) {
      hataTost(e);
    }
  };
  return (
    <div class="sayfa">
      <header class="sayfa__bas">
        <div>
          <h1>Arşiv</h1>
          <p class="soluk">
            Her teslimin bütün sürümleri burada. Canlıdakilerin kökeni ve tek tık aktarımlar da.
          </p>
        </div>
      </header>
      <Sekmeler<Sekme>
        etiket="Arşiv görünümü"
        secili={sekme()}
        sec={setSekme}
        secenekler={[
          { id: "arsiv", ad: "Bütün teslimler" },
          { id: "canli", ad: "Canlıdakiler" },
          { id: "aktarim", ad: "Aktarımlar" },
        ]}
      />
      <div class="sayfa__govde yigin">
        <Show when={sekme() !== "aktarim"}>
          <div class="suzgecler">
            <label class="arama-kutusu">
              <Simge ad="ara" boyut={16} />
              <input
                class="girdi"
                value={ad()}
                onInput={(e) => {
                  setAd(e.currentTarget.value);
                  setSayfa(0);
                }}
                placeholder="Ada göre ara"
                aria-label="Ada göre ara"
              />
            </label>
            <select
              class="girdi"
              value={alan()}
              onChange={(e) => {
                setAlan(e.currentTarget.value);
                setSayfa(0);
              }}
              aria-label="Alan"
            >
              <option value="">Bütün alanlar</option>
              <For each={ALANLAR}>{(a) => <option value={a.id}>{a.ad}</option>}</For>
            </select>
            <Show when={sekme() === "arsiv"}>
              <select
                class="girdi"
                value={durum()}
                onChange={(e) => {
                  setDurum(e.currentTarget.value);
                  setSayfa(0);
                }}
                aria-label="Durum"
              >
                <option value="">Bütün durumlar</option>
                <For each={DURUMLAR}>{(d) => <option value={d}>{DURUM_ADI[d]}</option>}</For>
              </select>
              <input
                class="girdi"
                type="date"
                value={tarihten()}
                onInput={(e) => {
                  setTarihten(e.currentTarget.value);
                  setSayfa(0);
                }}
                aria-label="Başlangıç tarihi"
              />
              <input
                class="girdi"
                type="date"
                value={tarihe()}
                onInput={(e) => {
                  setTarihe(e.currentTarget.value);
                  setSayfa(0);
                }}
                aria-label="Bitiş tarihi"
              />
            </Show>
          </div>
        </Show>
        <Show when={sekme() === "arsiv"}>
          <Show when={!sonuc.loading || sonuc()} fallback={<IskeletKartlar adet={4} y="28px" />}>
            <Show
              when={sonuc()?.ogeler.length}
              fallback={
                <Bos simge="arsiv" baslik="Sonuç yok">
                  Süzgeçleri gevşetmeyi dene.
                </Bos>
              }
            >
              <p class="cok-soluk kucuk">{sonuc()?.toplam} sonuç</p>
              <ul class="oge-listesi">
                <For each={sonuc()?.ogeler}>
                  {(o) => (
                    <li>
                      <a
                        class="oge-satiri"
                        href={`/incele/${o.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          git(`/incele/${o.id}`);
                        }}
                      >
                        <span class="oge-satiri__simge">
                          <Simge ad={GORUNUM_SIMGE[o.gorunum]} />
                        </span>
                        <span class="esnek">
                          <span class="tasma oge-satiri__ad">{o.ad}</span>
                          <span class="cok-soluk kucuk satir" style={{ gap: "6px", "flex-wrap": "wrap" }}>
                            <AlanIsareti alan={o.alan} />· {TESLIM_TURU_ADI[o.tur]} · {o.surum}. sürüm ·{" "}
                            {goreliZaman(o.olusturma, Date.now())}
                          </span>
                        </span>
                        <DurumEtiketi durum={o.durum} />
                      </a>
                    </li>
                  )}
                </For>
              </ul>
              <div class="satir satir--ara">
                <button
                  type="button"
                  class="dg dg--k"
                  disabled={sayfa() === 0}
                  onClick={() => setSayfa(sayfa() - 1)}
                >
                  <Simge ad="onceki" /> Önceki
                </button>
                <span class="cok-soluk kucuk">Sayfa {sayfa() + 1}</span>
                <button
                  type="button"
                  class="dg dg--k"
                  disabled={(sayfa() + 1) * 50 >= (sonuc()?.toplam ?? 0)}
                  onClick={() => setSayfa(sayfa() + 1)}
                >
                  Sonraki <Simge ad="sonraki" />
                </button>
              </div>
            </Show>
          </Show>
        </Show>
        <Show when={sekme() === "canli"}>
          <Show when={canli()} fallback={<IskeletKartlar adet={3} y="28px" />}>
            <Show
              when={canli()?.ogeler.length}
              fallback={
                <Bos simge="simsek" baslik="Canlıda öğe yok">
                  Onaylananlar oyuna eklenip yayına çıkınca burada köken bilgileriyle görünür.
                </Bos>
              }
            >
              <div class="tablo-kap">
                <table class="tablo">
                  <thead>
                    <tr>
                      <th>Öğe</th>
                      <th>Alan</th>
                      <th>Talimat</th>
                      <th>Onaylayan</th>
                      <th>Paket / sürüm</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={canli()?.ogeler}>
                      {(o) => (
                        <tr onClick={() => git(`/incele/${o.id}`)} style={{ cursor: "pointer" }}>
                          <td>
                            <strong>{o.ad}</strong>
                            <div class="cok-soluk kucuk">
                              teslim {o.koken.teslimId}
                              {o.koken.isId ? ` · iş ${o.koken.isId}` : ""}
                            </div>
                          </td>
                          <td>
                            <AlanIsareti alan={o.alan} />
                          </td>
                          <td>{o.koken.talimatSurum ? `${o.koken.talimatSurum}. sürüm` : "–"}</td>
                          <td>
                            {o.koken.otomatik ? "Kademeli güven" : (o.koken.onaylayan ?? "–")}
                            <div class="cok-soluk kucuk">{o.koken.karar ? tarihSaat(o.koken.karar) : ""}</div>
                          </td>
                          <td class="mono kucuk">
                            {o.koken.paket
                              ? `${o.koken.paket.klasor}${o.koken.paket.revizyon ? ` · ${o.koken.paket.revizyon.slice(0, 7)}` : ""}`
                              : "Tek tık aktarım"}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </Show>
        <Show when={sekme() === "aktarim"}>
          <Show when={aktarimlar()} fallback={<IskeletKartlar adet={3} y="28px" />}>
            <Show
              when={aktarimlar()?.aktarimlar.length}
              fallback={
                <Bos simge="simsek" baslik="Henüz aktarım yok">
                  İçerik havuzu ve moderasyon satırları onaylanınca tek tıkla oyuna gider; burada geri
                  alınabilir.
                </Bos>
              }
            >
              <ul class="oge-listesi">
                <For each={aktarimlar()?.aktarimlar}>
                  {(a) => (
                    <li class="oge-satiri">
                      <span class="oge-satiri__simge">
                        <Simge ad="simsek" />
                      </span>
                      <span class="esnek">
                        <span class="oge-satiri__ad">{a.ozet}</span>
                        <span class="cok-soluk kucuk">
                          {a.hedef} · {tarihSaat(a.olusturma)}
                        </span>
                      </span>
                      <Show when={!a.geriAlindi} fallback={<span class="etiket">Geri alındı</span>}>
                        <button type="button" class="dg dg--k" onClick={() => void geriAl(a)}>
                          <Simge ad="geri" /> Geri al
                        </button>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
