/**
 * İnceleme (UM-U3, U5, U6): tam ekran odak modu. Büyük önizleme + yan panel (bilgi, ön kontrol, geçmiş, fark),
 * başparmak bölgesinde karar çubuğu, klavye kısayolları, telefonda kaydırma jestleri, 10 sn geri al, "sıradaki" akışı.
 */
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  type JSX,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { HAZIR_NOTLAR, type HazirNotKodu } from "../../../src/ortak/durum.js";
import type { KontrolSatiri, OgeAyrinti, OgeOzeti } from "../../../src/ortak/tipler.js";
import { TESLIM_TURU_ADI } from "../../../src/ortak/tipler.js";
import { al, gonder } from "../api.js";
import { boyut, goreliZaman, tarihSaat } from "../bicim.js";
import { AlanIsareti, AltSayfa, Bos, DurumEtiketi, Iskelet, Sekmeler, SonucEtiketi } from "../bilesenler.js";
import {
  alanBul,
  git,
  hataTost,
  oturum,
  rehberGoruldu,
  rehberiKapat,
  sorgu,
  titret,
  tost,
  yolAdi,
} from "../durum.js";
import { jestIpucu, jestKarari } from "../jest.js";
import { panoYenile, yazmaAlaniMi } from "../Kabuk.js";
import { OyunOnizleme, varsayilanEkran } from "../onizleme/OyunOnizleme.js";
import {
  AnimasyonSahne,
  FarkGorunumu,
  FikirSahne,
  GorselSahne,
  KartSahne,
  ListeSahne,
  MetinSahne,
  RaporSahne,
  SesSahne,
  WikiSahne,
  zeminDondur,
} from "../onizleme/Sahneler.js";
import { Simge, type SimgeAdi } from "../simgeler.js";

interface Ayrinti {
  oge: OgeAyrinti;
  onceki: OgeAyrinti | null;
  tekTik: boolean;
}

type Karar = "onay" | "ret" | "duzeltme";
type Panel = "bilgi" | "kontrol" | "gecmis" | "fark";

const GRUP_ADI: Record<KontrolSatiri["grup"], string> = {
  ortak: "Ortak",
  gorsel: "Görsel",
  ses: "Ses",
  metin: "Metin ve havuz",
  alan: "Alan kuralları",
};
const SONUC_SIMGE: Record<KontrolSatiri["sonuc"], SimgeAdi> = {
  gecti: "onay",
  uyari: "uyari",
  kaldi: "ret",
  atlandi: "saat",
};

function KontrolListesi(p: { satirlar: KontrolSatiri[] }): JSX.Element {
  const gruplar = createMemo(() => {
    const m = new Map<KontrolSatiri["grup"], KontrolSatiri[]>();
    for (const s of p.satirlar) m.set(s.grup, [...(m.get(s.grup) ?? []), s]);
    return [...m.entries()];
  });
  return (
    <div class="yigin">
      <For each={gruplar()}>
        {([g, l]) => (
          <section class="kontrol-grup">
            <h3>{GRUP_ADI[g]}</h3>
            <ul>
              <For
                each={[...l].sort(
                  (a, b) =>
                    ["kaldi", "uyari", "atlandi", "gecti"].indexOf(a.sonuc) -
                    ["kaldi", "uyari", "atlandi", "gecti"].indexOf(b.sonuc),
                )}
              >
                {(s) => (
                  <li class={`kontrol kontrol--${s.sonuc}`}>
                    <Simge ad={SONUC_SIMGE[s.sonuc]} boyut={16} />
                    <span class="esnek">
                      {s.mesaj}
                      <Show when={s.dosya || s.satir !== undefined}>
                        <span class="cok-soluk kucuk"> · {s.dosya ?? `satır ${(s.satir ?? 0) + 1}`}</span>
                      </Show>
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </section>
        )}
      </For>
    </div>
  );
}

function BilgiPaneli(p: { a: Ayrinti }): JSX.Element {
  const o = (): OgeAyrinti => p.a.oge;
  return (
    <div class="yigin yigin--genis">
      <Show when={o().gerekce}>
        <div class="bilgi-blok">
          <span class="bilgi-blok__ad">Gerekçe</span>
          <p>{o().gerekce}</p>
        </div>
      </Show>
      <Show when={o().aciklama && o().gorunum !== "fikir"}>
        <div class="bilgi-blok">
          <span class="bilgi-blok__ad">Açıklama</span>
          <p>{o().aciklama}</p>
        </div>
      </Show>
      <dl class="tanimlar">
        <dt>Tür</dt>
        <dd>{TESLIM_TURU_ADI[o().tur]}</dd>
        <dt>Sürüm</dt>
        <dd>{o().surum}</dd>
        <dt>Kaynak</dt>
        <dd>{o().kaynak === "elle" ? "Elle yüklendi" : "Yapay zekâ"}</dd>
        <dt>Geldi</dt>
        <dd>{tarihSaat(o().olusturma)}</dd>
        <Show when={o().koken.talimatSurum}>
          <dt>Talimat</dt>
          <dd>{o().koken.talimatSurum}. sürüm</dd>
        </Show>
        <Show when={o().onizleme}>
          <dt>Önizleme</dt>
          <dd>{o().onizleme?.not || o().onizleme?.ekran}</dd>
        </Show>
      </dl>
      <Show when={o().dosyalar.length}>
        <div class="bilgi-blok">
          <span class="bilgi-blok__ad">Dosyalar</span>
          <ul class="dosya-listesi">
            <For each={o().dosyalar}>
              {(d) => (
                <li>
                  <span class="etiket">{d.tur.toUpperCase()}</span>
                  <span class="esnek tasma mono kucuk" title={d.hedefYol ?? d.ad}>
                    {d.hedefYol ?? d.ad}
                  </span>
                  <span class="cok-soluk kucuk">{boyut(d.boyut)}</span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}

function GecmisPaneli(p: { a: Ayrinti }): JSX.Element {
  return (
    <div class="yigin yigin--genis">
      <Show when={p.a.oge.surumler.length > 1}>
        <div class="bilgi-blok">
          <span class="bilgi-blok__ad">Sürümler</span>
          <ul class="zaman-cizelgesi">
            <For each={p.a.oge.surumler}>
              {(s) => (
                <li classList={{ "zaman-cizelgesi--simdi": s.id === p.a.oge.id }}>
                  <button type="button" class="satir" onClick={() => git(`/incele/${s.id}`)}>
                    <strong>{s.surum}. sürüm</strong>
                    <DurumEtiketi durum={s.durum} />
                    <span class="cok-soluk kucuk">{goreliZaman(s.olusturma, Date.now())}</span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
      <div class="bilgi-blok">
        <span class="bilgi-blok__ad">Notlar</span>
        <Show when={p.a.oge.notlar.length} fallback={<p class="cok-soluk">Bu sürüme not yazılmadı.</p>}>
          <ul class="notlar">
            <For each={p.a.oge.notlar}>
              {(n) => (
                <li>
                  <span class="cok-soluk kucuk">
                    {n.tur === "otomatik"
                      ? "Ön kontrol"
                      : n.tur === "ret"
                        ? "Ret"
                        : n.tur === "duzeltme"
                          ? "Düzeltme"
                          : "Not"}{" "}
                    · {goreliZaman(n.olusturma, Date.now())}
                  </span>
                  <p>{n.metin}</p>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
      <Show when={p.a.onceki}>
        {(on) => (
          <div class="bilgi-blok">
            <span class="bilgi-blok__ad">Önceki sürüm</span>
            <button type="button" class="dg dg--k" onClick={() => git(`/incele/${on().id}`)}>
              {on().surum}. sürümü aç
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}

function KararSayfasi(p: {
  tur: "ret" | "duzeltme";
  kapat: () => void;
  gonder: (hazir: HazirNotKodu | null, metin: string) => void;
}): JSX.Element {
  const [hazir, setHazir] = createSignal<HazirNotKodu | null>(null);
  const [metin, setMetin] = createSignal("");
  const hazirMi = (): boolean => hazir() !== null || metin().trim().length >= 2;
  return (
    <AltSayfa
      baslik={p.tur === "ret" ? "Neden reddediyorsun?" : "Ne değişsin?"}
      kapat={p.kapat}
      ayak={
        <>
          <button type="button" class="dg dg--hayalet" onClick={p.kapat}>
            Vazgeç
          </button>
          <button
            type="button"
            class={`dg esnek ${p.tur === "ret" ? "dg--tehlike" : "dg--birincil"}`}
            disabled={!hazirMi()}
            onClick={() => p.gonder(hazir(), metin())}
          >
            {p.tur === "ret" ? "Reddet" : "Düzeltme iste"}
          </button>
        </>
      }
    >
      <div class="yigin">
        <p class="soluk kucuk">
          Not yapay zekâya gider; bir sonraki turda dikkate alır. Bir hazır not seç ya da kısaca yaz.
        </p>
        <fieldset class="cipler" aria-label="Hazır notlar">
          <For each={HAZIR_NOTLAR}>
            {(n, i) => (
              <button
                type="button"
                class="cip"
                aria-pressed={hazir() === n.kod}
                onClick={() => setHazir(hazir() === n.kod ? null : n.kod)}
                data-ilk-odak={i() === 0 ? "" : undefined}
              >
                {n.metin}
              </button>
            )}
          </For>
        </fieldset>
        <textarea
          class="girdi"
          rows="3"
          placeholder={p.tur === "ret" ? "İstersen ayrıntı yaz…" : "ör. rengi biraz daha koyu olsun"}
          value={metin()}
          onInput={(e) => setMetin(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hazirMi()) p.gonder(hazir(), metin());
          }}
          maxlength="1000"
        />
      </div>
    </AltSayfa>
  );
}

function BenzerSayfasi(p: { oge: OgeAyrinti; kapat: () => void }): JSX.Element {
  const [adet, setAdet] = createSignal(5);
  const [fark, setFark] = createSignal("");
  const gonderBenzer = async (): Promise<void> => {
    try {
      await gonder(`oge/${p.oge.id}/benzer`, { adet: adet(), fark: fark() });
      tost(`${alanBul(p.oge.alan)?.ad} alanına iş açıldı`);
      p.kapat();
    } catch (e) {
      hataTost(e);
    }
  };
  return (
    <AltSayfa
      baslik="Benzerini daha üret"
      kapat={p.kapat}
      ayak={
        <>
          <button type="button" class="dg dg--hayalet" onClick={p.kapat}>
            Vazgeç
          </button>
          <button type="button" class="dg dg--birincil esnek" onClick={() => void gonderBenzer()}>
            İş aç
          </button>
        </>
      }
    >
      <div class="yigin">
        <p class="soluk kucuk">“{p.oge.ad}” örnek alınarak alana yeni bir iş açılır.</p>
        <div class="alan-giris">
          <span>Kaç tane</span>
          <div class="secim">
            <For each={[1, 3, 5, 10]}>
              {(n) => (
                <button type="button" aria-pressed={adet() === n} onClick={() => setAdet(n)}>
                  {n}
                </button>
              )}
            </For>
          </div>
        </div>
        <label class="alan-giris">
          <span>Şu farkla (isteğe bağlı)</span>
          <textarea
            class="girdi"
            rows="2"
            value={fark()}
            onInput={(e) => setFark(e.currentTarget.value)}
            placeholder="ör. sıcak renklerle, kış temalı"
            maxlength="500"
          />
        </label>
      </div>
    </AltSayfa>
  );
}

function FikirSecSayfasi(p: { oge: OgeAyrinti; kapat: () => void; tamam: () => void }): JSX.Element {
  const [not, setNot] = createSignal("");
  const sec = async (): Promise<void> => {
    try {
      await gonder(`oge/${p.oge.id}/fikir-sec`, { not: not() });
      titret(18);
      tost("Fikir seçildi; yapay zekâ yalnız bunu üretecek");
      p.tamam();
    } catch (e) {
      hataTost(e);
    }
  };
  return (
    <AltSayfa
      baslik="Bu fikri seç"
      kapat={p.kapat}
      ayak={
        <>
          <button type="button" class="dg dg--hayalet" onClick={p.kapat}>
            Vazgeç
          </button>
          <button type="button" class="dg dg--onay esnek" onClick={() => void sec()}>
            {not().trim() ? "Bunu al, şunu değiştir" : "Bu fikri seç"}
          </button>
        </>
      }
    >
      <div class="yigin">
        <p class="soluk kucuk">Diğer fikirler gerekçesiz arşive gider. İstersen küçük bir değişiklik iste.</p>
        <textarea
          class="girdi"
          rows="3"
          value={not()}
          onInput={(e) => setNot(e.currentTarget.value)}
          placeholder="ör. bunu al ama rengi diğer fikirdeki gibi mor olsun"
          maxlength="600"
          data-ilk-odak
        />
      </div>
    </AltSayfa>
  );
}

function Rehber(p: { kapat: () => void }): JSX.Element {
  return (
    <div class="rehber" role="dialog" aria-label="Kaydırma rehberi">
      <div class="rehber__kart">
        <h2>Kaydırarak karar ver</h2>
        <ul class="rehber__liste">
          <li>
            <span class="rehber__ok rehber__ok--sag">
              <Simge ad="sonraki" />
            </span>
            Sağa kaydır: <strong>onayla</strong>
          </li>
          <li>
            <span class="rehber__ok rehber__ok--sol">
              <Simge ad="onceki" />
            </span>
            Sola kaydır: <strong>reddet</strong> (not seçersin)
          </li>
          <li>
            <span class="rehber__ok rehber__ok--ust">
              <Simge ad="yukari" />
            </span>
            Yukarı kaydır: <strong>düzeltme iste</strong>
          </li>
        </ul>
        <p class="soluk kucuk">Yanlış karar mı verdin? 10 saniye içinde “Geri al”a dokun.</p>
        <button type="button" class="dg dg--birincil dg--b dg--tam" onClick={p.kapat}>
          Anladım
        </button>
      </div>
    </div>
  );
}

export function Incele(): JSX.Element {
  const alanSuzgeci = (): string | null => sorgu().get("alan");
  const istenenId = (): number | null => {
    const m = /^\/incele\/(\d+)$/.exec(yolAdi());
    return m?.[1] ? Number(m[1]) : null;
  };
  const [kuyruk, { refetch: kuyrukYenile }] = createResource(
    alanSuzgeci,
    async (a) => (await al<{ ogeler: OgeOzeti[] }>(`kuyruk${a ? `?alan=${a}` : ""}`)).ogeler,
    { initialValue: [] },
  );
  // `null` kaynakta tetiklenmez; bu yüzden ayrıca bir kez yüklenir.
  const [kuyrukTum, { mutate: kuyrukTumMutate }] = createResource(async () =>
    alanSuzgeci() ? [] : (await al<{ ogeler: OgeOzeti[] }>("kuyruk")).ogeler,
  );
  const liste = (): OgeOzeti[] => (alanSuzgeci() ? kuyruk() : (kuyrukTum() ?? []));
  const [bitenler, setBitenler] = createSignal(0);
  const [baslangicToplam, setBaslangicToplam] = createSignal<number | null>(null);
  createEffect(() => {
    if (baslangicToplam() === null && !kuyrukTum.loading && liste().length)
      setBaslangicToplam(liste().length);
  });
  const etkinId = (): number | null => istenenId() ?? liste()[0]?.id ?? null;
  const [ayrinti, { mutate: ayrintiDegistir }] = createResource(etkinId, (id) => al<Ayrinti>(`oge/${id}`));
  const [kardesler] = createResource(
    () => (ayrinti()?.oge.gorunum === "fikir" && ayrinti()?.oge.isId ? ayrinti()?.oge.isId : null),
    async (isId) => {
      const r = await al<{ ogeler: OgeOzeti[] }>(`is/${isId}/fikirler`);
      return Promise.all(
        r.ogeler
          .filter((x) => x.durum === "bekliyor")
          .map(async (x) => (await al<Ayrinti>(`oge/${x.id}`)).oge),
      );
    },
  );
  const [panel, setPanel] = createSignal<Panel>("bilgi");
  const [kararSayfa, setKararSayfa] = createSignal<"ret" | "duzeltme" | null>(null);
  const [benzerAcik, setBenzerAcik] = createSignal(false);
  const [oyunAcik, setOyunAcik] = createSignal(false);
  const [fikirSayfa, setFikirSayfa] = createSignal(false);
  const [rehber, setRehber] = createSignal(false);
  const [cikis, setCikis] = createSignal<Karar | null>(null);
  const [secili, setSecili] = createSignal<Set<number>>(new Set());
  const [suruk, setSuruk] = createSignal<{ dx: number; dy: number } | null>(null);
  const [mesgul, setMesgul] = createSignal(false);

  createEffect(
    on(
      () => ayrinti()?.oge.id,
      () => {
        const o = ayrinti()?.oge;
        setSecili(
          new Set<number>(
            o
              ? o.satirlar
                  .map((_, i) => i)
                  .filter((i) => !o.kontrol.satirlar.some((s) => s.satir === i && s.sonuc !== "gecti"))
              : [],
          ),
        );
        setPanel(o && o.kontrol.sonuc !== "gecti" ? "kontrol" : "bilgi");
        setCikis(null);
      },
    ),
  );
  onMount(() => {
    if (matchMedia("(pointer: coarse)").matches && !rehberGoruldu()) setRehber(true);
  });

  const sira = (): number => {
    const id = etkinId();
    const i = liste().findIndex((x) => x.id === id);
    return i < 0 ? 0 : i;
  };
  const toplam = (): number => Math.max(baslangicToplam() ?? liste().length, bitenler() + liste().length);
  const sonrakiId = (): number | null => {
    const l = liste();
    const i = sira();
    return l[i + 1]?.id ?? (l[i - 1]?.id !== etkinId() ? (l[i - 1]?.id ?? null) : null);
  };
  const gec = (yon: 1 | -1): void => {
    const l = liste();
    const h = l[sira() + yon];
    if (h) git(`/incele/${h.id}${alanSuzgeci() ? `?alan=${alanSuzgeci()}` : ""}`, true);
  };
  const kapat = (): void => {
    if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
    else git(alanSuzgeci() ? `/alan/${alanSuzgeci()}` : "/");
  };

  const kararSonrasi = (o: OgeAyrinti, karar: Karar): void => {
    const sonraki = sonrakiId();
    titret(karar === "onay" ? 14 : 22);
    setCikis(karar);
    setTimeout(() => {
      batch(() => {
        setBitenler((b) => b + 1);
        if (alanSuzgeci()) void kuyrukYenile();
        if (sonraki) git(`/incele/${sonraki}${alanSuzgeci() ? `?alan=${alanSuzgeci()}` : ""}`, true);
        else git(`/incele${alanSuzgeci() ? `?alan=${alanSuzgeci()}` : ""}`, true);
      });
      if (!alanSuzgeci()) {
        // Tüm kuyrukta: listeyi yerelde güncelle.
        const l = (kuyrukTum() ?? []).filter((x) => x.id !== o.id);
        kuyrukTumDegistir(l);
      }
      void panoYenile();
    }, 200);
    const ad = karar === "onay" ? "Onaylandı" : karar === "ret" ? "Reddedildi" : "Düzeltme istendi";
    tost(`${ad}: ${o.ad}`, {
      eylem: {
        ad: "Geri al",
        f: () => {
          void gonder(`oge/${o.id}/geri-al`)
            .then(() => {
              setBitenler((b) => Math.max(0, b - 1));
              if (!alanSuzgeci()) kuyrukTumDegistir([{ ...o, durum: "bekliyor" }, ...(kuyrukTum() ?? [])]);
              else void kuyrukYenile();
              git(`/incele/${o.id}${alanSuzgeci() ? `?alan=${alanSuzgeci()}` : ""}`, true);
              void panoYenile();
              tost("Karar geri alındı");
            })
            .catch(hataTost);
        },
      },
    });
  };
  const kuyrukTumDegistir = (l: OgeOzeti[]): void => {
    kuyrukTumMutate(l);
  };

  const kararVer = async (karar: Karar, hazir: HazirNotKodu | null = null, metin = ""): Promise<void> => {
    const a = ayrinti();
    if (!a || mesgul()) return;
    const o = a.oge;
    if (o.denetim) {
      if (karar === "duzeltme") return;
      if (karar === "ret" && !hazir && !metin) return void setKararSayfa("ret");
      setMesgul(true);
      try {
        await gonder(`oge/${o.id}/denetim`, {
          uygun: karar === "onay",
          metin: [hazir ? HAZIR_NOTLAR.find((n) => n.kod === hazir)?.metin : "", metin]
            .filter(Boolean)
            .join(" — "),
        });
        setKararSayfa(null);
        kararSonrasi(o, karar);
      } catch (e) {
        hataTost(e);
      } finally {
        setMesgul(false);
      }
      return;
    }
    if (o.durum !== "bekliyor") return void tost("Bu teslim için karar verilmiş.");
    if (karar !== "onay" && !hazir && metin.trim().length < 2) return void setKararSayfa(karar);
    if (karar === "onay" && o.gorunum === "fikir") return void setFikirSayfa(true);
    if (karar === "onay" && o.gorunum === "liste" && secili().size === 0)
      return void tost("Onaylanacak satır seçmedin.", { hata: true });
    setMesgul(true);
    try {
      const govde: Record<string, unknown> = {
        karar,
        ...(hazir ? { hazir } : {}),
        ...(metin.trim() ? { metin } : {}),
      };
      if (karar === "onay" && o.gorunum === "liste" && secili().size < o.satirlar.length)
        govde.satirlar = [...secili()].sort((x, y) => x - y);
      if (karar === "onay" && o.varyantIs)
        await gonder(`is/${o.varyantIs}/varyant-sec`, { ogeId: o.id, karisim: "" });
      else await gonder(`oge/${o.id}/karar`, govde);
      setKararSayfa(null);
      kararSonrasi(o, karar);
    } catch (e) {
      hataTost(e);
    } finally {
      setMesgul(false);
    }
  };

  const tus = (e: KeyboardEvent): void => {
    if (
      yazmaAlaniMi(e.target) ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      kararSayfa() ||
      benzerAcik() ||
      oyunAcik() ||
      fikirSayfa()
    )
      return;
    const k = e.key.toLowerCase();
    if (k === "o") void kararVer("onay");
    else if (k === "r") void kararVer("ret");
    else if (k === "d") void kararVer("duzeltme");
    else if (k === "arrowright" || k === "j") gec(1);
    else if (k === "arrowleft" || k === "k") gec(-1);
    else if (k === "b") zeminDondur();
    else if (k === "escape") kapat();
    else return;
    e.preventDefault();
  };
  onMount(() => document.addEventListener("keydown", tus));
  onCleanup(() => document.removeEventListener("keydown", tus));

  // ---- Kaydırma jestleri (yalnız dokunma)
  let bas: { x: number; y: number; t: number; id: number } | null = null;
  const jestBasla = (e: PointerEvent): void => {
    if (e.pointerType !== "touch" || ayrinti()?.oge.gorunum === "liste") return;
    const hedef = e.target as HTMLElement;
    if (hedef.closest("button, input, textarea, [role=slider], .dalga, .kucuk-resimler, .tablo-kap")) return;
    bas = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };
  const jestHareket = (e: PointerEvent): void => {
    if (!bas || e.pointerId !== bas.id) return;
    const dx = e.clientX - bas.x;
    const dy = e.clientY - bas.y;
    if (!suruk() && Math.hypot(dx, dy) < 10) return;
    if (!suruk() && Math.abs(dy) > Math.abs(dx) && dy > 0) {
      bas = null;
      return;
    }
    setSuruk({ dx, dy });
  };
  const jestBitir = (e: PointerEvent): void => {
    if (!bas || e.pointerId !== bas.id) return;
    const s = suruk();
    const sure = performance.now() - bas.t;
    bas = null;
    setSuruk(null);
    if (!s) return;
    const k = jestKarari(s.dx, s.dy, sure);
    if (k) void kararVer(k);
  };
  const ipucu = createMemo(() => {
    const s = suruk();
    return s ? jestIpucu(s.dx, s.dy) : { karar: null, guc: 0 };
  });
  const kartStili = (): JSX.CSSProperties => {
    const s = suruk();
    if (s)
      return {
        transform: `translate(${s.dx}px, ${Math.min(0, s.dy)}px) rotate(${s.dx / 28}deg)`,
        transition: "none",
      };
    return {};
  };

  return (
    <div class="odak" classList={{ "odak--liste": ayrinti()?.oge.gorunum === "liste" }}>
      <header class="odak__ust">
        <button type="button" class="dg-simge" onClick={kapat} aria-label="Kapat (Esc)">
          <Simge ad="kapat" />
        </button>
        <Show when={ayrinti()} fallback={<Iskelet g="40%" y="16px" />}>
          {(a) => (
            <div class="odak__baslik">
              <AlanIsareti alan={a().oge.alan} />
              <h1 class="tasma">{a().oge.ad}</h1>
              <span class="odak__etiketler">
                <Show when={a().oge.surum > 1}>
                  <span class="etiket">{a().oge.surum}. sürüm</span>
                </Show>
                <Show when={a().oge.denetim}>
                  <span class="etiket etiket--vurgu">Denetim</span>
                </Show>
                <Show when={a().oge.gorunum === "fikir"}>
                  <span class="etiket etiket--vurgu">Fikir</span>
                </Show>
                <SonucEtiketi sonuc={a().oge.sonuc} />
              </span>
            </div>
          )}
        </Show>
        <Show when={liste().length || bitenler()}>
          <div
            class="odak__ilerleme"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={toplam()}
            aria-valuenow={Math.min(toplam(), bitenler() + sira() + 1)}
            aria-label="İnceleme ilerlemesi"
          >
            <span class="kucuk">
              <strong>{Math.min(toplam(), bitenler() + sira() + 1)}</strong>
              <span class="cok-soluk"> / {toplam()}</span>
            </span>
            <div class="cubuk">
              <span
                style={{
                  width: `${(Math.min(toplam(), bitenler() + sira() + 1) / Math.max(1, toplam())) * 100}%`,
                }}
              />
            </div>
          </div>
        </Show>
        <div class="odak__gezinme">
          <button
            type="button"
            class="dg-simge"
            disabled={sira() === 0}
            onClick={() => gec(-1)}
            aria-label="Önceki (←)"
          >
            <Simge ad="onceki" />
          </button>
          <button
            type="button"
            class="dg-simge"
            disabled={sira() >= liste().length - 1}
            onClick={() => gec(1)}
            aria-label="Sıradaki (→)"
          >
            <Simge ad="sonraki" />
          </button>
        </div>
      </header>

      <Switch>
        <Match when={!etkinId() && !kuyrukTum.loading && !kuyruk.loading}>
          <div class="odak__bitti">
            <Bos
              simge="tamam"
              baslik={bitenler() ? "Hepsi bitti" : "İncelenecek teslim yok"}
              eylem={
                <button type="button" class="dg dg--birincil" onClick={() => git("/")}>
                  Panoya dön
                </button>
              }
            >
              {bitenler()
                ? `${bitenler()} teslim için karar verdin. Yeni teslim gelince bildirim alırsın.`
                : "Yapay zekâlar teslim edince burada sıraya girer. Ön kontrolden kalanlar sana gelmez."}
            </Bos>
          </div>
        </Match>
        <Match when={true}>
          <div class="odak__govde">
            <div
              class="odak__sahne"
              onPointerDown={jestBasla}
              onPointerMove={jestHareket}
              onPointerUp={jestBitir}
              onPointerCancel={jestBitir}
            >
              <Show
                when={!ayrinti.loading && ayrinti()}
                fallback={
                  <div class="sahne">
                    <Iskelet y="min(56vh, 520px)" r="14px" />
                  </div>
                }
              >
                {(a) => (
                  <div
                    class={`odak__kart ${cikis() ? `odak__kart--cikis-${cikis()}` : ""}`}
                    style={kartStili()}
                  >
                    <Show when={ipucu().karar}>
                      <div class={`jest-ipucu jest-ipucu--${ipucu().karar}`} style={{ opacity: ipucu().guc }}>
                        <Simge
                          ad={
                            ipucu().karar === "onay" ? "onay" : ipucu().karar === "ret" ? "ret" : "duzeltme"
                          }
                          boyut={28}
                        />
                        {ipucu().karar === "onay"
                          ? "Onayla"
                          : ipucu().karar === "ret"
                            ? "Reddet"
                            : "Düzeltme"}
                      </div>
                    </Show>
                    <Show when={a().oge.durum !== "bekliyor" && !a().oge.denetim}>
                      <div class="serit serit--bilgi">
                        <Simge ad="bilgi" />
                        <span>
                          Bu sürüm için karar verilmiş: <DurumEtiketi durum={a().oge.durum} />
                        </span>
                      </div>
                    </Show>
                    <Show when={a().oge.denetim}>
                      <div class="serit serit--bilgi">
                        <Simge ad="kalkan" />
                        <span>
                          Bu teslim kademeli güvenle kendiliğinden onaylandı. Uygun değilse bu alanın otomatik
                          onayı kapanır.
                        </span>
                      </div>
                    </Show>
                    <Show when={a().oge.varyantIs}>
                      <div class="serit serit--bilgi">
                        <Simge ad="katman" />
                        <span>Görsel varyantlardan biri. Onaylarsan diğerleri arşive gider.</span>
                      </div>
                    </Show>
                    <Switch fallback={<MetinSahne oge={a().oge} />}>
                      <Match when={a().oge.gorunum === "gorsel"}>
                        <GorselSahne oge={a().oge} onceki={a().onceki} />
                      </Match>
                      <Match when={a().oge.gorunum === "animasyon"}>
                        <AnimasyonSahne oge={a().oge} />
                      </Match>
                      <Match when={a().oge.gorunum === "ses" || a().oge.gorunum === "muzik"}>
                        <SesSahne oge={a().oge} onceki={a().onceki} muzik={a().oge.gorunum === "muzik"} />
                      </Match>
                      <Match when={a().oge.gorunum === "liste"}>
                        <ListeSahne
                          oge={a().oge}
                          secili={secili()}
                          setSecili={setSecili}
                          karar={a().oge.durum === "bekliyor"}
                        />
                      </Match>
                      <Match when={a().oge.gorunum === "kart"}>
                        <KartSahne oge={a().oge} />
                      </Match>
                      <Match when={a().oge.gorunum === "wiki"}>
                        <WikiSahne oge={a().oge} onceki={a().onceki} />
                      </Match>
                      <Match when={a().oge.gorunum === "rapor"}>
                        <RaporSahne oge={a().oge} />
                      </Match>
                      <Match when={a().oge.gorunum === "fikir"}>
                        <FikirSahne oge={a().oge} kardesler={kardesler() ?? []} />
                      </Match>
                    </Switch>
                    <Show when={a().oge.degisiklikler.length}>
                      <section class="yigin odak__fark">
                        <h3>Değişiklikler</h3>
                        <Show when={a().oge.gerekce}>
                          <p class="serit serit--bilgi">
                            <Simge ad="bilgi" />
                            <span>{a().oge.gerekce}</span>
                          </p>
                        </Show>
                        <FarkGorunumu oge={a().oge} />
                      </section>
                    </Show>
                  </div>
                )}
              </Show>
            </div>
            <aside class="odak__panel">
              <Show
                when={ayrinti()}
                fallback={
                  <div class="yigin">
                    <Iskelet />
                    <Iskelet g="80%" />
                    <Iskelet g="60%" />
                  </div>
                }
              >
                {(a) => (
                  <>
                    <Sekmeler<Panel>
                      etiket="Ayrıntılar"
                      secili={panel()}
                      sec={setPanel}
                      secenekler={[
                        { id: "bilgi", ad: "Bilgi" },
                        {
                          id: "kontrol",
                          ad: "Ön kontrol",
                          sayi: a().oge.kontrol.satirlar.filter(
                            (s) => s.sonuc === "uyari" || s.sonuc === "kaldi",
                          ).length,
                        },
                        { id: "gecmis", ad: "Geçmiş", sayi: a().oge.notlar.length },
                      ]}
                    />
                    <div class="odak__panel-icerik">
                      <Switch>
                        <Match when={panel() === "bilgi"}>
                          <BilgiPaneli a={a()} />
                        </Match>
                        <Match when={panel() === "kontrol"}>
                          <KontrolListesi satirlar={a().oge.kontrol.satirlar} />
                        </Match>
                        <Match when={panel() === "gecmis"}>
                          <GecmisPaneli a={a()} />
                        </Match>
                      </Switch>
                    </div>
                    <div class="odak__ek">
                      <Show when={varsayilanEkran(a().oge)}>
                        <button type="button" class="dg dg--k" onClick={() => setOyunAcik(true)}>
                          <Simge ad="incele" /> Oyunda gör
                        </button>
                      </Show>
                      <Show when={a().oge.gorunum !== "fikir" && a().oge.gorunum !== "rapor"}>
                        <button type="button" class="dg dg--k" onClick={() => setBenzerAcik(true)}>
                          <Simge ad="pirilti" /> Benzerini daha üret
                        </button>
                      </Show>
                    </div>
                  </>
                )}
              </Show>
            </aside>
          </div>
          <footer class="odak__alt">
            <Show
              when={ayrinti()?.oge.denetim}
              fallback={
                <div class="karar-cubugu">
                  <button
                    type="button"
                    class="dg dg--b karar karar--ret"
                    disabled={mesgul() || ayrinti()?.oge.durum !== "bekliyor"}
                    onClick={() => void kararVer("ret")}
                  >
                    <Simge ad="ret" />
                    <span>Reddet</span>
                    <span class="kisayol">R</span>
                  </button>
                  <Show when={ayrinti()?.oge.gorunum !== "fikir"}>
                    <button
                      type="button"
                      class="dg dg--b karar karar--duzelt"
                      disabled={mesgul() || ayrinti()?.oge.durum !== "bekliyor"}
                      onClick={() => void kararVer("duzeltme")}
                    >
                      <Simge ad="duzeltme" />
                      <span class="uzun">Düzeltme</span>
                      <span class="kisa">Düzelt</span>
                      <span class="kisayol">D</span>
                    </button>
                  </Show>
                  <button
                    type="button"
                    class="dg dg--b dg--onay karar karar--onay"
                    disabled={mesgul() || ayrinti()?.oge.durum !== "bekliyor"}
                    onClick={() => void kararVer("onay")}
                  >
                    <Simge ad="onay" />
                    <span>
                      {ayrinti()?.oge.gorunum === "fikir"
                        ? "Bu fikri seç"
                        : ayrinti()?.oge.gorunum === "liste" &&
                            secili().size < (ayrinti()?.oge.satirlar.length ?? 0)
                          ? `${secili().size} satırı onayla`
                          : "Onayla"}
                    </span>
                    <span class="kisayol">O</span>
                  </button>
                </div>
              }
            >
              <div class="karar-cubugu">
                <button
                  type="button"
                  class="dg dg--b karar karar--ret"
                  disabled={mesgul()}
                  onClick={() => void kararVer("ret")}
                >
                  <Simge ad="ret" /> <span>Uygun değil</span>
                </button>
                <button
                  type="button"
                  class="dg dg--b dg--onay karar karar--onay"
                  disabled={mesgul()}
                  onClick={() => void kararVer("onay")}
                >
                  <Simge ad="onay" /> <span>Uygun</span>
                </button>
              </div>
            </Show>
          </footer>
        </Match>
      </Switch>

      <Show when={kararSayfa()}>
        {(t) => (
          <KararSayfasi
            tur={t()}
            kapat={() => setKararSayfa(null)}
            gonder={(h, m) => void kararVer(t(), h, m)}
          />
        )}
      </Show>
      <Show when={benzerAcik() && ayrinti()}>
        {(a) => <BenzerSayfasi oge={(a() as Ayrinti).oge} kapat={() => setBenzerAcik(false)} />}
      </Show>
      <Show when={fikirSayfa() && ayrinti()}>
        {(a) => (
          <FikirSecSayfasi
            oge={(a() as Ayrinti).oge}
            kapat={() => setFikirSayfa(false)}
            tamam={() => {
              setFikirSayfa(false);
              const o = (a() as Ayrinti).oge;
              ayrintiDegistir({ ...(a() as Ayrinti), oge: { ...o, durum: "onaylandi" } });
              kararSonrasi(o, "onay");
            }}
          />
        )}
      </Show>
      <Show when={oyunAcik() && ayrinti()}>
        {(a) => (
          <AltSayfa baslik="Oyunda nasıl görünecek" kapat={() => setOyunAcik(false)} genis>
            <OyunOnizleme oge={(a() as Ayrinti).oge} url={oturum()?.onizlemeUrl ?? ""} />
          </AltSayfa>
        )}
      </Show>
      <Show when={rehber()}>
        <Rehber
          kapat={() => {
            rehberiKapat();
            setRehber(false);
          }}
        />
      </Show>
    </div>
  );
}
