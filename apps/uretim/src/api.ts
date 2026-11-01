/**
 * Sahip arayüzünün uçları (`/api/...`). Okuma GET, yazma POST. Her yazma isteği: geçerli oturum çerezi + CSRF
 * denetimi (Origin + `X-Uretim: 1`). Bütün girdiler doğrulanır; hatalar kısa ve Türkçe.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Anahtarlar } from "./anahtar.js";
import type { Bildirim } from "./bildirim.js";
import { aboneAyristir, ayarAyristir } from "./bildirim.js";
import type { UretimConfig } from "./config.js";
import type { Denetim } from "./denetim.js";
import { BOYUT_SINIRI, MIME } from "./dosya.js";
import { type Giris, OTURUM_CEREZI, oturumCerezi } from "./giris.js";
import {
  cerezOku,
  GovdeHatasi,
  gonder,
  govdeOku,
  guvenliIstek,
  hata,
  idParam,
  istemciIp,
  jsonOku,
  kayit,
  kaynakUygun,
  metin,
  tamsayi,
  tarih,
} from "./http.js";
import { type Donusturucu, istemDoldur, istemUret } from "./istekYaz.js";
import { IsHatasi, type Merkez } from "./merkez.js";
import { ALANLAR, type AlanId, alanTanimi, isAlanId } from "./ortak/alanlar.js";
import { isDurum, isHazirNot } from "./ortak/durum.js";
import { canliKontrol, paketler, paketOlustur, paketOyunaEklendi } from "./paket.js";
import type { SshKanal } from "./sshKanal.js";
import { teslimAyristir } from "./teslimGirdisi.js";

export interface ApiOrtami {
  config: UretimConfig;
  merkez: Merkez;
  giris: Giris;
  anahtarlar: Anahtarlar;
  denetim: Denetim;
  bildirim: Bildirim;
  ssh: SshKanal;
  donusturucu: Donusturucu;
  surum: string;
  now(): number;
}

const JSON_SINIRI = 1024 * 1024;

/**
 * IP başına giriş denemesi sınırı (bellekte, kısa pencere): dakikada 10. Sayaç dolunca hepsi silinmez (saldırgan çok
 * IP ile sayaçları sıfırlayamasın): en uzun süredir dokunulmayan IP düşer. Kalıcı sınırlar (kod sayısı, deneme)
 * veritabanındadır.
 */
const girisSayaci = new Map<string, number[]>();
export const GIRIS_SAYACI_SINIRI = 5000;
export function girisIzni(ip: string, now: number): boolean {
  const p = (girisSayaci.get(ip) ?? []).filter((t) => now - t < 60_000);
  girisSayaci.delete(ip);
  if (p.length >= 10) {
    girisSayaci.set(ip, p);
    return false;
  }
  p.push(now);
  girisSayaci.set(ip, p);
  while (girisSayaci.size > GIRIS_SAYACI_SINIRI) {
    const en = girisSayaci.keys().next().value;
    if (en === undefined) break;
    girisSayaci.delete(en);
  }
  return true;
}

type Yanit = (durum: number, govde: unknown, ek?: Record<string, string | string[]>) => void;

export async function apiIstek(req: IncomingMessage, res: ServerResponse, o: ApiOrtami): Promise<void> {
  const url = new URL(req.url ?? "/", "http://x");
  const yol = url.pathname.replace(/^\/api\//, "");
  const now = o.now();
  const yaz = req.method === "POST";
  if (req.method !== "GET" && !yaz) return hata(res, 405, "yontem", "Yöntem desteklenmiyor.");
  if (yaz && !kaynakUygun(req, o.config.publicUrl))
    return hata(res, 403, "kaynak", "İstek reddedildi. Sayfayı yenileyip yeniden dene.");
  if (
    yaz &&
    yol !== "yukle" &&
    !String(req.headers["content-type"] ?? "")
      .toLowerCase()
      .startsWith("application/json")
  )
    return hata(res, 415, "tur", "JSON bekleniyor.");
  const ok: Yanit = (d, g, ek) => gonder(res, d, g, ek);
  try {
    const belirtec = cerezOku(req.headers.cookie, OTURUM_CEREZI);
    const eposta = o.giris.oturum(belirtec, now);

    // ---- Girişsiz uçlar
    if (yol === "oturum" && !yaz)
      return ok(200, {
        giris: eposta !== null,
        eposta,
        vapid: o.bildirim.publicKey,
        onizlemeUrl: o.config.onizlemeUrl,
        sshAcik: o.ssh.acik,
        oyunAcik: o.merkez.oyun.acik,
        mcpUrl: `${o.config.publicUrl}/mcp`,
        gorunenAd: eposta ? (o.merkez.ayar(`gorunen_ad:${eposta}`) ?? "") : "",
        saatDilimi: o.config.saatDilimi,
        sshSunucu: o.config.sshSunucu,
        surum: o.surum,
      });
    if (yol === "giris/kod" && yaz) {
      if (!girisIzni(istemciIp(req, o.config.trustProxy), now))
        return hata(res, 429, "cok_istek", "Çok fazla deneme. Bir dakika sonra yeniden dene.");
      const b = await jsonOku(req, 2048);
      const e = kayit(b) && typeof b.eposta === "string" ? b.eposta.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(e) || e.length > 254)
        return hata(res, 400, "eposta", "Geçerli bir e-posta adresi yaz.");
      const r = await o.giris.kodIste(e, now);
      if (r === "erken") return hata(res, 429, "erken", "Yeni kod için bir dakika bekle.");
      if (r === "posta_yok")
        return hata(res, 503, "posta_yok", "E-posta gönderimi ayarlı değil; yöneticiye haber ver.");
      if (r === "posta_hatasi")
        return hata(res, 502, "posta_hatasi", "Kod e-postası gönderilemedi. Biraz sonra yeniden dene.");
      // İzinsiz adres de aynı yanıtı alır (adres listesi dışarı sızmaz).
      return ok(200, { ok: true, sureSn: 600 });
    }
    if (yol === "giris/dogrula" && yaz) {
      if (!girisIzni(istemciIp(req, o.config.trustProxy), now))
        return hata(res, 429, "cok_istek", "Çok fazla deneme. Bir dakika sonra yeniden dene.");
      const b = await jsonOku(req, 2048);
      if (!kayit(b) || typeof b.eposta !== "string" || typeof b.kod !== "string" || !/^\d{6}$/.test(b.kod))
        return hata(res, 400, "kod", "Altı haneli kodu yaz.");
      const r = o.giris.dogrula(b.eposta.trim().toLowerCase(), b.kod, b.guvenilir === true, now);
      if (!r.ok) {
        const m = {
          hatali: "Kod hatalı. Yeniden dene.",
          kilitli: "Çok fazla hatalı deneme. Yeni kod iste.",
          suresi_doldu: "Kodun süresi doldu. Yeni kod iste.",
        }[r.neden];
        return hata(res, r.neden === "kilitli" ? 429 : 400, r.neden, m);
      }
      return ok(
        200,
        { ok: true },
        { "Set-Cookie": oturumCerezi(r.belirtec, r.sure, guvenliIstek(req, o.config.trustProxy)) },
      );
    }
    if (yol === "cikis" && yaz) {
      if (belirtec) o.giris.cikis(belirtec, now);
      return ok(
        200,
        { ok: true },
        { "Set-Cookie": oturumCerezi("", 0, guvenliIstek(req, o.config.trustProxy)) },
      );
    }

    if (!eposta) return hata(res, 401, "giris", "Oturumun kapandı. Yeniden giriş yap.");
    const kim = eposta;
    const m = o.merkez;

    // Dosya yükleme (elle, ham gövde): /api/yukle?alan=...&ad=...
    if (yol === "yukle" && yaz) {
      const alan = url.searchParams.get("alan");
      const ad = url.searchParams.get("ad");
      if (!isAlanId(alan) || !ad) return hata(res, 400, "girdi", "Alan ve dosya adı gerekli.");
      const veri = await govdeOku(req, BOYUT_SINIRI.ses + 1024);
      return ok(200, await m.yukle(alan, null, ad, veri, now));
    }

    const govde = async (): Promise<Record<string, unknown>> => {
      const b = await jsonOku(req, JSON_SINIRI);
      if (!kayit(b)) throw new IsHatasi(400, "İstek gövdesi nesne olmalı.");
      return b;
    };
    const parca = yol.split("/");
    const [p0, p1, p2, p3] = parca;

    if (!yaz) {
      switch (yol) {
        case "pano":
          return ok(
            200,
            m.pano(
              now,
              { kullanilan: m.depo.kullanilan(), sinir: o.config.kota },
              { acik: o.donusturucu.acik, ...o.donusturucu.kullanim(now) },
            ),
          );
        case "alanlar":
          return ok(200, { alanlar: ALANLAR });
        case "kuyruk": {
          const alan = url.searchParams.get("alan");
          return ok(200, { ogeler: m.bekleyenler(isAlanId(alan) ? alan : null) });
        }
        case "arsiv": {
          const alan = url.searchParams.get("alan");
          const durum = url.searchParams.get("durum");
          const t1 = url.searchParams.get("tarihten");
          const t2 = url.searchParams.get("tarihe");
          return ok(
            200,
            m.arsiv({
              alan: isAlanId(alan) ? alan : null,
              ad: metin(url.searchParams.get("ad") ?? "", 0, 60) || null,
              durum: isDurum(durum) ? durum : null,
              tarihten: tarih(t1) ? Date.parse(t1 ?? "") : null,
              tarihe: tarih(t2) ? Date.parse(t2 ?? "") + 24 * 3600 * 1000 - 1 : null,
              sayfa: Number(url.searchParams.get("sayfa") ?? "0") || 0,
            }),
          );
        }
        case "paketler":
          return ok(200, { paketler: paketler(m) });
        case "aktarimlar":
          return ok(200, { aktarimlar: m.aktarimlar() });
        case "istek-kartlari":
          return ok(200, { kartlar: m.istekKartlari(null) });
        case "kod-istekleri":
          return ok(200, { istekler: m.kodIstekleri(null) });
        case "denetim":
          return ok(200, { kayitlar: o.denetim.sayfa(idParam(url.searchParams.get("onceki")), 100) });
        case "bildirim/ayar":
          return ok(200, { ayar: o.bildirim.ayar(), acik: o.bildirim.acik, abone: o.bildirim.aboneSayisi() });
        case "raporlar":
          return ok(200, { raporlar: raporlar(m) });
        case "ara":
          return ok(200, ara(m, url.searchParams.get("q") ?? ""));
        case "canlidakiler": {
          const alan = url.searchParams.get("alan");
          return ok(200, { ogeler: m.canlidakiler(isAlanId(alan) ? alan : null) });
        }
        default:
          break;
      }
      if (p0 === "alan" && isAlanId(p1) && p2 === undefined)
        return ok(200, {
          ...m.alanSayfasi(p1, now),
          ssh: o.ssh.liste(p1),
          sshAcik: o.ssh.acik,
          sshParola: o.ssh.parolaDurumu(p1),
          parolaAcik: o.ssh.parolaAcik,
          girisler: await o.ssh.girisler(p1),
        });
      if (p0 === "alan" && isAlanId(p1) && p2 === "talimat" && p3) {
        const s = idParam(p3);
        const t = s ? m.talimatSurumu(p1, s) : null;
        return t ? ok(200, t) : hata(res, 404, "yok", "Bu sürüm bulunamadı.");
      }
      if (p0 === "alan" && isAlanId(p1) && p2 === "istem") {
        const b = url.searchParams.get("baglanti") === "ssh" ? "ssh" : "mcp";
        const isId = idParam(url.searchParams.get("is"));
        const { mcp, ssh } = istemSablonlari(m, p1, isId);
        // Ekranda sırlar •••• görünür; açık hâli yalnız "Kopyala"da (POST istem-kopyala).
        const gorunum = (t: string): string =>
          istemDoldur(t, {
            "{{SSH_ADRES}}": o.config.sshSunucu,
            "{{SSH_KULLANICI}}": `uretim-${p1}`,
            "{{SSH_PAROLA}}": "••••",
            "{{MCP_ADRES}}": `${o.config.publicUrl}/mcp`,
            "{{MCP_ANAHTAR}}": "••••",
          });
        const istemler = { mcp: gorunum(mcp), ssh: gorunum(ssh) };
        return ok(200, {
          istem: istemler[b],
          istemler,
          sablonlar: { mcp, ssh },
          isSayisi: m.isler(p1, ["acik"]).length,
          uygulama: m.ayar(`uygulama:${p1}`) ?? "",
        });
      }
      if (p0 === "alan" && isAlanId(p1) && p2 === "zevk")
        return ok(200, { ornekler: m.zevkGalerisi(p1), talimatEki: m.zevkBolumu(p1) });
      if (p0 === "is" && p1 && (p2 === "fikirler" || p2 === "varyantlar")) {
        const id = idParam(p1);
        if (!id) return hata(res, 404, "yok", "İş bulunamadı.");
        return ok(200, { is: m.is(id), ogeler: p2 === "fikirler" ? m.fikirler(id) : m.varyantlar(id) });
      }
      if (p0 === "oge" && p1) {
        const id = idParam(p1);
        const oge = id ? m.oge(id) : null;
        if (!oge || !id) return hata(res, 404, "yok", "Teslim bulunamadı.");
        if (p2 === undefined) {
          const onceki = oge.oncekiId ? m.oge(oge.oncekiId) : null;
          return ok(200, { oge, onceki, tekTik: m.tekTikMi(oge) });
        }
        if (p2 === "dosya" && p3) return dosyaGonder(res, m, id, p3);
      }
      return hata(res, 404, "yok", "Bulunamadı.");
    }

    // ---- Yazma uçları
    if (p0 === "oge" && p1) {
      const id = idParam(p1);
      if (!id) return hata(res, 404, "yok", "Teslim bulunamadı.");
      switch (p2) {
        case "karar": {
          const b = await govde();
          const k = b.karar;
          if (k !== "onay" && k !== "ret" && k !== "duzeltme")
            return hata(res, 400, "girdi", "Karar onay, ret ya da düzeltme olmalı.");
          const hazir =
            b.hazir === undefined || b.hazir === null ? null : isHazirNot(b.hazir) ? b.hazir : undefined;
          if (hazir === undefined) return hata(res, 400, "girdi", "Hazır not tanınmadı.");
          const not = b.metin === undefined ? "" : metin(b.metin, 0, 1000);
          if (not === null) return hata(res, 400, "girdi", "Not en çok 1000 karakter.");
          let satirlar: number[] | null = null;
          if (b.satirlar !== undefined && b.satirlar !== null) {
            if (
              !Array.isArray(b.satirlar) ||
              b.satirlar.length > 500 ||
              !b.satirlar.every((x) => tamsayi(x, 0, 499) !== null)
            )
              return hata(res, 400, "girdi", "Satır seçimi geçersiz.");
            satirlar = b.satirlar as number[];
          }
          return ok(200, { oge: m.karar(id, k, { hazir, metin: not, satirlar }, kim, now) });
        }
        case "geri-al":
          return ok(200, { oge: m.kararGeriAl(id, kim, now) });
        case "benzer": {
          const b = await govde();
          const adet = tamsayi(b.adet, 1, 50);
          const fark = b.fark === undefined ? "" : metin(b.fark, 0, 500);
          if (!adet || fark === null) return hata(res, 400, "girdi", "Adet 1–50, fark en çok 500 karakter.");
          return ok(200, { is: m.benzeriniUret(id, adet, fark, kim, now) });
        }
        case "aktar":
          return ok(200, { aktarimlar: await m.aktar(id, kim, now) });
        case "denetim": {
          const b = await govde();
          const not = metin(b.metin ?? "", 0, 1000);
          if (typeof b.uygun !== "boolean" || not === null)
            return hata(res, 400, "girdi", "Denetim kararı geçersiz.");
          m.denetimKarar(id, b.uygun, not, kim, now);
          return ok(200, { ok: true });
        }
        case "fikir-sec": {
          const b = await govde();
          const not = metin(b.not ?? "", 0, 600);
          if (not === null) return hata(res, 400, "girdi", "Not en çok 600 karakter.");
          m.fikirSec(id, not, kim, now);
          return ok(200, { ok: true });
        }
        default:
          return hata(res, 404, "yok", "Bulunamadı.");
      }
    }
    if (yol === "toplu-karar") {
      const b = await govde();
      if (
        b.karar !== "onay" ||
        !Array.isArray(b.idler) ||
        b.idler.length > 200 ||
        !b.idler.every((x) => tamsayi(x, 1, 1e12) !== null)
      )
        return hata(res, 400, "girdi", "Toplu işlemde yalnız onay yapılır (en çok 200).");
      const sonuc: { id: number; ok: boolean; mesaj?: string }[] = [];
      for (const id of b.idler as number[]) {
        try {
          m.karar(id, "onay", { hazir: null, metin: "", satirlar: null }, kim, now);
          sonuc.push({ id, ok: true });
        } catch (err) {
          sonuc.push({ id, ok: false, mesaj: err instanceof IsHatasi ? err.message : "Onaylanamadı." });
        }
      }
      return ok(200, { sonuc });
    }
    if (yol === "istek-yaz") {
      const b = await govde();
      const metinH = metin(b.metin, 5, 2000);
      const sonTarih =
        b.sonTarih === undefined || b.sonTarih === null || b.sonTarih === "" ? null : tarih(b.sonTarih);
      if (
        !metinH ||
        !isAlanId(b.alan) ||
        (b.baglanti !== "mcp" && b.baglanti !== "ssh") ||
        (b.sonTarih && !sonTarih)
      )
        return hata(res, 400, "girdi", "İsteğini birkaç kelimeyle yaz ve alanı seç.");
      return ok(
        200,
        await o.donusturucu.taslak(
          { metin: metinH, alan: b.alan, baglanti: b.baglanti, fikirTuru: b.fikirTuru === true, sonTarih },
          now,
        ),
      );
    }
    if (yol === "elle-teslim") {
      const b = await govde();
      const alan = b.alan;
      if (!isAlanId(alan)) return hata(res, 400, "girdi", "Alan seç.");
      const { alan: _a, ...girdi } = b;
      const p = teslimAyristir(girdi, alanTanimi(alan));
      if (!p.ok) return hata(res, 400, "girdi", p.hatalar.join(" "));
      return ok(200, await m.teslimEt(alan, "elle", null, p.deger, false, now, kim));
    }
    if (p0 === "alan" && isAlanId(p1)) return await alanYaz(res, o, p1, parca.slice(2), govde, kim, now);
    if (p0 === "is" && p1 && p2 === "varyant-sec") {
      const id = idParam(p1);
      const b = await govde();
      const ogeId = tamsayi(b.ogeId, 1, 1e12);
      const karisim = metin(b.karisim ?? "", 0, 600);
      if (!id || !ogeId || karisim === null) return hata(res, 400, "girdi", "Seçim geçersiz.");
      m.varyantSec(id, ogeId, karisim, kim, now);
      return ok(200, { ok: true });
    }
    if (p0 === "zevk" && p1) {
      const id = idParam(p1);
      const b = await govde();
      if (!id) return hata(res, 404, "yok", "Örnek bulunamadı.");
      m.zevkDuzenle(
        id,
        {
          ...(typeof b.onemli === "boolean" ? { onemli: b.onemli } : {}),
          ...(b.cikar === true ? { cikar: true } : {}),
        },
        kim,
        now,
      );
      return ok(200, { ok: true });
    }
    if (p0 === "is" && p1 && p2 === "kilit-ac") {
      const id = idParam(p1);
      if (!id) return hata(res, 404, "yok", "İş bulunamadı.");
      m.kilitAc(id, kim, now);
      return ok(200, { ok: true });
    }
    if (yol === "profil") {
      const b = await govde();
      const ad = metin(b.gorunenAd ?? "", 0, 40);
      if (ad === null) return hata(res, 400, "girdi", "Ad en çok 40 karakter.");
      m.ayarYaz(`gorunen_ad:${kim}`, ad);
      return ok(200, { ok: true });
    }
    if (p0 === "is" && p1 && p2 === "durum") {
      const id = idParam(p1);
      const b = await govde();
      const d = b.durum;
      if (!id || (d !== "acik" && d !== "tamam" && d !== "iptal"))
        return hata(res, 400, "girdi", "İş durumu geçersiz.");
      m.isDurum(id, d, kim, now);
      return ok(200, { ok: true });
    }
    if (p0 === "istek" && p1 && p2 === "karar") {
      const id = idParam(p1);
      const b = await govde();
      if (!id || typeof b.onay !== "boolean") return hata(res, 400, "girdi", "Karar geçersiz.");
      return ok(200, { kart: m.istekKartiKarar(id, b.onay, kim, now) });
    }
    if (p0 === "kod-istegi" && p1 && p2 === "durum") {
      const id = idParam(p1);
      const b = await govde();
      const d = b.durum;
      if (!id || (d !== "onaylandi" && d !== "reddedildi" && d !== "yapildi"))
        return hata(res, 400, "girdi", "Durum geçersiz.");
      m.kodIstegiDurum(id, d, kim, now);
      return ok(200, { ok: true });
    }
    if (p0 === "rapor" && p1 && p2 === "duzelt") {
      const id = idParam(p1);
      const oge = id ? m.oge(id) : null;
      const b = await govde();
      const baslik = metin(b.baslik, 3, 120);
      const aciklama = metin(b.aciklama ?? "", 0, 2000);
      if (!oge || !baslik || aciklama === null) return hata(res, 400, "girdi", "Başlık gerekli.");
      const k = m.kodIstegiAc(
        oge.alan,
        {
          baslik,
          gerekce: aciklama || `Rapor: ${oge.ad}`,
          ornek: `oge:${oge.id}`,
          etki: "Rapordan düzeltme isteği",
        },
        kim,
        now,
      );
      m.kodIstegiDurum(k.id, "onaylandi", kim, now);
      return ok(200, { istek: k });
    }
    if (yol === "paket")
      return ok(200, { paket: await paketOlustur(m, o.config.aktarimDir, o.config.saatDilimi, kim, now) });
    if (p0 === "paket" && p1 && p2 === "oyuna-eklendi") {
      const id = idParam(p1);
      const b = await govde();
      if (!id || typeof b.revizyon !== "string") return hata(res, 400, "girdi", "Sürüm kimliğini yaz.");
      paketOyunaEklendi(m, id, b.revizyon.trim(), kim, now);
      await canliKontrol(m, now);
      return ok(200, { ok: true });
    }
    if (p0 === "aktarim" && p1 && p2 === "geri-al") {
      const id = idParam(p1);
      if (!id) return hata(res, 404, "yok", "Aktarım bulunamadı.");
      await m.aktarimGeriAl(id, kim, now);
      return ok(200, { ok: true });
    }
    if (yol === "bildirim/ayar") {
      const a = ayarAyristir(await govde());
      if (!a) return hata(res, 400, "girdi", "Saatleri SS:DD biçiminde yaz.");
      o.bildirim.ayarYaz(a);
      o.denetim.yaz(now, kim, "ayar", "bildirim");
      return ok(200, { ayar: a });
    }
    if (yol === "bildirim/abone") {
      const t = aboneAyristir(await govde());
      if (!t) return hata(res, 400, "girdi", "Bildirim aboneliği tanınmadı.");
      o.bildirim.abone(t, now);
      return ok(200, { ok: true });
    }
    if (yol === "bildirim/birak") {
      const b = await govde();
      if (typeof b.endpoint === "string") o.bildirim.birak(b.endpoint);
      return ok(200, { ok: true });
    }
    if (yol === "bildirim/dene") {
      await o.bildirim.dene();
      return ok(200, { ok: true });
    }
    return hata(res, 404, "yok", "Bulunamadı.");
  } catch (err) {
    if (err instanceof IsHatasi) return hata(res, err.durum, "is", err.message);
    if (err instanceof GovdeHatasi) return hata(res, err.durum, "govde", err.message);
    console.error(JSON.stringify({ seviye: "hata", olay: "api", yol, hata: String(err).slice(0, 300) }));
    return hata(res, 500, "sunucu", "Beklenmeyen bir sorun oldu. Biraz sonra yeniden dene.");
  }
}

async function alanYaz(
  res: ServerResponse,
  o: ApiOrtami,
  alan: AlanId,
  yol: string[],
  govde: () => Promise<Record<string, unknown>>,
  kim: string,
  now: number,
): Promise<void> {
  const m = o.merkez;
  const [a, b, c] = yol;
  const ok = (g: unknown): void => gonder(res, 200, g);
  if (a === "is" && b === undefined) {
    const g = await govde();
    const baslik = metin(g.baslik, 3, 120);
    const aciklama = metin(g.aciklama ?? "", 0, 2000);
    const adet = g.adet === undefined || g.adet === null ? null : tamsayi(g.adet, 1, 500);
    const sonTarih =
      g.sonTarih === undefined || g.sonTarih === null || g.sonTarih === "" ? null : tarih(g.sonTarih);
    const ornek = metin(g.ornek ?? "", 0, 2000);
    if (
      !baslik ||
      aciklama === null ||
      (g.adet !== undefined && g.adet !== null && adet === null) ||
      (g.sonTarih && !sonTarih) ||
      ornek === null
    )
      return hata(res, 400, "girdi", "Başlık 3–120 karakter; adet 1–500; son tarih YYYY-AA-GG.");
    const varyant = g.varyant === undefined || g.varyant === null ? null : tamsayi(g.varyant, 1, 2);
    if (g.varyant !== undefined && g.varyant !== null && varyant === null)
      return hata(res, 400, "girdi", "Görsel varyant en çok 2 olabilir.");
    const liste = (v: unknown): string[] | null =>
      v === undefined
        ? []
        : Array.isArray(v) && v.length <= 10 && v.every((x) => metin(x, 1, 200) !== null)
          ? (v as string[]).map((x) => x.trim())
          : null;
    const kisitlar = liste(g.kisitlar);
    const kabul = liste(g.kabul);
    const ozet = g.ozet === undefined ? "" : metin(g.ozet, 0, 140);
    if (!kisitlar || !kabul || ozet === null)
      return hata(res, 400, "girdi", "Kısıt ve kabul ölçütleri en çok 10 kısa madde olabilir.");
    return ok({
      is: m.isEkle(alan, { baslik, aciklama, adet, sonTarih, ornek }, "sahip", "acik", kim, now, null, {
        varyant,
        fikirTuru: g.fikirTuru === true,
        kisitlar,
        kabul,
        ozet,
      }),
    });
  }
  if (a === "is-sira") {
    const g = await govde();
    if (!Array.isArray(g.idler) || !g.idler.every((x) => tamsayi(x, 1, 1e12) !== null))
      return hata(res, 400, "girdi", "Sıra geçersiz.");
    m.isSirala(alan, g.idler as number[], kim, now);
    return ok({ ok: true });
  }
  if (a === "talimat") {
    const g = await govde();
    const t = metin(g.metin, 20, 60_000);
    if (!t) return hata(res, 400, "girdi", "Talimat 20–60.000 karakter olmalı.");
    return ok({ surum: m.talimatKaydet(alan, t, kim, now) });
  }
  if (a === "talimat-oneri") {
    const g = await govde();
    if (!isHazirNot(g.hazir) || typeof g.ekle !== "boolean")
      return hata(res, 400, "girdi", "Öneri geçersiz.");
    m.talimatOnerisiKarar(alan, g.hazir, g.ekle, kim, now);
    return ok({ ok: true });
  }
  if (a === "anahtar" && b === undefined) {
    const g = await govde();
    const ad = metin(g.ad ?? "", 1, 40);
    if (!ad) return hata(res, 400, "girdi", "Anahtara bir ad ver (ör. ChatGPT).");
    const r = o.anahtarlar.uret(alan, "mcp", now, kim, ad);
    return ok({ id: r.id, anahtar: r.anahtar, mcpUrl: `${o.config.publicUrl}/mcp` });
  }
  if (a === "anahtar" && b && c === "iptal") {
    const id = idParam(b);
    if (!id || !o.anahtarlar.iptal(id, alan, now, kim)) return hata(res, 404, "yok", "Anahtar bulunamadı.");
    return ok({ ok: true });
  }
  if (a === "ssh" && b === undefined) {
    const g = await govde();
    const acik = typeof g.acik === "string" ? g.acik : "";
    const aciklama = metin(g.aciklama ?? "", 0, 60) ?? "";
    return ok(await o.ssh.ekle(alan, acik, aciklama, kim, now));
  }
  if (a === "ssh" && b && c === "kaldir") {
    const id = idParam(b);
    if (!id) return hata(res, 404, "yok", "Anahtar bulunamadı.");
    await o.ssh.kaldir(alan, id, kim, now);
    return ok({ ok: true });
  }
  if (a === "ssh-yenile") {
    await o.ssh.kanalAnahtariYenile(alan, kim, now);
    return ok({ ok: true });
  }
  if (a === "istem-kopyala") {
    const g = await govde();
    const b = g.baglanti === "ssh" ? "ssh" : g.baglanti === "mcp" ? "mcp" : null;
    const isId = g.is === undefined || g.is === null ? null : tamsayi(g.is, 1, 1e12);
    const anahtarId =
      g.anahtarId === undefined || g.anahtarId === null ? null : tamsayi(g.anahtarId, 1, 1e12);
    if (!b) return hata(res, 400, "girdi", "Bağlantı türü MCP ya da SSH olmalı.");
    const sablon = istemSablonlari(m, alan, isId)[b];
    const parola = b === "ssh" ? o.ssh.parolaCoz(alan) : null;
    const varsayilan =
      o.anahtarlar.liste(alan).find((x) => x.kanal === "mcp" && x.iptal === null)?.id ?? null;
    const anahtar =
      b === "mcp" && (anahtarId ?? varsayilan)
        ? o.anahtarlar.coz((anahtarId ?? varsayilan) as number, alan)
        : null;
    const metinD = istemDoldur(sablon, {
      "{{SSH_ADRES}}": o.config.sshSunucu,
      "{{SSH_KULLANICI}}": `uretim-${alan}`,
      "{{SSH_PAROLA}}": parola ?? "(parola henüz yok; Bağlantı sekmesinden oluştur)",
      "{{MCP_ADRES}}": `${o.config.publicUrl}/mcp`,
      "{{MCP_ANAHTAR}}": anahtar ?? "(bağlantı ayarında kayıtlı anahtarını kullan)",
    });
    o.denetim.yaz(now, kim, "istem_kopyalandi", alan, `${b}${isId ? ` iş ${isId}` : ""}`);
    return ok({ metin: metinD, sirVar: parola !== null || anahtar !== null });
  }
  if (a === "parola-kopyala") {
    const p = o.ssh.parolaCoz(alan);
    if (!p) return hata(res, 404, "yok", "Bu alanın SSH parolası yok.");
    o.denetim.yaz(now, kim, "istem_kopyalandi", alan, "SSH parolası kopyalandı");
    return ok({ parola: p });
  }
  if (a === "ssh-parola") {
    const g = await govde();
    if (g.yenile === true) await o.ssh.parolaYenile(alan, kim, now);
    if (g.yenilemeGun !== undefined) {
      const gun = g.yenilemeGun === null ? null : tamsayi(g.yenilemeGun, 1, 365);
      if (g.yenilemeGun !== null && gun === null) return hata(res, 400, "girdi", "Yenileme süresi geçersiz.");
      o.ssh.parolaYenilemeAyarla(alan, gun, kim, now);
    }
    return ok({ durum: o.ssh.parolaDurumu(alan) });
  }
  if (a === "uygulama") {
    const g = await govde();
    const not = metin(g.not ?? "", 0, 80);
    if (not === null || (g.baglanti !== "mcp" && g.baglanti !== "ssh"))
      return hata(res, 400, "girdi", "Not en çok 80 karakter.");
    m.ayarYaz(`uygulama:${alan}`, not);
    m.ayarYaz(`baglanti:${alan}`, g.baglanti);
    return ok({ ok: true });
  }
  if (a === "sinirlar") {
    const g = await govde();
    const t = tamsayi(g.bekleyenTavan, 1, 500);
    const k = tamsayi(g.gunlukKota, 1, 2000);
    const h =
      g.haftalikUst === null || g.haftalikUst === undefined ? null : tamsayi(g.haftalikUst, 1, 10_000);
    if (!t || !k || (g.haftalikUst !== null && g.haftalikUst !== undefined && h === null))
      return hata(
        res,
        400,
        "girdi",
        "Kuyruk tavanı 1–500, günlük kota 1–2000, haftalık sınır boş ya da 1–10000 olmalı.",
      );
    m.sinirYaz(alan, t, k, h, kim, now);
    return ok({ ok: true });
  }
  if (a === "guven") {
    const g = await govde();
    const tur = g.tur;
    if (
      (tur !== "yeni" && tur !== "duzenleme" && tur !== "kaldirma-onerisi" && tur !== "rapor") ||
      typeof g.acik !== "boolean"
    )
      return hata(res, 400, "girdi", "Seçim geçersiz.");
    m.guvenYaz(alan, tur, g.acik, kim, now);
    return ok({ ok: true });
  }
  if (a === "kalanlar") {
    const g = await govde();
    m.ayarYaz(`kalanlar:${alan}`, g.goster === true ? "1" : "0");
    return ok({ ok: true });
  }
  return hata(res, 404, "yok", "Bulunamadı.");
}

function istemSablonlari(m: Merkez, alan: AlanId, isId: number | null): { mcp: string; ssh: string } {
  const acik = m.isler(alan, ["acik"]);
  const secili = isId ? [...acik.filter((i) => i.id === isId), ...acik.filter((i) => i.id !== isId)] : acik;
  return { mcp: istemUret(alan, "mcp", secili), ssh: istemUret(alan, "ssh", secili) };
}

async function dosyaGonder(res: ServerResponse, m: Merkez, ogeId: number, ozet: string): Promise<void> {
  const d = m.ogeDosyasi(ogeId, ozet);
  if (!d) return hata(res, 404, "yok", "Dosya bulunamadı.");
  let veri: Buffer;
  try {
    veri = await m.depo.oku(d.ozet);
  } catch {
    return hata(res, 404, "yok", "Dosya artık depoda yok.");
  }
  res.writeHead(200, {
    "Content-Type": MIME[d.tur],
    "Content-Length": String(veri.length),
    "Cache-Control": "private, max-age=86400, immutable",
    "X-Content-Type-Options": "nosniff",
    // Dosya kendi başına açılırsa da hiçbir şey çalıştıramaz.
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    "Content-Disposition": `inline; filename="${d.ad.replace(/[^a-z0-9._-]/g, "_")}"`,
  });
  res.end(veri);
}

function raporlar(m: Merkez): unknown[] {
  const r = m.db
    .prepare(
      "SELECT id FROM oge WHERE alan = 'test' AND gorunum = 'rapor' AND durum != 'kaldi' ORDER BY id DESC LIMIT 30",
    )
    .all() as { id: number }[];
  return r.map((x) => m.oge(x.id)).filter((x) => x !== null);
}

function ara(m: Merkez, q: string): unknown {
  const t = q.trim().toLocaleLowerCase("tr-TR");
  if (t.length < 1 || t.length > 60) return { alanlar: [], isler: [], ogeler: [] };
  const alanlar = ALANLAR.filter((a) => a.ad.toLocaleLowerCase("tr-TR").includes(t) || a.id.includes(t)).map(
    (a) => ({ id: a.id, ad: a.ad }),
  );
  const esc = `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const isler = m.db
    .prepare(
      "SELECT id, alan, baslik FROM isler WHERE durum IN ('oneri','acik') AND lower(baslik) LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 8",
    )
    .all(esc);
  const ogeler = m.db
    .prepare(
      "SELECT id, alan, ad, durum FROM oge WHERE (anahtar LIKE ? ESCAPE '\\' OR lower(ad) LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 12",
    )
    .all(esc, esc);
  return { alanlar, isler, ogeler };
}

/** Testler için: IP sayaçlarını sıfırlar. */
export function girisSayaciniSifirla(): void {
  girisSayaci.clear();
}
