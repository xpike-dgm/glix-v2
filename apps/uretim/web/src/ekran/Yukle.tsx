/** Elle yükleme (UM-G4): dosyaları sürükle-bırak, alanı ve işi seç, kısa açıklama; aynı ön kontrol sırasından geçer. */
import { createResource, createSignal, For, type JSX, Show } from "solid-js";
import { ALANLAR, type AlanId, alanTanimi } from "../../../src/ortak/alanlar.js";
import type { AlanSayfasi, KontrolSatiri } from "../../../src/ortak/tipler.js";
import { al, dosyaGonder, gonder } from "../api.js";
import { boyut } from "../bicim.js";
import { AlanIsareti, SonucEtiketi } from "../bilesenler.js";
import { git, hataTost, tost } from "../durum.js";
import { panoYenile } from "../Kabuk.js";
import { Simge } from "../simgeler.js";

interface Bekleyen {
  dosya: File;
  hedefYol: string;
  durum: "bekliyor" | "yukleniyor" | "tamam" | "hata";
  dosyaId?: string;
  hata?: string;
}

const UZANTI = /\.(png|webp|ogg|wav|json|svg|md|csv)$/i;

export function hedefOner(alan: AlanId, ad: string): string {
  const t = alanTanimi(alan);
  const onek = t.hedefOnekleri.find((o) => o.endsWith("/")) ?? "";
  if (!onek) return "";
  const temiz = ad
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9._-]+/g, "-");
  const kok = temiz.replace(/\.[a-z0-9]+$/, "");
  const uz = /\.(png|webp)$/.test(temiz) ? ".webp" : /\.(wav|ogg)$/.test(temiz) ? ".ogg" : (/\.[a-z0-9]+$/.exec(temiz)?.[0] ?? "");
  return `${onek}${kok}${uz}`;
}

export function Yukle(): JSX.Element {
  const [alan, setAlan] = createSignal<AlanId>("magaza");
  const [dosyalar, setDosyalar] = createSignal<Bekleyen[]>([]);
  const [ad, setAd] = createSignal("");
  const [aciklama, setAciklama] = createSignal("");
  const [isId, setIsId] = createSignal<string>("");
  const [ustunde, setUstunde] = createSignal(false);
  const [gonderiyor, setGonderiyor] = createSignal(false);
  const [sonuc, setSonuc] = createSignal<{ ogeId: number | null; sonuc: "gecti" | "uyari" | "kaldi"; satirlar: KontrolSatiri[] } | null>(null);
  const [isler] = createResource(alan, (a) => al<AlanSayfasi>(`alan/${a}`).then((s) => s.isler.filter((i) => i.durum === "acik")));
  let girdi: HTMLInputElement | undefined;
  const ekle = (l: FileList | null): void => {
    if (!l) return;
    const yeni = [...l].filter((f) => UZANTI.test(f.name)).map((f) => ({ dosya: f, hedefYol: hedefOner(alan(), f.name), durum: "bekliyor" as const }));
    if (yeni.length < l.length) tost("Bazı dosyalar atlandı: yalnız PNG, WebP, OGG, WAV, JSON, SVG, MD ve CSV kabul edilir.", { hata: true });
    setDosyalar([...dosyalar(), ...yeni]);
    if (!ad() && yeni[0]) setAd(yeni[0].dosya.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    setSonuc(null);
  };
  const teslimEt = async (): Promise<void> => {
    setGonderiyor(true);
    setSonuc(null);
    try {
      const l = [...dosyalar()];
      for (let i = 0; i < l.length; i++) {
        const b = l[i];
        if (!b || b.dosyaId) continue;
        l[i] = { ...b, durum: "yukleniyor" };
        setDosyalar([...l]);
        try {
          const r = await dosyaGonder<{ dosyaId: string }>(`yukle?alan=${alan()}&ad=${encodeURIComponent(b.dosya.name)}`, b.dosya);
          l[i] = { ...b, durum: "tamam", dosyaId: r.dosyaId };
        } catch (e) {
          l[i] = { ...b, durum: "hata", hata: e instanceof Error ? e.message : "Yüklenemedi" };
          setDosyalar([...l]);
          throw e;
        }
        setDosyalar([...l]);
      }
      const r = await gonder<{ ogeler: { ogeId: number | null; sonuc: "gecti" | "uyari" | "kaldi"; satirlar: KontrolSatiri[] }[] }>("elle-teslim", {
        alan: alan(),
        tur: "yeni",
        ...(isId() ? { isId: Number(isId()) } : {}),
        aciklama: aciklama(),
        ogeler: [
          {
            ad: ad().trim() || "Elle yükleme",
            aciklama: aciklama(),
            dosyalar: l.map((d) => ({ dosyaId: d.dosyaId, ...(d.hedefYol ? { hedefYol: d.hedefYol } : {}), ...(/\.csv$/i.test(d.dosya.name) ? { rol: "satirlar" } : {}) })),
          },
        ],
      });
      const s = r.ogeler[0] ?? null;
      setSonuc(s);
      void panoYenile();
      if (s && s.sonuc !== "kaldi") tost("Teslim inceleme sırasına girdi");
    } catch (e) {
      hataTost(e);
    } finally {
      setGonderiyor(false);
    }
  };
  const sifirla = (): void => {
    setDosyalar([]);
    setAd("");
    setAciklama("");
    setSonuc(null);
  };
  return (
    <div class="sayfa sayfa--dar">
      <header class="sayfa__bas">
        <div>
          <h1>Elle yükle</h1>
          <p class="soluk">Sunucuya bağlanamayan araçların ürettiklerini buradan bırak. Yapay zekâ teslimiyle aynı ön kontrolden geçer.</p>
        </div>
      </header>
      <div class="yigin yigin--genis">
        <label class="alan-giris">
          <span>Alan</span>
          <div class="alan-secici">
            <For each={ALANLAR.filter((a) => a.dosyaTurleri.length)}>
              {(a) => (
                <button type="button" class="cip" aria-pressed={alan() === a.id} onClick={() => (setAlan(a.id), setDosyalar(dosyalar().map((d) => ({ ...d, hedefYol: hedefOner(a.id, d.dosya.name) }))))}>
                  <AlanIsareti alan={a.id} />
                </button>
              )}
            </For>
          </div>
        </label>
        <div
          class="birakma"
          classList={{ "birakma--ustunde": ustunde() }}
          onDragOver={(e) => (e.preventDefault(), setUstunde(true))}
          onDragLeave={() => setUstunde(false)}
          onDrop={(e) => {
            e.preventDefault();
            setUstunde(false);
            ekle(e.dataTransfer?.files ?? null);
          }}
          onClick={() => girdi?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && girdi?.click()}
          role="button"
          tabindex="0"
        >
          <span class="birakma__simge">
            <Simge ad="yukle" boyut={24} />
          </span>
          <strong>Dosyaları buraya bırak ya da seç</strong>
          <span class="cok-soluk kucuk">{alanTanimi(alan()).dosyaTurleri.map((t) => t.toUpperCase()).join(", ")} · görsel 20 MB, ses 30 MB, metin 2 MB</span>
          <input ref={girdi} type="file" multiple hidden accept=".png,.webp,.ogg,.wav,.json,.svg,.md,.csv" onChange={(e) => ekle(e.currentTarget.files)} />
        </div>
        <Show when={dosyalar().length}>
          <ul class="yukleme-listesi">
            <For each={dosyalar()}>
              {(d, i) => (
                <li>
                  <span class="etiket">{d.dosya.name.split(".").pop()?.toUpperCase()}</span>
                  <span class="esnek yigin" style={{ gap: "4px" }}>
                    <span class="tasma">{d.dosya.name}</span>
                    <Show when={alanTanimi(alan()).hedefOnekleri.length}>
                      <input
                        class="girdi girdi--kucuk mono"
                        value={d.hedefYol}
                        onInput={(e) => setDosyalar(dosyalar().map((x, j) => (j === i() ? { ...x, hedefYol: e.currentTarget.value } : x)))}
                        aria-label="Oyundaki yol"
                        spellcheck={false}
                      />
                    </Show>
                    <Show when={d.hata}>
                      <span class="metin-kaldi kucuk">{d.hata}</span>
                    </Show>
                  </span>
                  <span class="cok-soluk kucuk">{d.durum === "yukleniyor" ? "yükleniyor…" : d.durum === "tamam" ? "yüklendi" : boyut(d.dosya.size)}</span>
                  <button type="button" class="dg-simge" onClick={() => setDosyalar(dosyalar().filter((_, j) => j !== i()))} aria-label="Kaldır" disabled={gonderiyor()}>
                    <Simge ad="kapat" boyut={16} />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <div class="iki-sutun">
          <label class="alan-giris">
            <span>Ad</span>
            <input class="girdi" value={ad()} onInput={(e) => setAd(e.currentTarget.value)} placeholder="ör. Kara Borsa tokmak sesi" maxlength="60" />
          </label>
          <label class="alan-giris">
            <span>İş (isteğe bağlı)</span>
            <select class="girdi" value={isId()} onChange={(e) => setIsId(e.currentTarget.value)}>
              <option value="">İşe bağlama</option>
              <For each={isler() ?? []}>{(i) => <option value={String(i.id)}>{i.baslik}</option>}</For>
            </select>
          </label>
        </div>
        <label class="alan-giris">
          <span>Kısa açıklama</span>
          <textarea class="girdi" rows="2" value={aciklama()} onInput={(e) => setAciklama(e.currentTarget.value)} placeholder="Hangi araçla, ne için üretildi?" maxlength="500" />
        </label>
        <Show when={sonuc()}>
          {(s) => (
            <div class={`serit ${s().sonuc === "kaldi" ? "serit--kirmizi" : s().sonuc === "uyari" ? "serit--sari" : "serit--bilgi"}`}>
              <Simge ad={s().sonuc === "kaldi" ? "uyari" : "tamam"} />
              <div class="esnek yigin" style={{ gap: "6px" }}>
                <div class="satir">
                  <SonucEtiketi sonuc={s().sonuc} />
                  <strong>{s().sonuc === "kaldi" ? "Ön kontrolden geçmedi" : "İnceleme sırasına girdi"}</strong>
                </div>
                <For each={s().satirlar.filter((x) => x.sonuc === "kaldi" || x.sonuc === "uyari")}>{(x) => <span class="kucuk">{x.mesaj}</span>}</For>
                <Show when={s().ogeId && s().sonuc !== "kaldi"}>
                  <div class="satir">
                    <button type="button" class="dg dg--k" onClick={() => git(`/incele/${s().ogeId}`)}>
                      Şimdi incele
                    </button>
                    <button type="button" class="dg dg--k dg--hayalet" onClick={sifirla}>
                      Yeni yükleme
                    </button>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </Show>
        <div class="sabit-eylem">
          <button type="button" class="dg dg--birincil dg--b dg--tam" disabled={!dosyalar().length || gonderiyor()} onClick={() => void teslimEt()}>
            {gonderiyor() ? "Gönderiliyor…" : `Teslim et${dosyalar().length ? ` · ${dosyalar().length} dosya` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
