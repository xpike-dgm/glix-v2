/** Ayarlar: görünüm (tema, yazı boyutu), bildirimler (UM-U7), paketler, kod istekleri, denetim kaydı, oturum. */
import { createResource, createSignal, For, type JSX, Show } from "solid-js";
import type { KodIstegi, PaketKaydi } from "../../../src/ortak/tipler.js";
import { al, gonder } from "../api.js";
import { tarihSaat } from "../bicim.js";
import { AlanIsareti, AltSayfa, Bos, Sekmeler } from "../bilesenler.js";
import { hataTost, oturum, oturumYukle, setTema, setYaziBuyuk, sorgu, tema, tost, yaziBuyuk } from "../durum.js";
import { panoYenile } from "../Kabuk.js";
import { Simge } from "../simgeler.js";

type Sekme = "genel" | "paketler" | "kod" | "denetim";

interface BildirimAyari {
  acik: boolean;
  ozetSaati: string;
  sessizBas: string;
  sessizSon: string;
}

const b64uDizi = (s: string): Uint8Array => {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

function Bildirimler(): JSX.Element {
  const [veri, { refetch }] = createResource(() => al<{ ayar: BildirimAyari; acik: boolean; abone: number }>("bildirim/ayar"));
  const [izin, setIzin] = createSignal(typeof Notification === "undefined" ? "denied" : Notification.permission);
  const ayarYaz = async (a: BildirimAyari): Promise<void> => {
    try {
      await gonder("bildirim/ayar", a);
      void refetch();
    } catch (e) {
      hataTost(e);
    }
  };
  const abone = async (): Promise<void> => {
    const anahtar = oturum()?.vapid;
    if (!anahtar || !("serviceWorker" in navigator)) return void tost("Bu tarayıcı bildirimleri desteklemiyor.", { hata: true });
    try {
      const k = await Notification.requestPermission();
      setIzin(k);
      if (k !== "granted") return void tost("Bildirim izni verilmedi. Tarayıcı ayarlarından açabilirsin.", { hata: true });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uDizi(anahtar) as BufferSource });
      await gonder("bildirim/abone", sub.toJSON());
      await gonder("bildirim/dene");
      tost("Bildirimler açıldı; bir deneme bildirimi gönderdik");
      void refetch();
    } catch (e) {
      hataTost(e);
    }
  };
  return (
    <section class="kart kart--ic yigin">
      <div class="satir">
        <Simge ad="zil" />
        <h2>Bildirimler</h2>
      </div>
      <Show when={veri()} fallback={<p class="cok-soluk">Yükleniyor…</p>}>
        {(v) => (
          <>
            <Show when={v().acik} fallback={<p class="soluk kucuk">Bildirim gönderimi bu sunucuda ayarlı değil; yönetici açınca burada etkinleştirebilirsin.</p>}>
              <div class="anahtarli-satir">
                <span class="esnek">
                  <strong>Bu cihaza bildirim</strong>
                  <span class="cok-soluk kucuk">Kırmızı uyarı hemen, günlük özet seçtiğin saatte gelir. Kayıtlı cihaz: {v().abone}</span>
                </span>
                <button type="button" class="dg dg--k" onClick={() => void abone()}>
                  {izin() === "granted" ? "Yeniden bağla" : "Aç"}
                </button>
              </div>
            </Show>
            <label class="anahtarli-satir">
              <span class="esnek">
                <strong>Bildirimler açık</strong>
                <span class="cok-soluk kucuk">Kapatırsan hiçbir bildirim gönderilmez.</span>
              </span>
              <input type="checkbox" class="anahtar-dugme" checked={v().ayar.acik} onChange={(e) => void ayarYaz({ ...v().ayar, acik: e.currentTarget.checked })} />
            </label>
            <div class="uc-sutun">
              <label class="alan-giris">
                <span>Günlük özet</span>
                <input class="girdi" type="time" value={v().ayar.ozetSaati} onChange={(e) => void ayarYaz({ ...v().ayar, ozetSaati: e.currentTarget.value })} />
              </label>
              <label class="alan-giris">
                <span>Sessiz saat başı</span>
                <input class="girdi" type="time" value={v().ayar.sessizBas} onChange={(e) => void ayarYaz({ ...v().ayar, sessizBas: e.currentTarget.value })} />
              </label>
              <label class="alan-giris">
                <span>Sessiz saat sonu</span>
                <input class="girdi" type="time" value={v().ayar.sessizSon} onChange={(e) => void ayarYaz({ ...v().ayar, sessizSon: e.currentTarget.value })} />
              </label>
            </div>
            <p class="cok-soluk kucuk">Sessiz saatlerde gelen acil uyarılar sessiz saat bitince gönderilir.</p>
          </>
        )}
      </Show>
    </section>
  );
}

function Paketler(): JSX.Element {
  const [veri, { refetch }] = createResource(() => al<{ paketler: PaketKaydi[] }>("paketler"));
  const [isaret, setIsaret] = createSignal<PaketKaydi | null>(null);
  const [rev, setRev] = createSignal("");
  const hazirla = async (): Promise<void> => {
    try {
      const r = await gonder<{ paket: PaketKaydi }>("paket");
      tost(`Paket hazır: ${r.paket.klasor}`);
      void refetch();
      void panoYenile();
    } catch (e) {
      hataTost(e);
    }
  };
  const eklendi = async (): Promise<void> => {
    const p = isaret();
    if (!p) return;
    try {
      await gonder(`paket/${p.id}/oyuna-eklendi`, { revizyon: rev() });
      tost("İşaretlendi. Canlı sürüm bu sürüme ulaşınca öğeler kendiliğinden “canlıda” olur.");
      setIsaret(null);
      setRev("");
      void refetch();
    } catch (e) {
      hataTost(e);
    }
  };
  const DURUM: Record<PaketKaydi["durum"], string> = { hazir: "Yöneticiye hazır", oyuna_eklendi: "Oyuna eklendi", canlida: "Canlıda" };
  return (
    <div class="yigin">
      <div class="satir satir--ara">
        <p class="soluk">Onaylananlar pakete alınır; yönetici paketi koda ekleyip test eder.</p>
        <button type="button" class="dg dg--birincil" onClick={() => void hazirla()}>
          <Simge ad="paket" /> Paket hazırla
        </button>
      </div>
      <Show when={veri()?.paketler.length} fallback={<Bos simge="paket" baslik="Henüz paket yok">Onaylanan görsel, ses ve katalog satırları birikince “Paket hazırla” ile yöneticiye gönderilir.</Bos>}>
        <ul class="oge-listesi">
          <For each={veri()?.paketler}>
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
                <span class={`etiket ${p.durum === "canlida" ? "etiket--gecti" : p.durum === "hazir" ? "etiket--vurgu" : ""}`}>{DURUM[p.durum]}</span>
                <Show when={p.durum === "hazir"}>
                  <button type="button" class="dg dg--k" onClick={() => setIsaret(p)}>
                    Oyuna eklendi
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={isaret()}>
        <AltSayfa
          baslik="Hangi sürümde eklendi?"
          kapat={() => setIsaret(null)}
          ayak={
            <button type="button" class="dg dg--birincil esnek" disabled={!/^[0-9a-f]{7,40}$/i.test(rev().trim())} onClick={() => void eklendi()}>
              Kaydet
            </button>
          }
        >
          <label class="alan-giris">
            <span>Sürüm kimliği (git commit)</span>
            <input class="girdi mono" value={rev()} onInput={(e) => setRev(e.currentTarget.value)} placeholder="ör. 3f9c2ab" data-ilk-odak />
          </label>
        </AltSayfa>
      </Show>
    </div>
  );
}

function KodIstekleri(): JSX.Element {
  const [veri, { refetch }] = createResource(() => al<{ istekler: KodIstegi[] }>("kod-istekleri"));
  const durum = async (k: KodIstegi, d: "onaylandi" | "reddedildi" | "yapildi"): Promise<void> => {
    try {
      await gonder(`kod-istegi/${k.id}/durum`, { durum: d });
      void refetch();
    } catch (e) {
      hataTost(e);
    }
  };
  const AD: Record<KodIstegi["durum"], string> = { bekliyor: "Bekliyor", onaylandi: "Yöneticide", reddedildi: "Reddedildi", yapildi: "Yapıldı" };
  return (
    <Show when={veri()?.istekler.length} fallback={<Bos simge="kod" baslik="Kod isteği yok">Yapay zekâlar veriyle yapılamayan şeyler için gerekçeli istek açınca burada görünür.</Bos>}>
      <ul class="oge-listesi">
        <For each={veri()?.istekler}>
          {(k) => (
            <li class="oge-satiri oge-satiri--genis">
              <span class="esnek yigin" style={{ gap: "4px" }}>
                <span class="satir" style={{ "flex-wrap": "wrap" }}>
                  <AlanIsareti alan={k.alan} />
                  <strong>{k.baslik}</strong>
                  <span class="etiket">{AD[k.durum]}</span>
                </span>
                <span class="soluk kucuk">{k.gerekce}</span>
              </span>
              <Show when={k.durum === "bekliyor"}>
                <button type="button" class="dg dg--k dg--birincil" onClick={() => void durum(k, "onaylandi")}>
                  Yöneticiye ver
                </button>
                <button type="button" class="dg dg--k dg--hayalet" onClick={() => void durum(k, "reddedildi")}>
                  Reddet
                </button>
              </Show>
              <Show when={k.durum === "onaylandi"}>
                <button type="button" class="dg dg--k" onClick={() => void durum(k, "yapildi")}>
                  Yapıldı
                </button>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}

function Denetim(): JSX.Element {
  const [veri] = createResource(() => al<{ kayitlar: { id: number; zaman: number; kim: string; eylem: string; hedef: string; ayrinti: string }[] }>("denetim"));
  return (
    <div class="tablo-kap">
      <table class="tablo">
        <thead>
          <tr>
            <th>Zaman</th>
            <th>Kim</th>
            <th>Ne</th>
            <th>Ayrıntı</th>
          </tr>
        </thead>
        <tbody>
          <For each={veri()?.kayitlar}>
            {(k) => (
              <tr>
                <td class="kucuk" style={{ "white-space": "nowrap" }}>
                  {tarihSaat(k.zaman)}
                </td>
                <td class="kucuk tasma" style={{ "max-width": "180px" }}>
                  {k.kim}
                </td>
                <td class="kucuk">{k.eylem.replace(/_/g, " ")}</td>
                <td class="kucuk soluk">{[k.hedef, k.ayrinti].filter(Boolean).join(" · ")}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

export function Ayarlar(): JSX.Element {
  const ilk = sorgu().get("sekme");
  const [sekme, setSekme] = createSignal<Sekme>(ilk === "paketler" || ilk === "kod" || ilk === "denetim" ? ilk : "genel");
  const cikis = async (): Promise<void> => {
    try {
      await gonder("cikis");
    } finally {
      await oturumYukle();
    }
  };
  return (
    <div class="sayfa">
      <header class="sayfa__bas">
        <div>
          <h1>Ayarlar</h1>
          <p class="soluk">{oturum()?.eposta}</p>
        </div>
      </header>
      <Sekmeler<Sekme>
        etiket="Ayar bölümleri"
        secili={sekme()}
        sec={setSekme}
        secenekler={[
          { id: "genel", ad: "Genel" },
          { id: "paketler", ad: "Paketler" },
          { id: "kod", ad: "Kod istekleri" },
          { id: "denetim", ad: "İşlem kaydı" },
        ]}
      />
      <div class="sayfa__govde">
        <Show when={sekme() === "genel"}>
          <div class="iki-sutun iki-sutun--genis">
            <section class="kart kart--ic yigin">
              <div class="satir">
                <Simge ad="gunes" />
                <h2>Görünüm</h2>
              </div>
              <div class="anahtarli-satir">
                <span class="esnek">
                  <strong>Tema</strong>
                  <span class="cok-soluk kucuk">Sistem, cihazının ayarını izler.</span>
                </span>
                <div class="secim">
                  <button type="button" aria-pressed={tema() === "sistem"} onClick={() => setTema("sistem")}>
                    Sistem
                  </button>
                  <button type="button" aria-pressed={tema() === "acik"} onClick={() => setTema("acik")}>
                    Açık
                  </button>
                  <button type="button" aria-pressed={tema() === "koyu"} onClick={() => setTema("koyu")}>
                    Koyu
                  </button>
                </div>
              </div>
              <label class="anahtarli-satir">
                <span class="esnek">
                  <strong>Büyük yazı</strong>
                  <span class="cok-soluk kucuk">Bütün metinler biraz büyür.</span>
                </span>
                <input type="checkbox" class="anahtar-dugme" checked={yaziBuyuk()} onChange={(e) => setYaziBuyuk(e.currentTarget.checked)} />
              </label>
            </section>
            <Bildirimler />
            <section class="kart kart--ic yigin">
              <div class="satir">
                <Simge ad="kalkan" />
                <h2>Oturum</h2>
              </div>
              <p class="soluk kucuk">Bu cihazdaki oturumu kapatır. Yeniden girmek için e-postana kod gelir.</p>
              <button type="button" class="dg dg--tehlike" onClick={() => void cikis()}>
                <Simge ad="cikis" /> Çıkış yap
              </button>
              <p class="cok-soluk kucuk">Sürüm {oturum()?.surum}</p>
            </section>
          </div>
        </Show>
        <Show when={sekme() === "paketler"}>
          <Paketler />
        </Show>
        <Show when={sekme() === "kod"}>
          <KodIstekleri />
        </Show>
        <Show when={sekme() === "denetim"}>
          <Denetim />
        </Show>
      </div>
    </div>
  );
}
