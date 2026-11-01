/**
 * Bot koşusu sonucu → rapor panosu biçimi (`rapor{ozet, seriler, tablolar, bulgular}`, sözleşme bölüm 12 ve 14).
 * Oyun sunucusunun ham ölçümü (`apps/server/src/botKosusu.ts` `KosuSonucu`) burada ağdan gelen veri olarak doğrulanır;
 * bulgular kendiliğinden çıkar: takılan maç, çöken oyun, eşik aşımı (tick, bellek, eylem süresi), reddedilen eylem,
 * ayırt etmeyen skor dağılımı, süre sınırı.
 */
import type { RaporBulgu, RaporSeri, RaporTablo, YapiliRapor } from "./ortak/rapor.js";

/** Eşikler (sunucunun tick aralığı 100 ms; test2 kabı 512 MB). */
export const KOSU_ESIKLERI = { tickP95Ms: 50, bellekMb: 420, eylemP95Ms: 30, redOrani: 0.25 } as const;

export interface KosuMaci {
  oyun: string;
  oyuncu: number;
  durum: string;
  sureMs: number | null;
  skorlar: number[];
  takildigiAsama?: string;
  hata?: string;
  oda?: string;
}

export interface KosuOlcumu {
  id: string;
  durum: string;
  istek: { oyunlar: string[]; oyuncular: number[]; mac: number; strateji: string; sureDk: number };
  baslama: number;
  bitis: number | null;
  maclar: KosuMaci[];
  ornekler: { t: number; tickP95: number; bellekMb: number; oda: number }[];
  eylemler: Record<string, { n: number; p50: number; p95: number; max: number; red: Record<string, number> }>;
  oyunHatalari: { oyun: string; fn: string; mesaj: string }[];
  atlananlar: string[];
  tickP95Son: number;
}

const kayit = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const sayi = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const yazi = (v: unknown, enCok = 200): string => (typeof v === "string" ? v.slice(0, enCok) : "");

/** Ham koşu yanıtını doğrular (ağdan gelen veri); bozuksa null. */
export function kosuOlcumuOku(v: unknown): KosuOlcumu | null {
  if (!kayit(v) || typeof v.id !== "string" || typeof v.durum !== "string" || !Array.isArray(v.maclar))
    return null;
  const ist = kayit(v.istek) ? v.istek : {};
  const eylemler: KosuOlcumu["eylemler"] = {};
  if (kayit(v.eylemler))
    for (const [oyun, e] of Object.entries(v.eylemler).slice(0, 40)) {
      if (!kayit(e)) continue;
      const red: Record<string, number> = {};
      if (kayit(e.red))
        for (const [k, n] of Object.entries(e.red).slice(0, 20)) red[k.slice(0, 40)] = sayi(n);
      eylemler[oyun.slice(0, 60)] = {
        n: sayi(e.n),
        p50: sayi(e.p50),
        p95: sayi(e.p95),
        max: sayi(e.max),
        red,
      };
    }
  return {
    id: v.id.slice(0, 60),
    durum: v.durum.slice(0, 20),
    istek: {
      oyunlar: Array.isArray(ist.oyunlar)
        ? ist.oyunlar.filter((x): x is string => typeof x === "string")
        : [],
      oyuncular: Array.isArray(ist.oyuncular)
        ? ist.oyuncular.filter((x): x is number => typeof x === "number")
        : [],
      mac: sayi(ist.mac, 1),
      strateji: yazi(ist.strateji, 20) || "oyna",
      sureDk: sayi(ist.sureDk),
    },
    baslama: sayi(v.baslama),
    bitis: typeof v.bitis === "number" ? v.bitis : null,
    maclar: v.maclar.slice(0, 200).flatMap((m) =>
      kayit(m) && typeof m.oyun === "string"
        ? [
            {
              oyun: m.oyun.slice(0, 60),
              oyuncu: sayi(m.oyuncu),
              durum: yazi(m.durum, 20),
              sureMs: typeof m.sureMs === "number" ? m.sureMs : null,
              skorlar: Array.isArray(m.skorlar)
                ? m.skorlar.filter((x): x is number => typeof x === "number").slice(0, 8)
                : [],
              ...(typeof m.takildigiAsama === "string"
                ? { takildigiAsama: m.takildigiAsama.slice(0, 20) }
                : {}),
              ...(typeof m.hata === "string" ? { hata: m.hata.slice(0, 300) } : {}),
              ...(typeof m.oda === "string" ? { oda: m.oda.slice(0, 12) } : {}),
            },
          ]
        : [],
    ),
    ornekler: Array.isArray(v.ornekler)
      ? v.ornekler
          .slice(0, 200)
          .flatMap((o) =>
            kayit(o)
              ? [{ t: sayi(o.t), tickP95: sayi(o.tickP95), bellekMb: sayi(o.bellekMb), oda: sayi(o.oda) }]
              : [],
          )
      : [],
    eylemler,
    oyunHatalari: Array.isArray(v.oyunHatalari)
      ? v.oyunHatalari
          .slice(0, 50)
          .flatMap((h) =>
            kayit(h) ? [{ oyun: yazi(h.oyun, 60), fn: yazi(h.fn, 40), mesaj: yazi(h.mesaj, 300) }] : [],
          )
      : [],
    atlananlar: Array.isArray(v.atlananlar)
      ? v.atlananlar.filter((x): x is string => typeof x === "string").slice(0, 20)
      : [],
    tickP95Son: sayi(v.tickP95Son),
  };
}

const DURUM_ADI: Record<string, string> = {
  bitti: "Bitti",
  takildi: "Takıldı",
  coktu: "Çöktü",
  iptal: "İptal",
  bekliyor: "Başlamadı",
  oynaniyor: "Sürüyordu",
};
const ASAMA_ADI: Record<string, string> = {
  lobby: "lobi",
  briefing: "anlatım",
  countdown: "geri sayım",
  playing: "oyun",
  results: "sonuç",
  cards: "kart seçimi",
  final: "final",
};

const yuvarla = (n: number, b = 1): number => Math.round(n * 10 ** b) / 10 ** b;
const sn = (ms: number | null): number => (ms === null ? 0 : yuvarla(ms / 1000));
const ortalama = (x: number[]): number => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);
const dakikaSaniye = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const tarihSaat = (t: number): string =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));

/** Ham ölçümden rapor. `oyunAdi` kimliği okunur ada çevirir. */
export function kosuRaporu(k: KosuOlcumu, oyunAdi: (id: string) => string = (id) => id): YapiliRapor {
  const maclar = k.maclar;
  const say = (d: string): number => maclar.filter((m) => m.durum === d).length;
  const bitenler = maclar.filter((m) => m.durum === "bitti");
  const eylemler = Object.entries(k.eylemler);
  const toplamEylem = eylemler.reduce((t, [, e]) => t + e.n, 0);
  const toplamRed = eylemler.reduce((t, [, e]) => t + Object.values(e.red).reduce((a, b) => a + b, 0), 0);
  const eylemP95 = Math.max(0, ...eylemler.map(([, e]) => e.p95));
  const sureMs = (k.bitis ?? k.baslama) - k.baslama;
  const bellekEnCok = Math.max(0, ...k.ornekler.map((o) => o.bellekMb));
  const tickEnCok = Math.max(k.tickP95Son, ...k.ornekler.map((o) => o.tickP95));

  const ozet: YapiliRapor["ozet"] = [
    { ad: "Maç", deger: maclar.length },
    { ad: "Biten maç", deger: bitenler.length, iyi: "yukari" },
    { ad: "Takılan maç", deger: say("takildi"), iyi: "asagi" },
    { ad: "Çöken maç", deger: say("coktu"), iyi: "asagi" },
    { ad: "Tick p95 (en çok)", deger: yuvarla(tickEnCok, 2), birim: "ms", iyi: "asagi" },
    { ad: "Eylem p95 (en çok)", deger: yuvarla(eylemP95, 2), birim: "ms", iyi: "asagi" },
    { ad: "Bot eylemi", deger: toplamEylem },
    { ad: "Reddedilen eylem", deger: toplamRed, iyi: "asagi" },
    { ad: "Bellek (en çok)", deger: bellekEnCok, birim: "MB", iyi: "asagi" },
    { ad: "Koşu süresi", deger: yuvarla(sureMs / 60_000), birim: "dk" },
  ];

  const oyunlar = [...new Set(maclar.map((m) => m.oyun))];
  const seriler: RaporSeri[] = [];
  if (k.ornekler.length) {
    const etiketler = k.ornekler.map((o) => dakikaSaniye(o.t));
    seriler.push({
      ad: "Sunucu tick p95",
      tur: "cizgi",
      birim: "ms",
      etiketler,
      degerler: k.ornekler.map((o) => o.tickP95),
      esik: KOSU_ESIKLERI.tickP95Ms,
    });
    seriler.push({
      ad: "Sunucu belleği",
      tur: "cizgi",
      birim: "MB",
      etiketler,
      degerler: k.ornekler.map((o) => o.bellekMb),
      esik: KOSU_ESIKLERI.bellekMb,
    });
  }
  if (oyunlar.length) {
    const ad = (o: string): string => oyunAdi(o).slice(0, 24);
    seriler.push({
      ad: "Oyuna göre ortalama maç süresi",
      tur: "cubuk",
      birim: "sn",
      etiketler: oyunlar.map(ad),
      degerler: oyunlar.map((o) =>
        yuvarla(ortalama(bitenler.filter((m) => m.oyun === o).map((m) => sn(m.sureMs)))),
      ),
    });
    seriler.push({
      ad: "Oyuna göre eylem işleme p95",
      tur: "cubuk",
      birim: "ms",
      etiketler: oyunlar.map(ad),
      degerler: oyunlar.map((o) => k.eylemler[o]?.p95 ?? 0),
      esik: KOSU_ESIKLERI.eylemP95Ms,
    });
  }

  const tablolar: RaporTablo[] = [
    {
      ad: "Oyuna göre",
      sutunlar: [
        "Oyun",
        "Maç",
        "Biten",
        "Takılan",
        "Çöken",
        "Ort. süre (sn)",
        "Eylem",
        "Eylem p95 (ms)",
        "Reddedilen",
      ],
      satirlar: oyunlar.map((o) => {
        const m = maclar.filter((x) => x.oyun === o);
        const e = k.eylemler[o];
        return [
          oyunAdi(o),
          m.length,
          m.filter((x) => x.durum === "bitti").length,
          m.filter((x) => x.durum === "takildi").length,
          m.filter((x) => x.durum === "coktu").length,
          yuvarla(ortalama(m.filter((x) => x.durum === "bitti").map((x) => sn(x.sureMs)))),
          e?.n ?? 0,
          e?.p95 ?? 0,
          e ? Object.values(e.red).reduce((a, b) => a + b, 0) : 0,
        ];
      }),
    },
    {
      ad: "Skor dağılımı (biten maçlar)",
      sutunlar: ["Oyun", "Oyuncu", "Maç", "Ort. birinci", "Ort. sonuncu", "Ort. fark", "Beraberlik %"],
      satirlar: [...new Set(bitenler.map((m) => `${m.oyun}|${m.oyuncu}`))].map((anahtar) => {
        const [o, n] = anahtar.split("|");
        const m = bitenler.filter((x) => x.oyun === o && String(x.oyuncu) === n && x.skorlar.length);
        const bir = m.map((x) => x.skorlar[0] ?? 0);
        const son = m.map((x) => x.skorlar.at(-1) ?? 0);
        const esit = m.filter((x) => (x.skorlar[0] ?? 0) === (x.skorlar[1] ?? Number.NaN)).length;
        return [
          oyunAdi(o ?? ""),
          Number(n),
          m.length,
          yuvarla(ortalama(bir)),
          yuvarla(ortalama(son)),
          yuvarla(ortalama(m.map((x) => (x.skorlar[0] ?? 0) - (x.skorlar.at(-1) ?? 0)))),
          m.length ? Math.round((esit / m.length) * 100) : 0,
        ];
      }),
    },
    {
      ad: "Maçlar",
      sutunlar: ["Oyun", "Oyuncu", "Durum", "Süre (sn)", "Skorlar", "Not"],
      satirlar: maclar.map((m) => [
        oyunAdi(m.oyun),
        m.oyuncu,
        DURUM_ADI[m.durum] ?? m.durum,
        sn(m.sureMs),
        m.skorlar.join(" · ") || "–",
        (
          m.hata ?? (m.takildigiAsama ? `${ASAMA_ADI[m.takildigiAsama] ?? m.takildigiAsama} aşamasında` : "")
        ).slice(0, 120) || "–",
      ]),
    },
  ];

  const bulgular: RaporBulgu[] = [];
  // Takılan maçlar: oyun + oyuncu sayısı + aşama başına tek bulgu.
  const takilan = new Map<string, KosuMaci[]>();
  for (const m of maclar.filter((x) => x.durum === "takildi")) {
    const a = `${m.oyun}|${m.oyuncu}|${m.takildigiAsama ?? ""}`;
    takilan.set(a, [...(takilan.get(a) ?? []), m]);
  }
  for (const [, m] of takilan) {
    const ilk = m[0];
    if (!ilk) continue;
    bulgular.push({
      baslik:
        `${oyunAdi(ilk.oyun)} ${ilk.oyuncu} oyuncuyla ${ASAMA_ADI[ilk.takildigiAsama ?? ""] ?? "bir"} aşamasında takıldı`.slice(
          0,
          140,
        ),
      onem: "yuksek",
      oyun: ilk.oyun,
      adimlar: [
        `${ilk.oyuncu} botla tek oyunluk maç aç (strateji: ${k.istek.strateji})`,
        `Maç ${ASAMA_ADI[ilk.takildigiAsama ?? ""] ?? "aynı"} aşamasından ilerlemiyor`,
      ],
      kanit: `${ilk.hata ?? "süre sınırı"} · koşu ${k.id}${ilk.oda ? `, oda ${ilk.oda}` : ""}`,
      oneri: "Oyunun bu aşamadaki zaman aşımı ve bekleme koşullarını denetle.",
      siklik: m.length,
    });
  }
  // Çöken oyunlar: oyun + işlev başına.
  const coken = new Map<string, { oyun: string; fn: string; mesaj: string; n: number }>();
  for (const h of k.oyunHatalari) {
    const a = `${h.oyun}|${h.fn}`;
    const x = coken.get(a);
    if (x) x.n += 1;
    else coken.set(a, { ...h, n: 1 });
  }
  for (const h of coken.values())
    bulgular.push({
      baslik: `${oyunAdi(h.oyun)} oyunu hata verdi (${h.fn || "bilinmiyor"})`.slice(0, 140),
      onem: "kritik",
      oyun: h.oyun,
      kanit: `${h.mesaj} · koşu ${k.id}`.slice(0, 2000),
      oneri: "Maç kaydıyla hatayı yeniden üret; oyun işlevini düzelt.",
      siklik: h.n,
    });
  if (tickEnCok > KOSU_ESIKLERI.tickP95Ms)
    bulgular.push({
      baslik: `Sunucu tick p95 eşiği aştı (${yuvarla(tickEnCok, 2)} ms > ${KOSU_ESIKLERI.tickP95Ms} ms)`,
      onem: "orta",
      kanit: `koşu ${k.id}, ${maclar.length} maç, en çok ${Math.max(0, ...k.ornekler.map((o) => o.oda))} oda`,
      oneri: "Hangi oyunun tick'i pahalı, tek oyunlu koşularla ayır.",
    });
  if (bellekEnCok > KOSU_ESIKLERI.bellekMb)
    bulgular.push({
      baslik: `Sunucu belleği eşiği aştı (${bellekEnCok} MB > ${KOSU_ESIKLERI.bellekMb} MB; kap sınırı 512 MB)`,
      onem: "yuksek",
      kanit: `koşu ${k.id}`,
      oneri: "Bellek sızıntısı ya da büyüyen oda durumu var mı, uzun koşuyla denetle.",
    });
  for (const [o, e] of eylemler) {
    if (e.p95 > KOSU_ESIKLERI.eylemP95Ms)
      bulgular.push({
        baslik: `${oyunAdi(o)}: eylem işleme p95 ${e.p95} ms (eşik ${KOSU_ESIKLERI.eylemP95Ms} ms)`.slice(
          0,
          140,
        ),
        onem: "orta",
        oyun: o,
        kanit: `${e.n} eylem, en çok ${e.max} ms · koşu ${k.id}`,
      });
    const red = Object.values(e.red).reduce((a, b) => a + b, 0);
    if (e.n >= 20 && red / e.n > KOSU_ESIKLERI.redOrani)
      bulgular.push({
        baslik: `${oyunAdi(o)}: bot eylemlerinin %${Math.round((red / e.n) * 100)}'i reddedildi`.slice(
          0,
          140,
        ),
        onem: "dusuk",
        oyun: o,
        kanit: Object.entries(e.red)
          .sort((a, b) => b[1] - a[1])
          .map(([r, n]) => `${r}: ${n}`)
          .join(", ")
          .slice(0, 2000),
        oneri: "Bot stratejisi ya da oyunun hamle kuralı uyumsuz olabilir.",
      });
  }
  // Denge sinyali: aynı oyun + oyuncu sayısında 3+ maçın hepsi berabere bitti (skor ayırt etmiyor).
  for (const s of tablolar[1]?.satirlar ?? []) {
    const [ad, n, mac, , , , esit] = s;
    if (typeof mac === "number" && mac >= 3 && esit === 100)
      bulgular.push({
        baslik: `${String(ad)} ${String(n)} oyuncuyla her maç berabere bitti`.slice(0, 140),
        onem: "dusuk",
        kanit: `${mac} maç · koşu ${k.id}`,
        oneri: "Puanlama oyuncuları ayırt etmiyor olabilir (botların aynı stratejisi de neden olabilir).",
      });
  }
  if (k.durum === "zaman_asimi")
    bulgular.push({
      baslik: `Koşu süre sınırında (${k.istek.sureDk} dk) bitmedi`,
      onem: "orta",
      kanit: `${maclar.filter((m) => m.durum === "iptal" || m.durum === "bekliyor").length} maç oynanamadı · koşu ${k.id}`,
      oneri: "Daha az maç ya da daha uzun süre sınırı seç.",
    });
  if (k.atlananlar.length)
    bulgular.push({
      baslik: "Bazı oyun/oyuncu birleşimleri atlandı",
      onem: "dusuk",
      kanit: k.atlananlar.join("; ").slice(0, 2000),
    });

  return {
    baslik: `Bot koşusu — ${tarihSaat(k.baslama)}`.slice(0, 120),
    donem: `${tarihSaat(k.baslama)} – ${tarihSaat(k.bitis ?? k.baslama)}`.slice(0, 60),
    ozet,
    seriler: seriler.slice(0, 12),
    tablolar,
    bulgular: bulgular.slice(0, 100),
  };
}
