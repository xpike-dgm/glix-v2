/**
 * MCP ucu (UM-G2): Streamable HTTP üzerinden JSON-RPC 2.0, yeni bağımlılık olmadan. Yalnız `initialize`, `ping`,
 * `tools/list`, `tools/call` ve bildirimler. Kimlik `Authorization: Bearer <alan anahtarı>`; her araç yalnız o alanın
 * verisini görür. Yanıt her zaman tek JSON gövdesidir (akış gerekmez; spec buna izin verir). Dosya sistemi ya da
 * kabuk erişimi veren hiçbir araç yoktur.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnahtarKimligi, Anahtarlar } from "./anahtar.js";
import { GovdeHatasi, gonder, govdeOku, kayit, metin, tamsayi, tarih } from "./http.js";
import { IsHatasi, type Merkez } from "./merkez.js";
import { alanTanimi, isAlanId } from "./ortak/alanlar.js";
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
const teslimSemasi = {
  type: "object",
  required: ["tur", "ogeler"],
  properties: {
    isId: { type: "integer", description: "Bağlı iş (isleri_listele)" },
    tur: {
      type: "string",
      enum: ["yeni", "duzenleme", "kaldirma-onerisi", "rapor", "fikir"],
      description: "fikir: yalnız metin (ad, aciklama, gorunus, gerekce); fikir turu açık işlerde önce bu",
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
          rapor: { type: "object" },
          gorunus: { type: "string", maxLength: 600, description: "Fikirde: nasıl görünecek, renk, hareket" },
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
  const kim = `yz:${k.alan}`;
  const alan = k.alan;
  switch (ad) {
    case "talimat_oku": {
      const t = m.yzTalimati(alan, now);
      return { alan, alanAdi: alanTanimi(alan).ad, surum: t.surum, metin: t.metin };
    }
    case "isleri_listele":
      return { isler: m.isler(alan, ["acik"]).map(({ alan: _a, ...i }) => i) };
    case "is_oku": {
      const id = tamsayi(args.id, 1, 1e12);
      const is = id ? m.is(id, alan) : null;
      if (!is) throw new AracHatasi("Bu iş bulunamadı.");
      return is;
    }
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
      const r = await m.teslimEt(alan, "mcp", k.id, p.deger, ad === "on_kontrol", now, kim);
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

export interface McpOrtami {
  merkez: Merkez;
  anahtarlar: Anahtarlar;
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
  const k = o.anahtarlar.dogrula(bearer, now);
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
