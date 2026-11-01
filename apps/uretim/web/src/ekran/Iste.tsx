/**
 * İsteğini yaz (UM-R1, R2): düz cümle → yapılandırılmış iş taslağı (sahip düzeltir) → iş açılır → istem tek dokunuşla
 * kopyalanır. İstem yalnız iş numarası ve kısa özet taşır; anahtar ya da sır içermez.
 */
import { createResource, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { ALANLAR, type AlanId, alanTanimi } from "../../../src/ortak/alanlar.js";
import type { AlanSayfasi, IsKaydi } from "../../../src/ortak/tipler.js";
import { al, gonder } from "../api.js";
import { AlanIsareti, TarihSecici } from "../bilesenler.js";
import { olayDinle } from "../canli.js";
import { alanRengi, git, hataTost, sorgu, titret, tost } from "../durum.js";
import { panoYenile } from "../Kabuk.js";
import { Simge } from "../simgeler.js";

interface Taslak {
  baslik: string;
  aciklama: string;
  adet: number | null;
  kisitlar: string[];
  kabul: string[];
  ozet: string;
}

export async function panoyaKopyala(metin: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(metin);
    return true;
  } catch {
    // Eski tarayıcı: geçici metin alanı.
    const t = document.createElement("textarea");
    t.value = metin;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.append(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

/** İstemi sırlarıyla birlikte (yalnız panoya) kopyalar; uygulama notu varsa hatırlatır. */
export async function istemiKopyala(
  alan: AlanId,
  baglanti: "mcp" | "ssh",
  isId?: number,
  anahtarId?: number | null,
): Promise<void> {
  try {
    const r = await gonder<{ metin: string }>(`alan/${alan}/istem-kopyala`, {
      baglanti,
      ...(isId ? { is: isId } : {}),
      ...(anahtarId ? { anahtarId } : {}),
    });
    const u = await al<{ uygulama: string }>(`alan/${alan}/istem`).catch(() => ({ uygulama: "" }));
    if (await panoyaKopyala(r.metin)) {
      titret(12);
      tost(
        u.uygulama
          ? `İstem kopyalandı — ${u.uygulama} sohbetine yapıştır`
          : "İstem kopyalandı — yapay zekâ sohbetine yapıştır",
      );
    } else tost("Kopyalanamadı; tarayıcı panoya erişime izin vermedi.", { hata: true });
  } catch (e) {
    hataTost(e);
  }
}

interface IstemYaniti {
  istemler: { mcp: string; ssh: string };
  isSayisi: number;
  uygulama: string;
}

/** İki kalıplı istem görünümü (bölüm 8–9): MCP ve SSH sekmeleri; sırlar ekranda ••••, yalnız kopyalanan metinde açık. */
export function IstemKutusu(p: { alan: AlanId; isId?: number; ilkBaglanti: "mcp" | "ssh" }): JSX.Element {
  const [b, setB] = createSignal<"mcp" | "ssh">(p.ilkBaglanti);
  const [veri] = createResource(
    () => `alan/${p.alan}/istem${p.isId ? `?is=${p.isId}` : ""}`,
    (y) => al<IstemYaniti>(y),
  );
  const [sayfa] = createResource(
    () => p.alan,
    (a) => al<AlanSayfasi & { sshParola: { var: boolean }; parolaAcik: boolean }>(`alan/${a}`),
  );
  const anahtarlar = (): { id: number; ad: string }[] =>
    (sayfa()?.anahtarlar ?? []).filter((k) => k.kanal === "mcp" && k.iptal === null);
  const [anahtarId, setAnahtarId] = createSignal<number | null>(null);
  const secili = (): number | null => anahtarId() ?? anahtarlar()[0]?.id ?? null;
  return (
    <div class="yigin">
      <div class="istem-kutusu">
        <div class="istem-kutusu__bas">
          <fieldset class="secim" aria-label="Bağlantı">
            <button type="button" aria-pressed={b() === "mcp"} onClick={() => setB("mcp")}>
              MCP
            </button>
            <button type="button" aria-pressed={b() === "ssh"} onClick={() => setB("ssh")}>
              SSH
            </button>
          </fieldset>
          <span class="cok-soluk kucuk">•••• yalnız kopyalanınca açılır</span>
        </div>
        <Show when={veri()} fallback={<pre class="istem-kutusu__metin cok-soluk">Hazırlanıyor…</pre>}>
          {(v) => <pre class="istem-kutusu__metin">{v().istemler[b()]}</pre>}
        </Show>
      </div>
      <Show when={b() === "mcp" && anahtarlar().length > 1}>
        <label class="alan-giris">
          <span>Hangi anahtar?</span>
          <select
            class="girdi"
            value={String(secili() ?? "")}
            onChange={(e) => setAnahtarId(Number(e.currentTarget.value))}
          >
            <For each={anahtarlar()}>{(k) => <option value={String(k.id)}>{k.ad}</option>}</For>
          </select>
        </label>
      </Show>
      <Show when={b() === "mcp" && sayfa() && anahtarlar().length === 0}>
        <p class="serit serit--sari">
          <Simge ad="uyari" />
          <span>
            Bu alanda MCP anahtarı yok; istem anahtarsız kopyalanır. Bağlantı sekmesinden adlandırılmış bir
            anahtar üret.
          </span>
        </p>
      </Show>
      <Show when={b() === "ssh" && sayfa() && !sayfa()?.sshParola.var}>
        <p class="serit serit--sari">
          <Simge ad="uyari" />
          <span>Bu alanın SSH parolası henüz yok; Bağlantı sekmesinden oluştur.</span>
        </p>
      </Show>
      <button
        type="button"
        class="dg dg--birincil dg--b dg--tam iste__kopyala"
        onClick={() => void istemiKopyala(p.alan, b(), p.isId, b() === "mcp" ? secili() : null)}
      >
        <Simge ad="kopyala" /> İstemi kopyala
      </button>
    </div>
  );
}

function MaddeListesi(p: {
  baslik: string;
  liste: string[];
  setListe: (l: string[]) => void;
  yer: string;
}): JSX.Element {
  const [yeni, setYeni] = createSignal("");
  const ekle = (): void => {
    const t = yeni().trim();
    if (!t || p.liste.length >= 10) return;
    p.setListe([...p.liste, t.slice(0, 200)]);
    setYeni("");
  };
  return (
    <div class="alan-giris">
      <span>{p.baslik}</span>
      <ul class="madde-duzen">
        <For each={p.liste}>
          {(m, i) => (
            <li>
              <span class="esnek">{m}</span>
              <button
                type="button"
                class="dg-simge"
                onClick={() => p.setListe(p.liste.filter((_, j) => j !== i()))}
                aria-label="Kaldır"
              >
                <Simge ad="kapat" boyut={16} />
              </button>
            </li>
          )}
        </For>
      </ul>
      <div class="satir">
        <input
          class="girdi esnek"
          value={yeni()}
          onInput={(e) => setYeni(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ekle();
            }
          }}
          placeholder={p.yer}
          maxlength="200"
        />
        <button type="button" class="dg" onClick={ekle} disabled={!yeni().trim()}>
          Ekle
        </button>
      </div>
    </div>
  );
}

export function Iste(): JSX.Element {
  const ilkAlan = ALANLAR.find((a) => a.id === sorgu().get("alan"))?.id ?? "magaza";
  const [adim, setAdim] = createSignal<1 | 2 | 3>(1);
  const [alan, setAlan] = createSignal<AlanId>(ilkAlan);
  const [metin, setMetin] = createSignal("");
  const [fikir, setFikir] = createSignal(false);
  const [sonTarih, setSonTarih] = createSignal("");
  const [ayar, { refetch: ayarYenile }] = createResource(alan, (a) => al<AlanSayfasi>(`alan/${a}`));
  onCleanup(
    olayDinle(["is", "kilit", "ayar", "istek_karti"], (olay) => {
      if (olay.alan === null || olay.alan === alan()) void ayarYenile();
    }),
  );
  const [baglantiSecimi, setBaglantiSecimi] = createSignal<"mcp" | "ssh" | null>(null);
  const baglanti = (): "mcp" | "ssh" => baglantiSecimi() ?? ayar()?.uygulama.baglanti ?? "mcp";
  const [taslak, setTaslak] = createSignal<Taslak | null>(null);
  const [kaynak, setKaynak] = createSignal<"model" | "kalip">("kalip");
  const [bekle, setBekle] = createSignal(false);
  const [is, setIs] = createSignal<IsKaydi | null>(null);
  const [uygulamaNotu, setUygulamaNotu] = createSignal<string | null>(null);

  const cevir = async (): Promise<void> => {
    setBekle(true);
    try {
      const r = await gonder<{ taslak: Taslak; kaynak: "model" | "kalip" }>("istek-yaz", {
        metin: metin(),
        alan: alan(),
        baglanti: baglanti(),
        fikirTuru: fikir(),
        sonTarih: sonTarih() || null,
      });
      setTaslak(r.taslak);
      setKaynak(r.kaynak);
      setAdim(2);
    } catch (e) {
      hataTost(e);
    } finally {
      setBekle(false);
    }
  };
  const ac = async (): Promise<void> => {
    const t = taslak();
    if (!t) return;
    setBekle(true);
    try {
      const r = await gonder<{ is: IsKaydi }>(`alan/${alan()}/is`, {
        ...t,
        sonTarih: sonTarih() || null,
        fikirTuru: fikir(),
        ornek: "",
      });
      setIs(r.is);
      const i = await al<{ uygulama: string }>(`alan/${alan()}/istem?is=${r.is.id}`);
      setUygulamaNotu(i.uygulama);
      setAdim(3);
      void panoYenile();
      void ayarYenile();
    } catch (e) {
      hataTost(e);
    } finally {
      setBekle(false);
    }
  };
  const notKaydet = async (not: string): Promise<void> => {
    try {
      await gonder(`alan/${alan()}/uygulama`, { not, baglanti: baglanti() });
      setUygulamaNotu(not);
      tost("Not kaydedildi");
    } catch (e) {
      hataTost(e);
    }
  };
  const t = (): Taslak =>
    taslak() ?? { baslik: "", aciklama: "", adet: null, kisitlar: [], kabul: [], ozet: "" };
  const guncelle = (p: Partial<Taslak>): void => {
    setTaslak({ ...t(), ...p });
  };
  const sifirla = (): void => {
    setAdim(1);
    setMetin("");
    setTaslak(null);
    setIs(null);
  };
  const bekleyenIs = (): number => ayar()?.isler.filter((x) => x.durum === "acik").length ?? 0;

  return (
    <div class="sayfa sayfa--dar iste" style={{ "--alan-renk": alanRengi(alan()) }}>
      <header class="sayfa__bas">
        <div>
          <h1>İş iste</h1>
          <p class="soluk">
            Ne istediğini kendi cümlenle yaz; site bunu net bir işe ve yapıştırılacak kısa bir isteme çevirir.
          </p>
        </div>
      </header>
      <ol class="adimlar" aria-label="Adımlar">
        <For each={["Yaz", "Kontrol et", "Kopyala"]}>
          {(a, i) => (
            <li classList={{ "adimlar--etkin": adim() === i() + 1, "adimlar--bitti": adim() > i() + 1 }}>
              <span class="adimlar__no">{adim() > i() + 1 ? <Simge ad="onay" boyut={14} /> : i() + 1}</span>
              <span>{a}</span>
            </li>
          )}
        </For>
      </ol>

      <Show when={adim() === 1}>
        <div class="yigin yigin--genis">
          <div class="alan-giris">
            <span>Hangi alan?</span>
            <div class="alan-secici">
              <For each={ALANLAR}>
                {(a) => (
                  <button
                    type="button"
                    class="cip"
                    aria-pressed={alan() === a.id}
                    onClick={() => {
                      setAlan(a.id);
                      setBaglantiSecimi(null);
                    }}
                  >
                    <AlanIsareti alan={a.id} />
                  </button>
                )}
              </For>
            </div>
          </div>
          <label class="alan-giris">
            <span>Ne istiyorsun?</span>
            <textarea
              class="girdi iste__metin"
              rows="5"
              value={metin()}
              onInput={(e) => setMetin(e.currentTarget.value)}
              placeholder={`ör. ${alanTanimi(alan()).ornekIs}`}
              maxlength="2000"
              onKeyDown={(e) =>
                e.key === "Enter" && (e.metaKey || e.ctrlKey) && metin().trim().length >= 5 && void cevir()
              }
            />
          </label>
          <div class="iki-sutun">
            <div class="alan-giris">
              <span>Yapay zekâ nasıl bağlanıyor?</span>
              <div class="secim">
                <button
                  type="button"
                  aria-pressed={baglanti() === "mcp"}
                  onClick={() => setBaglantiSecimi("mcp")}
                >
                  MCP
                </button>
                <button
                  type="button"
                  aria-pressed={baglanti() === "ssh"}
                  onClick={() => setBaglantiSecimi("ssh")}
                >
                  SSH
                </button>
              </div>
            </div>
            <div class="alan-giris">
              <span>Son tarih (isteğe bağlı)</span>
              <TarihSecici
                etiket="Son tarih"
                deger={sonTarih() || null}
                degistir={(v) => setSonTarih(v ?? "")}
              />
            </div>
          </div>
          <label class="anahtarli-satir">
            <span class="esnek">
              <strong>Önce fikir sor</strong>
              <span class="cok-soluk kucuk">
                Yapay zekâ önce yalnız metinle 2–3 kısa fikir getirir; sen seçince bir kez üretir. Görsel ve
                seste kullanım limitini korur.
              </span>
            </span>
            <input
              type="checkbox"
              class="anahtar-dugme"
              checked={fikir()}
              onChange={(e) => setFikir(e.currentTarget.checked)}
            />
          </label>
          <div class="sabit-eylem">
            <button
              type="button"
              class="dg dg--birincil dg--b dg--tam"
              disabled={metin().trim().length < 5 || bekle()}
              onClick={() => void cevir()}
            >
              {bekle() ? "Hazırlanıyor…" : "İşe çevir"}
              <Simge ad="sonraki" />
            </button>
          </div>
        </div>
      </Show>

      <Show when={adim() === 2}>
        <div class="yigin yigin--genis">
          <div class={`serit ${kaynak() === "model" ? "serit--bilgi" : "serit--sari"}`}>
            <Simge ad={kaynak() === "model" ? "pirilti" : "bilgi"} />
            <span>
              {kaynak() === "model"
                ? "Taslak hazır. Göz at, gerekirse düzelt."
                : "Taslak sabit kalıptan hazırlandı (yardımcı model şu an kullanılamıyor). Göz at, gerekirse düzelt."}
            </span>
          </div>
          <label class="alan-giris">
            <span>Başlık</span>
            <input
              class="girdi"
              value={t().baslik}
              onInput={(e) => guncelle({ baslik: e.currentTarget.value })}
              maxlength="120"
            />
          </label>
          <label class="alan-giris">
            <span>Açıklama</span>
            <textarea
              class="girdi"
              rows="4"
              value={t().aciklama}
              onInput={(e) => guncelle({ aciklama: e.currentTarget.value })}
              maxlength="2000"
            />
          </label>
          <div class="iki-sutun">
            <label class="alan-giris">
              <span>Adet</span>
              <input
                class="girdi"
                inputmode="numeric"
                value={t().adet ?? ""}
                onInput={(e) =>
                  guncelle({
                    adet: e.currentTarget.value
                      ? Math.min(500, Number(e.currentTarget.value.replace(/\D/g, "")) || 1)
                      : null,
                  })
                }
                placeholder="—"
              />
            </label>
            <label class="alan-giris">
              <span>İstemdeki kısa özet</span>
              <input
                class="girdi"
                value={t().ozet}
                onInput={(e) => guncelle({ ozet: e.currentTarget.value })}
                maxlength="140"
              />
            </label>
          </div>
          <MaddeListesi
            baslik="Kısıtlar"
            liste={t().kisitlar}
            setListe={(l) => guncelle({ kisitlar: l })}
            yer="ör. biri efsanevi olsun"
          />
          <MaddeListesi
            baslik="Kabul ölçütleri"
            liste={t().kabul}
            setListe={(l) => guncelle({ kabul: l })}
            yer="ör. fiyatlar aralıkta"
          />
          <div class="sabit-eylem satir">
            <button type="button" class="dg dg--b" onClick={() => setAdim(1)}>
              <Simge ad="onceki" /> Geri
            </button>
            <button
              type="button"
              class="dg dg--birincil dg--b esnek"
              disabled={t().baslik.trim().length < 3 || bekle()}
              onClick={() => void ac()}
            >
              {bekle() ? "Açılıyor…" : "İşi aç"}
            </button>
          </div>
        </div>
      </Show>

      <Show when={adim() === 3 && is()}>
        {(i) => (
          <div class="yigin yigin--genis">
            <div class="iste__tamam">
              <span class="iste__tamam-simge">
                <Simge ad="tamam" boyut={28} />
              </span>
              <div>
                <h2>İş açıldı · #{i().id}</h2>
                <p class="soluk">
                  {bekleyenIs() > 1
                    ? `Bu alanda sırada ${bekleyenIs()} iş var; istem hepsini kapsar.`
                    : "Şimdi istemi yapay zekâya yapıştır."}
                </p>
              </div>
            </div>
            <IstemKutusu alan={alan()} isId={i().id} ilkBaglanti={baglanti()} />
            <label class="alan-giris">
              <span>Bu alanı hangi uygulamada kullanıyorsun?</span>
              <input
                class="girdi"
                value={uygulamaNotu() ?? ""}
                onChange={(e) => void notKaydet(e.currentTarget.value)}
                placeholder="ör. ChatGPT – Mağaza sohbeti"
                maxlength="80"
              />
            </label>
            <div class="satir">
              <button type="button" class="dg" onClick={sifirla}>
                <Simge ad="arti" /> Yeni istek
              </button>
              <button type="button" class="dg dg--hayalet" onClick={() => git(`/alan/${alan()}?sekme=isler`)}>
                İşlere git
              </button>
            </div>
          </div>
        )}
      </Show>
      <p class="cok-soluk kucuk iste__dip">
        Dosyan hazırsa{" "}
        <a
          href="/yukle"
          onClick={(e) => {
            e.preventDefault();
            git("/yukle");
          }}
        >
          elle yükle
        </a>
        .
      </p>
    </div>
  );
}
