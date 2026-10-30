/**
 * Oyun ansiklopedisi (`/wiki`): yöneticinin masaüstünden açtığı, her oyunun kural, puan, akış ve ekranlarını
 * gösteren sayfa. Sağdaki telefon görüntüleyicide ekranın üstüne kutu çizip not bırakılır; notlar sunucuda
 * (`wiki_feedback`) durur. Erişim yönetici paneliyle aynıdır: oturum + yönetici hesabı + e-posta kodu.
 */
import "../fonts.js";
import "./wiki.css";
import {
  WIKI_FEEDBACK_SECTIONS,
  WIKI_IMAGE_MAX_BYTES,
  type WikiBox,
  type WikiFeedback,
  type WikiFeedbackStatus,
} from "@glix/engine";
import { parseData, parseFeedbackList, parseState, type WikiGame, type WikiScreen } from "./parse.js";

const API = "/api/admin/";
const RENK: Record<string, string> = {
  Blöf: "#ff4fd8",
  Kelime: "#2ef2ff",
  Refleks: "#c7ff3d",
  Hafıza: "#9a7bff",
  Strateji: "#ffc23b",
  Şans: "#ff8a3d",
  Çizim: "#5bc0ff",
  Sosyal: "#ff5b6e",
  Zamanlama: "#7dffb0",
};
const SEKMELER = [
  ["genel", "Genel bakış"],
  ["kurallar", "Kurallar"],
  ["puan", "Puanlama"],
  ["durum", "Özel durumlar"],
  ["ekranlar", "Ekranlar"],
  ["teknik", "Teknik"],
  ["gb", "Geri bildirim"],
] as const;
type Sekme = (typeof SEKMELER)[number][0];
const SEKME_ANAHTAR = "glix-wiki-sekme";
const DURUM_AD: Record<WikiFeedbackStatus, string> = {
  acik: "Açık",
  isleniyor: "İnceleniyor",
  cozuldu: "Çözüldü",
};

interface Durum {
  oyunlar: WikiGame[];
  ekranVar: Set<string>;
  oyun: string | null;
  sekme: Sekme;
  ekran: number;
  isaret: boolean;
  kat: string;
  ara: string;
  gb: WikiFeedback[];
  gbHazir: boolean;
  vurgu: number | null;
  gorsel: Blob | null;
}

const s: Durum = {
  oyunlar: [],
  ekranVar: new Set(),
  oyun: null,
  sekme: "genel",
  ekran: 0,
  isaret: false,
  kat: "Tümü",
  ara: "",
  gb: [],
  gbHazir: false,
  vurgu: null,
  gorsel: null,
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} yok`);
  return el;
}
const $opt = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (t: unknown): string => String(t ?? "").replace(/[&<>"']/g, (c) => ESC[c] ?? c);
const oyunBul = (id: string | null): WikiGame | undefined => s.oyunlar.find((o) => o.id === id);
const ekranSrc = (m: string): string => `${API}wiki/image?f=${encodeURIComponent(m)}`;
const kartSrc = (id: string): string => `/assets/cards/${encodeURIComponent(id)}.webp`;
const gorselSrc = (id: number): string => `${API}wiki/feedback/image?id=${id}`;
const renk = (k: string): string => RENK[k] ?? "#888";
const acikSay = (id: string): number => s.gb.filter((g) => g.gameId === id && g.status !== "cozuldu").length;
const ekranlar = (o: WikiGame): WikiScreen[] => o.ekranlar.filter((e) => s.ekranVar.has(e.dosya));
/** Notun oyundaki sıra numarası (eskiden yeniye). */
const notNo = (g: WikiFeedback): number =>
  s.gb.filter(
    (x) =>
      x.gameId === g.gameId && (x.createdAt < g.createdAt || (x.createdAt === g.createdAt && x.id <= g.id)),
  ).length;

function tarih(ms: number): string {
  try {
    return new Date(ms).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function bildir(m: string): void {
  const d = document.createElement("div");
  d.className = "bildirim";
  d.textContent = m;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2400);
}

/* ── ağ ── */

class IstekHatasi extends Error {}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(API + path, { credentials: "same-origin", cache: "no-store" });
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { status: r.status, body };
}

async function post(path: string, data: unknown): Promise<void> {
  let r: Response;
  try {
    r = await fetch(API + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new IstekHatasi("Bağlantı kurulamadı. Tekrar dene.");
  }
  if (r.ok) return;
  let message = "İşlem yapılamadı.";
  try {
    const b: unknown = await r.json();
    if (typeof b === "object" && b !== null && "message" in b && typeof b.message === "string")
      message = b.message;
  } catch {
    // Gövde yoksa genel ileti kalır.
  }
  throw new IstekHatasi(message);
}

async function notlariYukle(): Promise<void> {
  try {
    const r = await getJson("wiki/feedback");
    const l = r.status === 200 ? parseFeedbackList(r.body) : null;
    if (!l) return;
    s.gb = l;
    s.gbHazir = true;
    yenidenCiz();
  } catch {
    // Ağ yoksa eski liste kalır; bir sonraki yenilemede gelir.
  }
}

/** Not listesi değişince sayfayı yeniden kurar; yazılmakta olan metin ve açık işaret kutusu korunur. */
function yenidenCiz(): void {
  const odak = document.activeElement?.id;
  const taslak = $opt<HTMLTextAreaElement>("gb-metin")?.value;
  const bolum = $opt<HTMLSelectElement>("gb-bolum")?.value;
  const acilirVar = document.querySelector(".acilir") !== null;
  liste();
  if (s.oyun) oyunSayfasi();
  else genelBakis();
  const metin = $opt<HTMLTextAreaElement>("gb-metin");
  if (metin && taslak) metin.value = taslak;
  const sec = $opt<HTMLSelectElement>("gb-bolum");
  if (sec && bolum) sec.value = bolum;
  gorselAdi();
  if (!acilirVar) goruntuleyici();
  if (odak) $opt(odak)?.focus();
}

/* ── sol raf ── */

function kategoriler(): void {
  const k = [
    "Tümü",
    ...Array.from(new Set(s.oyunlar.map((o) => o.kategori))).sort((a, b) => a.localeCompare(b, "tr")),
  ];
  $("kategoriler").innerHTML = k
    .map(
      (x) =>
        `<button class="cip" type="button" data-kat="${esc(x)}" aria-pressed="${x === s.kat}">${esc(x)}</button>`,
    )
    .join("");
}

function liste(): void {
  const q = s.ara.toLocaleLowerCase("tr");
  const l = s.oyunlar.filter(
    (o) =>
      (s.kat === "Tümü" || o.kategori === s.kat) &&
      (!q || `${o.ad} ${o.etiketler.join(" ")}`.toLocaleLowerCase("tr").includes(q)),
  );
  $("liste").innerHTML =
    l
      .map((o) => {
        const n = acikSay(o.id);
        return `<button class="oge" type="button" data-oyun="${esc(o.id)}" aria-current="${s.oyun === o.id}">
        <img src="${kartSrc(o.id)}" alt="" loading="lazy">
        <span><span class="oge__ad">${esc(o.ad)}</span><br><span class="oge__alt"><span class="kategori-renk" style="background:${renk(o.kategori)}"></span>${esc(o.kategori)} · ${o.oyuncu.min}–${o.oyuncu.max} kişi</span></span>
        ${n ? `<span class="rozet" title="Açık geri bildirim">${n}</span>` : "<span></span>"}
      </button>`;
      })
      .join("") || `<div class="bos">Eşleşen oyun yok</div>`;
}

/* ── orta ── */

function genelBakis(): void {
  const acik = s.gb.filter((g) => g.status !== "cozuldu");
  $("dosya").innerHTML = `
    <section class="genel-bas">
      <span class="ust-etiket">Oyun ansiklopedisi</span>
      <h1><em>${s.oyunlar.length}</em> oyun, her ayrıntısıyla</h1>
      <p class="slogan">Kurallar, puanlama, aşama aşama akış, süreler, özel durumlar ve oyunun kendi ekranları. Bir ekranın üstüne kutu çizip not bırak; notlar burada toplanır ve tek tek işlenir.</p>
      <div class="olcular">
        <div class="olcu"><small>Oyun</small><b>${s.oyunlar.length}</b></div>
        <div class="olcu"><small>Ekran görüntüsü</small><b>${s.ekranVar.size}</b></div>
        <div class="olcu"><small>Açık geri bildirim</small><b>${s.gbHazir ? acik.length : "—"}</b></div>
        <div class="olcu"><small>Çözülen</small><b>${s.gbHazir ? s.gb.length - acik.length : "—"}</b></div>
      </div>
    </section>
    <div class="icerik">
      <section class="vitrin">${s.oyunlar
        .map((o) => {
          const n = acikSay(o.id);
          return `<button class="vk" type="button" data-oyun="${esc(o.id)}"><img src="${kartSrc(o.id)}" alt="" loading="lazy">${n ? `<span class="rozet">${n}</span>` : ""}<div><b>${esc(o.ad)}</b><small><span class="kategori-renk" style="background:${renk(o.kategori)}"></span>${esc(o.kategori)} · ${o.oyuncu.min}–${o.oyuncu.max} kişi · ~${Math.round(o.sure.tahminiSn / 6) / 10} dk</small></div></button>`;
        })
        .join("")}</section>
      ${
        acik.length
          ? `<section class="kart"><h2>Açık geri bildirimler <span class="say">${acik.length}</span></h2><div class="gb-liste">${acik
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((g) => gbSatir(g, true))
              .join("")}</div></section>`
          : ""
      }
    </div>`;
}

function oyunSayfasi(): void {
  const o = oyunBul(s.oyun);
  if (!o) return;
  const n = acikSay(o.id);
  const t = o.sure.tahminiSn;
  const sureDk = t ? (t >= 90 ? `${Math.round(t / 6) / 10} dk` : `${t} sn`) : "—";
  $("dosya").innerHTML = `
    <header class="kahraman">
      <div class="kahraman__resim" style="background-image:url('${kartSrc(o.id)}')"></div>
      <div class="kahraman__ic">
        <span class="ust-etiket"><span class="kategori-renk" style="background:${renk(o.kategori)}"></span>${esc(o.kategori)}</span>
        <h1>${esc(o.ad)}</h1>
        <p class="slogan">${esc(o.slogan)}</p>
        <div class="olcular">
          <div class="olcu"><small>Oyuncu</small><b>${o.oyuncu.min}–${o.oyuncu.max}</b></div>
          <div class="olcu"><small>Süre</small><b>${sureDk}</b></div>
          <div class="olcu"><small>Aşama</small><b>${o.akis.length}</b></div>
          <div class="olcu"><small>Ekran</small><b>${ekranlar(o).length}</b></div>
        </div>
        <div class="etiketler">${o.etiketler.map((e) => `<span class="etiket">${esc(e)}</span>`).join("")}</div>
        <nav class="sekmeler" role="tablist">${SEKMELER.map(
          ([k, ad]) =>
            `<button class="sekme" role="tab" type="button" data-sekme="${k}" aria-selected="${s.sekme === k}">${ad}${k === "gb" && n ? ` <span class="rozet">${n}</span>` : ""}</button>`,
        ).join("")}</nav>
      </div>
    </header>
    <div class="icerik">${sekmeIcerik(o)}</div>`;
}

const ADIM_RENK = ["#2ef2ff", "#9a7bff", "#ff4fd8", "#c7ff3d", "#ffc23b", "#5bc0ff", "#ff8a3d", "#7dffb0"];

function puanSinif(v: string): string {
  const t = v.trim();
  if (t.startsWith("+") || /^[1-9]/.test(t)) return "art";
  if (t.startsWith("-") || t.startsWith("−")) return "eks";
  return "not";
}

function sekmeIcerik(o: WikiGame): string {
  switch (s.sekme) {
    case "genel": {
      const toplam = o.akis.reduce((t, a) => t + (a.sureSn ?? 0), 0);
      return `
        <section class="kart"><h2>Özet</h2><p class="ozet">${esc(o.ozet)}</p></section>
        <section class="kart"><h2>Akış <span class="say">${o.akis.length} aşama${toplam ? ` · ~${toplam} sn` : ""}</span></h2>
          ${
            toplam
              ? `<div class="sure-bar" aria-hidden="true">${o.akis
                  .filter((a) => a.sureSn)
                  .map(
                    (a, i) =>
                      `<span title="${esc(a.ad)} · ${a.sureSn} sn" style="flex:${a.sureSn};background:${ADIM_RENK[i % ADIM_RENK.length]}"></span>`,
                  )
                  .join("")}</div>`
              : ""
          }
          <div class="akis">${o.akis
            .map(
              (a, i) =>
                `<div class="adim"><span class="adim__no">${i + 1}</span><div><div class="adim__bas"><b>${esc(a.ad)}</b>${a.sureSn ? `<span class="sure-cip">${a.sureSn} sn</span>` : ""}${a.kim ? `<span class="kim">${esc(a.kim)}</span>` : ""}</div><p>${esc(a.aciklama)}</p>${a.gizli ? `<div class="gizli">🔒 <span>${esc(a.gizli)}</span></div>` : ""}</div></div>`,
            )
            .join("")}</div>
        </section>
        <div class="iki">
          <section class="kart"><h2>Strateji ipuçları</h2><ul class="ipuclari">${o.strateji.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
          <section class="kart"><h2>TV ekranı</h2><p class="tv">${esc(o.tv || "—")}</p><p class="bilgi ust-bosluk">${esc(o.sure.not)}</p></section>
        </div>`;
    }
    case "kurallar":
      return `<section class="kart"><h2>Kurallar <span class="say">${o.kurallar.length} madde</span></h2><ol class="kurallar">${o.kurallar.map((k) => `<li><span>${esc(k)}</span></li>`).join("")}</ol></section>`;
    case "puan": {
      const p = o.puanlama;
      return `
        <section class="kart"><h2>Puan neye göre?</h2><p class="ozet">${esc(p.ozet)}</p></section>
        <section class="kart"><h2>Puan tablosu</h2><div class="kaydir"><table class="puanlar"><thead><tr><th>Puan</th><th>Olay</th><th>Ayrıntı</th></tr></thead><tbody>${p.kalemler
          .map(
            (k) =>
              `<tr><td><span class="puan ${puanSinif(k.puan)}">${esc(k.puan)}</span></td><td><b>${esc(k.olay)}</b></td><td class="ayrinti">${esc(k.not)}</td></tr>`,
          )
          .join("")}</tbody></table></div></section>
        <div class="iki">
          <section class="kart"><h2>Örnek tur</h2><div class="ornek">${esc(p.ornek)}</div></section>
          <section class="kart"><h2>Beraberlik</h2><p class="beraberlik">${esc(p.beraberlik)}</p></section>
        </div>`;
    }
    case "durum":
      return `
        <section class="kart"><h2>Özel durumlar <span class="say">${o.ozelDurumlar.length}</span></h2><div class="izgara">${o.ozelDurumlar.map((d) => `<div class="mini"><b>${esc(d.baslik)}</b><p>${esc(d.aciklama)}</p></div>`).join("")}</div></section>
        <section class="kart"><h2>Maç kartlarıyla etkileşim <span class="say">${o.kartlar.length}</span></h2>${o.kartlar.length ? `<div class="izgara">${o.kartlar.map((k) => `<div class="mini kart-et"><b>${esc(k.kart)}</b><p>${esc(k.etki)}</p></div>`).join("")}</div>` : `<p class="bilgi">Bu oyuna özel bir kart etkileşimi yok.</p>`}</section>`;
    case "ekranlar": {
      const l = ekranlar(o);
      return `<section class="kart"><h2>Oyunun ekranları <span class="say">${l.length}</span></h2>${
        l.length
          ? `<div class="ekran-izgara">${l
              .map((e, i) => {
                const say = s.gb.filter(
                  (g) => g.gameId === o.id && g.screen === e.dosya && g.status !== "cozuldu",
                ).length;
                return `<button class="ekran-k ${e.tv ? "tvk" : ""}" type="button" data-ekran="${i}" aria-current="${s.ekran === i}"><img src="${ekranSrc(e.dosya)}" alt="" loading="lazy"><b>${esc(e.baslik)}${say ? ` <span class="rozet">${say}</span>` : ""}</b><small>${esc(e.aciklama)}</small></button>`;
              })
              .join("")}</div>`
          : `<p class="bilgi">Bu oyun için çekilmiş ekran yok.</p>`
      }<p class="bilgi ust-bosluk">Bir ekrana tıkla, sağda açılır. "✎ İşaretle" ile ekranın üstüne kutu çizip not bırakabilirsin.</p></section>`;
    }
    case "teknik":
      return `
        <section class="kart"><h2>Koddaki sabitler <span class="say">${o.sabitler.length}</span></h2><div class="kaydir"><table class="sabitler"><tbody>${o.sabitler.map((x) => `<tr><td>${esc(x.ad)}</td><td>${esc(x.deger)}</td><td>${esc(x.kaynak)}</td></tr>`).join("")}</tbody></table></div></section>
        <div class="iki">
          <section class="kart"><h2>Bilinen sorunlar ve farklar <span class="say">${o.bilinenSorunlar.length}</span></h2>${o.bilinenSorunlar.length ? `<div class="uyari">${o.bilinenSorunlar.map((x) => `<div>${esc(x)}</div>`).join("")}</div>` : `<p class="bilgi">Bilinen bir sorun yok.</p>`}</section>
          <section class="kart"><h2>Son değişiklikler</h2><ul class="degisiklik">${o.sonDegisiklikler.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
        </div>
        <section class="kart"><h2>Kaynak dosyalar</h2><div class="kaynak">${o.kaynaklar.map(esc).join("<br>")}</div></section>`;
    case "gb": {
      const l = s.gb
        .filter((g) => g.gameId === o.id)
        .sort(
          (a, b) =>
            Number(a.status === "cozuldu") - Number(b.status === "cozuldu") || b.createdAt - a.createdAt,
        );
      return `
        <section class="kart"><h2>Yeni geri bildirim</h2>
          <form class="gb-form" id="gb-form">
            <div class="satir sola"><label for="gb-bolum" class="bilgi">Bölüm</label><select id="gb-bolum">${WIKI_FEEDBACK_SECTIONS.map((b) => `<option>${esc(b)}</option>`).join("")}</select>
            <label class="dug ince tikla" for="gb-gorsel">Görsel ekle</label><input id="gb-gorsel" type="file" accept="image/*" hidden><span class="bilgi" id="gb-gorsel-ad"></span><button type="button" class="dug ince" id="gb-gorsel-kaldir" hidden>Görseli kaldır</button></div>
            <textarea id="gb-metin" maxlength="2000" placeholder="Bu oyunda neyi değiştirelim? Kural, puan, süre, ekran… (Ekrandaki belirli bir yer için sağdaki ✎ İşaretle'yi kullan. Görseli buraya yapıştırabilirsin.)"></textarea>
            <div class="satir"><button class="dug" type="submit">Gönder</button></div>
          </form>
        </section>
        <section class="kart"><h2>Bu oyunun geri bildirimleri <span class="say">${l.length}</span></h2>${l.length ? `<div class="gb-liste">${l.map((g) => gbSatir(g, false)).join("")}</div>` : `<p class="bilgi">${s.gbHazir ? "Henüz geri bildirim yok. Yazdığın her şey burada listelenir." : "Geri bildirimler yükleniyor…"}</p>`}</section>`;
    }
  }
}

function gbSatir(g: WikiFeedback, oyunAdiyla: boolean): string {
  const o = oyunBul(g.gameId);
  const kutu = g.box;
  const kesit =
    g.screen && s.ekranVar.has(g.screen) && kutu
      ? `<button type="button" class="gb__kesit" data-git="${g.id}" title="Ekranda göster" style="background-image:url('${ekranSrc(g.screen)}');background-size:${100 / Math.max(kutu.w, 0.05)}% auto;background-position:${(kutu.x / Math.max(1 - kutu.w, 0.0001)) * 100}% ${(kutu.y / Math.max(1 - kutu.h, 0.0001)) * 100}%"></button>`
      : `<span class="gb__no">${notNo(g)}</span>`;
  const ekranAd = g.screen ? (o?.ekranlar.find((e) => e.dosya === g.screen)?.baslik ?? g.screen) : "";
  return `<article class="gb ${g.status === "cozuldu" ? "cozuldu" : ""}">
    ${kesit}
    <div class="gb__govde">
      <div class="gb__ust"><span class="durum ${g.status}">${DURUM_AD[g.status]}</span>${oyunAdiyla && o ? `<b class="gb__oyun">${esc(o.ad)}</b>` : ""}<span>${esc(g.section)}</span>${ekranAd ? `<span>· ${esc(ekranAd)}</span>` : ""}<span>· ${tarih(g.createdAt)}</span></div>
      <div class="gb__metin">${esc(g.text)}</div>
      ${g.hasImage ? `<a class="gb__ek" href="${gorselSrc(g.id)}" target="_blank" rel="noopener"><img src="${gorselSrc(g.id)}" alt="Eklenen görsel" loading="lazy"></a>` : ""}
      ${g.reply ? `<div class="yanit"><b>Yanıt:</b> ${esc(g.reply)}</div>` : ""}
      <div class="gb__dug">${g.status !== "cozuldu" ? `<button class="dug ince" type="button" data-cozuldu="${g.id}">Çözüldü say</button>` : `<button class="dug ince" type="button" data-ac="${g.id}">Yeniden aç</button>`}<button class="dug tehlike" type="button" data-sil="${g.id}">Sil</button></div>
    </div>
  </article>`;
}

/* ── sağ: görüntüleyici ── */

function goruntuleyici(): void {
  const o = oyunBul(s.oyun);
  const l = o ? ekranlar(o) : [];
  const isaret = $("isaret") as HTMLButtonElement;
  isaret.hidden = !o || !l.length;
  const telefon = $("telefon");
  if (!o || !l.length) {
    $("gor-baslik").textContent = o ? o.ad : "Ekranlar";
    $("gor-alt").textContent = o ? "Bu oyun için ekran yok" : "Bir oyun seç";
    telefon.className = "telefon";
    $("ekran").innerHTML = `<div class="bos">${o ? "Ekran görüntüsü yok" : "Soldan bir oyun seç"}</div>`;
    $("serit").innerHTML = "";
    $("gor-aciklama").innerHTML = "";
    return;
  }
  if (s.ekran >= l.length) s.ekran = 0;
  const e = l[s.ekran] as WikiScreen;
  $("gor-baslik").textContent = e.baslik;
  $("gor-alt").textContent = `${o.ad} · ${s.ekran + 1}/${l.length}`;
  telefon.className = `telefon${e.tv ? " tvc" : ""}`;
  const kutular = s.gb.filter((g) => g.gameId === o.id && g.screen === e.dosya && g.box);
  $("ekran").innerHTML =
    `<img src="${ekranSrc(e.dosya)}" alt="${esc(e.baslik)}"><div class="katman ${s.isaret ? "ciz" : ""}" id="katman">${kutular
      .map((g) => {
        const b = g.box as WikiBox;
        return `<div class="kutu ${g.status === "cozuldu" ? "cozuldu" : ""} ${s.vurgu === g.id ? "vurgu" : ""}" title="${esc(g.text)}" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%"><span class="kutu__no">${notNo(g)}</span></div>`;
      })
      .join("")}</div>`;
  $("serit").innerHTML = l
    .map((x, i) => {
      const say = s.gb.filter(
        (g) => g.gameId === o.id && g.screen === x.dosya && g.status !== "cozuldu",
      ).length;
      return `<button type="button" class="${x.tv ? "tvs" : ""}" data-ekran="${i}" aria-current="${i === s.ekran}" title="${esc(x.baslik)}"><img src="${ekranSrc(x.dosya)}" alt="" loading="lazy">${say ? `<span class="say">${say}</span>` : ""}</button>`;
    })
    .join("");
  $("gor-aciklama").innerHTML =
    `<b>${esc(e.baslik)}.</b> ${esc(e.aciklama)}${s.isaret ? `<br><span class="pembe">İşaretleme açık: ekranda değiştirmek istediğin yerin etrafına kutu çiz.</span>` : ""}`;
  cizimBagla();
}

interface Nokta {
  x: number;
  y: number;
}

function cizimBagla(): void {
  const k = $opt("katman");
  if (!k || !s.isaret) return;
  let bas: Nokta | null = null;
  let yeni: HTMLDivElement | null = null;
  const nokta = (ev: PointerEvent): Nokta => {
    const r = k.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
    };
  };
  k.onpointerdown = (ev) => {
    if (ev.button !== 0) return;
    kapatAcilir();
    bas = nokta(ev);
    yeni = document.createElement("div");
    yeni.className = "kutu yeni";
    k.appendChild(yeni);
    k.setPointerCapture(ev.pointerId);
  };
  k.onpointermove = (ev) => {
    if (!bas || !yeni) return;
    const p = nokta(ev);
    Object.assign(yeni.style, {
      left: `${Math.min(bas.x, p.x) * 100}%`,
      top: `${Math.min(bas.y, p.y) * 100}%`,
      width: `${Math.abs(p.x - bas.x) * 100}%`,
      height: `${Math.abs(p.y - bas.y) * 100}%`,
    });
  };
  k.onpointerup = (ev) => {
    if (!bas || !yeni) return;
    const p = nokta(ev);
    const kutu: WikiBox = {
      x: Math.min(bas.x, p.x),
      y: Math.min(bas.y, p.y),
      w: Math.abs(p.x - bas.x),
      h: Math.abs(p.y - bas.y),
    };
    bas = null;
    if (kutu.w < 0.03 || kutu.h < 0.015) {
      yeni.remove();
      return;
    }
    acilirAc(kutu, yeni, ev);
  };
}

function kapatAcilir(): void {
  for (const x of document.querySelectorAll(".acilir, .kutu.yeni")) x.remove();
}

function acilirAc(kutu: WikiBox, el: HTMLElement, ev: PointerEvent): void {
  const gor = $("gor");
  const r = gor.getBoundingClientRect();
  const a = document.createElement("form");
  a.className = "acilir";
  a.innerHTML = `<b class="acilir__baslik">Bu alan için not</b><textarea maxlength="2000" placeholder="Ne değişsin? Örn: bu yazı çok küçük, buton burada olmasın…"></textarea><div class="satir"><button type="button" class="dug ince" data-iptal="1">İptal</button><button type="submit" class="dug">Kaydet</button></div>`;
  a.style.left = `${Math.max(8, Math.min(r.width - 308, ev.clientX - r.left - 150))}px`;
  a.style.top = `${Math.max(60, Math.min(r.height - 200, ev.clientY - r.top + 12))}px`;
  gor.appendChild(a);
  const metinEl = a.querySelector("textarea") as HTMLTextAreaElement;
  const kaydet = a.querySelector("button[type=submit]") as HTMLButtonElement;
  metinEl.focus();
  (a.querySelector("[data-iptal]") as HTMLButtonElement).onclick = () => {
    a.remove();
    el.remove();
  };
  a.onsubmit = async (e) => {
    e.preventDefault();
    const metin = metinEl.value.trim();
    const o = oyunBul(s.oyun);
    const ek = o ? ekranlar(o)[s.ekran] : undefined;
    if (!metin || !o || !ek) return;
    kaydet.disabled = true;
    try {
      await post("wiki/feedback/add", {
        gameId: o.id,
        section: "Arayüz",
        text: metin,
        screen: ek.dosya,
        box: kutu,
      });
      a.remove();
      el.remove();
      bildir("İşaret kaydedildi");
      await notlariYukle();
    } catch (err) {
      kaydet.disabled = false;
      bildir(err instanceof IstekHatasi ? err.message : "Kaydedilemedi, tekrar dene");
    }
  };
}

/* ── görsel ekleme: tarayıcıda küçültülür (en çok 1600 px, WebP), sınırı aşarsa kalite düşürülür ── */

async function kucult(f: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  const olcek = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * olcek));
  c.height = Math.max(1, Math.round(bmp.height * olcek));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("tuval yok");
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  for (const q of [0.86, 0.72, 0.55, 0.4]) {
    const b = await new Promise<Blob | null>((res) => c.toBlob(res, "image/webp", q));
    if (b && b.type === "image/webp" && b.size <= WIKI_IMAGE_MAX_BYTES) return b;
  }
  const j = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.6));
  if (j && j.size <= WIKI_IMAGE_MAX_BYTES) return j;
  throw new Error("görsel çok büyük");
}

function base64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const v = typeof r.result === "string" ? r.result : "";
      res(v.slice(v.indexOf(",") + 1));
    };
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

function gorselAdi(): void {
  const ad = $opt("gb-gorsel-ad");
  const kaldir = $opt<HTMLButtonElement>("gb-gorsel-kaldir");
  if (ad) ad.textContent = s.gorsel ? `Görsel hazır (${Math.round(s.gorsel.size / 1024)} KB)` : "";
  if (kaldir) kaldir.hidden = !s.gorsel;
}

async function gorselSec(f: File | Blob): Promise<void> {
  if (!f.type.startsWith("image/")) return bildir("Yalnız görsel eklenebilir");
  try {
    s.gorsel = await kucult(f);
  } catch {
    s.gorsel = null;
    bildir("Görsel eklenemedi");
  }
  gorselAdi();
}

/* ── yönlendirme ve olaylar ── */

function ciz(): void {
  liste();
  if (s.oyun) oyunSayfasi();
  else genelBakis();
  goruntuleyici();
}

function git(id: string | null): void {
  s.oyun = id;
  s.ekran = 0;
  s.vurgu = null;
  s.gorsel = null;
  try {
    history.replaceState(null, "", id ? `#${id}` : location.pathname);
  } catch {
    // Geçmiş yazılamazsa adres değişmez; sayfa yine çalışır.
  }
  ciz();
  $("dosya").scrollTop = 0;
}

async function durumYaz(t: HTMLButtonElement, id: number, islem: "cozuldu" | "acik" | "sil"): Promise<void> {
  t.disabled = true;
  try {
    if (islem === "sil") await post("wiki/feedback/delete", { id });
    else await post("wiki/feedback/status", { id, status: islem });
    await notlariYukle();
  } catch (err) {
    bildir(err instanceof IstekHatasi ? err.message : "İşlem yapılamadı");
    t.disabled = false;
  }
}

function olaylar(): void {
  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1) || null;
    if (id !== s.oyun && (!id || oyunBul(id))) {
      s.oyun = id;
      s.ekran = 0;
      ciz();
    }
  });

  document.addEventListener("click", (ev) => {
    if (!(ev.target instanceof Element)) return;
    const t = ev.target.closest<HTMLButtonElement>(
      "[data-oyun],[data-sekme],[data-ekran],[data-kat],[data-git],[data-cozuldu],[data-ac],[data-sil],#logo,#isaret,#gb-gorsel-kaldir",
    );
    if (!t) return;
    const d = t.dataset;
    if (t.id === "logo") return git(null);
    if (t.id === "isaret") {
      s.isaret = !s.isaret;
      t.setAttribute("aria-pressed", String(s.isaret));
      kapatAcilir();
      return goruntuleyici();
    }
    if (t.id === "gb-gorsel-kaldir") {
      s.gorsel = null;
      const inp = $opt<HTMLInputElement>("gb-gorsel");
      if (inp) inp.value = "";
      return gorselAdi();
    }
    if (d.oyun) return git(d.oyun);
    if (d.kat) {
      s.kat = d.kat;
      kategoriler();
      return liste();
    }
    if (d.sekme) {
      const k = SEKMELER.find(([x]) => x === d.sekme)?.[0];
      if (!k) return;
      s.sekme = k;
      try {
        localStorage.setItem(SEKME_ANAHTAR, k);
      } catch {
        // Saklanamazsa sekme yalnız bu açılışta hatırlanır.
      }
      oyunSayfasi();
      return gorselAdi();
    }
    if (d.ekran !== undefined) {
      s.ekran = Number(d.ekran);
      s.vurgu = null;
      goruntuleyici();
      if (s.sekme === "ekranlar") oyunSayfasi();
      return;
    }
    if (d.git) {
      const g = s.gb.find((x) => x.id === Number(d.git));
      if (!g) return;
      if (s.oyun !== g.gameId) git(g.gameId);
      const o = oyunBul(g.gameId);
      const i = o ? ekranlar(o).findIndex((e) => e.dosya === g.screen) : -1;
      if (i >= 0) {
        s.ekran = i;
        s.vurgu = g.id;
        goruntuleyici();
      }
      return;
    }
    if (d.cozuldu) return void durumYaz(t, Number(d.cozuldu), "cozuldu");
    if (d.ac) return void durumYaz(t, Number(d.ac), "acik");
    if (d.sil) {
      if (d.onay) return void durumYaz(t, Number(d.sil), "sil");
      d.onay = "1";
      t.textContent = "Emin misin? Sil";
    }
  });

  $("ara").addEventListener("input", (e) => {
    s.ara = (e.target as HTMLInputElement).value;
    liste();
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.id === "gb-gorsel") {
      const f = t.files?.[0];
      if (f) void gorselSec(f);
    }
  });

  document.addEventListener("paste", (e) => {
    if (!(e.target instanceof HTMLTextAreaElement) || e.target.id !== "gb-metin") return;
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
    const f = item?.getAsFile();
    if (!f) return;
    e.preventDefault();
    void gorselSec(f);
  });

  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "gb-form") return;
    e.preventDefault();
    const metinEl = $opt<HTMLTextAreaElement>("gb-metin");
    const bolum = $opt<HTMLSelectElement>("gb-bolum")?.value;
    const metin = metinEl?.value.trim() ?? "";
    if (!metin || !s.oyun || !metinEl) return;
    const btn = form.querySelector("button[type=submit]") as HTMLButtonElement;
    btn.disabled = true;
    try {
      const gorsel = s.gorsel ? { type: s.gorsel.type, data: await base64(s.gorsel) } : null;
      await post("wiki/feedback/add", { gameId: s.oyun, section: bolum, text: metin, image: gorsel });
      metinEl.value = "";
      s.gorsel = null;
      bildir("Geri bildirim kaydedildi");
      await notlariYukle();
    } catch (err) {
      bildir(err instanceof IstekHatasi ? err.message : "Kaydedilemedi, tekrar dene");
    } finally {
      const b = $opt("gb-form")?.querySelector<HTMLButtonElement>("button[type=submit]");
      if (b) b.disabled = false;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof Element && e.target.matches("input,textarea,select")) return;
    if (e.key === "Escape") return kapatAcilir();
    const o = oyunBul(s.oyun);
    if (!o) return;
    const l = ekranlar(o);
    if (!l.length) return;
    if (e.key === "ArrowRight") s.ekran = (s.ekran + 1) % l.length;
    else if (e.key === "ArrowLeft") s.ekran = (s.ekran - 1 + l.length) % l.length;
    else return;
    s.vurgu = null;
    goruntuleyici();
  });

  // Başka sekmede/cihazda bırakılan notlar sayfaya dönünce gelir.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void notlariYukle();
  });
}

/* ── giriş kapısı ve başlatma ── */

function kapi(baslik: string, metin: string, link: { href: string; ad: string } | null): void {
  document.body.innerHTML = `<main class="kapi"><b class="kapi__logo">GLIX</b><h1>${esc(baslik)}</h1><p>${esc(metin)}</p>${link ? `<a class="dug" href="${esc(link.href)}">${esc(link.ad)}</a>` : ""}</main>`;
}

async function baslat(): Promise<void> {
  let durum: { status: number; body: unknown };
  try {
    durum = await getJson("status");
  } catch {
    return kapi("Bağlantı kurulamadı", "İnternet bağlantını kontrol edip sayfayı yenile.", null);
  }
  if (durum.status === 401)
    return kapi("Önce giriş yap", "Ansiklopedi yalnız yönetici hesabıyla açılır.", {
      href: "/",
      ad: "Oyuna git",
    });
  const st = durum.status === 200 ? parseState(durum.body) : null;
  if (!st) return kapi("Bu sayfa yok", "Aradığın sayfa bulunamadı.", { href: "/", ad: "Ana sayfa" });
  if (st === "need_otp")
    return kapi(
      "Yönetici kodu gerekli",
      "Yönetim panelinde e-posta kodunu onayla, sonra bu sayfayı yenile.",
      {
        href: "/admin",
        ad: "Yönetim paneline git",
      },
    );
  let veri: ReturnType<typeof parseData> = null;
  try {
    const r = await getJson("wiki/data");
    veri = r.status === 200 ? parseData(r.body) : null;
  } catch {
    veri = null;
  }
  if (!veri) return kapi("Ansiklopedi açılamadı", "Biraz sonra sayfayı yenile.", null);
  s.oyunlar = veri.games;
  s.ekranVar = new Set(veri.screens);
  try {
    const k = localStorage.getItem(SEKME_ANAHTAR);
    const bulunan = SEKMELER.find(([x]) => x === k)?.[0];
    if (bulunan) s.sekme = bulunan;
  } catch {
    // Saklanan sekme okunamazsa Genel bakış açılır.
  }
  const ilk = location.hash.slice(1);
  if (ilk && oyunBul(ilk)) s.oyun = ilk;
  $("uyg").hidden = false;
  $("yukleniyor").remove();
  olaylar();
  kategoriler();
  ciz();
  await notlariYukle();
}

void baslat();
