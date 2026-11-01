#!/bin/node
/**
 * `uretim` komut aracı (UM-G3): SSH ile bağlanan yapay zekânın tek komutu. sshd `ForceCommand` ile her bağlantıyı
 * buraya yollar; komut `SSH_ORIGINAL_COMMAND`tan okunur (kabuk yok, joker yok). Alt komutlar MCP araçlarının birebir
 * karşılığıdır; araç sitenin MCP ucuna alanın SSH kanal anahtarıyla gider, yetki MCP ile aynıdır. SFTP isteği
 * chroot içindeki `sftp-server`a devredilir.
 *
 * Bu dosya bilerek bağımsızdır (yalnız Node'un yerleşik modülleri): chroot'a tek başına kopyalanır.
 */
import { spawn } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export const ALT_KOMUTLAR: Readonly<Record<string, string>> = {
  "talimat-oku": "talimat_oku",
  "isleri-listele": "isleri_listele",
  "is-oku": "is_oku",
  "katalog-oku": "katalog_oku",
  "geri-bildirim-oku": "geri_bildirim_oku",
  "dosya-yukle": "dosya_yukle",
  "on-kontrol": "on_kontrol",
  "teslim-et": "teslim_et",
  "istek-karti-ac": "istek_karti_ac",
  "kod-istegi-ac": "kod_istegi_ac",
  "ornek-paket": "paket_bicimi",
  "paket-bicimi": "paket_bicimi",
  yardim: "",
};

/** `uretim yardim`: komutlar ve teslim paketinin biçimi (yerel; siteye gitmez). */
export const YARDIM = [
  "Komutlar:",
  "  talimat-oku | isleri-listele | is-oku <id> | katalog-oku | geri-bildirim-oku [sınır]",
  "  ornek-paket (ya da paket-bicimi): alanına uygun doldurulmuş teslim.json örneği ve alan açıklamaları",
  "  dosya-yukle <paket>/<dosya> | on-kontrol <paket> [gorsel-model] | teslim-et <paket> [gorsel-model]",
  "  istek-karti-ac < json | kod-istegi-ac < json | yardim",
  "Teslim paketi: SFTP ile gelen/<paket>/ klasörüne dosyalarını ve KÖKTE teslim.json'u koy (paket.json değil).",
  "  teslim.json: { tur, isId, arac, model, uretimYontemi, ogeler: [{ ad, aciklama, gerekce,",
  "  dosyalar: [{ dosya, hedefYol, rol }], satirlar }] }. Örnek: uretim ornek-paket",
].join("\n");

const PAKET = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const DOSYA = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const SFTP =
  /^(internal-sftp|\/usr\/lib\/openssh\/sftp-server|\/usr\/libexec\/openssh\/sftp-server|\/usr\/lib\/ssh\/sftp-server)(\s.*)?$/;
const EN_COK_GIRDI = 45 * 1024 * 1024;

export interface CliOrtami {
  url: string;
  anahtar: string;
  gelen: string;
  stdin(): Buffer;
  fetchImpl: typeof fetch;
}

export class CliHatasi extends Error {}

/** Komut satırı: yalnız bilinen alt komut ve güvenli argümanlar. */
export function komutAyristir(ham: string): { komut: string; args: string[] } {
  if (ham.length > 400 || /[\0\r\n]/.test(ham)) throw new CliHatasi("Komut geçersiz.");
  const parca = ham.trim().split(/\s+/).filter(Boolean);
  // "uretim talimat-oku" ile "talimat-oku" aynıdır (istemler ikisini de kullanabilir).
  if (parca[0] === "uretim") parca.shift();
  const [komut, ...args] = parca;
  if (!komut || !(komut in ALT_KOMUTLAR))
    throw new CliHatasi(
      `Bilinmeyen komut. Kullanılabilir: ${Object.keys(ALT_KOMUTLAR).join(", ")}. Ayrıntı: uretim yardim`,
    );
  if (
    args.length > 2 ||
    args.some((a) => !/^[A-Za-z0-9._/-]{1,200}$/.test(a) || a.includes("..") || a.startsWith("/"))
  )
    throw new CliHatasi("Argüman geçersiz.");
  return { komut, args };
}

/** `gelen/` altında güvenli bir yol: `.."`, mutlak yol, bağlantı ve klasör dışı reddedilir. */
export function gelenYolu(gelen: string, gorece: string, tur: "paket" | "dosya"): string {
  const parcalar = gorece.split("/");
  if (tur === "paket" && (parcalar.length !== 1 || !PAKET.test(gorece)))
    throw new CliHatasi("Paket adı geçersiz.");
  if (
    tur === "dosya" &&
    (parcalar.length !== 2 || !PAKET.test(parcalar[0] ?? "") || !DOSYA.test(parcalar[1] ?? ""))
  )
    throw new CliHatasi("Dosya yolu <paket>/<dosya> olmalı (dosya adı: küçük harf, rakam, . _ -).");
  const kok = realpathSync(gelen);
  const p = resolve(kok, gorece);
  if (!p.startsWith(kok + sep)) throw new CliHatasi("Yol gelen klasörünün dışında.");
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(p);
  } catch {
    // Yalnız ad (yol yok): yapay zekâ neyin eksik olduğunu görsün.
    throw new CliHatasi(
      tur === "paket" ? `Paket bulunamadı: ${gorece}.` : `Pakette dosya bulunamadı: ${parcalar[1] ?? ""}.`,
    );
  }
  if (st.isSymbolicLink()) throw new CliHatasi("Bağlantı (symlink) kabul edilmez.");
  if (tur === "paket" ? !st.isDirectory() : !st.isFile() || st.nlink > 1)
    throw new CliHatasi("Yol beklenen türde değil.");
  if (realpathSync(p) !== p) throw new CliHatasi("Yol gelen klasörünün dışında.");
  return p;
}

async function arac(o: CliOrtami, ad: string, args: Record<string, unknown>): Promise<unknown> {
  let r: Response;
  try {
    r = await o.fetchImpl(o.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${o.anahtar}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: ad, arguments: args },
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new CliHatasi("Üretim Merkezi'ne ulaşılamadı.");
  }
  let j: unknown;
  try {
    j = await r.json();
  } catch {
    throw new CliHatasi("Yanıt okunamadı.");
  }
  const rec = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (!rec(j)) throw new CliHatasi("Yanıt okunamadı.");
  if (rec(j.error))
    throw new CliHatasi(typeof j.error.message === "string" ? j.error.message : "İstek reddedildi.");
  const res = j.result;
  if (!rec(res) || !Array.isArray(res.content)) throw new CliHatasi("Yanıt okunamadı.");
  const ilk = res.content[0];
  const metin = rec(ilk) && typeof ilk.text === "string" ? ilk.text : "";
  if (res.isError === true) throw new CliHatasi(metin || "İşlem yapılamadı.");
  return rec(res.structuredContent) ? res.structuredContent : JSON.parse(metin || "null");
}

function jsonGirdi(o: CliOrtami): Record<string, unknown> {
  const b = o.stdin();
  if (b.length > EN_COK_GIRDI) throw new CliHatasi("Girdi çok büyük.");
  try {
    const v: unknown = JSON.parse(b.toString("utf8") || "{}");
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new CliHatasi("Girdi JSON nesnesi olmalı.");
  }
}

/** `gelen/<paket>/` → dosyaları yükle, teslim.json'daki `dosya` adlarını dosyaId'ye çevir. */
async function paketHazirla(o: CliOrtami, paket: string): Promise<Record<string, unknown>> {
  const kok = gelenYolu(o.gelen, paket, "paket");
  const tj = join(kok, "teslim.json");
  if (!existsSync(tj)) {
    let baska = "";
    try {
      baska = readdirSync(kok).find((x) => x.endsWith(".json") && DOSYA.test(x)) ?? "";
    } catch {
      baska = "";
    }
    throw new CliHatasi(
      `Pakette teslim.json yok${baska ? ` (${baska} değil)` : ""}. Biçim için: uretim ornek-paket`,
    );
  }
  gelenYolu(o.gelen, `${paket}/teslim.json`, "dosya");
  let teslim: unknown;
  try {
    teslim = JSON.parse(readFileSync(tj, "utf8"));
  } catch {
    throw new CliHatasi("teslim.json okunamadı.");
  }
  if (typeof teslim !== "object" || teslim === null || Array.isArray(teslim))
    throw new CliHatasi("teslim.json nesne olmalı.");
  const t = teslim as Record<string, unknown>;
  const yuklenen = new Map<string, string>();
  for (const oge of Array.isArray(t.ogeler) ? t.ogeler : []) {
    if (typeof oge !== "object" || oge === null || !Array.isArray((oge as { dosyalar?: unknown }).dosyalar))
      continue;
    const dl = (oge as { dosyalar: unknown[] }).dosyalar;
    for (let i = 0; i < dl.length; i++) {
      const d = dl[i];
      if (typeof d !== "object" || d === null || typeof (d as { dosya?: unknown }).dosya !== "string")
        continue;
      const ad = (d as { dosya: string }).dosya;
      let id = yuklenen.get(ad);
      if (!id) {
        const yol = gelenYolu(o.gelen, `${paket}/${ad}`, "dosya");
        const r = await arac(o, "dosya_yukle", { ad, icerik_base64: readFileSync(yol).toString("base64") });
        const dosyaId = (r as { dosyaId?: unknown }).dosyaId;
        if (typeof dosyaId !== "string") throw new CliHatasi("Dosya yüklenemedi.");
        id = dosyaId;
        yuklenen.set(ad, id);
      }
      const { dosya: _x, ...kalan } = d as Record<string, unknown>;
      dl[i] = { ...kalan, dosyaId: id };
    }
  }
  return t;
}

export async function calistirKomut(o: CliOrtami, ham: string): Promise<unknown> {
  const { komut, args } = komutAyristir(ham);
  const ad = ALT_KOMUTLAR[komut] ?? "";
  switch (komut) {
    case "yardim":
      return { yardim: YARDIM };
    case "ornek-paket":
    case "paket-bicimi":
      return arac(o, ad, {});
    case "talimat-oku":
    case "isleri-listele":
    case "katalog-oku":
      return arac(o, ad, {});
    case "geri-bildirim-oku":
      return arac(o, ad, args[0] ? { sinir: Number(args[0]) } : {});
    case "is-oku": {
      if (!args[0] || !/^\d{1,12}$/.test(args[0])) throw new CliHatasi("Kullanım: is-oku <iş kimliği>");
      return arac(o, ad, { id: Number(args[0]) });
    }
    case "dosya-yukle": {
      const a = args[0];
      if (!a) throw new CliHatasi("Kullanım: dosya-yukle <paket>/<dosya>  ya da  dosya-yukle <ad> < dosya");
      if (a.includes("/")) {
        const yol = gelenYolu(o.gelen, a, "dosya");
        return arac(o, ad, { ad: a.split("/")[1], icerik_base64: readFileSync(yol).toString("base64") });
      }
      if (!DOSYA.test(a)) throw new CliHatasi("Dosya adı geçersiz.");
      const b = o.stdin();
      if (!b.length || b.length > EN_COK_GIRDI)
        throw new CliHatasi("Dosya içeriği standart girdiden gelmeli.");
      return arac(o, ad, { ad: a, icerik_base64: b.toString("base64") });
    }
    case "on-kontrol":
    case "teslim-et": {
      const paket = args[0];
      const girdi = paket ? await paketHazirla(o, paket) : jsonGirdi(o);
      // `teslim-et <paket> gorsel-model`: görsellerin nasıl üretildiği (teslim.json'daki "uretimYontemi" yerine).
      const yontem = args[1];
      if (yontem !== undefined) {
        if (yontem !== "gorsel-model" && yontem !== "kod")
          throw new CliHatasi(
            'Üretim yöntemi "gorsel-model" ya da "kod" olmalı: teslim-et <paket> gorsel-model',
          );
        girdi.uretimYontemi = yontem;
      }
      const r = await arac(o, ad, girdi);
      if (komut === "teslim-et" && paket)
        rmSync(gelenYolu(o.gelen, paket, "paket"), { recursive: true, force: true });
      return r;
    }
    default:
      return arac(o, ad, jsonGirdi(o));
  }
}

function stdinOku(): Buffer {
  try {
    return readFileSync(0);
  } catch {
    return Buffer.alloc(0);
  }
}

async function ana(): Promise<void> {
  const ham = process.env.SSH_ORIGINAL_COMMAND ?? process.argv.slice(2).join(" ");
  if (SFTP.test(ham.trim())) {
    // Dosya aktarımı: chroot içindeki sftp-server'a devret (yalnız gelen/ yazılabilir, okunur/ salt okunur).
    const sftp = [
      "/usr/lib/openssh/sftp-server",
      "/usr/libexec/openssh/sftp-server",
      "/usr/lib/ssh/sftp-server",
    ].find((p) => {
      try {
        return lstatSync(p).isFile();
      } catch {
        return false;
      }
    });
    if (!sftp) {
      process.stderr.write("Dosya aktarımı şu an kapalı.\n");
      process.exit(1);
    }
    const c = spawn(sftp, ["-d", "/gelen", "-u", "0002"], { stdio: "inherit" });
    c.on("exit", (kod) => process.exit(kod ?? 1));
    return;
  }
  const ayarYolu = process.env.URETIM_AYAR ?? "/etc/uretim/ayar.json";
  let url = process.env.URETIM_URL ?? "";
  let anahtarYolu = process.env.URETIM_ANAHTAR_DOSYASI ?? "/etc/uretim/anahtar";
  try {
    const a = JSON.parse(readFileSync(ayarYolu, "utf8")) as { url?: unknown; anahtar?: unknown };
    if (typeof a.url === "string") url = a.url;
    if (typeof a.anahtar === "string") anahtarYolu = a.anahtar;
  } catch {
    // Ayar dosyası yoksa ortam değişkenleri kullanılır.
  }
  let anahtar = "";
  try {
    anahtar = readFileSync(anahtarYolu, "utf8").trim();
  } catch {
    anahtar = "";
  }
  const o: CliOrtami = {
    url,
    anahtar,
    gelen: process.env.URETIM_GELEN ?? "/gelen",
    stdin: stdinOku,
    fetchImpl: fetch,
  };
  try {
    // Yardım yereldir: bağlantı kurulmadan da okunur, düz metin basılır.
    if (/^\s*(uretim\s+)?yardim\s*$/.test(ham)) {
      process.stdout.write(`${YARDIM}\n`);
      return;
    }
    if (!url || !anahtar)
      throw new CliHatasi("Bu bağlantı henüz kurulmadı; sahibinden alana SSH anahtarı eklemesini iste.");
    const sonuc = await calistirKomut(o, ham);
    process.stdout.write(`${JSON.stringify(sonuc, null, 2)}\n`);
  } catch (err) {
    process.stdout.write(
      `${JSON.stringify({ hata: err instanceof CliHatasi ? err.message : "Beklenmeyen bir sorun oldu." })}\n`,
    );
    process.exitCode = 1;
  }
}

// Doğrudan çalıştırılınca (testler içe aktarır, çalıştırmaz).
if (process.argv[1] && /uretim(\.js|\.ts)?$/.test(process.argv[1]) && !process.env.VITEST) void ana();
