/**
 * MCP ucu (UM-G2): Streamable HTTP üzerinden JSON-RPC 2.0, yeni bağımlılık olmadan. Yalnız `initialize`, `ping`,
 * `tools/list`, `tools/call` ve bildirimler. Kimlik `Authorization: Bearer <alan anahtarı>`; her araç yalnız o alanın
 * verisini görür. Yanıt her zaman tek JSON gövdesidir (akış gerekmez; spec buna izin verir). Dosya sistemi ya da
 * kabuk erişimi veren hiçbir araç yoktur.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnahtarKimligi, Anahtarlar } from "./anahtar.js";
import { GovdeHatasi, gonder, govdeOku, icAgIstegi, kayit, metin, tamsayi, tarih } from "./http.js";
import { IsHatasi, type Merkez } from "./merkez.js";
import { alanTanimi, isAlanId } from "./ortak/alanlar.js";
import { gorselAlaniMi, gorselKuraliMaddeleri } from "./ortak/gorselKurali.js";
import { paketBicimi } from "./ortak/paketBicimi.js";
import type { SshKanal } from "./sshKanal.js";
import { teslimAyristir } from "./teslimGirdisi.js";

export const MCP_SURUMLERI = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
/** 30 MB ses dosyasının base64 hâli + zarf. */
export const MCP_GOVDE_SINIRI = 42 * 1024 * 1024;

export interface AracTanimi {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const bos = { type: "object", properties: {}, additionalProperties: false };
const raporSemasi = {
  type: "object",
  description: "Rapor panosu. Biri gerekli: ozet, seriler, tablolar, bulgular.",
  properties: {
    baslik: { type: "string", maxLength: 120 },
    donem: { type: "string", maxLength: 60 },
    ozet: {
      type: "array",
      maxItems: 12,
      description: "Özet kutucukları",
      items: {
        type: "object",
        required: ["ad", "deger"],
        properties: {
          ad: { type: "string", maxLength: 40 },
          deger: { type: "number" },
          birim: { type: "string", maxLength: 12 },
          onceki: { type: "number" },
          iyi: { type: "string", enum: ["yukari", "asagi"] },
        },
      },
    },
    seriler: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        required: ["ad", "tur", "etiketler", "degerler"],
        properties: {
          ad: { type: "string", maxLength: 60 },
          tur: { type: "string", enum: ["cizgi", "cubuk"] },
          birim: { type: "string", maxLength: 12 },
          etiketler: { type: "array", items: { type: "string" }, maxItems: 200 },
          degerler: { type: "array", items: { type: "number" }, maxItems: 200 },
          esik: { type: "number" },
        },
      },
    },
    tablolar: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        required: ["ad", "sutunlar", "satirlar"],
        properties: {
          ad: { type: "string", maxLength: 60 },
          sutunlar: { type: "array", items: { type: "string" }, maxItems: 12 },
          satirlar: { type: "array", maxItems: 200, items: { type: "array" } },
        },
      },
    },
    bulgular: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        required: ["baslik", "onem"],
        properties: {
          baslik: { type: "string", maxLength: 140 },
          onem: { type: "string", enum: ["kritik", "yuksek", "orta", "dusuk"] },
          oyun: { type: "string", maxLength: 60 },
          adimlar: { type: "array", items: { type: "string" }, maxItems: 20 },
          kanit: { type: "string", maxLength: 2000 },
          oneri: { type: "string", maxLength: 600 },
          siklik: { type: "number" },
        },
      },
    },
  },
};
const teslimSemasi = {
  type: "object",
  required: ["tur", "ogeler"],
  properties: {
    isId: { type: "integer", description: "Bağlı iş (isleri_listele)" },
    arac: { type: "string", maxLength: 60, description: "Kullandığın araç (ör. ChatGPT, OpenCode)" },
    model: { type: "string", maxLength: 80, description: "Kullandığın model" },
    uretimYontemi: {
      type: "string",
      enum: ["gorsel-model", "kod"],
      description:
        'Görselleri nasıl ürettin: "gorsel-model" (görsel üretim becerisi/aracı). Görsel alanlarında "kod" (PIL, SVG, canvas ile çizim) reddedilir.',
    },
    tur: {
      type: "string",
      enum: ["yeni", "duzenleme", "kaldirma-onerisi", "rapor", "fikir"],
      description:
        'fikir: fikir panosu (her öğede ad, ozet, kategori, etki, zahmet, gerekce; dosya isteğe bağlı küçük önizleme). rapor: öğede yapılandırılmış "rapor" nesnesi (ozet, seriler, tablolar, bulgular). Örnek: paket_bicimi',
    },
    aciklama: { type: "string", maxLength: 1000 },
    ogeler: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        required: ["ad"],
        properties: {
          ad: { type: "string", maxLength: 60 },
          aciklama: { type: "string", maxLength: 500 },
          gerekce: { type: "string", maxLength: 1000 },
          dosyalar: {
            type: "array",
            items: {
              type: "object",
              required: ["dosyaId"],
              properties: {
                dosyaId: { type: "string" },
                hedefYol: { type: "string" },
                rol: { type: "string" },
              },
            },
          },
          satirlar: { type: "array", description: "Katalog/havuz satırları (alan talimatındaki biçimde)" },
          degisiklikler: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, eski: { type: "object" }, yeni: { type: "object" } },
            },
          },
          kaldirilacaklar: { type: "array", items: { type: "string" } },
          onizleme: { type: "object", properties: { ekran: { type: "string" }, not: { type: "string" } } },
          oncekiOge: { type: "integer", description: "Düzeltilen öğenin kimliği" },
          rapor: raporSemasi,
          gorunus: { type: "string", maxLength: 600, description: "Fikirde: nasıl görünecek, renk, hareket" },
          ozet: { type: "string", maxLength: 160, description: "Fikirde: tek cümle özet" },
          kategori: {
            type: "string",
            maxLength: 30,
            description: "Fikirde: kategori (ör. Koleksiyon, Ses, Oynanış)",
          },
          etki: { type: "string", enum: ["dusuk", "orta", "yuksek"], description: "Fikirde: beklenen etki" },
          zahmet: { type: "string", enum: ["kucuk", "orta", "buyuk"], description: "Fikirde: iş büyüklüğü" },
          fikirId: {
            type: "integer",
            description:
              "Onaylananları uygula işinde: bu öğenin uyguladığı fikrin kimliği (is_oku → fikirler)",
          },
        },
      },
    },
  },
};

export const ARACLAR: readonly AracTanimi[] = [
  {
    name: "talimat_oku",
    title: "Talimatı oku",
    description: "Alanının güncel kalıcı talimatı (sürümüyle). Her turun başında oku.",
    inputSchema: bos,
  },
  {
    name: "isleri_listele",
    title: "İşleri listele",
    description: "Sana açılmış işler, sırasıyla. En üsttekinden başla.",
    inputSchema: bos,
  },
  {
    name: "is_oku",
    title: "İşi oku",
    description: "Bir işin ayrıntısı.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "integer" } },
      additionalProperties: false,
    },
  },
  {
    name: "paket_bicimi",
    title: "Teslim paketi biçimi",
    description:
      "Alanına uygun doldurulmuş teslim örneği (teslim.json) ve alan açıklamaları. SSH'ta `dosya` (paketteki ad), MCP'de dosya_yukle'den dönen `dosyaId` yazılır.",
    inputSchema: bos,
  },
  {
    name: "katalog_oku",
    title: "Kataloğu oku",
    description: "Alanının oyundaki güncel kataloğu (salt okunur, anonim).",
    inputSchema: bos,
  },
  {
    name: "geri_bildirim_oku",
    title: "Geri bildirimi oku",
    description:
      "Ret notları, düzeltme istekleri, sahibin yorumları ve ön kontrolden dönenler (en yeni üstte).",
    inputSchema: {
      type: "object",
      properties: { sinir: { type: "integer", minimum: 1, maximum: 200 } },
      additionalProperties: false,
    },
  },
  {
    name: "dosya_yukle",
    title: "Dosya yükle",
    description:
      "Tek dosya yükler (base64). İzinli türler: png, webp, ogg, wav, json, svg, md, csv. Dönen dosyaId teslimde kullanılır.",
    inputSchema: {
      type: "object",
      required: ["ad", "icerik_base64"],
      properties: {
        ad: { type: "string", description: "ör. neon-cerceve.png" },
        icerik_base64: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "on_kontrol",
    title: "Ön kontrol",
    description: "Teslim etmeden paketini denetletir; hiçbir şey kaydedilmez.",
    inputSchema: teslimSemasi,
  },
  {
    name: "teslim_et",
    title: "Teslim et",
    description: "Paketi teslim eder. 'Kaldı' alan öğeler sahibe gitmez, nedeniyle sana döner.",
    inputSchema: teslimSemasi,
  },
  {
    name: "istek_karti_ac",
    title: "İstek kartı aç",
    description:
      "Başka bir alandan bir şey iste. Kendi alanını yazarsan yeni iş önerirsin. Sahip onaylamadan iş olmaz.",
    inputSchema: {
      type: "object",
      required: ["istenen_alan", "ne", "neden"],
      properties: {
        istenen_alan: { type: "string" },
        ne: { type: "string", maxLength: 300 },
        neden: { type: "string", maxLength: 1000 },
        son_tarih: { type: "string", description: "YYYY-AA-GG" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kod_istegi_ac",
    title: "Kod isteği aç",
    description: "Veriyle yapılamayan bir şey için gerekçeli kod isteği.",
    inputSchema: {
      type: "object",
      required: ["baslik", "gerekce", "etki"],
      properties: {
        baslik: { type: "string", maxLength: 120 },
        gerekce: { type: "string", maxLength: 2000 },
        ornek: { type: "string", maxLength: 2000 },
        etki: { type: "string", maxLength: 1000 },
      },
      additionalProperties: false,
    },
  },
];

export class AracHatasi extends Error {}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Bir aracı çalıştırır; sonuç düz JSON. Alan her zaman anahtardan gelir. */
export async function aracCalistir(
  m: Merkez,
  a: Anahtarlar,
  k: AnahtarKimligi,
  ad: string,
  args: Record<string, unknown>,
  now: number,
): Promise<unknown> {
  const kim = `yz:${k.alan}:${k.ad}`;
  m.kilitTazele(k.id, now);
  const alan = k.alan;
  switch (ad) {
    case "talimat_oku": {
      const t = m.yzTalimati(alan, now);
      return { alan, alanAdi: alanTanimi(alan).ad, surum: t.surum, metin: t.metin };
    }
    case "isleri_listele":
      return m.yzIsListesi(alan, k.id, now);
    case "is_oku": {
      const id = tamsayi(args.id, 1, 1e12);
      const is = id ? m.is(id, alan) : null;
      if (!is) throw new AracHatasi("Bu iş bulunamadı.");
      if (!m.isKilitle(is.id, k.id, k.ad, now)) {
        const kl = m.kilit(is.id, now);
        const siradaki = m.yzIsListesi(alan, k.id, now).siradaki;
        return {
          ...is,
          uzerindeCalisiliyor: true,
          kilit: kl?.ad ?? "",
          siradaki,
          mesaj: `Bu iş üzerinde çalışılıyor (${kl?.ad ?? "başka oturum"}).${siradaki ? ` Sıradaki iş: ${siradaki}.` : ""}`,
        };
      }
      m.isBasladi(is.id, now);
      // Görsel alanlarında kural her iş ayrıntısının başında (iş metninden bağımsız, çıkarılamaz).
      return gorselAlaniMi(alan)
        ? { gorselKurali: gorselKuraliMaddeleri(alan), ...is, uzerindeCalisiliyor: false }
        : { ...is, uzerindeCalisiliyor: false };
    }
    case "paket_bicimi":
      return paketBicimi(alan);
    case "katalog_oku":
      return m.katalog.alanKatalogu(alan, now);
    case "geri_bildirim_oku": {
      const s = args.sinir === undefined ? 50 : tamsayi(args.sinir, 1, 200);
      if (s === null) throw new AracHatasi("sinir 1–200 olmalı.");
      return { notlar: m.geriBildirim(alan, s) };
    }
    case "dosya_yukle": {
      const b64 = args.icerik_base64;
      if (typeof b64 !== "string" || b64.length === 0 || b64.length % 4 !== 0 || !BASE64.test(b64))
        throw new AracHatasi("icerik_base64 geçerli base64 olmalı.");
      if (!a.dosyaIzni(k.id, now))
        throw new AracHatasi("Günlük dosya sınırı (500) doldu; yarın yeniden dene.");
      return m.yukle(alan, k.id, args.ad, Buffer.from(b64, "base64"), now);
    }
    case "on_kontrol":
    case "teslim_et": {
      const p = teslimAyristir(args, alanTanimi(alan));
      if (!p.ok) return { sonuc: "kaldi", hatalar: p.hatalar };
      const r = await m.teslimEt(alan, "mcp", k.id, p.deger, ad === "on_kontrol", now, kim, {
        kanal: k.kanal,
        ad: k.ad,
      });
      return {
        teslimId: r.teslimId,
        ogeler: r.ogeler.map((o) => ({
          ad: o.ad,
          ogeId: o.ogeId,
          sonuc: o.sonuc,
          durum: o.durum,
          satirlar: o.satirlar.filter((s) => s.sonuc !== "gecti"),
        })),
      };
    }
    case "istek_karti_ac": {
      const istenen = args.istenen_alan;
      const ne = metin(args.ne, 3, 300);
      const neden = metin(args.neden, 3, 1000);
      const son = args.son_tarih === undefined ? null : tarih(args.son_tarih);
      if (!isAlanId(istenen) || !ne || !neden || (args.son_tarih !== undefined && !son))
        throw new AracHatasi("istenen_alan, ne, neden (ve isteğe bağlı son_tarih YYYY-AA-GG) gerekli.");
      return m.istekKartiAc(alan, { istenenAlan: istenen, ne, neden, sonTarih: son }, kim, now);
    }
    case "kod_istegi_ac": {
      const baslik = metin(args.baslik, 3, 120);
      const gerekce = metin(args.gerekce, 3, 2000);
      const etki = metin(args.etki, 2, 1000);
      const ornek = args.ornek === undefined ? "" : metin(args.ornek, 0, 2000);
      if (!baslik || !gerekce || !etki || ornek === null)
        throw new AracHatasi("baslik, gerekce ve etki gerekli.");
      return m.kodIstegiAc(alan, { baslik, gerekce, ornek, etki }, kim, now);
    }
    default:
      throw new AracHatasi("Bilinmeyen araç.");
  }
}

interface RpcIstegi {
  id: string | number | null | undefined;
  method: string;
  params: Record<string, unknown>;
}

const rpcHata = (id: RpcIstegi["id"], code: number, message: string): unknown => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

function rpcAyristir(v: unknown): RpcIstegi | null {
  if (!kayit(v) || v.jsonrpc !== "2.0" || typeof v.method !== "string") return null;
  const id = v.id;
  if (id !== undefined && id !== null && typeof id !== "string" && typeof id !== "number") return null;
  const params = v.params === undefined ? {} : v.params;
  if (!kayit(params)) return null;
  return { id: id as RpcIstegi["id"], method: v.method, params };
}

export const SSH_PAKET_ARACI = "ssh_paket";

export interface McpOrtami {
  merkez: Merkez;
  anahtarlar: Anahtarlar;
  /** SSH kanalı (yalnız `ssh_paket` iç aracı için). */
  ssh?: SshKanal;
  publicUrl: string;
  surum: string;
  now(): number;
}

export async function mcpIstek(req: IncomingMessage, res: ServerResponse, o: McpOrtami): Promise<void> {
  if (req.method !== "POST") {
    gonder(res, 405, rpcHata(null, -32000, "Yalnız POST desteklenir."), { Allow: "POST" });
    return;
  }
  // DNS yeniden bağlama koruması: tarayıcıdan gelen istek yalnız sitenin kendi kökeninden.
  const origin = req.headers.origin;
  if (origin && origin !== new URL(o.publicUrl).origin) {
    gonder(res, 403, rpcHata(null, -32000, "Kaynak reddedildi."));
    return;
  }
  const yetki = req.headers.authorization ?? "";
  const bearer = /^Bearer\s+(\S+)$/.exec(yetki)?.[1] ?? null;
  const now = o.now();
  const ham = o.anahtarlar.dogrula(bearer, now);
  // SSH kanal anahtarı yalnız sunucunun içinden (chroot'taki araç) kullanılır; herkese açık adreste geçmez.
  const k = ham && (ham.kanal !== "ssh" || icAgIstegi(req)) ? ham : null;
  if (!k) {
    gonder(res, 401, rpcHata(null, -32001, "Anahtar geçersiz ya da iptal edilmiş."), {
      "WWW-Authenticate": 'Bearer realm="uretim"',
    });
    return;
  }
  if (!o.anahtarlar.istekIzni(k.id, now)) {
    gonder(res, 429, rpcHata(null, -32002, "Dakikada en çok 60 istek; biraz bekle."), {
      "Retry-After": "30",
    });
    return;
  }
  let govde: unknown;
  try {
    const b = await govdeOku(req, MCP_GOVDE_SINIRI);
    govde = JSON.parse(b.toString("utf8"));
  } catch (err) {
    if (err instanceof GovdeHatasi && err.durum === 413)
      gonder(res, 413, rpcHata(null, -32600, "İstek çok büyük."));
    else gonder(res, 400, rpcHata(null, -32700, "JSON okunamadı."));
    return;
  }
  if (Array.isArray(govde)) {
    gonder(res, 400, rpcHata(null, -32600, "Toplu istek desteklenmiyor."));
    return;
  }
  const r = rpcAyristir(govde);
  if (!r) {
    gonder(res, 400, rpcHata(null, -32600, "Geçersiz JSON-RPC isteği."));
    return;
  }
  // Bildirim (kimliksiz): yanıt gövdesi yok.
  if (r.id === undefined) {
    res.writeHead(202);
    res.end();
    return;
  }
  const ok = (result: unknown): void => gonder(res, 200, { jsonrpc: "2.0", id: r.id, result });
  switch (r.method) {
    case "initialize": {
      const istenen = r.params.protocolVersion;
      const surum =
        typeof istenen === "string" && (MCP_SURUMLERI as readonly string[]).includes(istenen)
          ? istenen
          : MCP_SURUMLERI[0];
      return ok({
        protocolVersion: surum,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "glix-uretim", title: "GLIX Üretim Merkezi", version: o.surum },
        instructions: `Alanın: ${alanTanimi(k.alan).ad}. Önce talimat_oku, sonra isleri_listele ve geri_bildirim_oku. Dosyaları dosya_yukle ile yükle, on_kontrol ile denetle, teslim_et ile teslim et.`,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: ARACLAR });
    case "tools/call": {
      const ad = r.params.name;
      const args = r.params.arguments === undefined ? {} : r.params.arguments;
      // İç araç: yalnız SSH kanal anahtarı (chroot'taki `uretim` aracı); listede görünmez. Paketi site kendisi okur,
      // böylece yüzlerce dosyalı paket tek istek sayılır.
      if (ad === SSH_PAKET_ARACI && kayit(args)) {
        if (k.kanal !== "ssh" || !o.ssh) {
          gonder(res, 200, rpcHata(r.id, -32602, "Araç adı ya da argümanlar geçersiz."));
          return;
        }
        const paket = typeof args.paket === "string" ? args.paket : "";
        const islem = args.islem === "teslim" ? "teslim" : args.islem === "on_kontrol" ? "on_kontrol" : null;
        try {
          if (!islem) throw new AracHatasi('islem "on_kontrol" ya da "teslim" olmalı.');
          const sonuc = await o.ssh.sshPaket(
            k.alan,
            paket,
            islem,
            args.uretimYontemi,
            { id: k.id, ad: k.ad },
            now,
          );
          return ok({
            content: [{ type: "text", text: JSON.stringify(sonuc) }],
            structuredContent: kayit(sonuc) ? sonuc : { sonuc },
            isError: false,
          });
        } catch (err) {
          const mesaj =
            err instanceof AracHatasi || err instanceof IsHatasi ? err.message : "Paket işlenemedi.";
          return ok({ content: [{ type: "text", text: mesaj }], isError: true });
        }
      }
      if (typeof ad !== "string" || !ARACLAR.some((x) => x.name === ad) || !kayit(args)) {
        gonder(res, 200, rpcHata(r.id, -32602, "Araç adı ya da argümanlar geçersiz."));
        return;
      }
      try {
        const sonuc = await aracCalistir(o.merkez, o.anahtarlar, k, ad, args, now);
        return ok({
          content: [{ type: "text", text: JSON.stringify(sonuc) }],
          structuredContent: kayit(sonuc) ? sonuc : { sonuc },
          isError: false,
        });
      } catch (err) {
        const mesaj =
          err instanceof AracHatasi || err instanceof IsHatasi
            ? err.message
            : "Beklenmeyen bir sorun oldu; biraz sonra yeniden dene.";
        return ok({ content: [{ type: "text", text: mesaj }], isError: true });
      }
    }
    default:
      gonder(res, 200, rpcHata(r.id, -32601, "Bilinmeyen yöntem."));
  }
}
