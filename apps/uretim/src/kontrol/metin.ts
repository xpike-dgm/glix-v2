/**
 * Metin ve havuz kontrolleri (UM-K4). Havuz kuralları oyunun kendi kodundan (`@glix/engine` `CONTENT_POOLS`,
 * `fromFields`, `key`) birebir uygulanır; yasaklı kelime eşleştirmesi oyunun `matchesBanned` ve `moderateText`
 * işlevleriyle yapılır. Üstüne: havuzdaki ve aynı teslimdeki tekrarlar, çok benzer satırlar, çift ve tanım kuralları.
 */
import { CONTENT_POOLS, cleanBannedWord, dedupeKey, matchesBanned, moderateText } from "@glix/engine";
import { kayit } from "../http.js";
import type { CanliHavuz, Kalip } from "../oyun.js";
import { type KontrolBaglami, type Satir, satir } from "./baglam.js";

export interface HavuzSatiri {
  havuz: string;
  alanlar: Record<string, string>;
  zorluk?: "kolay" | "orta" | "zor";
  tema?: string;
}

export interface KapatmaSatiri {
  havuz: string;
  anahtar: string;
  neden: string;
}

export interface KalipSatiri {
  kalip: string;
  tur: "kufur" | "hakaret" | "cinsel" | "nefret";
  risk: "dusuk" | "orta" | "yuksek";
}

const ZORLUK = ["kolay", "orta", "zor"] as const;
const KALIP_TURU = ["kufur", "hakaret", "cinsel", "nefret"] as const;
const RISK = ["dusuk", "orta", "yuksek"] as const;

export function havuzSatiriAyristir(v: unknown): HavuzSatiri | null {
  if (!kayit(v) || typeof v.havuz !== "string" || !kayit(v.alanlar)) return null;
  const alanlar: Record<string, string> = {};
  for (const [k, x] of Object.entries(v.alanlar)) {
    if (typeof x !== "string" || x.length > 400 || !/^[a-zA-Z]{1,20}$/.test(k)) return null;
    alanlar[k] = x;
  }
  const out: HavuzSatiri = { havuz: v.havuz, alanlar };
  if (v.zorluk !== undefined) {
    if (!(ZORLUK as readonly unknown[]).includes(v.zorluk)) return null;
    out.zorluk = v.zorluk as HavuzSatiri["zorluk"] & string;
  }
  if (v.tema !== undefined) {
    if (typeof v.tema !== "string" || v.tema.length > 30) return null;
    out.tema = v.tema;
  }
  return out;
}

export function kapatmaSatiriAyristir(v: unknown): KapatmaSatiri | null {
  if (!kayit(v) || typeof v.havuz !== "string" || typeof v.anahtar !== "string" || v.anahtar.length > 400)
    return null;
  return {
    havuz: v.havuz,
    anahtar: v.anahtar,
    neden: typeof v.neden === "string" ? v.neden.slice(0, 200) : "",
  };
}

export function kalipSatiriAyristir(v: unknown): KalipSatiri | null {
  if (!kayit(v) || typeof v.kalip !== "string") return null;
  if (!(KALIP_TURU as readonly unknown[]).includes(v.tur)) return null;
  const risk = v.risk === undefined ? "orta" : v.risk;
  if (!(RISK as readonly unknown[]).includes(risk)) return null;
  return { kalip: v.kalip, tur: v.tur as KalipSatiri["tur"], risk: risk as KalipSatiri["risk"] };
}

/** Üçlü harf kümesi (benzerlik için). */
function ucluler(t: string): Set<string> {
  const s = ` ${t} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

export function benzerlik(a: string, b: string): number {
  const x = ucluler(a);
  const y = ucluler(b);
  let ortak = 0;
  for (const g of x) if (y.has(g)) ortak++;
  return ortak / (x.size + y.size - ortak || 1);
}

export const BENZERLIK_ESIGI = 0.75;

/** Çift havuzlar: iki kelime alanı (ör. Sızma `a`/`b`, Karalama `main`/`near`). */
function ciftAlanlari(
  fields: readonly { key: string; long?: boolean; max: number }[],
): [string, string] | null {
  if (fields.length !== 2) return null;
  const [a, b] = fields;
  if (!a || !b || a.long || b.long || a.max > 16 || b.max > 16) return null;
  return [a.key, b.key];
}

/** Yasaklı listedeki kalıpların eşleştirme biçimi. */
export function katlanmisKaliplar(kaliplar: readonly Kalip[]): string[] {
  return kaliplar.flatMap((k) => {
    const c = cleanBannedWord(k.kalip);
    return c ? [c.folded] : [];
  });
}

export function havuzKontrolleri(
  satirlar: readonly unknown[],
  canli: readonly CanliHavuz[],
  kaliplar: readonly string[],
  kaynak: "canli" | "yerlesik",
): Satir[] {
  const s: Satir[] = [];
  if (kaynak === "yerlesik")
    s.push(
      satir(
        "metin",
        "havuz-kaynagi",
        "uyari",
        "Oyuna ulaşılamadı; tekrar denetimi yalnız yerleşik havuzla yapıldı.",
      ),
    );
  const goruldu = new Map<string, number>();
  const metinler: { satir: number; havuz: string; t: string }[] = [];
  satirlar.forEach((ham, i) => {
    const e = { satir: i };
    const r = havuzSatiriAyristir(ham);
    if (!r) {
      s.push(satir("metin", "bicim", "kaldi", "Satır { havuz, alanlar } biçiminde olmalı.", e));
      return;
    }
    const pool = CONTENT_POOLS.find((p) => p.id === r.havuz);
    if (!pool) {
      s.push(satir("metin", "havuz", "kaldi", `"${r.havuz.slice(0, 40)}" diye bir havuz yok.`, e));
      return;
    }
    const fazla = Object.keys(r.alanlar).filter((k) => !pool.fields.some((f) => f.key === k));
    if (fazla.length) s.push(satir("metin", "bicim", "kaldi", `Bilinmeyen alan: ${fazla.join(", ")}.`, e));
    const p = pool.fromFields(r.alanlar);
    if (!p.ok) {
      s.push(satir("metin", "havuz-kurali", "kaldi", p.error, e));
      return;
    }
    const temiz = pool.toFields(p.entry);
    const anahtar = `${pool.id}#${pool.key(p.entry)}`;
    const once = goruldu.get(anahtar);
    if (once !== undefined)
      s.push(satir("metin", "tekrar", "kaldi", `Aynı teslimde ${once + 1}. satırla aynı.`, e));
    goruldu.set(anahtar, i);
    const havuz = canli.find((h) => h.id === pool.id);
    const mevcut = havuz?.kayitlar.find((k) => k.anahtar === pool.key(p.entry));
    if (mevcut)
      s.push(
        satir(
          "metin",
          "tekrar",
          "kaldi",
          mevcut.acik ? "Bu kayıt havuzda zaten var." : "Bu kayıt havuzda kapalı olarak var.",
          e,
        ),
      );
    // Çift kuralı.
    const cift = ciftAlanlari(pool.fields);
    if (cift) {
      const a = dedupeKey(temiz[cift[0]] ?? "");
      const b = dedupeKey(temiz[cift[1]] ?? "");
      if (a === b) s.push(satir("metin", "cift", "kaldi", "Çiftteki iki kelime aynı olamaz.", e));
      else if (a.includes(b) || b.includes(a))
        s.push(satir("metin", "cift", "kaldi", "Çiftte bir kelime diğerinin içinde geçiyor.", e));
    }
    // Tanım kuralı.
    if (temiz.word !== undefined && temiz.definition !== undefined) {
      const w = dedupeKey(temiz.word);
      const kok = w.length > 5 ? w.slice(0, Math.max(4, w.length - 2)) : w;
      if (
        dedupeKey(temiz.definition)
          .split(" ")
          .some((t) => t.startsWith(kok))
      )
        s.push(satir("metin", "tanim", "kaldi", "Tanımda kelimenin kendisi geçiyor.", e));
    }
    const tum = Object.values(temiz).join(" ");
    if (matchesBanned(tum, kaliplar) || !moderateText(tum).ok)
      s.push(satir("metin", "yasakli", "kaldi", "Yasaklı kelime içeriyor.", e));
    const t = dedupeKey(tum);
    metinler.push({ satir: i, havuz: pool.id, t });
    if (havuz && !mevcut) {
      const benzer = havuz.kayitlar.find(
        (k) => benzerlik(t, dedupeKey(Object.values(k.alanlar).join(" "))) >= BENZERLIK_ESIGI,
      );
      if (benzer)
        s.push(
          satir(
            "metin",
            "benzer",
            "uyari",
            `Havuzdaki bir kayda çok benziyor: "${Object.values(benzer.alanlar).join(" / ").slice(0, 60)}".`,
            e,
          ),
        );
    }
  });
  for (let i = 0; i < metinler.length; i++)
    for (let j = 0; j < i; j++) {
      const a = metinler[i];
      const b = metinler[j];
      if (!a || !b || a.havuz !== b.havuz || a.t === b.t) continue;
      if (benzerlik(a.t, b.t) >= BENZERLIK_ESIGI) {
        s.push(satir("metin", "benzer", "uyari", `${b.satir + 1}. satıra çok benziyor.`, { satir: a.satir }));
        break;
      }
    }
  if (!s.some((x) => x.sonuc === "kaldi"))
    s.push(satir("metin", "havuz-kurali", "gecti", `${satirlar.length} satır havuz kurallarına uyuyor.`));
  return s;
}

export function kapatmaKontrolleri(satirlar: readonly unknown[], canli: readonly CanliHavuz[]): Satir[] {
  const s: Satir[] = [];
  satirlar.forEach((ham, i) => {
    const r = kapatmaSatiriAyristir(ham);
    if (!r) {
      s.push(
        satir("metin", "bicim", "kaldi", "Kapatma satırı { havuz, anahtar, neden } olmalı.", { satir: i }),
      );
      return;
    }
    const h = canli.find((x) => x.id === r.havuz);
    const k = h?.kayitlar.find((x) => x.anahtar === r.anahtar);
    if (!h) s.push(satir("metin", "havuz", "kaldi", "Havuz bulunamadı.", { satir: i }));
    else if (!k) s.push(satir("metin", "kayit", "kaldi", "Kapatılacak kayıt havuzda yok.", { satir: i }));
    else if (!k.acik) s.push(satir("metin", "kayit", "uyari", "Kayıt zaten kapalı.", { satir: i }));
  });
  return s;
}

/** Yanlış alarm denetimi için sık kullanılan Türkçe kelimeler (yakalanmamalı). */
export const ORNEK_METIN: readonly string[] = (
  "ama ancak araba akşam anne baba bakmak balık bardak belki ben bilgisayar bir biraz bugün çay çalışmak çocuk çok " +
  "daha defter deniz derin dükkan elma ev evet gece gelmek gitmek göl götürmek göz güneş haftasonu hasta hayır hızlı " +
  "ılık için iş kalem kapı kar kasa kaş kedi kitap kız köpek kum masa mavi memnun merhaba mutfak nasıl okul oda otobüs " +
  "pencere peynir sabah sandalye sıkıntı sıcak sokak su şeker şimdi tamam tatil telefon toplantı uçak uzun yağmur yarın " +
  "yeşil yol yumurta zaman sıkmak amaç amca kamp kumsal sikke sikloid analiz amatör ambalaj ambar memleket pikap"
).split(" ");

export function kalipKontrolleri(satirlar: readonly unknown[], mevcut: readonly Kalip[]): Satir[] {
  const s: Satir[] = [];
  const mevcutK = new Set(katlanmisKaliplar(mevcut));
  const gor = new Set<string>();
  satirlar.forEach((ham, i) => {
    const e = { satir: i };
    const r = kalipSatiriAyristir(ham);
    if (!r) {
      s.push(
        satir(
          "metin",
          "bicim",
          "kaldi",
          "Satır { kalip, tur, risk } olmalı; tür: küfür, hakaret, cinsel, nefret.",
          e,
        ),
      );
      return;
    }
    const c = cleanBannedWord(r.kalip);
    if (!c) {
      s.push(satir("metin", "kalip", "kaldi", "Kalıp geçersiz (1–40 karakter, en az 2 harf).", e));
      return;
    }
    if (mevcutK.has(c.folded)) s.push(satir("metin", "tekrar", "kaldi", "Bu kalıp listede zaten var.", e));
    if (gor.has(c.folded)) s.push(satir("metin", "tekrar", "kaldi", "Aynı teslimde tekrar ediyor.", e));
    gor.add(c.folded);
    const yanlis = ORNEK_METIN.filter((w) => matchesBanned(w, [c.folded]));
    if (yanlis.length)
      s.push(
        satir(
          "metin",
          "yanlis-alarm",
          "uyari",
          `Sık kelimeleri de yakalıyor: ${yanlis.slice(0, 5).join(", ")}.`,
          e,
        ),
      );
    else if (r.risk === "yuksek")
      s.push(satir("metin", "yanlis-alarm", "uyari", "Yanlış alarm riski yüksek bildirildi.", e));
  });
  if (!s.some((x) => x.sonuc === "kaldi"))
    s.push(satir("metin", "kalip", "gecti", `${satirlar.length} kalıp biçime uyuyor.`));
  return s;
}

export async function metinKontrolleri(b: KontrolBaglami): Promise<Satir[]> {
  const { alan, oge, tur } = b;
  if (alan.id === "icerik" && oge.satirlar.length) {
    const h = await b.katalog.havuzlar(b.now);
    if (tur === "kaldirma-onerisi") return kapatmaKontrolleri(oge.satirlar, h.havuzlar);
    let kaliplar: Kalip[] = [];
    try {
      kaliplar = await b.katalog.moderasyonListesi();
    } catch {
      kaliplar = [];
    }
    return havuzKontrolleri(oge.satirlar, h.havuzlar, katlanmisKaliplar(kaliplar), h.kaynak);
  }
  if (alan.id === "moderasyon" && oge.satirlar.length) {
    let mevcut: Kalip[] = [];
    try {
      mevcut = await b.katalog.moderasyonListesi();
    } catch {
      mevcut = [];
    }
    return kalipKontrolleri(oge.satirlar, mevcut);
  }
  return [];
}
