/**
 * Oyun Tasarımı kartı ayrıntısı (`/fikir/:id`; sözleşme bölüm 15): kartın bütün içeriği okunur biçimde, sürüm geçmişi
 * ve iki sürümün yan yana farkı, sahibin notları ve başka yapay zekâların eleştirileri, bağlı işler. Eylemler:
 * onayla/reddet, "Geliştir" (notla aynı yapay zekâya yeni sürüm işi), "Başka bir yapay zekâya eleştirt", onaylı
 * kartta "Öneri dosyası hazırla" (docs/oneriler biçimi, kabul havuzuna düşer).
 */
import { createMemo, createResource, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import {
  ETKI_ADI,
  FIKIR_ASAMA_ADI,
  type FikirAlanlari,
  type FikirAsamasi,
  ZAHMET_ADI,
} from "../../../src/ortak/fikir.js";
import {
  KAPSAM_ADI,
  OYUN_TURU_ADI,
  TASARIM_TURU_ADI,
  type TasarimFikri,
  tasarimSatirlari,
} from "../../../src/ortak/tasarim.js";
import { al, dosyaUrl, gonder } from "../api.js";
import { goreliZaman, tarihSaat } from "../bicim.js";
import { AlanIsareti, Bos, IskeletKartlar } from "../bilesenler.js";
import { olayDinle, yerelOlay } from "../canli.js";
import { alanRengi, git, hataTost, tost, yolAdi } from "../durum.js";
import { Simge } from "../simgeler.js";

interface Kaynak {
  anahtarId: number | null;
  anahtarAd: string;
  kanal: string;
  arac: string | null;
  model: string | null;
}
interface Surum {
  id: number;
  surum: number;
  durum: string;
  ad: string;
  aciklama: string;
  gerekce: string;
  olusturma: number;
  fikir: FikirAlanlari | null;
  kaynak: Kaynak;
}
interface Ayrinti {
  id: number;
  alan: string;
  guncelId: number;
  asama: FikirAsamasi | null;
  surumler: Surum[];
  notlar: { id: number; ogeId: number | null; tur: string; metin: string; olusturma: number }[];
  isler: {
    id: number;
    baslik: string;
    isTuru: string | null;
    durum: string;
    hedef: string | null;
    olusturma: number;
  }[];
  anahtarlar: { id: number; ad: string; kanal: string }[];
  oneri: { ogeId: number; durum: string; yol: string | null; ozet: string | null } | null;
}

/** Kartın türü rozeti (pano ve ayrıntı). */
export function TasarimRozeti(p: { t: TasarimFikri }): JSX.Element {
  return (
    <span class="tasarim-rozet" data-tasarim={p.t.tur}>
      <Simge ad={p.t.tur === "yeni-oyun" ? "oynat" : p.t.tur === "sistem" ? "katman" : "arti"} boyut={12} />
      {TASARIM_TURU_ADI[p.t.tur]}
    </span>
  );
}

/** Kısa künye: yeni oyunda oyuncu · süre · tür; sistemde kapsam. */
export function TasarimKunyesi(p: { t: TasarimFikri }): JSX.Element {
  return (
    <span class="tasarim-kunye">
      <Show
        when={p.t.tur === "yeni-oyun" ? p.t : null}
        fallback={
          <span>
            {p.t.tur !== "yeni-oyun" ? KAPSAM_ADI[p.t.kapsam.tur] : ""}
            {p.t.tur !== "yeni-oyun" && p.t.kapsam.oyunlar.length
              ? `: ${p.t.kapsam.oyunlar.slice(0, 3).join(", ")}`
              : ""}
          </span>
        }
      >
        {(y) => (
          <>
            <span>
              {y().oyuncu.enAz}–{y().oyuncu.enCok} kişi
            </span>
            <span>{y().sureDk} dk</span>
            <span>
              {y()
                .oyunTuru.map((x) => OYUN_TURU_ADI[x])
                .join(" · ")}
            </span>
          </>
        )}
      </Show>
    </span>
  );
}

const kaynakMetni = (k: Kaynak): string =>
  [k.anahtarAd, k.arac && k.arac !== k.anahtarAd ? k.arac : null, k.model].filter(Boolean).join(" · ") ||
  "Yapay zekâ";

/** Bir sürümün satırları (başlık alanları + kart alanları). */
function satirlar(s: Surum): { ad: string; deger: string }[] {
  return [
    { ad: "Başlık", deger: s.ad },
    { ad: "Tek cümle", deger: s.fikir?.ozet ?? s.aciklama },
    {
      ad: "Etki / zahmet",
      deger: s.fikir ? `${ETKI_ADI[s.fikir.etki]} · ${ZAHMET_ADI[s.fikir.zahmet]}` : "",
    },
    ...(s.fikir?.tasarim ? tasarimSatirlari(s.fikir.tasarim) : []),
    { ad: "Gerekçe", deger: s.gerekce },
  ];
}

/** İki sürümün yan yana farkı: değişen satırlar işaretli. */
function SurumFarki(p: { eski: Surum; yeni: Surum }): JSX.Element {
  const satir = createMemo(() => {
    const e = new Map(satirlar(p.eski).map((x) => [x.ad, x.deger]));
    const y = satirlar(p.yeni);
    const adlar = [...new Set([...y.map((x) => x.ad), ...e.keys()])];
    return adlar.map((ad) => {
      const yeni = y.find((x) => x.ad === ad)?.deger ?? "";
      const eski = e.get(ad) ?? "";
      return { ad, eski, yeni, degisti: eski !== yeni };
    });
  });
  const degisen = (): number => satir().filter((x) => x.degisti).length;
  return (
    <div class="surum-farki">
      <div class="surum-farki__bas">
        <span>
          Sürüm {p.eski.surum} → {p.yeni.surum}
        </span>
        <span class="cok-soluk kucuk">{degisen() ? `${degisen()} alan değişti` : "değişiklik yok"}</span>
      </div>
      <table class="surum-farki__tablo">
        <thead>
          <tr class="surum-farki__satir surum-farki__satir--baslik">
            <th scope="col">Alan</th>
            <th scope="col">Sürüm {p.eski.surum}</th>
            <th scope="col">Sürüm {p.yeni.surum}</th>
          </tr>
        </thead>
        <tbody>
          <For each={satir()}>
            {(x) => (
              <tr class="surum-farki__satir" classList={{ "surum-farki__satir--degisti": x.degisti }}>
                <th scope="row" class="surum-farki__ad">
                  {x.ad}
                </th>
                <td class="surum-farki__eski">{x.eski || "—"}</td>
                <td class="surum-farki__yeni">{x.yeni || "—"}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

export function TasarimAyrinti(): JSX.Element {
  const id = (): number => Number(/^\/fikir\/(\d+)/.exec(yolAdi())?.[1] ?? 0);
  const [veri, { refetch }] = createResource(id, (x) => al<Ayrinti>(`fikir/${x}`));
  onCleanup(olayDinle(["teslim", "karar", "is", "geri_al", "paket"], () => void refetch()));
  const [secili, setSecili] = createSignal<number | null>(null);
  const [karsi, setKarsi] = createSignal<number | null>(null);
  const [not, setNot] = createSignal("");
  const [elestiren, setElestiren] = createSignal<number | null>(null);
  const [mesgul, setMesgul] = createSignal(false);
  const surum = (): Surum | undefined => {
    const v = veri();
    return v?.surumler.find((s) => s.id === (secili() ?? v.guncelId)) ?? v?.surumler[0];
  };
  const karsilastirilan = (): Surum | undefined => {
    const v = veri();
    const s = surum();
    if (!v || !s) return undefined;
    const k = karsi();
    if (k !== null) return v.surumler.find((x) => x.id === k);
    return v.surumler.find((x) => x.surum < s.surum);
  };
  const guncel = (): Surum | undefined => veri()?.surumler[0];
  const yazanId = (): number | null => guncel()?.kaynak.anahtarId ?? null;
  const elestirenler = (): Ayrinti["anahtarlar"] =>
    (veri()?.anahtarlar ?? []).filter((k) => k.id !== yazanId());

  const calistir = async (f: () => Promise<unknown>, mesaj: string): Promise<void> => {
    setMesgul(true);
    try {
      await f();
      tost(mesaj);
      yerelOlay("karar");
      void refetch();
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };
  const karar = (k: "onay" | "ret"): Promise<void> =>
    calistir(
      () =>
        gonder("fikir/toplu", {
          idler: [veri()?.guncelId],
          karar: k,
          ...(not().trim() ? { metin: not().trim() } : {}),
        }),
      k === "onay" ? "Fikir onaylandı" : "Fikir reddedildi",
    );
  const gelistir = (): Promise<void> =>
    calistir(async () => {
      await gonder(`fikir/${veri()?.guncelId}/gelistir`, { not: not().trim() });
      setNot("");
    }, "Geliştir işi açıldı: yeni sürüm aynı karta gelecek");
  const elestirt = (): Promise<void> =>
    calistir(
      () => gonder(`fikir/${veri()?.guncelId}/elestirt`, { anahtarId: elestiren() }),
      "Eleştiri işi açıldı: sonuç kartın altına gelecek",
    );
  const oneri = (): Promise<void> =>
    calistir(() => gonder(`fikir/${veri()?.guncelId}/oneri-dosyasi`), "Öneri dosyası hazır: kabul havuzunda");

  return (
    <div
      class="sayfa sayfa--genis tasarim-ayrinti"
      style={{ "--alan-renk": alanRengi(veri()?.alan ?? "oyun-tasarim") }}
    >
      <button type="button" class="dg dg--hayalet dg--k" onClick={() => git("/fikirler?alan=oyun-tasarim")}>
        <Simge ad="onceki" /> Fikirler
      </button>
      <Show when={!veri.loading || veri()} fallback={<IskeletKartlar adet={3} y="120px" />}>
        <Show when={surum()} fallback={<Bos simge="pirilti" baslik="Kart bulunamadı" />}>
          {(s) => (
            <div class="tasarim-duzen">
              <article class="kart kart--ic yigin tasarim-icerik">
                <div class="satir satir--sar">
                  <Show when={s().fikir?.tasarim}>{(t) => <TasarimRozeti t={t()} />}</Show>
                  <AlanIsareti alan={veri()?.alan ?? ""} kisa />
                  <Show when={veri()?.asama}>
                    {(a) => <span class="etiket etiket--vurgu">{FIKIR_ASAMA_ADI[a()]}</span>}
                  </Show>
                  <span class="etiket">Sürüm {s().surum}</span>
                  <Show when={s().id !== veri()?.guncelId}>
                    <span class="etiket etiket--uyari">Eski sürüm</span>
                  </Show>
                </div>
                <h1 class="tasarim-icerik__baslik">{s().ad}</h1>
                <p class="fikir__ozet">{s().fikir?.ozet ?? s().aciklama}</p>
                <p class="cok-soluk kucuk">
                  <Simge ad="pirilti" boyut={12} /> {kaynakMetni(s().kaynak)} · {tarihSaat(s().olusturma)}
                  <Show when={s().fikir}>
                    {(f) => (
                      <>
                        {" "}
                        · {ETKI_ADI[f().etki]} · {ZAHMET_ADI[f().zahmet]} · {f().kategori}
                      </>
                    )}
                  </Show>
                </p>
                <Show when={s().fikir?.tasarim}>{(t) => <TasarimKunyesi t={t()} />}</Show>
                <dl class="tasarim-alanlar">
                  <For each={s().fikir?.tasarim ? tasarimSatirlari(s().fikir?.tasarim as TasarimFikri) : []}>
                    {(x) => (
                      <div class="tasarim-alan">
                        <dt>{x.ad}</dt>
                        <dd>{x.deger}</dd>
                      </div>
                    )}
                  </For>
                  <Show when={s().gerekce}>
                    <div class="tasarim-alan">
                      <dt>Gerekçe</dt>
                      <dd>{s().gerekce}</dd>
                    </div>
                  </Show>
                </dl>
              </article>

              <aside class="yigin tasarim-yan">
                <section class="kart kart--ic yigin">
                  <strong>Karar ve tartışma</strong>
                  <label class="alan-giris">
                    <span>Not (“şöyle olsun”): Geliştir ile aynı yapay zekâya gider</span>
                    <textarea
                      class="girdi"
                      rows="3"
                      maxLength={1000}
                      value={not()}
                      onInput={(e) => setNot(e.currentTarget.value)}
                    />
                  </label>
                  <div class="satir satir--sar">
                    <button
                      type="button"
                      class="dg dg--birincil"
                      disabled={mesgul() || not().trim().length < 3}
                      onClick={() => void gelistir()}
                    >
                      <Simge ad="tekrar" /> Geliştir
                    </button>
                    <Show when={guncel()?.durum === "bekliyor"}>
                      <button
                        type="button"
                        class="dg dg--onay"
                        disabled={mesgul()}
                        onClick={() => void karar("onay")}
                      >
                        <Simge ad="onay" /> Onayla
                      </button>
                      <button
                        type="button"
                        class="dg"
                        disabled={mesgul() || not().trim().length < 2}
                        title="Ret için not yaz"
                        onClick={() => void karar("ret")}
                      >
                        <Simge ad="ret" /> Reddet
                      </button>
                    </Show>
                  </div>
                  <div class="yigin">
                    <span class="cok-soluk kucuk">Başka bir yapay zekâya eleştirt</span>
                    <Show
                      when={elestirenler().length}
                      fallback={
                        <span class="cok-soluk kucuk">Bu alanda başka bir yapay zekâ anahtarı yok.</span>
                      }
                    >
                      <div class="satir satir--sar">
                        <select
                          class="girdi girdi--kucuk"
                          aria-label="Eleştirecek yapay zekâ"
                          value={elestiren() ?? ""}
                          onChange={(e) => setElestiren(Number(e.currentTarget.value) || null)}
                        >
                          <option value="">Yapay zekâ seç</option>
                          <For each={elestirenler()}>
                            {(k) => (
                              <option value={k.id}>
                                {k.ad}
                                {k.kanal === "ssh" ? " (SSH)" : ""}
                              </option>
                            )}
                          </For>
                        </select>
                        <button
                          type="button"
                          class="dg"
                          disabled={mesgul() || !elestiren()}
                          onClick={() => void elestirt()}
                        >
                          <Simge ad="kalkan" /> Eleştirt
                        </button>
                      </div>
                    </Show>
                  </div>
                  <Show when={guncel()?.durum === "onaylandi" || veri()?.oneri}>
                    <div class="yigin tasarim-oneri">
                      <span class="cok-soluk kucuk">Onaylı kart: yöneticiye öneri dosyası</span>
                      <div class="satir satir--sar">
                        <Show
                          when={
                            guncel()?.durum === "onaylandi" &&
                            (!veri()?.oneri || veri()?.oneri?.durum === "havuzda")
                          }
                        >
                          <button
                            type="button"
                            class="dg dg--birincil"
                            disabled={mesgul()}
                            onClick={() => void oneri()}
                          >
                            <Simge ad="dosya" />{" "}
                            {veri()?.oneri ? "Öneri dosyasını yeniden hazırla" : "Öneri dosyası hazırla"}
                          </button>
                        </Show>
                        <Show when={veri()?.oneri}>
                          {(o) => (
                            <>
                              <Show when={o().ozet}>
                                {(z) => (
                                  <a
                                    class="dg dg--hayalet"
                                    href={dosyaUrl(o().ogeId, z())}
                                    target="_blank"
                                    rel="noopener"
                                  >
                                    <Simge ad="dis" /> Dosyayı aç
                                  </a>
                                )}
                              </Show>
                              <button type="button" class="dg dg--hayalet" onClick={() => git("/kabul")}>
                                Kabul havuzu
                              </button>
                            </>
                          )}
                        </Show>
                      </div>
                      <Show when={veri()?.oneri?.yol}>{(y) => <code class="kucuk">{y()}</code>}</Show>
                    </div>
                  </Show>
                </section>

                <section class="kart kart--ic yigin">
                  <strong>Sürümler</strong>
                  <ol class="surum-listesi">
                    <For each={veri()?.surumler ?? []}>
                      {(x) => (
                        <li>
                          <button
                            type="button"
                            class="surum-listesi__oge"
                            aria-pressed={x.id === s().id}
                            onClick={() => {
                              setSecili(x.id);
                              setKarsi(null);
                            }}
                          >
                            <span class="etiket">s{x.surum}</span>
                            <span class="esnek tasma">{x.ad}</span>
                            <span class="cok-soluk kucuk">
                              {kaynakMetni(x.kaynak)} · {goreliZaman(x.olusturma, Date.now())}
                            </span>
                          </button>
                        </li>
                      )}
                    </For>
                  </ol>
                </section>

                <section class="kart kart--ic yigin">
                  <strong>Notlar ve eleştiriler</strong>
                  <Show
                    when={veri()?.notlar.length}
                    fallback={<span class="cok-soluk kucuk">Henüz not yok.</span>}
                  >
                    <ul class="tasarim-notlar">
                      <For each={veri()?.notlar ?? []}>
                        {(n) => (
                          <li data-tur={n.tur}>
                            <span class="etiket">
                              {n.tur === "elestiri"
                                ? "Eleştiri"
                                : n.tur === "ret"
                                  ? "Ret"
                                  : n.tur === "duzeltme"
                                    ? "Düzeltme"
                                    : "Senin notun"}
                            </span>
                            <p class="metin-govde">{n.metin}</p>
                            <span class="cok-soluk kucuk">{goreliZaman(n.olusturma, Date.now())}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </section>

                <Show when={veri()?.isler.length}>
                  <section class="kart kart--ic yigin">
                    <strong>Bağlı işler</strong>
                    <ul class="tasarim-isler">
                      <For each={veri()?.isler ?? []}>
                        {(i) => (
                          <li>
                            <span class="etiket">
                              {i.isTuru === "gelistir"
                                ? "Geliştir"
                                : i.isTuru === "elestiri"
                                  ? "Eleştiri"
                                  : "İş"}
                            </span>
                            <span class="esnek tasma">
                              #{i.id} · {i.hedef ?? "alan"}
                            </span>
                            <span class={`etiket ${i.durum === "tamam" ? "etiket--gecti" : "etiket--uyari"}`}>
                              {i.durum === "tamam" ? "tamam" : i.durum === "acik" ? "bekliyor" : i.durum}
                            </span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </section>
                </Show>
              </aside>

              <Show when={karsilastirilan()}>
                {(e) => (
                  <section class="kart kart--ic yigin tasarim-fark">
                    <div class="satir satir--ara">
                      <strong>Sürüm geçmişi: yan yana</strong>
                      <select
                        class="girdi girdi--kucuk"
                        aria-label="Karşılaştırılan sürüm"
                        value={e().id}
                        onChange={(x) => setKarsi(Number(x.currentTarget.value))}
                      >
                        <For each={(veri()?.surumler ?? []).filter((x) => x.id !== s().id)}>
                          {(x) => <option value={x.id}>Sürüm {x.surum}</option>}
                        </For>
                      </select>
                    </div>
                    <SurumFarki
                      eski={e().surum < s().surum ? e() : s()}
                      yeni={e().surum < s().surum ? s() : e()}
                    />
                  </section>
                )}
              </Show>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
}
