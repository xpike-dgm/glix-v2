/**
 * Ses kontrolleri (UM-K3): süre, kanal, örnekleme, LUFS (ffmpeg ebur128), kırpılma, baş/son sessizlik, müzikte döngü
 * dikişi. Örnek analizi saf JS'tir; OGG açmak ve LUFS ölçmek ffmpeg ister, yoksa o satırlar "atlandı" olur.
 */
import { ffmpegVar, lufsOlc, MedyaHatasi, type SesBilgisi, sesAc } from "../medya.js";
import { type KontrolBaglami, type Satir, satir } from "./baglam.js";

export interface SesProfili {
  ad: string;
  enAzSure: number;
  enCokSure: number;
  hedefLufs: number;
  muzik: boolean;
}

export function sesProfili(alan: string, hedefYol: string | null, rol: string | null): SesProfili {
  if (alan === "muzik") return { ad: "müzik", enAzSure: 30, enCokSure: 120, hedefLufs: -20, muzik: true };
  if (rol === "arayuz" || hedefYol?.includes("/arayuz/"))
    return { ad: "arayüz sesi", enAzSure: 0.02, enCokSure: 0.4, hedefLufs: -16, muzik: false };
  return { ad: "ses efekti", enAzSure: 0.05, enCokSure: 2, hedefLufs: -16, muzik: false };
}

const SESSIZ = 10 ** (-50 / 20);

export interface OrnekAnalizi {
  tepe: number;
  kirpikDizisi: number;
  basSessizlik: number;
  sonSessizlik: number;
  dikisSicrama: number;
  dikisSeviyeOrani: number;
}

export function ornekAnalizi(mono: Float32Array, ornekleme: number): OrnekAnalizi {
  let tepe = 0;
  let dizi = 0;
  let enUzun = 0;
  for (const v of mono) {
    const a = Math.abs(v);
    tepe = Math.max(tepe, a);
    if (a >= 0.999) {
      dizi += 1;
      enUzun = Math.max(enUzun, dizi);
    } else dizi = 0;
  }
  let bas = 0;
  while (bas < mono.length && Math.abs(mono[bas] ?? 0) < SESSIZ) bas++;
  let son = 0;
  while (son < mono.length - bas && Math.abs(mono[mono.length - 1 - son] ?? 0) < SESSIZ) son++;
  const pencere = Math.min(Math.floor(ornekleme * 0.05), Math.floor(mono.length / 4));
  const rms = (a: number, b: number): number => {
    let t = 0;
    for (let i = a; i < b; i++) t += (mono[i] ?? 0) ** 2;
    return Math.sqrt(t / Math.max(1, b - a));
  };
  const ilk = rms(0, pencere);
  const sonR = rms(mono.length - pencere, mono.length);
  const oran =
    ilk > 1e-6 && sonR > 1e-6
      ? Math.max(ilk, sonR) / Math.min(ilk, sonR)
      : ilk < 1e-6 && sonR < 1e-6
        ? 1
        : 100;
  return {
    tepe,
    kirpikDizisi: enUzun,
    basSessizlik: bas / ornekleme,
    sonSessizlik: son / ornekleme,
    dikisSicrama: mono.length ? Math.abs((mono[mono.length - 1] ?? 0) - (mono[0] ?? 0)) : 0,
    dikisSeviyeOrani: oran,
  };
}

export function sesSatirlari(
  bilgi: SesBilgisi,
  lufs: number | null | "yok",
  p: SesProfili,
  dosya: string,
): Satir[] {
  const s: Satir[] = [];
  const e = { dosya };
  const sn = (x: number): string => `${x.toFixed(2).replace(".", ",")} sn`;
  if (bilgi.sure < p.enAzSure || bilgi.sure > p.enCokSure)
    s.push(
      satir(
        "ses",
        "sure",
        "kaldi",
        `${p.ad} süresi ${sn(p.enAzSure)}–${sn(p.enCokSure)} olmalı (gelen ${sn(bilgi.sure)}).`,
        e,
      ),
    );
  else s.push(satir("ses", "sure", "gecti", `Süre ${sn(bilgi.sure)}.`, e));
  if (bilgi.kanal > 1)
    s.push(satir("ses", "kanal", "uyari", `${bilgi.kanal} kanal; pakette tek kanala indirilecek.`, e));
  if (bilgi.ornekleme < 22050)
    s.push(satir("ses", "ornekleme", "kaldi", `Örnekleme hızı çok düşük (${bilgi.ornekleme} Hz).`, e));
  else if (bilgi.ornekleme !== 44100 && bilgi.ornekleme !== 48000)
    s.push(
      satir(
        "ses",
        "ornekleme",
        "uyari",
        `Örnekleme hızı ${bilgi.ornekleme} Hz; 44100 ya da 48000 beklenir.`,
        e,
      ),
    );
  if (lufs === "yok")
    s.push(satir("ses", "lufs", "atlandi", "Ses yüksekliği ölçülemedi (ölçüm aracı yok).", e));
  else if (lufs === null)
    s.push(satir("ses", "lufs", "uyari", "Ses yüksekliği ölçülemedi (çok kısa ya da sessiz).", e));
  else {
    const fark = Math.abs(lufs - p.hedefLufs);
    const m = `Algılanan yükseklik ${lufs.toFixed(1)} LUFS (hedef ${p.hedefLufs}).`;
    s.push(
      satir(
        "ses",
        "lufs",
        fark <= 2 ? "gecti" : fark <= 8 ? "uyari" : "kaldi",
        fark <= 2 ? m : `${m} Pakette düzeltilecek.`,
        e,
      ),
    );
  }
  const a = ornekAnalizi(bilgi.mono, bilgi.monoOrnekleme);
  if (a.kirpikDizisi >= 3) s.push(satir("ses", "kirpilma", "kaldi", "Kırpılma (clipping) var.", e));
  else if (a.tepe >= 0.999)
    s.push(satir("ses", "kirpilma", "uyari", "Tepe tam sınırda; kırpılmaya çok yakın.", e));
  else s.push(satir("ses", "kirpilma", "gecti", "Kırpılma yok.", e));
  const sessizSinir = p.muzik ? 0.05 : 0.15;
  if (a.basSessizlik > sessizSinir)
    s.push(
      satir("ses", "bas-sessizlik", "uyari", `Başta ${sn(a.basSessizlik)} sessizlik var; kırpılmalı.`, e),
    );
  if (a.sonSessizlik > (p.muzik ? 0.05 : 0.3))
    s.push(
      satir("ses", "son-sessizlik", "uyari", `Sonda ${sn(a.sonSessizlik)} sessizlik var; kırpılmalı.`, e),
    );
  if (p.muzik) {
    if (a.dikisSicrama > 0.2 || a.dikisSeviyeOrani > 2)
      s.push(
        satir(
          "ses",
          "dongu-dikisi",
          "uyari",
          "Döngü dikişi uyumsuz: son ve ilk dalga birbirine oturmuyor (tık ya da seviye sıçraması).",
          e,
        ),
      );
    else s.push(satir("ses", "dongu-dikisi", "gecti", "Döngü dikişi uyumlu.", e));
  }
  return s;
}

export async function sesKontrolleri(b: KontrolBaglami): Promise<Satir[]> {
  const out: Satir[] = [];
  const arac = await ffmpegVar();
  for (const d of b.dosyalar) {
    if (d.tur !== "wav" && d.tur !== "ogg") continue;
    if (d.tur === "ogg" && !arac) {
      out.push(satir("ses", "ac", "atlandi", "OGG dosyası şu an incelenemiyor (araç yok).", { dosya: d.ad }));
      continue;
    }
    try {
      const bilgi = await sesAc(d.veri, d.tur);
      const lufs = arac ? await lufsOlc(d.veri, d.tur) : "yok";
      out.push(...sesSatirlari(bilgi, lufs, sesProfili(b.alan.id, d.hedefYol, d.rol), d.ad));
    } catch (err) {
      out.push(
        satir("ses", "ac", "kaldi", err instanceof MedyaHatasi ? err.message : "Ses dosyası açılamadı.", {
          dosya: d.ad,
        }),
      );
    }
  }
  return out;
}
