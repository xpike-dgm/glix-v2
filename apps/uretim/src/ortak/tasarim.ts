/**
 * Oyun Tasarımı alanı (13. alan): yapılandırılmış fikir kartları (sözleşme bölüm 15). Fikir teslimindeki her öğe
 * (ad, ozet, kategori, etki, zahmet, gerekce) ek olarak bir `tasarim` nesnesi taşır:
 * - **yeni-oyun**: yeni mini oyun;
 * - **sistem**: oyunlar arası ya da maçı/birkaç oyunu değiştiren mekanik (kartlar gibi, maç değiştiricileri, olaylar,
 *   kombo/seri ödülü, takım modu, izleyici rolü…);
 * - **oyuna-ek**: var olan tek bir oyunu daha eğlenceli yapan ek ("Bu oyuna şu eklense").
 * Sunucu ve arayüz ortak kullanır; Node'a bağımlı değildir.
 */

export const TASARIM_TURLERI = ["yeni-oyun", "sistem", "oyuna-ek"] as const;
export type TasarimTuru = (typeof TASARIM_TURLERI)[number];
export const TASARIM_TURU_ADI: Record<TasarimTuru, string> = {
  "yeni-oyun": "Yeni oyun",
  sistem: "Sistem / mekanik",
  "oyuna-ek": "Mevcut oyuna ek",
};

export const OYUN_TURLERI = [
  "tepki",
  "blof",
  "cizim",
  "yazi",
  "strateji",
  "bilgi",
  "hafiza",
  "sans",
  "ortak",
  "parti",
] as const;
export type OyunTuru = (typeof OYUN_TURLERI)[number];
export const OYUN_TURU_ADI: Record<OyunTuru, string> = {
  tepki: "Tepki",
  blof: "Blöf",
  cizim: "Çizim",
  yazi: "Yazı",
  strateji: "Strateji",
  bilgi: "Bilgi",
  hafiza: "Hafıza",
  sans: "Şans",
  ortak: "Ortak (iş birliği)",
  parti: "Parti",
};

export const KAPSAMLAR = ["tum", "bazi", "tek"] as const;
export type Kapsam = (typeof KAPSAMLAR)[number];
export const KAPSAM_ADI: Record<Kapsam, string> = {
  tum: "Tüm oyunlar",
  bazi: "Bazı oyunlar",
  tek: "Tek oyun",
};

export interface YeniOyunFikri {
  tur: "yeni-oyun";
  oyuncu: { enAz: number; enCok: number };
  /** Bir oynanışın tahmini süresi (dakika). */
  sureDk: number;
  oyunTuru: OyunTuru[];
  /** Kurallar, adım adım. */
  kurallar: string[];
  /** Eğlencenin kaynağı: masada hangi an, hangi duygu. */
  eglence: string;
  /** Telefonda nasıl görünür: ekranlar, sırayla. */
  ekranlar: string[];
  /** TV / izleyici görünümü. */
  tv: string;
  puanlama: string;
  /** Riskler ve kötüye kullanım (hile, kırıcı metin, tek kişinin oyunu bozması…). */
  riskler: string;
  /** Benzer GLIX oyunlarından farkı (oyun kimlikleri ve fark). */
  fark: string;
  benzerOyunlar: string[];
}

export interface SistemFikri {
  tur: "sistem" | "oyuna-ek";
  kapsam: { tur: Kapsam; oyunlar: string[] };
  /** Nasıl çalışır, adım adım. */
  nasil: string[];
  /** Örnek bir maç anı. */
  ornekAn: string;
  /** Eğlenceye etkisi. */
  eglence: string;
  /** Mevcut sistemlerle etkileşim: kartlar, puan, Glix, rozet. */
  etkilesim: string;
  denge: string;
  /** Uygulama zahmeti (kod tarafında ne değişir). */
  uygulama: string;
}

export type TasarimFikri = YeniOyunFikri | SistemFikri;

const temiz = (v: unknown, enAz: number, enCok: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[^\S\n]+/g, " ").trim();
  if (/(?![\n])\p{Cc}/u.test(t)) return null;
  const n = [...t].length;
  return n >= enAz && n <= enCok ? t : null;
};

const kayit = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Kısa metin listesi (adımlar, ekranlar). */
function maddeler(v: unknown, enAz: number, enCok: number, uzunluk: number): string[] | null {
  if (!Array.isArray(v) || v.length < enAz || v.length > enCok) return null;
  const out = v.map((x) => temiz(x, 2, uzunluk));
  return out.every((x): x is string => x !== null) ? out : null;
}

const OYUN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `tasarim` nesnesini doğrular; hatalar `yer` önekiyle. `oyunVar` oyun kimliği denetimi (motorun kaydı); verilmezse
 * yalnız biçim denetlenir.
 */
export function tasarimDogrula(
  v: unknown,
  yer: string,
  hatalar: string[],
  oyunVar: (id: string) => boolean = () => true,
): TasarimFikri | null {
  const once = hatalar.length;
  const h = (m: string): void => {
    hatalar.push(`${yer}: tasarim.${m}`);
  };
  if (!kayit(v)) {
    hatalar.push(`${yer}: "tasarim" nesne olmalı ({ tur: "yeni-oyun" | "sistem" | "oyuna-ek", … }).`);
    return null;
  }
  const tur = (TASARIM_TURLERI as readonly unknown[]).includes(v.tur) ? (v.tur as TasarimTuru) : null;
  if (!tur) {
    h(`tur "yeni-oyun", "sistem" ya da "oyuna-ek" olmalı.`);
    return null;
  }
  const izinli =
    tur === "yeni-oyun"
      ? [
          "tur",
          "oyuncu",
          "sureDk",
          "oyunTuru",
          "kurallar",
          "eglence",
          "ekranlar",
          "tv",
          "puanlama",
          "riskler",
          "fark",
          "benzerOyunlar",
        ]
      : ["tur", "kapsam", "nasil", "ornekAn", "eglence", "etkilesim", "denge", "uygulama"];
  for (const k of Object.keys(v))
    if (!izinli.includes(k)) h(`bilinmeyen alan "${k.slice(0, 30)}" (${TASARIM_TURU_ADI[tur]}).`);
  const yazi = (k: string, enCok: number, enAz = 10): string => {
    const t = temiz(v[k], enAz, enCok);
    if (t === null) h(`${k} ${enAz}–${enCok} karakter olmalı.`);
    return t ?? "";
  };
  if (tur === "yeni-oyun") {
    const o = kayit(v.oyuncu) ? v.oyuncu : {};
    const enAz = typeof o.enAz === "number" && Number.isInteger(o.enAz) ? o.enAz : 0;
    const enCok = typeof o.enCok === "number" && Number.isInteger(o.enCok) ? o.enCok : 0;
    if (enAz < 2 || enCok > 8 || enAz > enCok) h("oyuncu { enAz, enCok } 2–8 arası olmalı (enAz ≤ enCok).");
    const sureDk = typeof v.sureDk === "number" && Number.isFinite(v.sureDk) ? v.sureDk : 0;
    if (sureDk < 0.5 || sureDk > 15) h("sureDk 0,5–15 dakika olmalı (mini oyun).");
    const oyunTuru = Array.isArray(v.oyunTuru)
      ? v.oyunTuru.filter((x): x is OyunTuru => (OYUN_TURLERI as readonly unknown[]).includes(x))
      : [];
    if (
      !Array.isArray(v.oyunTuru) ||
      !oyunTuru.length ||
      oyunTuru.length !== v.oyunTuru.length ||
      oyunTuru.length > 3
    )
      h(`oyunTuru 1–3 tür: ${OYUN_TURLERI.join(", ")}.`);
    const kurallar = maddeler(v.kurallar, 3, 15, 300);
    if (!kurallar) h("kurallar 3–15 adım (her biri en çok 300 karakter) olmalı.");
    const ekranlar = maddeler(v.ekranlar, 1, 10, 300);
    if (!ekranlar) h("ekranlar 1–10 ekran tarifi (telefonda sırayla ne görünür) olmalı.");
    const benzer = v.benzerOyunlar === undefined ? [] : v.benzerOyunlar;
    const benzerOyunlar = Array.isArray(benzer)
      ? benzer.filter((x): x is string => typeof x === "string")
      : [];
    if (!Array.isArray(benzer) || benzerOyunlar.length !== benzer.length || benzerOyunlar.length > 5)
      h("benzerOyunlar en çok 5 oyun kimliği olmalı.");
    for (const id of benzerOyunlar)
      if (!OYUN_ID.test(id) || !oyunVar(id)) h(`benzerOyunlar: "${id.slice(0, 40)}" GLIX'te yok.`);
    const r: YeniOyunFikri = {
      tur,
      oyuncu: { enAz, enCok },
      sureDk,
      oyunTuru,
      kurallar: kurallar ?? [],
      eglence: yazi("eglence", 800),
      ekranlar: ekranlar ?? [],
      tv: yazi("tv", 600),
      puanlama: yazi("puanlama", 800),
      riskler: yazi("riskler", 800),
      fark: yazi("fark", 800),
      benzerOyunlar,
    };
    return hatalar.length === once ? r : null;
  }
  const k = kayit(v.kapsam) ? v.kapsam : {};
  const kapsamTur = (KAPSAMLAR as readonly unknown[]).includes(k.tur) ? (k.tur as Kapsam) : null;
  const oyunlar = Array.isArray(k.oyunlar) ? k.oyunlar.filter((x): x is string => typeof x === "string") : [];
  if (!kapsamTur) h(`kapsam.tur "tum", "bazi" ya da "tek" olmalı.`);
  else if (kapsamTur === "tum" && oyunlar.length) h("kapsam: tüm oyunlarda oyun listesi yazılmaz.");
  else if (kapsamTur === "bazi" && (oyunlar.length < 2 || oyunlar.length > 30))
    h("kapsam: bazı oyunlarda 2+ oyun kimliği.");
  else if (kapsamTur === "tek" && oyunlar.length !== 1) h("kapsam: tek oyunda tam bir oyun kimliği.");
  if (tur === "oyuna-ek" && kapsamTur !== "tek")
    h('oyuna-ek fikri kapsam { tur: "tek", oyunlar: [oyun] } olmalı.');
  for (const id of oyunlar)
    if (!OYUN_ID.test(id) || !oyunVar(id)) h(`kapsam: "${id.slice(0, 40)}" GLIX'te yok.`);
  const nasil = maddeler(v.nasil, 2, 12, 300);
  if (!nasil) h("nasil 2–12 adım (her biri en çok 300 karakter) olmalı.");
  const r: SistemFikri = {
    tur,
    kapsam: { tur: kapsamTur ?? "tum", oyunlar },
    nasil: nasil ?? [],
    ornekAn: yazi("ornekAn", 800),
    eglence: yazi("eglence", 800),
    etkilesim: yazi("etkilesim", 800),
    denge: yazi("denge", 800),
    uygulama: yazi("uygulama", 800),
  };
  return hatalar.length === once ? r : null;
}

/** Kartın arama/karşılaştırma metni (sürüm farkı için satır satır). */
export function tasarimSatirlari(t: TasarimFikri): { ad: string; deger: string }[] {
  if (t.tur === "yeni-oyun")
    return [
      { ad: "Oyuncu", deger: `${t.oyuncu.enAz}–${t.oyuncu.enCok}` },
      { ad: "Süre", deger: `${t.sureDk} dk` },
      { ad: "Tür", deger: t.oyunTuru.map((x) => OYUN_TURU_ADI[x]).join(", ") },
      { ad: "Kurallar", deger: t.kurallar.map((x, i) => `${i + 1}. ${x}`).join("\n") },
      { ad: "Eğlencenin kaynağı", deger: t.eglence },
      { ad: "Telefonda", deger: t.ekranlar.map((x, i) => `${i + 1}. ${x}`).join("\n") },
      { ad: "TV / izleyici", deger: t.tv },
      { ad: "Puanlama", deger: t.puanlama },
      { ad: "Riskler", deger: t.riskler },
      {
        ad: "Benzer oyunlardan farkı",
        deger: `${t.fark}${t.benzerOyunlar.length ? ` (${t.benzerOyunlar.join(", ")})` : ""}`,
      },
    ];
  return [
    {
      ad: "Kapsam",
      deger: `${KAPSAM_ADI[t.kapsam.tur]}${t.kapsam.oyunlar.length ? `: ${t.kapsam.oyunlar.join(", ")}` : ""}`,
    },
    { ad: "Nasıl çalışır", deger: t.nasil.map((x, i) => `${i + 1}. ${x}`).join("\n") },
    { ad: "Örnek maç anı", deger: t.ornekAn },
    { ad: "Eğlenceye etkisi", deger: t.eglence },
    { ad: "Mevcut sistemlerle", deger: t.etkilesim },
    { ad: "Denge riskleri", deger: t.denge },
    { ad: "Uygulama zahmeti", deger: t.uygulama },
  ];
}

/** Kopyalanan istemde sabit satır (Oyun Tasarımı). */
export const TASARIM_ISTEM_SATIRI =
  'Önce oyun_katalogu_oku ile oyunları, kart sistemini ve mevcut fikirleri oku (tekrar etme). Her kart tur "fikir" ve tasarim nesnesi (yeni-oyun, sistem ya da oyuna-ek) taşır; dosya yok. Geliştir işinde yeni sürümü oncekiOge ile, eleştiri işinde sonucu elestiri_yaz ile ver.';

/** Talimatın sonundaki sabit bölüm (yalnız Oyun Tasarımı; kodla eklenir, düzenleme çıkaramaz). */
export const TASARIM_BOLUMU = `## Oyun tasarımı kartı (zorunlu biçim)
- Her teslim \`tur: "fikir"\`; dosya yok, yalnız metin. Her öğe: \`ad\`, \`ozet\` (tek cümle), \`kategori\`, \`etki\`,
  \`zahmet\`, \`gerekce\` ve **\`tasarim\`** nesnesi.
- **Yeni oyun** (\`tasarim.tur: "yeni-oyun"\`): \`oyuncu { enAz, enCok }\` (2–8), \`sureDk\`, \`oyunTuru\` (tepki, blof,
  cizim, yazi, strateji, bilgi, hafiza, sans, ortak, parti; en çok 3), \`kurallar\` (adım adım), \`eglence\` (eğlencenin
  kaynağı), \`ekranlar\` (telefonda sırayla ne görünür), \`tv\` (TV/izleyici), \`puanlama\`, \`riskler\` (kötüye kullanım
  dahil), \`fark\` ve \`benzerOyunlar\` (benzer GLIX oyunlarının kimlikleri).
- **Sistem / mekanik** (\`"sistem"\`; kartlar gibi oyunlar arası, maç değiştirici, olay, seri ödülü, takım modu,
  izleyici rolü…) ve **mevcut oyuna ek** (\`"oyuna-ek"\`): \`kapsam { tur: "tum" | "bazi" | "tek", oyunlar }\`, \`nasil\`
  (adım adım), \`ornekAn\` (örnek bir maç anı), \`eglence\`, \`etkilesim\` (kartlar, puan, Glix, rozetle), \`denge\`
  (denge riskleri), \`uygulama\` (uygulama zahmeti).
- Önce \`oyun_katalogu_oku\` ile oyunları, kuralları, kart sistemini ve **mevcut fikirleri** oku; var olanı tekrar etme.
  Bir oyunun ayrıntısı: \`oyun_katalogu_oku { oyun: "<kimlik>" }\`.
- **Geliştir işi**: sahip bir kartına not yazıp "Geliştir" der; iş sana önceki sürümle ve notla gelir. Yeni sürümü
  \`oncekiOge: <kart kimliği>\` ile teslim et (aynı kartta yeni sürüm olur).
- **Eleştiri işi**: başka bir yapay zekânın kartını eleştirmen istenir; \`elestiri_yaz { isId, metin, guclu, zayif,
  oneriler }\` ile yaz (SSH: \`uretim elestiri-yaz < json\`). Eleştiri kartın altına not olarak düşer.
`;
