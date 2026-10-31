/**
 * Oyun sunucusunun Üretim Merkezi uçları (docs/uretim/SOZLESME.md bölüm 3). Site oyuna yalnız bunlarla, iç ağdan ve
 * `GLIX_URETIM_TOKEN` ile gider. Her yanıt biçim olarak doğrulanır; bozuk yanıt hata sayılır.
 */
import { kayit } from "./http.js";

export type OyunFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    redirect: "manual";
    signal: AbortSignal;
  },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface CanliKayit {
  anahtar: string;
  alanlar: Record<string, string>;
  kaynak: "yerlesik" | "panel";
  acik: boolean;
}
export interface CanliHavuz {
  id: string;
  gameId: string;
  label: string;
  fields: unknown[];
  kayitlar: CanliKayit[];
}
export interface Kalip {
  kalip: string;
  tur: string;
  kaynak: string;
}

export class OyunHatasi extends Error {}

export const SATIR_SINIRI = 500;

const str = (v: unknown): v is string => typeof v === "string";
const sayi = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function alanlarMi(v: unknown): v is Record<string, string> {
  return kayit(v) && Object.values(v).every(str);
}

export class OyunIstemcisi {
  constructor(
    private readonly url: string | null,
    private readonly token: string | null,
    private readonly fetchImpl: OyunFetch = fetch as unknown as OyunFetch,
  ) {}

  get acik(): boolean {
    return this.url !== null && this.token !== null;
  }

  private async istek(
    yontem: "GET" | "POST",
    yol: string,
    govde?: unknown,
  ): Promise<Record<string, unknown>> {
    if (!this.url || !this.token) throw new OyunHatasi("Oyun bağlantısı ayarlı değil.");
    let r: Awaited<ReturnType<OyunFetch>>;
    try {
      r = await this.fetchImpl(`${this.url}${yol}`, {
        method: yontem,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(govde === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(govde === undefined ? {} : { body: JSON.stringify(govde) }),
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new OyunHatasi("Oyuna ulaşılamadı.");
    }
    if (r.status === 404) throw new OyunHatasi("Oyunda bu uç kapalı.");
    if (r.status === 429) throw new OyunHatasi("Oyun şu an çok istek alıyor; biraz sonra dene.");
    if (r.status < 200 || r.status >= 300) throw new OyunHatasi("Oyun isteği kabul etmedi.");
    let j: unknown;
    try {
      j = await r.json();
    } catch {
      throw new OyunHatasi("Oyunun yanıtı okunamadı.");
    }
    if (!kayit(j)) throw new OyunHatasi("Oyunun yanıtı beklenen biçimde değil.");
    return j;
  }

  async havuzlar(): Promise<CanliHavuz[]> {
    const j = await this.istek("GET", "/api/uretim/havuzlar");
    if (!Array.isArray(j.havuzlar)) throw new OyunHatasi("Havuz listesi bozuk.");
    const out: CanliHavuz[] = [];
    for (const h of j.havuzlar) {
      if (!kayit(h) || !str(h.id) || !str(h.gameId) || !str(h.label) || !Array.isArray(h.kayitlar)) continue;
      const kayitlar: CanliKayit[] = [];
      for (const k of h.kayitlar) {
        if (!kayit(k) || !str(k.anahtar) || !alanlarMi(k.alanlar) || typeof k.acik !== "boolean") continue;
        kayitlar.push({
          anahtar: k.anahtar,
          alanlar: k.alanlar,
          kaynak: k.kaynak === "panel" ? "panel" : "yerlesik",
          acik: k.acik,
        });
      }
      out.push({
        id: h.id,
        gameId: h.gameId,
        label: h.label,
        fields: Array.isArray(h.fields) ? h.fields : [],
        kayitlar,
      });
    }
    return out;
  }

  private aktarimYaniti(j: Record<string, unknown>): string {
    const id = j.aktarimId;
    if (!(str(id) || sayi(id))) throw new OyunHatasi("Aktarım yanıtı bozuk.");
    return String(id);
  }

  async havuzEkle(
    poolId: string,
    satirlar: Record<string, string>[],
  ): Promise<{ aktarimId: string; eklenen: number; atlanan: { satir: unknown; neden: string }[] }> {
    if (satirlar.length > SATIR_SINIRI) throw new OyunHatasi("Bir aktarımda en çok 500 satır.");
    const j = await this.istek("POST", `/api/uretim/havuzlar/${encodeURIComponent(poolId)}/ekle`, {
      satirlar,
    });
    return {
      aktarimId: this.aktarimYaniti(j),
      eklenen: sayi(j.eklenen) ? j.eklenen : 0,
      atlanan: atlananlar(j.atlanan),
    };
  }

  async havuzKapat(poolId: string, anahtarlar: string[]): Promise<{ aktarimId: string; kapatilan: number }> {
    if (anahtarlar.length > SATIR_SINIRI) throw new OyunHatasi("Bir aktarımda en çok 500 satır.");
    const j = await this.istek("POST", `/api/uretim/havuzlar/${encodeURIComponent(poolId)}/kapat`, {
      anahtarlar,
    });
    return { aktarimId: this.aktarimYaniti(j), kapatilan: sayi(j.kapatilan) ? j.kapatilan : 0 };
  }

  async geriAl(aktarimId: string): Promise<void> {
    const j = await this.istek("POST", `/api/uretim/aktarim/${encodeURIComponent(aktarimId)}/geri-al`, {});
    if (j.ok !== true) throw new OyunHatasi("Geri alma kabul edilmedi.");
  }

  async moderasyon(): Promise<Kalip[]> {
    const j = await this.istek("GET", "/api/uretim/moderasyon");
    if (!Array.isArray(j.kaliplar)) throw new OyunHatasi("Kalıp listesi bozuk.");
    return j.kaliplar.flatMap((k) =>
      kayit(k) && str(k.kalip)
        ? [{ kalip: k.kalip, tur: str(k.tur) ? k.tur : "", kaynak: str(k.kaynak) ? k.kaynak : "" }]
        : [],
    );
  }

  async moderasyonEkle(
    kaliplar: { kalip: string; tur: string }[],
  ): Promise<{ aktarimId: string; eklenen: number; atlanan: { satir: unknown; neden: string }[] }> {
    if (kaliplar.length > SATIR_SINIRI) throw new OyunHatasi("Bir aktarımda en çok 500 satır.");
    const j = await this.istek("POST", "/api/uretim/moderasyon/ekle", { kaliplar });
    return {
      aktarimId: this.aktarimYaniti(j),
      eklenen: sayi(j.eklenen) ? j.eklenen : 0,
      atlanan: atlananlar(j.atlanan),
    };
  }

  async magazaIstatistik(): Promise<{
    donem: string;
    urunler: { id: string; satis: number; kusanan: number; firsatSatis: number }[];
  }> {
    const j = await this.istek("GET", "/api/uretim/magaza/istatistik");
    const urunler = Array.isArray(j.urunler)
      ? j.urunler.flatMap((u) =>
          kayit(u) && str(u.id)
            ? [
                {
                  id: u.id,
                  satis: sayi(u.satis) ? u.satis : 0,
                  kusanan: sayi(u.kusanan) ? u.kusanan : 0,
                  firsatSatis: sayi(u.firsatSatis) ? u.firsatSatis : 0,
                },
              ]
            : [],
        )
      : [];
    return { donem: str(j.donem) ? j.donem : "30g", urunler };
  }

  async saglik(): Promise<{ ok: boolean; revision: string | null }> {
    const j = await this.istek("GET", "/api/uretim/saglik");
    const rev = str(j.revision) && /^[0-9a-f]{7,40}$/i.test(j.revision) ? j.revision : null;
    return { ok: j.ok === true, revision: rev };
  }
}

function atlananlar(v: unknown): { satir: unknown; neden: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((a) => (kayit(a) ? [{ satir: a.satir ?? null, neden: str(a.neden) ? a.neden : "" }] : []));
}
