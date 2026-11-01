/**
 * Test ve Performans alanı: test2 bot koşuları (sözleşme bölüm 14). "Koşu başlat" formu (oyunlar, oyuncu sayıları,
 * maç, strateji, süre), koşu geçmişi (durum, maç, takılan, çöken, rapor bağlantısı) ve dönemli koşu ayarı.
 */
import { createResource, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { al, gonder } from "./api.js";
import { goreliZaman, sure } from "./bicim.js";
import { Bos } from "./bilesenler.js";
import { olayDinle } from "./canli.js";
import { git, hataTost, tost } from "./durum.js";
import { Simge } from "./simgeler.js";

interface KosuIstegi {
  oyunlar: string[];
  oyuncular: number[];
  mac: number;
  strateji: "oyna" | "rastgele";
  sureDk: number;
}

interface KosuKaydi {
  id: number;
  istek: KosuIstegi;
  baslatan: string;
  durum: "suruyor" | "bitti" | "iptal" | "zaman_asimi" | "hata";
  baslama: number;
  bitis: number | null;
  ogeId: number | null;
  hata: string | null;
  ozet: { mac: number; biten: number; takilan: number; coken: number; sureMs: number | null } | null;
}

interface KosuPlani {
  acik: boolean;
  aralikSaat: number;
  istek: KosuIstegi;
  son: number | null;
}

interface Veri {
  acik: boolean;
  kosular: KosuKaydi[];
  plan: KosuPlani | null;
}

interface Oyun {
  id: string;
  ad: string;
  min: number;
  max: number;
}

export const KOSU_DURUM_ADI: Record<KosuKaydi["durum"], string> = {
  suruyor: "Sürüyor",
  bitti: "Bitti",
  iptal: "İptal edildi",
  zaman_asimi: "Süre doldu",
  hata: "Yarım kaldı",
};

const OYUNCU_SECENEKLERI = [2, 3, 4, 5, 6, 8];

function baslatanAdi(b: string): string {
  if (b === "plan") return "dönemli koşu";
  if (b.startsWith("yz:")) return "yapay zekâ";
  return "sen";
}

/** Oyun, oyuncu sayısı, maç ve strateji seçimi (koşu başlatma ve dönemli plan aynı formu kullanır). */
function IstekFormu(p: {
  oyunlar: Oyun[];
  deger: KosuIstegi;
  degisti: (i: KosuIstegi) => void;
}): JSX.Element {
  const sec = <T,>(liste: T[], x: T): T[] =>
    liste.includes(x) ? liste.filter((y) => y !== x) : [...liste, x];
  return (
    <div class="yigin kosu-formu">
      <fieldset class="kosu-formu__oyunlar cipler" aria-label="Oyunlar">
        <For each={p.oyunlar}>
          {(o) => (
            <button
              type="button"
              class="cip"
              aria-pressed={p.deger.oyunlar.includes(o.id)}
              onClick={() => p.degisti({ ...p.deger, oyunlar: sec(p.deger.oyunlar, o.id) })}
            >
              {o.ad}
            </button>
          )}
        </For>
      </fieldset>
      <div class="satir kosu-formu__satir">
        <span class="soluk kucuk">Oyuncu</span>
        <For each={OYUNCU_SECENEKLERI}>
          {(n) => (
            <button
              type="button"
              class="cip"
              aria-pressed={p.deger.oyuncular.includes(n)}
              onClick={() =>
                p.degisti({
                  ...p.deger,
                  oyuncular: sec(p.deger.oyuncular, n)
                    .sort((a, b) => a - b)
                    .slice(0, 4),
                })
              }
            >
              {n}
            </button>
          )}
        </For>
      </div>
      <div class="satir kosu-formu__satir">
        <label class="satir">
          <span class="soluk kucuk">Maç</span>
          <input
            class="girdi girdi--kisa"
            type="number"
            min="1"
            max="10"
            value={p.deger.mac}
            onInput={(e) =>
              p.degisti({ ...p.deger, mac: Math.max(1, Math.min(10, Number(e.currentTarget.value) || 1)) })
            }
          />
        </label>
        <label class="satir">
          <span class="soluk kucuk">Süre sınırı (dk)</span>
          <input
            class="girdi girdi--kisa"
            type="number"
            min="1"
            max="120"
            value={p.deger.sureDk}
            onInput={(e) =>
              p.degisti({
                ...p.deger,
                sureDk: Math.max(1, Math.min(120, Number(e.currentTarget.value) || 30)),
              })
            }
          />
        </label>
        <label class="satir">
          <span class="soluk kucuk">Bot</span>
          <select
            class="girdi"
            value={p.deger.strateji}
            onChange={(e) =>
              p.degisti({ ...p.deger, strateji: e.currentTarget.value === "rastgele" ? "rastgele" : "oyna" })
            }
          >
            <option value="oyna">İnsan gibi oynar</option>
            <option value="rastgele">Kuralları zorlar</option>
          </select>
        </label>
      </div>
      <p class="cok-soluk kucuk">
        {p.deger.oyunlar.length} oyun × {Math.max(1, p.deger.oyuncular.length)} oyuncu sayısı × {p.deger.mac}{" "}
        maç = {p.deger.oyunlar.length * Math.max(1, p.deger.oyuncular.length) * p.deger.mac} maç (en çok 60).
        Oyuncu seçilmezse oyuna uygun sayı kullanılır.
      </p>
    </div>
  );
}

export function KosuPaneli(): JSX.Element {
  const [veri, { refetch }] = createResource(() => al<Veri>("kosu"));
  const [oyunlar] = createResource(() =>
    al<{ oyunlar: Oyun[] }>("oyunlar")
      .then((r) => r.oyunlar)
      .catch(() => [] as Oyun[]),
  );
  onCleanup(olayDinle(["teslim", "ayar"], () => void refetch()));
  // Süren koşu varken 15 sn'de bir tazelenir (bitince rapor teslim edilir).
  const t = setInterval(() => {
    if (veri()?.kosular.some((k) => k.durum === "suruyor")) void refetch();
  }, 15_000);
  onCleanup(() => clearInterval(t));
  const [istek, setIstek] = createSignal<KosuIstegi>({
    oyunlar: [],
    oyuncular: [3],
    mac: 1,
    strateji: "oyna",
    sureDk: 30,
  });
  const [planAcik, setPlanAcik] = createSignal(false);
  const [planIstek, setPlanIstek] = createSignal<KosuIstegi | null>(null);
  const [aralik, setAralik] = createSignal(12);
  const [mesgul, setMesgul] = createSignal(false);
  const suren = (): KosuKaydi | undefined => veri()?.kosular.find((k) => k.durum === "suruyor");
  const baslat = async (): Promise<void> => {
    setMesgul(true);
    try {
      await gonder("kosu", istek());
      tost("Koşu başladı; bitince rapor kendiliğinden gelir.");
      void refetch();
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };
  const iptal = async (k: KosuKaydi): Promise<void> => {
    try {
      await gonder(`kosu/${k.id}/iptal`);
      tost("Koşu iptal edildi");
      void refetch();
    } catch (e) {
      hataTost(e);
    }
  };
  const planiAc = (): void => {
    const p = veri()?.plan;
    setPlanIstek(p?.istek.oyunlar.length ? p.istek : istek());
    setAralik(p?.aralikSaat ?? 12);
    setPlanAcik(true);
  };
  const planKaydet = async (acik: boolean): Promise<void> => {
    try {
      await gonder("kosu/plan", { acik, aralikSaat: aralik(), istek: planIstek() ?? istek() });
      tost(acik ? `Dönemli koşu: her ${aralik()} saatte` : "Dönemli koşu kapatıldı");
      setPlanAcik(false);
      void refetch();
    } catch (e) {
      hataTost(e);
    }
  };
  return (
    <Show
      when={veri()?.acik}
      fallback={
        <Bos simge="katman" baslik="Oyun alanı bağlı değil">
          Bot koşuları test2'de çalışır; sitede URETIM_TEST2_URL ve URETIM_TEST2_TOKEN ayarlı olmalı.
        </Bos>
      }
    >
      <div class="yigin yigin--genis">
        <section class="kart kart--ic yigin">
          <div class="satir satir--ara">
            <strong>Koşu başlat</strong>
            <span class="cok-soluk kucuk">test2'de yalnız botlarla; aynı anda tek koşu</span>
          </div>
          <IstekFormu oyunlar={oyunlar() ?? []} deger={istek()} degisti={setIstek} />
          <div class="satir">
            <button
              type="button"
              class="dg dg--birincil"
              disabled={mesgul() || !istek().oyunlar.length || suren() !== undefined}
              onClick={() => void baslat()}
            >
              <Simge ad="oynat" /> {suren() ? "Bir koşu sürüyor" : "Koşu başlat"}
            </button>
          </div>
        </section>

        <section class="kart kart--ic yigin">
          <div class="satir satir--ara">
            <strong>Dönemli koşu</strong>
            <Show when={veri()?.plan?.acik} fallback={<span class="etiket">Kapalı</span>}>
              <span class="etiket etiket--gecti">Her {veri()?.plan?.aralikSaat} saatte</span>
            </Show>
            <span class="esnek" />
            <button type="button" class="dg dg--k dg--hayalet" onClick={planiAc}>
              <Simge ad="ayar" /> Ayarla
            </button>
          </div>
          <Show when={veri()?.plan?.acik && veri()?.plan}>
            {(p) => (
              <p class="soluk kucuk">
                {p().istek.oyunlar.length} oyun · {p().istek.oyuncular.join("/") || "oyuna göre"} oyuncu ·{" "}
                {p().istek.mac} maç · son koşu {p().son ? goreliZaman(p().son ?? 0, Date.now()) : "henüz yok"}
              </p>
            )}
          </Show>
          <Show when={planAcik()}>
            <div class="yigin">
              <div class="satir">
                <span class="soluk kucuk">Aralık</span>
                <For each={[6, 12, 24]}>
                  {(s) => (
                    <button
                      type="button"
                      class="cip"
                      aria-pressed={aralik() === s}
                      onClick={() => setAralik(s)}
                    >
                      {s} saat
                    </button>
                  )}
                </For>
              </div>
              <IstekFormu oyunlar={oyunlar() ?? []} deger={planIstek() ?? istek()} degisti={setPlanIstek} />
              <div class="satir">
                <button
                  type="button"
                  class="dg dg--birincil"
                  disabled={!(planIstek() ?? istek()).oyunlar.length}
                  onClick={() => void planKaydet(true)}
                >
                  Kaydet ve aç
                </button>
                <Show when={veri()?.plan?.acik}>
                  <button type="button" class="dg dg--hayalet" onClick={() => void planKaydet(false)}>
                    Kapat
                  </button>
                </Show>
                <button type="button" class="dg dg--hayalet" onClick={() => setPlanAcik(false)}>
                  Vazgeç
                </button>
              </div>
            </div>
          </Show>
        </section>

        <section class="kart kart--ic yigin">
          <strong>Koşu geçmişi</strong>
          <Show when={veri()?.kosular.length} fallback={<p class="cok-soluk kucuk">Henüz koşu yok.</p>}>
            <ul class="kosu-listesi">
              <For each={veri()?.kosular ?? []}>
                {(k) => (
                  <li class="kosu-satiri" data-durum={k.durum}>
                    <span
                      class={`etiket ${k.durum === "bitti" ? "etiket--gecti" : k.durum === "suruyor" ? "etiket--vurgu" : k.durum === "hata" ? "etiket--kaldi" : "etiket--uyari"}`}
                    >
                      {KOSU_DURUM_ADI[k.durum]}
                    </span>
                    <span class="esnek">
                      <span class="tasma">
                        #{k.id} · {k.istek.oyunlar.length} oyun ·{" "}
                        {k.istek.oyuncular.join("/") || "oyuna göre"} oyuncu
                      </span>
                      <span class="cok-soluk kucuk">
                        {goreliZaman(k.baslama, Date.now())} · {baslatanAdi(k.baslatan)}
                        <Show when={k.ozet}>
                          {(o) => (
                            <>
                              {" "}
                              · {o().mac} maç, {o().biten} bitti
                              {o().takilan ? `, ${o().takilan} takıldı` : ""}
                              {o().coken ? `, ${o().coken} çöktü` : ""}
                              {o().sureMs !== null ? ` · ${sure(o().sureMs ?? 0)}` : ""}
                            </>
                          )}
                        </Show>
                        <Show when={k.hata}> · {k.hata}</Show>
                      </span>
                    </span>
                    <Show when={k.durum === "suruyor"}>
                      <button type="button" class="dg dg--k dg--hayalet" onClick={() => void iptal(k)}>
                        İptal
                      </button>
                    </Show>
                    <Show when={k.ogeId}>
                      {(id) => (
                        <button
                          type="button"
                          class="dg dg--k dg--hayalet"
                          onClick={() => git(`/incele/${id()}`)}
                        >
                          <Simge ad="rapor" /> Rapor
                        </button>
                      )}
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
      </div>
    </Show>
  );
}
