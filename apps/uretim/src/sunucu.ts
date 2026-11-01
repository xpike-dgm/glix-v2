/** Sitenin HTTP sunucusu: `/mcp`, `/api/*`, `/saglik` ve derlenmiş arayüz (tek sayfa uygulaması). */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { Anahtarlar } from "./anahtar.js";
import { apiIstek } from "./api.js";
import { Bildirim, yerelZaman } from "./bildirim.js";
import type { UretimConfig } from "./config.js";
import { openDb } from "./db.js";
import { Denetim } from "./denetim.js";
import { Depo } from "./depo.js";
import { Giris, type Postaci, resendPostaci } from "./giris.js";
import { Kasa } from "./gizli.js";
import { GUVENLIK_BASLIKLARI, gonder, sayfaCsp } from "./http.js";
import { type AiFetch, donusturucuKur } from "./istekYaz.js";
import { Depoayna, Katalog } from "./katalog.js";
import { Kosular } from "./kosu.js";
import { mcpIstek } from "./mcp.js";
import { Merkez } from "./merkez.js";
import { eylemdenOlay, OlayYayini } from "./olaylar.js";
import { type OyunFetch, OyunIstemcisi } from "./oyun.js";
import { OyunAlani } from "./oyunAlani.js";
import { canliKontrol } from "./paket.js";
import { SshKanal } from "./sshKanal.js";
import { createWebPush, disabledPush, type PushGateway } from "./webpush.js";
import { yedekAl } from "./yedek.js";

const TURLER: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export interface Bagimliliklar {
  postaci?: Postaci | null;
  oyunFetch?: OyunFetch;
  /** Oyun alanına (test2) giden istek (testlerde sahte); varsayılan `oyunFetch` ya da `fetch`. */
  test2Fetch?: OyunFetch;
  push?: PushGateway;
  now?: () => number;
  sshYetkiDir?: string | null;
  sshKok?: string | null;
  aiFetch?: AiFetch;
}

export interface Uretim {
  server: Server;
  merkez: Merkez;
  anahtarlar: Anahtarlar;
  giris: Giris;
  ssh: SshKanal;
  bildirim: Bildirim;
  katalog: Katalog;
  yayin: OlayYayini;
  oyunAlani: OyunAlani;
  /** Zamanlanmış işleri başlatır (eşitleme, temizlik, yedek, bildirim, gelen klasörü). */
  zamanlayicilariBaslat(): void;
  kapat(): Promise<void>;
}

export function uretimKur(config: UretimConfig, b: Bagimliliklar = {}): Uretim {
  const now = b.now ?? Date.now;
  const db = openDb(config.db);
  const denetim = new Denetim(db);
  const depo = new Depo(config.depoDir, db);
  const oyun = new OyunIstemcisi(config.oyunUrl, config.oyunToken, b.oyunFetch);
  const katalog = new Katalog(db, new Depoayna(config.repoDir), oyun);
  const kasa = new Kasa(config.gizliAnahtar);
  const anahtarlar = new Anahtarlar(db, denetim, kasa);
  let push: PushGateway = b.push ?? disabledPush;
  if (!b.push && config.vapid) {
    try {
      push = createWebPush(config.vapid);
    } catch {
      console.error(JSON.stringify({ seviye: "uyari", olay: "vapid_gecersiz" }));
    }
  }
  const bildirim = new Bildirim(db, push, config.saatDilimi);
  // Giriş nesnesi aşağıda kurulur; akışın oturum denetimi ona geç bağlanır.
  let oturumGecerli: (belirtec: string) => boolean = () => false;
  const yayin = new OlayYayini((b) => oturumGecerli(b));
  denetim.dinle((eylem, hedef, ayrinti) => {
    const t = eylemdenOlay(eylem, ayrinti);
    if (t) yayin.yay(t, hedef);
  });
  const merkez = new Merkez(db, depo, denetim, katalog, oyun, anahtarlar, {
    kirmizi: (m) => {
      yayin.yay("uyari");
      void bildirim.kirmizi(m, now());
    },
    bilgi: (m, url) => void bildirim.bilgi(m, url, now()),
    degisti: (tur, alan) => yayin.yay(tur, alan),
  });
  // Oyun alanı (test2): canlı istemcisinden ayrı adres ve ayrı anahtar (sözleşme bölüm 13).
  const test2 = new OyunIstemcisi(config.test2Url, config.test2Token, b.test2Fetch ?? b.oyunFetch);
  const oyunAlani = new OyunAlani(db, test2, (id) => merkez.oge(id), config.test2PublicUrl, now);
  oyunAlani.depoOku = (ozet) => depo.oku(ozet);
  oyunAlani.degisti = (alan) => yayin.yay("aktarim", alan);
  merkez.oyunAlani = oyunAlani;
  // Test alanının bot koşuları ve bütün alanların oyun alanı odaları (aynı test2 bağlantısı; sözleşme bölüm 14).
  const kosular = new Kosular(db, test2, merkez, now);
  merkez.kosular = kosular;
  const donusturucu = donusturucuKur(db, config.aiKey, {
    ...(b.aiFetch ? { fetch: b.aiFetch } : {}),
    gunluk: config.aiGunluk,
  });
  const postaci =
    b.postaci !== undefined
      ? b.postaci
      : config.resendKey && config.mailFrom
        ? resendPostaci(config.resendKey, config.mailFrom)
        : null;
  const giris = new Giris(db, denetim, config.sahipEpostalar, postaci);
  oturumGecerli = (b) => giris.oturum(b, now()) !== null;
  const ssh = new SshKanal(
    db,
    denetim,
    anahtarlar,
    merkez,
    {
      yetkiDir: b.sshYetkiDir !== undefined ? b.sshYetkiDir : (process.env.URETIM_SSH_YETKI_DIR ?? null),
      kok: b.sshKok !== undefined ? b.sshKok : (process.env.URETIM_SSH_KOK ?? null),
      gunluk: config.sshGunluk,
    },
    kasa,
  );
  const surum = process.env.GIT_SHA ?? "gelistirme";
  const web = resolve(config.webDir);
  const csp = sayfaCsp(config.onizlemeUrl);

  async function statik(req: IncomingMessage, res: ServerResponse, yol: string): Promise<void> {
    let p = resolve(join(web, decodeURIComponent(yol)));
    if (!p.startsWith(web + sep) && p !== web) {
      res.writeHead(404).end();
      return;
    }
    let st = await stat(p).catch(() => null);
    const varlik = yol.startsWith("/assets/");
    if (!st?.isFile()) {
      if (varlik || extname(yol) !== "") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...GUVENLIK_BASLIKLARI });
        res.end("Bulunamadı");
        return;
      }
      p = join(web, "index.html");
      st = await stat(p).catch(() => null);
      if (!st?.isFile()) {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Arayüz derlenmemiş.");
        return;
      }
    }
    const tur = TURLER[extname(p)] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": tur,
      "Content-Length": String(st.size),
      "Cache-Control": varlik ? "public, max-age=31536000, immutable" : "no-cache",
      ...GUVENLIK_BASLIKLARI,
      ...(tur.startsWith("text/html") ? { "Content-Security-Policy": csp, "X-Frame-Options": "DENY" } : {}),
      ...(p.endsWith("sw.js") ? { "Service-Worker-Allowed": "/" } : {}),
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(p).pipe(res);
  }

  const server = createServer((req, res) => {
    const yol = (req.url ?? "/").split("?")[0] ?? "/";
    const is = async (): Promise<void> => {
      if (yol === "/mcp")
        return mcpIstek(req, res, { merkez, anahtarlar, ssh, publicUrl: config.publicUrl, surum, now });
      if (yol === "/saglik") return gonder(res, 200, { ok: true, surum });
      if (yol.startsWith("/api/"))
        return apiIstek(req, res, {
          config,
          merkez,
          giris,
          anahtarlar,
          denetim,
          bildirim,
          ssh,
          donusturucu,
          yayin,
          oyunAlani,
          surum,
          now,
        });
      if (req.method !== "GET" && req.method !== "HEAD") return gonder(res, 405, { ok: false });
      return statik(req, res, yol === "/" ? "/index.html" : yol);
    };
    is().catch((err: unknown) => {
      console.error(JSON.stringify({ seviye: "hata", olay: "istek", hata: String(err).slice(0, 300) }));
      if (!res.headersSent) gonder(res, 500, { ok: false, mesaj: "Beklenmeyen bir sorun oldu." });
      else res.end();
    });
  });
  server.requestTimeout = 300_000;

  const zamanlayicilar: NodeJS.Timeout[] = [];
  const guvenli = (ad: string, f: () => Promise<unknown>) => () => {
    f().catch((err: unknown) =>
      console.error(JSON.stringify({ seviye: "hata", olay: ad, hata: String(err).slice(0, 300) })),
    );
  };
  let sonYedek = "";
  return {
    server,
    merkez,
    anahtarlar,
    giris,
    ssh,
    bildirim,
    katalog,
    yayin,
    oyunAlani,
    zamanlayicilariBaslat() {
      const esitle = guvenli("esitleme", () => katalog.esitle(now()));
      esitle();
      zamanlayicilar.push(setInterval(esitle, 3600_000));
      zamanlayicilar.push(
        setInterval(
          guvenli("canli", () => canliKontrol(merkez, now())),
          10 * 60_000,
        ),
      );
      zamanlayicilar.push(
        setInterval(
          guvenli("temizlik", async () => {
            await depo.temizle(now());
            denetim.temizle(now());
            giris.temizle(now());
          }),
          6 * 3600_000,
        ),
      );
      zamanlayicilar.push(
        setInterval(
          guvenli("dakika", async () => {
            await ssh.gelenTara(now());
            await ssh.parolalariYenile(now());
            for (const b of merkez.baslamayanlar(now()))
              await bildirim.bilgi(
                `${b.sayi} iş bekliyor — istemi kopyala`,
                `/alan/${b.alan}?sekme=isler`,
                now(),
              );
            const p = merkez.pano(now(), { kullanilan: depo.kullanilan(), sinir: config.kota });
            const bekleyen = p.alanlar.reduce((t, a) => t + a.bekleyen, 0);
            await bildirim.tik(
              now(),
              () =>
                `${bekleyen} teslim bekliyor, ${p.istekKartlari.length} istek kartı, onaylananlar ${p.havuz.toplam}.`,
            );
            const z = yerelZaman(now(), config.saatDilimi);
            if (config.yedekDir && z.dakika >= 3 * 60 && z.dakika < 3 * 60 + 30 && sonYedek !== z.tarih) {
              sonYedek = z.tarih;
              await yedekAl(db, depo, config.yedekDir, z.tarih);
            }
          }),
          60_000,
        ),
      );
      zamanlayicilar.push(
        setInterval(
          guvenli("okunur", () => ssh.okunurTazele(now())),
          5 * 60_000,
        ),
      );
      // Oyun alanı (test2): sağlık, gece sıfırlaması algılama ve bekleyen yüklemeler (5 dakikada bir).
      if (oyunAlani.acik) {
        const t2 = guvenli("oyun_alani", () => oyunAlani.esitle());
        t2();
        zamanlayicilar.push(setInterval(t2, 5 * 60_000));
        // Bot koşuları: süreni izle (bitince rapor teslimi), dönemli planı başlat.
        zamanlayicilar.push(
          setInterval(
            guvenli("kosu", async () => {
              await kosular.esitle();
              await kosular.planDenetle();
            }),
            60_000,
          ),
        );
      }
    },
    async kapat() {
      for (const z of zamanlayicilar) clearInterval(z);
      yayin.kapat();
      await oyunAlani.bosalt();
      await new Promise<void>((r) => server.close(() => r()));
      server.closeAllConnections();
      db.close();
    },
  };
}
