/**
 * Bildirimler (UM-U7): oyunla aynı web-push altyapısı (VAPID + aes128gcm, paketsiz). Kırmızı uyarı hemen gider
 * (sessiz saatteyse sessiz saat bitince); günlük özet ayarlanan saatte bir kez. Bildirimde gizli bilgi yoktur.
 */
import type { Db } from "./db.js";
import { json } from "./db.js";
import { kayit } from "./http.js";
import { isAllowedPushEndpoint, type PushGateway, type PushTarget } from "./webpush.js";

export interface BildirimAyari {
  acik: boolean;
  ozetSaati: string;
  sessizBas: string;
  sessizSon: string;
}

export const VARSAYILAN_AYAR: BildirimAyari = {
  acik: true,
  ozetSaati: "09:00",
  sessizBas: "23:00",
  sessizSon: "08:00",
};
const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ayarAyristir(v: unknown): BildirimAyari | null {
  if (!kayit(v) || typeof v.acik !== "boolean") return null;
  const s = [v.ozetSaati, v.sessizBas, v.sessizSon];
  if (!s.every((x) => typeof x === "string" && SAAT.test(x))) return null;
  return {
    acik: v.acik,
    ozetSaati: v.ozetSaati as string,
    sessizBas: v.sessizBas as string,
    sessizSon: v.sessizSon as string,
  };
}

const dk = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

export function yerelZaman(now: number, saatDilimi: string): { tarih: string; dakika: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: saatDilimi,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(now))
      .map((x) => [x.type, x.value]),
  );
  return { tarih: `${p.year}-${p.month}-${p.day}`, dakika: Number(p.hour) * 60 + Number(p.minute) };
}

export function sessizMi(dakika: number, a: BildirimAyari): boolean {
  const bas = dk(a.sessizBas);
  const son = dk(a.sessizSon);
  return bas <= son ? dakika >= bas && dakika < son : dakika >= bas || dakika < son;
}

export function aboneAyristir(v: unknown): PushTarget | null {
  if (!kayit(v) || typeof v.endpoint !== "string" || !kayit(v.keys)) return null;
  const { p256dh, auth } = v.keys;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (
    !isAllowedPushEndpoint(v.endpoint) ||
    v.endpoint.length > 1000 ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]{16,30}$/.test(auth)
  )
    return null;
  return { endpoint: v.endpoint, p256dh, auth };
}

export class Bildirim {
  constructor(
    private readonly db: Db,
    private readonly push: PushGateway,
    private readonly saatDilimi: string,
  ) {}

  get acik(): boolean {
    return this.push.enabled;
  }

  get publicKey(): string | null {
    return this.push.publicKey;
  }

  ayar(): BildirimAyari {
    const r = this.db.prepare("SELECT deger FROM ayar WHERE anahtar = 'bildirim'").get() as
      | { deger: string }
      | undefined;
    return ayarAyristir(json<unknown>(r?.deger, null)) ?? VARSAYILAN_AYAR;
  }

  ayarYaz(a: BildirimAyari): void {
    this.db
      .prepare(
        "INSERT INTO ayar (anahtar, deger) VALUES ('bildirim', ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger",
      )
      .run(JSON.stringify(a));
  }

  abone(t: PushTarget, now: number): void {
    this.db
      .prepare(
        "INSERT INTO abonelik (endpoint, p256dh, auth, olusturma) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth",
      )
      .run(t.endpoint, t.p256dh, t.auth, now);
  }

  birak(endpoint: string): void {
    this.db.prepare("DELETE FROM abonelik WHERE endpoint = ?").run(endpoint);
  }

  aboneSayisi(): number {
    return Number((this.db.prepare("SELECT COUNT(*) AS n FROM abonelik").get() as { n: number }).n);
  }

  private async herkese(baslik: string, govde: string, etiket: string, url = "/"): Promise<void> {
    if (!this.push.enabled) return;
    const yuk = JSON.stringify({ title: baslik, body: govde, tag: etiket, url });
    const ab = this.db
      .prepare("SELECT endpoint, p256dh, auth FROM abonelik")
      .all() as unknown as PushTarget[];
    await Promise.all(
      ab.map(async (t) => {
        const r = await this.push.send(t, yuk);
        if (r === "gone") this.birak(t.endpoint);
      }),
    );
  }

  /** Kırmızı uyarı: sessiz saatte kuyruğa, değilse hemen. */
  async kirmizi(metin: string, now: number): Promise<void> {
    const a = this.ayar();
    if (!a.acik) return;
    if (sessizMi(yerelZaman(now, this.saatDilimi).dakika, a)) {
      const k = this.kuyruk();
      k.push(metin);
      this.db
        .prepare(
          "INSERT INTO ayar (anahtar, deger) VALUES ('kirmizi_kuyruk', ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger",
        )
        .run(JSON.stringify(k.slice(-20)));
      return;
    }
    await this.herkese("Üretim Merkezi: acil uyarı", metin, "kirmizi");
  }

  private kuyruk(): string[] {
    const r = this.db.prepare("SELECT deger FROM ayar WHERE anahtar = 'kirmizi_kuyruk'").get() as
      | { deger: string }
      | undefined;
    return json<string[]>(r?.deger, []);
  }

  /** Dakikalık tik: kuyruktaki kırmızıları ve günlük özeti gönderir. Özet metni çağırandan gelir. */
  async tik(now: number, ozet: () => string): Promise<void> {
    const a = this.ayar();
    if (!a.acik) return;
    const z = yerelZaman(now, this.saatDilimi);
    if (sessizMi(z.dakika, a)) return;
    const k = this.kuyruk();
    if (k.length) {
      this.db.prepare("DELETE FROM ayar WHERE anahtar = 'kirmizi_kuyruk'").run();
      await this.herkese(
        "Üretim Merkezi: acil uyarı",
        k.length === 1 ? (k[0] ?? "") : `${k.length} uyarı: ${k.slice(0, 3).join(" · ")}`,
        "kirmizi",
      );
    }
    const son = this.db.prepare("SELECT deger FROM ayar WHERE anahtar = 'son_ozet'").get() as
      | { deger: string }
      | undefined;
    if (z.dakika >= dk(a.ozetSaati) && son?.deger !== z.tarih) {
      this.db
        .prepare(
          "INSERT INTO ayar (anahtar, deger) VALUES ('son_ozet', ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger",
        )
        .run(z.tarih);
      await this.herkese("Üretim Merkezi: günün özeti", ozet(), "ozet");
    }
  }

  async dene(): Promise<void> {
    await this.herkese(
      "Üretim Merkezi",
      "Bildirimler açık. Acil uyarılar ve günlük özet buraya gelecek.",
      "deneme",
    );
  }
}
