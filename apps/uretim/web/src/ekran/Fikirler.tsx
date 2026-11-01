/**
 * Fikir panosu (Üretim Merkezi 2, aşama 1): yapay zekâların fikirleri kart ızgarasında. Alan, kategori, etki, zahmet ve
 * aşama süzgeci; arama; sıralama (yeni, etki, kolay kazanç). Çoklu seçim (kart onay kutusu, Shift ile aralık, "görüneni
 * seç") ile toplu onay/ret; seçili onaylı fikirlerden "Uygula işi" açılır. Karta not ("şöyle olsun") eklenir; not
 * uygulama işine ve yapay zekânın geri bildirimine gider. Aşama kendiliğinden ilerler; canlı güncellenir.
 */
import { createMemo, createResource, createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { ALANLAR } from "../../../src/ortak/alanlar.js";
import {
  ETKI_ADI,
  ETKILER,
  type Etki,
  FIKIR_ASAMA_ADI,
  FIKIR_YOLU,
  type FikirAsamasi,
  type FikirKarti,
  ZAHMET_ADI,
  ZAHMETLER,
  type Zahmet,
} from "../../../src/ortak/fikir.js";
import { TASARIM_TURLERI, TASARIM_TURU_ADI, type TasarimTuru } from "../../../src/ortak/tasarim.js";
import { al, dosyaUrl, gonder } from "../api.js";
import { goreliZaman } from "../bicim.js";
import { AlanIsareti, AltSayfa, Bos, IskeletKartlar } from "../bilesenler.js";
import { olayDinle, yerelOlay } from "../canli.js";
import { alanBul, alanRengi, git, hataTost, sorgu, titret, tost } from "../durum.js";
import { fikirSuz, type Siralama } from "../fikirSuzgec.js";
import { yazmaAlaniMi } from "../Kabuk.js";
import { Simge } from "../simgeler.js";
import { TasarimKunyesi, TasarimRozeti } from "./TasarimAyrinti.js";

const ASAMA_SINIF: Partial<Record<FikirAsamasi, string>> = {
  onaylandi: "etiket--vurgu",
  uygulaniyor: "etiket--uyari",
  teslim_edildi: "etiket--uyari",
  kabul_edildi: "etiket--gecti",
  ana_kodda: "etiket--gecti",
  canlida: "etiket--gecti",
  reddedildi: "etiket--kaldi",
};

function AsamaSeridi(p: { asama: FikirAsamasi }): JSX.Element {
  const i = (): number => FIKIR_YOLU.indexOf(p.asama);
  return (
    <span class="asama-seridi" role="img" aria-label={`Aşama: ${FIKIR_ASAMA_ADI[p.asama]}`}>
      <For each={FIKIR_YOLU}>
        {(a, j) => (
          <span
            class="asama-seridi__nokta"
            classList={{ "asama-seridi__nokta--dolu": i() >= j(), "asama-seridi__nokta--simdi": i() === j() }}
            title={FIKIR_ASAMA_ADI[a]}
          />
        )}
      </For>
    </span>
  );
}

function FikirKartiGorunumu(p: {
  f: FikirKarti;
  secili: boolean;
  secimModu: boolean;
  alanGoster: boolean;
  sec: (e: MouseEvent | KeyboardEvent) => void;
  ac: () => void;
}): JSX.Element {
  return (
    <article
      class="fikir-karti"
      classList={{ "fikir-karti--secili": p.secili, "fikir-karti--red": p.f.asama === "reddedildi" }}
      data-tasarim={p.f.tasarim?.tur}
      style={{ "--alan-renk": alanRengi(p.f.alan) }}
      data-fikir={p.f.id}
    >
      <label class="fikir-karti__sec" title="Seç (Shift ile aralık)">
        <input
          type="checkbox"
          class="onay-kutusu"
          checked={p.secili}
          aria-label={`${p.f.baslik} seç`}
          onClick={(e) => {
            e.stopPropagation();
            p.sec(e);
          }}
        />
      </label>
      <button
        type="button"
        class="fikir-karti__govde"
        onClick={(e) => (p.secimModu ? p.sec(e) : p.ac())}
        aria-label={`${p.f.baslik}: ayrıntı`}
      >
        <span class="fikir-karti__ust">
          <Show when={p.alanGoster}>
            <AlanIsareti alan={p.f.alan} kisa />
          </Show>
          <Show when={p.f.kategori}>
            <span class="fikir-karti__kategori">{p.f.kategori}</span>
          </Show>
        </span>
        <Show when={p.f.tasarim}>{(t) => <TasarimRozeti t={t()} />}</Show>
        <strong class="fikir-karti__baslik">{p.f.baslik}</strong>
        <span class="fikir-karti__ozet">{p.f.ozet ?? p.f.aciklama}</span>
        <Show when={p.f.tasarim}>{(t) => <TasarimKunyesi t={t()} />}</Show>
        <Show when={p.f.onizleme}>
          {(o) => (
            <img
              class="fikir-karti__gorsel"
              src={dosyaUrl(p.f.id, o())}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
        </Show>
        <span class="fikir-karti__alt">
          <Show when={p.f.etki} fallback={<span class="cok-soluk kucuk">Düz metin fikir</span>}>
            {(e) => <span class={`olcek olcek--etki-${e()}`}>{ETKI_ADI[e()]}</span>}
          </Show>
          <Show when={p.f.zahmet}>
            {(z) => <span class={`olcek olcek--zahmet-${z()}`}>{ZAHMET_ADI[z()]}</span>}
          </Show>
          <Show when={p.f.notlar.length}>
            <span class="fikir-karti__not" title={p.f.notlar[0]}>
              <Simge ad="sohbet" boyut={14} /> {p.f.notlar.length}
            </span>
          </Show>
          <Show when={p.f.elestiri}>
            <span class="fikir-karti__not" title="Eleştiri">
              <Simge ad="kalkan" boyut={14} /> {p.f.elestiri}
            </span>
          </Show>
        </span>
        <Show when={p.f.tasarim && p.f.kaynak}>
          <span class="fikir-karti__kaynak">
            <Simge ad="pirilti" boyut={12} /> {p.f.kaynak?.ad}
            {p.f.kaynak?.model ? ` · ${p.f.kaynak.model}` : ""}
            <Show when={(p.f.surum ?? 1) > 1}>
              <span class="etiket">sürüm {p.f.surum}</span>
            </Show>
          </span>
        </Show>
        <span class="fikir-karti__asama">
          <span class={`etiket ${ASAMA_SINIF[p.f.asama] ?? ""}`}>{FIKIR_ASAMA_ADI[p.f.asama]}</span>
          <Show when={p.f.asama !== "reddedildi"}>
            <AsamaSeridi asama={p.f.asama} />
          </Show>
        </span>
      </button>
    </article>
  );
}

export function Fikirler(): JSX.Element {
  const [veri, { refetch, mutate }] = createResource(() => al<{ fikirler: FikirKarti[] }>("fikirler"));
  onCleanup(olayDinle(["teslim", "karar", "geri_al", "is", "aktarim", "paket"], () => void refetch()));
  const ilkAlan = sorgu().get("alan");
  const [ara, setAra] = createSignal("");
  const [alan, setAlan] = createSignal<string | null>(
    ilkAlan && ALANLAR.some((a) => a.id === ilkAlan) ? ilkAlan : null,
  );
  const [kategori, setKategori] = createSignal<string | null>(null);
  const [etki, setEtki] = createSignal<Etki | null>(null);
  const [zahmet, setZahmet] = createSignal<Zahmet | null>(null);
  const [asama, setAsama] = createSignal<FikirAsamasi | "acik" | null>(
    (sorgu().get("asama") as FikirAsamasi | null) ?? "acik",
  );
  const [siralama, setSiralama] = createSignal<Siralama>("yeni");
  const [tasarim, setTasarim] = createSignal<TasarimTuru | null>(null);
  const tasarimVar = (): boolean => tum().some((f) => f.tasarim);
  const tasarimSayisi = (t: TasarimTuru): number =>
    tum().filter((f) => (!alan() || f.alan === alan()) && f.tasarim?.tur === t && f.asama !== "reddedildi")
      .length;
  /** Telefonda süzgeç seçimleri bir dokunuşla açılır (ızgara hemen görünsün). */
  const [suzgecAcik, setSuzgecAcik] = createSignal(false);
  const etkinSuzgec = (): number =>
    [alan(), kategori(), etki(), zahmet(), siralama() !== "yeni" ? siralama() : null].filter(Boolean).length;
  const [secili, setSecili] = createSignal<ReadonlySet<number>>(new Set());
  const [sonSecilen, setSonSecilen] = createSignal<number | null>(null);
  const [ayrinti, setAyrinti] = createSignal<number | null>(null);
  const [retAcik, setRetAcik] = createSignal(false);
  const [mesgul, setMesgul] = createSignal(false);

  const tum = (): FikirKarti[] => veri()?.fikirler ?? [];
  const alanlar = createMemo(() => ALANLAR.filter((a) => tum().some((f) => f.alan === a.id)));
  const kategoriler = createMemo(() =>
    [
      ...new Set(
        tum()
          .filter((f) => !alan() || f.alan === alan())
          .map((f) => f.kategori)
          .filter((k): k is string => !!k),
      ),
    ].sort((a, b) => a.localeCompare(b, "tr")),
  );
  const gorunen = createMemo(() =>
    fikirSuz(tum(), {
      ara: ara(),
      alan: alan(),
      kategori: kategori(),
      etki: etki(),
      zahmet: zahmet(),
      asama: asama(),
      siralama: siralama(),
      tasarim: tasarim(),
    }),
  );
  const asamaSayisi = (a: FikirAsamasi | "acik"): number =>
    tum().filter(
      (f) => (!alan() || f.alan === alan()) && (a === "acik" ? f.asama !== "reddedildi" : f.asama === a),
    ).length;
  const seciliKartlar = createMemo(() => tum().filter((f) => secili().has(f.id)));
  const bekleyenSecili = (): FikirKarti[] => seciliKartlar().filter((f) => f.asama === "fikir");
  const onayliSecili = (): FikirKarti[] => seciliKartlar().filter((f) => f.asama === "onaylandi");
  const tekAlanOnayli = (): string | null => {
    const a = [...new Set(onayliSecili().map((f) => f.alan))];
    return a.length === 1 ? (a[0] ?? null) : null;
  };

  const sec = (f: FikirKarti, e: MouseEvent | KeyboardEvent): void => {
    const s = new Set(secili());
    const son = sonSecilen();
    if (e.shiftKey && son !== null) {
      const l = gorunen();
      const a = l.findIndex((x) => x.id === son);
      const b = l.findIndex((x) => x.id === f.id);
      if (a >= 0 && b >= 0) for (const x of l.slice(Math.min(a, b), Math.max(a, b) + 1)) s.add(x.id);
    } else if (s.has(f.id)) s.delete(f.id);
    else s.add(f.id);
    setSecili(s);
    setSonSecilen(f.id);
    titret(8);
  };
  const temizle = (): void => {
    setSecili(new Set<number>());
    setSonSecilen(null);
  };
  const gorunenSec = (): void => {
    setSecili(new Set([...secili(), ...gorunen().map((f) => f.id)]));
  };

  /** İyimser: seçilenlerin aşamasını hemen değiştir; sunucu olayı düzeltir. */
  const toplu = async (karar: "onay" | "ret", metin = ""): Promise<void> => {
    const hedef = bekleyenSecili();
    if (!hedef.length || mesgul()) return;
    setMesgul(true);
    const idler = new Set(hedef.map((f) => f.id));
    const once = veri();
    mutate((v) =>
      v
        ? {
            fikirler: v.fikirler.map((f) =>
              idler.has(f.id) ? { ...f, asama: karar === "onay" ? "onaylandi" : "reddedildi" } : f,
            ),
          }
        : v,
    );
    try {
      const r = await gonder<{ sonuc: { id: number; ok: boolean; mesaj?: string }[] }>("fikir/toplu", {
        idler: [...idler],
        karar,
        ...(metin ? { metin } : {}),
      });
      const basarili = r.sonuc.filter((x) => x.ok).length;
      const hata = r.sonuc.find((x) => !x.ok);
      tost(
        `${basarili} fikir ${karar === "onay" ? "onaylandı" : "reddedildi"}${hata ? ` · ${r.sonuc.length - basarili} atlandı (${hata.mesaj})` : ""}`,
      );
      yerelOlay("karar");
      temizle();
      setRetAcik(false);
    } catch (e) {
      mutate(once);
      hataTost(e);
    } finally {
      setMesgul(false);
      void refetch();
    }
  };
  const uygula = (idler: number[], hedefAlan: string): void =>
    git(`/iste?alan=${hedefAlan}&fikirler=${idler.join(",")}`);

  const tus = (e: KeyboardEvent): void => {
    if (yazmaAlaniMi(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape" && secili().size) temizle();
    else if (e.key.toLowerCase() === "a" && e.shiftKey) {
      e.preventDefault();
      gorunenSec();
    }
  };
  onMount(() => document.addEventListener("keydown", tus));
  onCleanup(() => document.removeEventListener("keydown", tus));

  const ayrintiKart = (): FikirKarti | undefined => tum().find((f) => f.id === ayrinti());
  const suzgecVar = (): boolean =>
    !!(ara() || kategori() || etki() || zahmet() || (asama() && asama() !== "acik"));

  return (
    <div class="sayfa sayfa--genis fikir-panosu" classList={{ "fikir-panosu--secim": secili().size > 0 }}>
      <header class="sayfa__bas">
        <div>
          <h1>Fikirler</h1>
          <p class="soluk">
            Yapay zekâların önerileri. Beğendiklerini seç ve onayla; onaylananlardan “Uygula işi” aç, yapay
            zekâ uygulasın.
          </p>
        </div>
      </header>

      <search class="fikir-arac" classList={{ "fikir-arac--acik": suzgecAcik() }}>
        <label class="ara-kutu">
          <Simge ad="ara" boyut={16} />
          <input
            class="girdi"
            type="search"
            placeholder="Fikirlerde ara"
            value={ara()}
            onInput={(e) => setAra(e.currentTarget.value)}
            aria-label="Fikirlerde ara"
          />
        </label>
        <button
          type="button"
          class="dg fikir-arac__dugme"
          aria-expanded={suzgecAcik()}
          onClick={() => setSuzgecAcik(!suzgecAcik())}
        >
          <Simge ad="filtre" boyut={16} /> Süzgeç
          <Show when={etkinSuzgec()}>
            <span class="sayac">{etkinSuzgec()}</span>
          </Show>
        </button>
        <select
          class="girdi girdi--kucuk"
          aria-label="Alan"
          value={alan() ?? ""}
          onChange={(e) => {
            setAlan(e.currentTarget.value || null);
            setKategori(null);
          }}
        >
          <option value="">Bütün alanlar</option>
          <For each={alanlar()}>{(a) => <option value={a.id}>{a.ad}</option>}</For>
        </select>
        <select
          class="girdi girdi--kucuk"
          aria-label="Kategori"
          value={kategori() ?? ""}
          onChange={(e) => setKategori(e.currentTarget.value || null)}
        >
          <option value="">Bütün kategoriler</option>
          <For each={kategoriler()}>{(k) => <option value={k}>{k}</option>}</For>
        </select>
        <select
          class="girdi girdi--kucuk"
          aria-label="Etki"
          value={etki() ?? ""}
          onChange={(e) => setEtki((e.currentTarget.value || null) as Etki | null)}
        >
          <option value="">Her etki</option>
          <For each={[...ETKILER].reverse()}>{(x) => <option value={x}>{ETKI_ADI[x]}</option>}</For>
        </select>
        <select
          class="girdi girdi--kucuk"
          aria-label="Zahmet"
          value={zahmet() ?? ""}
          onChange={(e) => setZahmet((e.currentTarget.value || null) as Zahmet | null)}
        >
          <option value="">Her zahmet</option>
          <For each={ZAHMETLER}>{(x) => <option value={x}>{ZAHMET_ADI[x]}</option>}</For>
        </select>
        <select
          class="girdi girdi--kucuk"
          aria-label="Sıralama"
          value={siralama()}
          onChange={(e) => setSiralama(e.currentTarget.value as Siralama)}
        >
          <option value="yeni">En yeni</option>
          <option value="etki">En yüksek etki</option>
          <option value="kolay">Kolay kazanç (etki/zahmet)</option>
        </select>
      </search>

      <Show when={tasarimVar()}>
        <fieldset class="cipler fikir-tasarim-turleri" aria-label="Fikir türü">
          <button type="button" class="cip" aria-pressed={!tasarim()} onClick={() => setTasarim(null)}>
            Hepsi
          </button>
          <For each={TASARIM_TURLERI}>
            {(t) => (
              <button
                type="button"
                class="cip"
                data-tasarim={t}
                aria-pressed={tasarim() === t}
                onClick={() => setTasarim(tasarim() === t ? null : t)}
              >
                {TASARIM_TURU_ADI[t]} <span class="cok-soluk">{tasarimSayisi(t)}</span>
              </button>
            )}
          </For>
        </fieldset>
      </Show>

      <fieldset class="cipler fikir-asamalar" aria-label="Aşama">
        <For each={["acik", ...FIKIR_YOLU, "reddedildi"] as const}>
          {(a) => (
            <Show when={a === "acik" || asamaSayisi(a) > 0}>
              <button
                type="button"
                class="cip"
                aria-pressed={asama() === a}
                onClick={() => setAsama(asama() === a ? null : a)}
              >
                {a === "acik" ? "Açık" : FIKIR_ASAMA_ADI[a]} <span class="cok-soluk">{asamaSayisi(a)}</span>
              </button>
            </Show>
          )}
        </For>
      </fieldset>

      <div class="satir satir--ara fikir-ozet-satiri">
        <span class="kucuk soluk">
          {gorunen().length} fikir
          <Show when={suzgecVar()}>
            {" "}
            ·{" "}
            <button
              type="button"
              class="baglanti-dugme"
              onClick={() => {
                setAra("");
                setKategori(null);
                setEtki(null);
                setZahmet(null);
                setAsama("acik");
              }}
            >
              süzgeçleri temizle
            </button>
          </Show>
        </span>
        <Show when={gorunen().length}>
          <button type="button" class="dg dg--hayalet dg--k" onClick={gorunenSec}>
            Görüneni seç <span class="kisayol">⇧A</span>
          </button>
        </Show>
      </div>

      <Show when={!veri.loading || veri()} fallback={<IskeletKartlar adet={6} y="150px" />}>
        <Show
          when={gorunen().length}
          fallback={
            <Bos simge="pirilti" baslik={tum().length ? "Bu süzgeçte fikir yok" : "Henüz fikir yok"}>
              {tum().length
                ? "Süzgeçleri gevşet ya da aramayı temizle."
                : "Bir alandan “30 fikir ver” gibi bir iş iste; fikirler burada kart kart görünür."}
            </Bos>
          }
        >
          <div class="fikir-izgara">
            <For each={gorunen()}>
              {(f) => (
                <FikirKartiGorunumu
                  f={f}
                  secili={secili().has(f.id)}
                  secimModu={secili().size > 0}
                  alanGoster={!alan()}
                  sec={(e) => sec(f, e)}
                  ac={() => (f.tasarim ? git(`/fikir/${f.id}`) : setAyrinti(f.id))}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={secili().size > 0}>
        <div class="toplu-cubuk" role="toolbar" aria-label="Seçili fikirler">
          <span class="toplu-cubuk__sayi">
            <span>
              <strong>{secili().size}</strong> seçili
            </span>
            <button type="button" class="baglanti-dugme toplu-cubuk__temizle" onClick={temizle}>
              Seçimi bırak
            </button>
          </span>
          <button
            type="button"
            class="dg dg--onay"
            disabled={!bekleyenSecili().length || mesgul()}
            onClick={() => void toplu("onay")}
          >
            <Simge ad="onay" /> Onayla
            {bekleyenSecili().length !== secili().size && bekleyenSecili().length
              ? ` (${bekleyenSecili().length})`
              : ""}
          </button>
          <button
            type="button"
            class="dg"
            disabled={!bekleyenSecili().length || mesgul()}
            onClick={() => setRetAcik(true)}
          >
            <Simge ad="ret" /> Reddet
          </button>
          <button
            type="button"
            class="dg dg--birincil"
            disabled={!onayliSecili().length || !tekAlanOnayli()}
            title={onayliSecili().length && !tekAlanOnayli() ? "Uygulama işi tek alan için açılır" : ""}
            onClick={() => {
              const a = tekAlanOnayli();
              if (a)
                uygula(
                  onayliSecili().map((f) => f.id),
                  a,
                );
            }}
          >
            <Simge ad="simsek" /> Uygula işi{onayliSecili().length ? ` (${onayliSecili().length})` : ""}
          </button>
          <button type="button" class="dg-simge" aria-label="Seçimi temizle" onClick={temizle}>
            <Simge ad="kapat" />
          </button>
        </div>
      </Show>

      <Show when={retAcik()}>
        <RetSayfasi
          adet={bekleyenSecili().length}
          kapat={() => setRetAcik(false)}
          reddet={(m) => void toplu("ret", m)}
        />
      </Show>

      <Show when={ayrintiKart()}>
        {(f) => (
          <FikirAyrinti
            f={f()}
            kapat={() => setAyrinti(null)}
            yenile={() => void refetch()}
            uygula={() => uygula([f().id], f().alan)}
          />
        )}
      </Show>
    </div>
  );
}

function RetSayfasi(p: { adet: number; kapat: () => void; reddet: (metin: string) => void }): JSX.Element {
  const [metin, setMetin] = createSignal("");
  const hazir = ["Oyunun tarzına uymuyor", "Zaten var", "Şimdilik değil", "Çok büyük iş"];
  return (
    <AltSayfa
      baslik={`${p.adet} fikri reddet`}
      kapat={p.kapat}
      ayak={
        <button
          type="button"
          class="dg dg--tehlike dg--tam"
          disabled={metin().trim().length < 2}
          onClick={() => p.reddet(metin().trim())}
        >
          Reddet
        </button>
      }
    >
      <div class="cipler">
        <For each={hazir}>
          {(h) => (
            <button type="button" class="cip" aria-pressed={metin() === h} onClick={() => setMetin(h)}>
              {h}
            </button>
          )}
        </For>
      </div>
      <label class="alan-giris">
        <span>Not (yapay zekâ bir sonraki turda dikkate alır)</span>
        <textarea
          class="girdi"
          rows="3"
          maxLength={600}
          value={metin()}
          onInput={(e) => setMetin(e.currentTarget.value)}
        />
      </label>
    </AltSayfa>
  );
}

function FikirAyrinti(p: {
  f: FikirKarti;
  kapat: () => void;
  yenile: () => void;
  uygula: () => void;
}): JSX.Element {
  const [not, setNot] = createSignal("");
  const [mesgul, setMesgul] = createSignal(false);
  const notEkle = async (): Promise<void> => {
    if (not().trim().length < 2) return;
    setMesgul(true);
    try {
      await gonder(`oge/${p.f.id}/not`, { metin: not().trim() });
      setNot("");
      tost("Not eklendi");
      p.yenile();
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };
  const karar = async (k: "onay" | "ret"): Promise<void> => {
    setMesgul(true);
    try {
      await gonder("fikir/toplu", {
        idler: [p.f.id],
        karar: k,
        ...(not().trim() ? { metin: not().trim() } : {}),
      });
      tost(k === "onay" ? "Fikir onaylandı" : "Fikir reddedildi");
      yerelOlay("karar", p.f.alan);
      p.yenile();
      p.kapat();
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };
  return (
    <AltSayfa
      baslik={p.f.baslik}
      kapat={p.kapat}
      genis
      ayak={
        <div class="satir satir--sar">
          <Show when={p.f.asama === "fikir"}>
            <button type="button" class="dg dg--onay" disabled={mesgul()} onClick={() => void karar("onay")}>
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
          <Show when={p.f.asama === "onaylandi"}>
            <button type="button" class="dg dg--birincil" onClick={p.uygula}>
              <Simge ad="simsek" /> Uygula işi aç
            </button>
          </Show>
          <Show when={p.f.uygulamaOge}>
            {(id) => (
              <button type="button" class="dg" onClick={() => git(`/incele/${id()}`)}>
                <Simge ad="incele" /> Teslimi aç
              </button>
            )}
          </Show>
          <button type="button" class="dg dg--hayalet" onClick={() => git(`/incele/${p.f.id}`)}>
            İncelemede aç
          </button>
        </div>
      }
    >
      <div class="yigin">
        <div class="satir satir--sar">
          <AlanIsareti alan={p.f.alan} />
          <Show when={p.f.kategori}>
            <span class="etiket">{p.f.kategori}</span>
          </Show>
          <Show when={p.f.etki}>
            {(e) => <span class={`olcek olcek--etki-${e()}`}>{ETKI_ADI[e()]}</span>}
          </Show>
          <Show when={p.f.zahmet}>
            {(z) => <span class={`olcek olcek--zahmet-${z()}`}>{ZAHMET_ADI[z()]}</span>}
          </Show>
        </div>
        <ol class="asama-yolu" aria-label="Fikrin yolu">
          <For each={FIKIR_YOLU}>
            {(a, i) => (
              <li
                classList={{
                  "asama-yolu--gecti": FIKIR_YOLU.indexOf(p.f.asama) > i(),
                  "asama-yolu--simdi": p.f.asama === a,
                }}
              >
                {FIKIR_ASAMA_ADI[a]}
              </li>
            )}
          </For>
        </ol>
        <Show when={p.f.asama === "reddedildi"}>
          <p class="serit serit--sari">Bu fikir reddedildi.</p>
        </Show>
        <Show when={p.f.ozet}>
          <p class="fikir__ozet">{p.f.ozet}</p>
        </Show>
        <Show when={p.f.aciklama && p.f.aciklama !== p.f.ozet}>
          <p class="metin-govde">{p.f.aciklama}</p>
        </Show>
        <Show when={p.f.gerekce}>
          <div class="fikir__alan">
            <span class="cok-soluk kucuk">Neden</span>
            <p>{p.f.gerekce}</p>
          </div>
        </Show>
        <Show when={p.f.onizleme}>
          {(o) => <img class="fikir__onizleme" src={dosyaUrl(p.f.id, o())} alt="" />}
        </Show>
        <Show when={p.f.notlar.length}>
          <div class="fikir__alan">
            <span class="cok-soluk kucuk">Notların</span>
            <ul class="not-listesi">
              <For each={p.f.notlar}>{(n) => <li>{n}</li>}</For>
            </ul>
          </div>
        </Show>
        <label class="alan-giris">
          <span>Not ekle (“şöyle olsun”) — uygulama işine ve yapay zekâya gider</span>
          <textarea
            class="girdi"
            rows="2"
            maxLength={600}
            value={not()}
            onInput={(e) => setNot(e.currentTarget.value)}
          />
        </label>
        <div>
          <button
            type="button"
            class="dg dg--k"
            disabled={mesgul() || not().trim().length < 2}
            onClick={() => void notEkle()}
          >
            <Simge ad="sohbet" /> Notu kaydet
          </button>
        </div>
        <p class="cok-soluk kucuk">
          #{p.f.id} · {alanBul(p.f.alan)?.ad} · {goreliZaman(p.f.olusturma, Date.now())}
          <Show when={p.f.isler.length}> · iş #{p.f.isler.join(", #")}</Show>
        </p>
      </div>
    </AltSayfa>
  );
}
