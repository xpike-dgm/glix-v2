/**
 * Oyunun güncel kataloğu (UM-A4): her saat `URETIM_REPO_DIR` (oyun deposunun salt okunur git aynası) ana dalından
 * katalog dosyaları ve varlık klasörü listeleri okunur, veritabanına kopyalanır. Canlı havuz kayıtları oyunun
 * `GET /api/uretim/havuzlar` ucundan gelir. Git komutları kabuksuz, sabit argümanlarla çalışır.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_POOLS, COSMETIC_ITEMS } from "@glix/engine";
import type { Db } from "./db.js";
import { json } from "./db.js";
import { calistir } from "./medya.js";
import type { AlanId } from "./ortak/alanlar.js";
import type { CanliHavuz, Kalip, OyunIstemcisi } from "./oyun.js";

export const KATALOG_KOKU = "packages/engine/src/katalog/";
/** Listesi tutulan klasörler (ad tekrarı ve "bu yol zaten var" denetimi için). */
export const LISTE_KLASORLERI = [
  "apps/client/public/assets/shop/",
  "apps/client/public/assets/badges/",
  "apps/client/public/assets/cards/",
  "apps/client/public/assets/ikon/",
  "apps/client/public/assets/sus/",
  "apps/client/public/assets/fx/",
  "apps/client/public/assets/ses/",
  "apps/client/public/assets/muzik/",
  "apps/client/public/assets/karakter/",
  "docs/wiki/",
];
/** Oyun kuralları (kanonik) ve oyun ansiklopedisi: Oyun Tasarımı alanının bağlamı. */
export const KURALLAR_YOLU = "docs/KURALLAR.md";
export const WIKI_OYUNLAR = "docs/wiki/oyunlar/";
/** Karakter iskeleti (`glix-parts-1`). */
export const RIG_YOLU = "apps/client/public/assets/karakter/rig.json";
const EN_COK_DOSYA = 2 * 1024 * 1024;

export class Depoayna {
  constructor(private readonly dir: string | null) {}

  get acik(): boolean {
    return this.dir !== null && existsSync(this.dir);
  }

  private args(): string[] {
    if (!this.dir) return [];
    return existsSync(join(this.dir, ".git")) ? ["-C", this.dir] : ["--git-dir", this.dir];
  }

  private async git(args: string[]): Promise<string | null> {
    if (!this.acik) return null;
    const r = await calistir("git", [...this.args(), "-c", "safe.directory=*", ...args]);
    return r.kod === 0 ? r.cikti.toString("utf8") : null;
  }

  /** Ana dalın kimliği (main, yoksa HEAD). */
  async revizyon(): Promise<string | null> {
    for (const ref of ["refs/heads/main", "HEAD"]) {
      const r = await this.git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      if (r && /^[0-9a-f]{40}$/.test(r.trim())) return r.trim();
    }
    return null;
  }

  async listele(rev: string, onek: string): Promise<string[]> {
    if (!/^[0-9a-f]{40}$/.test(rev) || !/^[\w./-]+$/.test(onek) || onek.includes("..")) return [];
    const r = await this.git(["ls-tree", "-r", "--name-only", rev, "--", onek]);
    return r ? r.split("\n").filter((x) => x !== "") : [];
  }

  async oku(rev: string, yol: string): Promise<string | null> {
    if (!/^[0-9a-f]{40}$/.test(rev) || !/^[\w./-]+$/.test(yol) || yol.includes("..")) return null;
    const boy = await this.git(["cat-file", "-s", `${rev}:${yol}`]);
    if (!boy || Number(boy.trim()) > EN_COK_DOSYA) return null;
    return this.git(["show", `${rev}:${yol}`]);
  }

  /** `eski` revizyon `yeni`nin atası mı (ya da aynısı): canlıdaki sürüm paketi içeriyor mu (UM-İ1). */
  async iceriyor(eski: string, yeni: string): Promise<boolean> {
    if (!/^[0-9a-f]{7,40}$/i.test(eski) || !/^[0-9a-f]{7,40}$/i.test(yeni)) return false;
    if (yeni.startsWith(eski) || eski.startsWith(yeni)) return true;
    if (!this.acik) return false;
    const r = await calistir("git", [
      ...this.args(),
      "-c",
      "safe.directory=*",
      "merge-base",
      "--is-ancestor",
      eski,
      yeni,
    ]);
    return r.kod === 0;
  }
}

export class Katalog {
  private canliHavuzlar: { zaman: number; havuzlar: CanliHavuz[] } | null = null;

  constructor(
    private readonly db: Db,
    readonly ayna: Depoayna,
    private readonly oyun: OyunIstemcisi,
  ) {}

  /** Saatlik eşitleme: katalog JSON'ları ve klasör listeleri. Okunan dosya sayısını döner. */
  async esitle(now: number): Promise<number> {
    const rev = await this.ayna.revizyon();
    if (!rev) return 0;
    let n = 0;
    const yaz = (yol: string, icerik: string): void => {
      this.db
        .prepare(
          "INSERT INTO katalog (yol, icerik, revizyon, zaman) VALUES (?, ?, ?, ?) ON CONFLICT(yol) DO UPDATE SET icerik = excluded.icerik, revizyon = excluded.revizyon, zaman = excluded.zaman",
        )
        .run(yol, icerik, rev, now);
      n += 1;
    };
    for (const yol of await this.ayna.listele(rev, KATALOG_KOKU)) {
      if (!yol.endsWith(".json")) continue;
      const icerik = await this.ayna.oku(rev, yol);
      if (icerik !== null) yaz(yol, icerik);
    }
    // Karakter iskeleti: dans ve giysi doğrulayıcıları bunu ister.
    const rig = await this.ayna.oku(rev, RIG_YOLU);
    if (rig !== null) yaz(RIG_YOLU, rig);
    // Oyun Tasarımı (bölüm 15): oyun kuralları ve oyun ansiklopedisi (oyun_katalogu_oku).
    const kurallar = await this.ayna.oku(rev, KURALLAR_YOLU);
    if (kurallar !== null) yaz(KURALLAR_YOLU, kurallar);
    for (const yol of await this.ayna.listele(rev, WIKI_OYUNLAR)) {
      if (!yol.endsWith(".json")) continue;
      const icerik = await this.ayna.oku(rev, yol);
      if (icerik !== null) yaz(yol, icerik);
    }
    for (const k of LISTE_KLASORLERI) yaz(`liste:${k}`, JSON.stringify(await this.ayna.listele(rev, k)));
    return n;
  }

  dosya(yol: string): { icerik: string; revizyon: string; zaman: number } | null {
    return (
      (this.db.prepare("SELECT icerik, revizyon, zaman FROM katalog WHERE yol = ?").get(yol) as
        | { icerik: string; revizyon: string; zaman: number }
        | undefined) ?? null
    );
  }

  /** Oyun deposunda var olan yollar (eşitlenmiş listelerden). */
  varOlanYollar(): Set<string> {
    const out = new Set<string>();
    for (const r of this.db.prepare("SELECT icerik FROM katalog WHERE yol LIKE 'liste:%'").all() as {
      icerik: string;
    }[])
      for (const y of json<string[]>(r.icerik, [])) out.add(y);
    for (const r of this.db.prepare("SELECT yol FROM katalog WHERE yol NOT LIKE 'liste:%'").all() as {
      yol: string;
    }[])
      out.add(r.yol);
    return out;
  }

  /** Mağaza ürünleri: eşitlenmiş `magaza.json` varsa ondan, yoksa motorun yerleşik kataloğundan. */
  magazaUrunleri(): { kaynak: "katalog" | "motor"; urunler: Record<string, unknown>[] } {
    const d = this.dosya(`${KATALOG_KOKU}magaza.json`);
    const j = json<unknown>(d?.icerik, null);
    if (
      j &&
      typeof j === "object" &&
      !Array.isArray(j) &&
      Array.isArray((j as { urunler?: unknown }).urunler)
    )
      return {
        kaynak: "katalog",
        urunler: (j as { urunler: unknown[] }).urunler.filter(
          (u): u is Record<string, unknown> => typeof u === "object" && u !== null,
        ),
      };
    return { kaynak: "motor", urunler: COSMETIC_ITEMS.map((u) => ({ ...u })) };
  }

  /** Canlı havuzlar (5 dk önbellek). Oyun kapalıysa motorun yerleşik havuzları. */
  async havuzlar(now: number): Promise<{ kaynak: "canli" | "yerlesik"; havuzlar: CanliHavuz[] }> {
    if (this.oyun.acik) {
      if (this.canliHavuzlar && now - this.canliHavuzlar.zaman < 5 * 60_000)
        return { kaynak: "canli", havuzlar: this.canliHavuzlar.havuzlar };
      try {
        const h = await this.oyun.havuzlar();
        this.canliHavuzlar = { zaman: now, havuzlar: h };
        return { kaynak: "canli", havuzlar: h };
      } catch {
        // Oyuna ulaşılamazsa yerleşik havuzla denetlenir (rapor bunu belirtir).
      }
    }
    return {
      kaynak: "yerlesik",
      havuzlar: CONTENT_POOLS.map((p) => ({
        id: p.id,
        gameId: p.gameId,
        label: p.label,
        fields: [...p.fields],
        kayitlar: p.builtin.map((e: unknown) => ({
          anahtar: p.key(e),
          alanlar: p.toFields(e),
          kaynak: "yerlesik" as const,
          acik: true,
        })),
      })),
    };
  }

  /** Oyunun yasaklı kelime listesi (oyun kapalıysa boş). */
  async moderasyonListesi(): Promise<Kalip[]> {
    if (!this.oyun.acik) return [];
    return this.oyun.moderasyon();
  }

  havuzOnbellekSil(): void {
    this.canliHavuzlar = null;
  }

  /** Alanın `katalog_oku` yanıtı: yalnız o alanın verisi, kişisel bilgi yok. */
  async alanKatalogu(alan: AlanId, now: number): Promise<Record<string, unknown>> {
    const liste = (onek: string): string[] => json<string[]>(this.dosya(`liste:${onek}`)?.icerik, []);
    const katalogDosyasi = (ad: string): unknown => {
      const d = this.dosya(`${KATALOG_KOKU}${ad}`);
      return d ? json<unknown>(d.icerik, null) : "henüz yok";
    };
    switch (alan) {
      case "magaza": {
        let istatistik: unknown = "henüz yok";
        if (this.oyun.acik)
          try {
            istatistik = await this.oyun.magazaIstatistik();
          } catch {
            istatistik = "şu an alınamadı";
          }
        return { ...this.magazaUrunleri(), istatistik, dosyalar: liste("apps/client/public/assets/shop/") };
      }
      case "icerik": {
        const h = await this.havuzlar(now);
        return {
          kaynak: h.kaynak,
          havuzlar: h.havuzlar.map((p) => ({
            id: p.id,
            ad: p.label,
            alanlar: p.fields,
            kayitlar: p.kayitlar.map((k) => ({ anahtar: k.anahtar, alanlar: k.alanlar, acik: k.acik })),
          })),
        };
      }
      case "moderasyon": {
        let kaliplar: unknown = "henüz yok";
        if (this.oyun.acik)
          try {
            kaliplar = await this.oyun.moderasyon();
          } catch {
            kaliplar = "şu an alınamadı";
          }
        return { kaliplar, wiki: liste("docs/wiki/") };
      }
      case "rozet":
        return {
          katalog: katalogDosyasi("rozetler.json"),
          dosyalar: liste("apps/client/public/assets/badges/"),
        };
      case "kartlar":
        return {
          katalog: katalogDosyasi("kartlar.json"),
          dosyalar: liste("apps/client/public/assets/cards/"),
        };
      case "ikon":
        return {
          katalog: katalogDosyasi("ikonlar.json"),
          dosyalar: [...liste("apps/client/public/assets/ikon/"), ...liste("apps/client/public/assets/sus/")],
        };
      case "efekt":
        return { katalog: katalogDosyasi("efektler.json"), dosyalar: liste("apps/client/public/assets/fx/") };
      case "ses":
        return { katalog: katalogDosyasi("sesler.json"), dosyalar: liste("apps/client/public/assets/ses/") };
      case "muzik":
        return { katalog: katalogDosyasi("muzik.json"), dosyalar: liste("apps/client/public/assets/muzik/") };
      case "test": {
        const { GAMES } = await import("@glix/engine");
        return {
          oyunlar: Object.values(GAMES).map((g) => ({
            id: g.id,
            ad: g.name,
            enAz: g.minPlayers,
            enCok: g.maxPlayers,
          })),
        };
      }
      default:
        return { not: "Bu alanın oyun kataloğu yok; öneri belgeleri teslim edilir." };
    }
  }
}
