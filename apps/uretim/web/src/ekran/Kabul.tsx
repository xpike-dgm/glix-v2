/**
 * Kabul havuzu (Üretim Merkezi 2, aşama 1): kabul edilen teslimler alan alan. Yol: kabulde → yöneticide → ana kodda →
 * test'te → canlıda. "Yöneticiye gönder" kabuldekileri tek bir entegrasyon paketine (UM-İ7) alır; içerik havuzu ve
 * moderasyon gibi tek tık alanlar "Oyuna aktar" ile doğrudan gider (geri alınabilir). Paket ana koda eklenince sürüm
 * yazılır, test ortamına çıkınca işaretlenir; canlı sürüm o sürümü içerince öğeler kendiliğinden "canlıda" olur.
 */
import { createMemo, createResource, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { ALANLAR } from "../../../src/ortak/alanlar.js";
import type { OgeAyrinti, PaketKaydi } from "../../../src/ortak/tipler.js";
import { al, dosyaUrl, gonder } from "../api.js";
import { goreliZaman, tarihSaat } from "../bicim.js";
import { AlanIsareti, AltSayfa, Bos, IskeletKartlar } from "../bilesenler.js";
import { olayDinle, yerelOlay } from "../canli.js";
import { alanRengi, git, hataTost, tost } from "../durum.js";
import { panoYenile } from "../Kabuk.js";
import { Simge } from "../simgeler.js";

type Basamak = "kabulde" | "yoneticide" | "ana_kodda" | "testte" | "canlida";
interface Havuz {
  basamaklar: Record<Basamak, OgeAyrinti[]>;
  sayilar: Record<Basamak, number>;
  paketlenecek: number;
  tekTikIdler: number[];
}
const BASAMAKLAR: { id: Basamak; ad: string; aciklama: string }[] = [
  { id: "kabulde", ad: "Kabulde", aciklama: "Kabul ettiklerin; yöneticiye gönderilmeyi bekliyor." },
  { id: "yoneticide", ad: "Yöneticide", aciklama: "Pakette; yönetici test edip ana koda ekleyecek." },
  { id: "ana_kodda", ad: "Ana kodda", aciklama: "Ana dala eklendi; test ortamına çıkmayı bekliyor." },
  { id: "testte", ad: "Test'te", aciklama: "Test ortamında; “canlıya al” deyince canlıya çıkar." },
  { id: "canlida", ad: "Canlıda", aciklama: "Oyuncular görüyor." },
];

function KucukGorsel(p: { o: OgeAyrinti }): JSX.Element {
  const g = (): string | undefined => p.o.dosyalar.find((d) => d.tur === "png")?.ozet;
  return (
    <span class="kabul-oge__gorsel" style={{ "--alan-renk": alanRengi(p.o.alan) }}>
      <Show
        when={g()}
        fallback={<Simge ad={p.o.satirlar.length ? "liste" : p.o.gorunum === "ses" ? "ses" : "dosya"} />}
      >
        {(oz) => <img src={dosyaUrl(p.o.id, oz())} alt="" loading="lazy" decoding="async" />}
      </Show>
    </span>
  );
}

export function Kabul(): JSX.Element {
  const [veri, { refetch }] = createResource(() => al<Havuz>("kabul"));
  const [paketler, { refetch: paketYenile }] = createResource(() =>
    al<{ paketler: PaketKaydi[] }>("paketler"),
  );
  onCleanup(
    olayDinle(["karar", "geri_al", "aktarim", "paket", "teslim"], () => {
      void refetch();
      void paketYenile();
    }),
  );
  const [basamak, setBasamak] = createSignal<Basamak>("kabulde");
  const [mesgul, setMesgul] = createSignal(false);
  const [isaret, setIsaret] = createSignal<PaketKaydi | null>(null);
  const [rev, setRev] = createSignal("");
  const ogeler = (): OgeAyrinti[] => veri()?.basamaklar[basamak()] ?? [];
  const gruplar = createMemo(() =>
    ALANLAR.map((a) => ({ alan: a, ogeler: ogeler().filter((o) => o.alan === a.id) })).filter(
      (g) => g.ogeler.length,
    ),
  );
  const tekTik = (o: OgeAyrinti): boolean => veri()?.tekTikIdler.includes(o.id) ?? false;
  const yenile = (): void => {
    void refetch();
    void paketYenile();
    void panoYenile();
    yerelOlay("paket");
  };
  const gonderYoneticiye = async (): Promise<void> => {
    setMesgul(true);
    try {
      const r = await gonder<{ paket: PaketKaydi }>("paket");
      tost(`Yöneticiye gönderildi: ${r.paket.ogeSayisi} öğe (${r.paket.klasor})`);
      yenile();
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };
  const aktar = async (o: OgeAyrinti): Promise<void> => {
    try {
      const r = await gonder<{ aktarimlar: { id: number; ozet: string }[] }>(`oge/${o.id}/aktar`);
      const ak = r.aktarimlar[0];
      const geriAl = (id: number) => (): void =>
        void gonder(`aktarim/${id}/geri-al`)
          .then(() => {
            tost("Aktarım geri alındı");
            yenile();
          })
          .catch(hataTost);
      tost(`Oyuna aktarıldı: ${ak?.ozet ?? o.ad}`, ak ? { eylem: { ad: "Geri al", f: geriAl(ak.id) } } : {});
      yenile();
    } catch (e) {
      hataTost(e);
    }
  };
  const anaKodaEklendi = async (): Promise<void> => {
    const p = isaret();
    if (!p) return;
    try {
      await gonder(`paket/${p.id}/oyuna-eklendi`, { revizyon: rev().trim() });
      tost("Ana koda eklendi olarak işaretlendi.");
      setIsaret(null);
      setRev("");
      yenile();
    } catch (e) {
      hataTost(e);
    }
  };
  const testte = async (p: PaketKaydi): Promise<void> => {
    try {
      await gonder(`paket/${p.id}/testte`);
      tost("Test ortamında olarak işaretlendi.");
      yenile();
    } catch (e) {
      hataTost(e);
    }
  };
  const acikPaketler = (): PaketKaydi[] =>
    (paketler()?.paketler ?? []).filter((p) => p.durum !== "canlida").slice(0, 8);
  return (
    <div class="sayfa sayfa--genis">
      <header class="sayfa__bas">
        <div>
          <h1>Kabul havuzu</h1>
          <p class="soluk">
            Kabul ettiklerin burada birikir. “Yöneticiye gönder” deyince yönetici paketi test eder ve ana koda
            ekler; canlıya alma yalnız sen “canlıya al” deyince.
          </p>
        </div>
        <Show when={(veri()?.paketlenecek ?? 0) > 0}>
          <button
            type="button"
            class="dg dg--birincil"
            disabled={mesgul()}
            onClick={() => void gonderYoneticiye()}
          >
            <Simge ad="paket" /> {mesgul() ? "Hazırlanıyor…" : `Yöneticiye gönder (${veri()?.paketlenecek})`}
          </button>
        </Show>
      </header>

      <ol class="kabul-yolu" aria-label="Kabul yolu">
        <For each={BASAMAKLAR}>
          {(b) => (
            <li>
              <button
                type="button"
                class="kabul-yolu__basamak"
                aria-pressed={basamak() === b.id}
                onClick={() => setBasamak(b.id)}
              >
                <span class="kabul-yolu__sayi">{veri()?.sayilar[b.id] ?? "–"}</span>
                <span class="kabul-yolu__ad">{b.ad}</span>
              </button>
            </li>
          )}
        </For>
      </ol>
      <p class="kucuk soluk">{BASAMAKLAR.find((b) => b.id === basamak())?.aciklama}</p>

      <Show
        when={
          acikPaketler().length &&
          (basamak() === "yoneticide" || basamak() === "ana_kodda" || basamak() === "testte")
        }
      >
        <section class="kart kart--ic yigin">
          <h3>Paketler</h3>
          <ul class="oge-listesi">
            <For each={acikPaketler()}>
              {(p) => (
                <li class="oge-satiri">
                  <span class="oge-satiri__simge">
                    <Simge ad="paket" />
                  </span>
                  <span class="esnek">
                    <span class="oge-satiri__ad mono">{p.klasor}</span>
                    <span class="cok-soluk kucuk">
                      {p.ogeSayisi} öğe · {tarihSaat(p.olusturma)}
                      {p.revizyon ? ` · ${p.revizyon.slice(0, 7)}` : ""}
                    </span>
                  </span>
                  <Show when={p.durum === "hazir"}>
                    <button type="button" class="dg dg--k" onClick={() => setIsaret(p)}>
                      Ana koda eklendi
                    </button>
                  </Show>
                  <Show when={p.durum === "oyuna_eklendi"}>
                    <button type="button" class="dg dg--k" onClick={() => void testte(p)}>
                      Test'e çıktı
                    </button>
                  </Show>
                  <Show when={p.durum === "testte"}>
                    <span class="etiket etiket--vurgu">Test'te</span>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <Show when={!veri.loading || veri()} fallback={<IskeletKartlar adet={3} y="72px" />}>
        <Show
          when={gruplar().length}
          fallback={
            <Bos simge="paket" baslik={`${BASAMAKLAR.find((b) => b.id === basamak())?.ad}: boş`}>
              {basamak() === "kabulde"
                ? "İncelemede “Kabul et” dediğin teslimler burada birikir."
                : "Bu basamakta öğe yok."}
            </Bos>
          }
        >
          <div class="kabul-gruplar">
            <For each={gruplar()}>
              {(g) => (
                <section class="kart kabul-grup" style={{ "--alan-renk": alanRengi(g.alan.id) }}>
                  <div class="kabul-grup__bas">
                    <AlanIsareti alan={g.alan.id} />
                    <span class="sayac sayac--sessiz">{g.ogeler.length}</span>
                  </div>
                  <ul class="kabul-liste">
                    <For each={g.ogeler}>
                      {(o) => (
                        <li class="kabul-oge">
                          <KucukGorsel o={o} />
                          <button type="button" class="kabul-oge__ad" onClick={() => git(`/incele/${o.id}`)}>
                            <strong class="tasma">{o.ad}</strong>
                            <span class="cok-soluk kucuk">
                              {o.satirlar.length ? `${o.satirlar.length} satır · ` : ""}
                              {o.dosyalar.length ? `${o.dosyalar.length} dosya · ` : ""}
                              {o.fikirId ? `fikir #${o.fikirId} · ` : ""}
                              {goreliZaman(o.karar ?? o.olusturma, Date.now())}
                            </span>
                          </button>
                          <Show when={basamak() === "kabulde" && tekTik(o)}>
                            <button type="button" class="dg dg--k" onClick={() => void aktar(o)}>
                              <Simge ad="simsek" /> Oyuna aktar
                            </button>
                          </Show>
                        </li>
                      )}
                    </For>
                  </ul>
                </section>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={isaret()}>
        <AltSayfa
          baslik="Hangi sürümde ana koda eklendi?"
          kapat={() => setIsaret(null)}
          ayak={
            <button
              type="button"
              class="dg dg--birincil dg--tam"
              disabled={!/^[0-9a-f]{7,40}$/i.test(rev().trim())}
              onClick={() => void anaKodaEklendi()}
            >
              İşaretle
            </button>
          }
        >
          <label class="alan-giris">
            <span>Ana daldaki birleştirme kimliği (7–40 hane)</span>
            <input
              class="girdi mono"
              value={rev()}
              onInput={(e) => setRev(e.currentTarget.value)}
              placeholder="ör. 135ee01"
            />
          </label>
        </AltSayfa>
      </Show>
    </div>
  );
}
