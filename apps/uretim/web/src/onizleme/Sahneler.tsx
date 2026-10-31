/** İnceleme sahneleri (UM-U3): türüne göre görsel, animasyon, ses, müzik, liste, kart, wiki, rapor, metin, fikir. */
import { createEffect, createMemo, createResource, createSignal, For, type JSX, Match, on, onCleanup, Show, Switch } from "solid-js";
import { HAZIR_NOTLAR } from "../../../src/ortak/durum.js";
import type { KontrolSatiri, OgeAyrinti, OgeDosyasi } from "../../../src/ortak/tipler.js";
import { dosyaUrl, gonder } from "../api.js";
import { saniye } from "../bicim.js";
import { Bos, Iskelet } from "../bilesenler.js";
import { hataTost, tost, yazTercih } from "../durum.js";
import { alanFarklari, degerMetni, kelimeFarki } from "../fark.js";
import { Simge } from "../simgeler.js";

export type Zemin = "koyu" | "acik" | "dama";
const zeminOku = (): Zemin => {
  try {
    const z = localStorage.getItem("uretim:zemin");
    return z === "acik" || z === "dama" ? z : "koyu";
  } catch {
    return "koyu";
  }
};
export const [zemin, setZeminSinyal] = createSignal<Zemin>(zeminOku());
export const setZemin = (z: Zemin): void => {
  setZeminSinyal(z);
  yazTercih("uretim:zemin", z);
};
export const zeminDondur = (): void => setZemin(zemin() === "koyu" ? "acik" : zemin() === "acik" ? "dama" : "koyu");

const gorseller = (o: OgeAyrinti): OgeDosyasi[] => o.dosyalar.filter((d) => d.tur === "png");
const sesler = (o: OgeAyrinti): OgeDosyasi[] => o.dosyalar.filter((d) => d.tur === "wav" || d.tur === "ogg");
const kareNo = (d: OgeDosyasi): number => Number(/-(\d+)\.(png|webp)$/.exec(d.hedefYol ?? d.ad)?.[1] ?? 0);

export function ZeminSecici(): JSX.Element {
  return (
    <div class="secim secim--zemin" role="group" aria-label="Zemin">
      <button type="button" aria-pressed={zemin() === "koyu"} onClick={() => setZemin("koyu")} title="Koyu zemin">
        <Simge ad="ay" boyut={16} />
      </button>
      <button type="button" aria-pressed={zemin() === "acik"} onClick={() => setZemin("acik")} title="Açık zemin">
        <Simge ad="gunes" boyut={16} />
      </button>
      <button type="button" aria-pressed={zemin() === "dama"} onClick={() => setZemin("dama")} title="Dama (şeffaflık)">
        <Simge ad="dama" boyut={16} />
      </button>
    </div>
  );
}

/** Oyundaki gerçek boyutlar (CSS px) — hedef yola göre. */
function oyunBoyutlari(d: OgeDosyasi): number[] {
  const y = d.hedefYol ?? "";
  if (y.includes("/badges/")) return [48, 96];
  if (y.includes("/shop/cerceve/")) return [56, 96];
  if (y.includes("/shop/tepki/")) return [40, 72];
  if (y.includes("/shop/zafer/")) return [32, 64];
  if (y.includes("/ikon/") || y.includes("/sus/")) return [16, 24, 32];
  if (y.includes("/cards/")) return [160];
  if (y.includes("/kart-arkasi/")) return [64, 120];
  return [48, 96];
}

function KarsilastirmaKaydiraci(p: { eski: string; yeni: string }): JSX.Element {
  const [x, setX] = createSignal(50);
  let kutu: HTMLDivElement | undefined;
  const surukle = (e: PointerEvent): void => {
    if (!kutu) return;
    const r = kutu.getBoundingClientRect();
    setX(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={kutu}
      class={`karsilastir zemin--${zemin()}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        surukle(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons) surukle(e);
      }}
      role="slider"
      aria-label="Eski ve yeni karşılaştırma"
      aria-valuenow={Math.round(x())}
      tabindex="0"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setX((v) => Math.max(0, v - 5));
        if (e.key === "ArrowRight") setX((v) => Math.min(100, v + 5));
      }}
    >
      <img src={p.yeni} alt="Yeni" draggable={false} />
      <img src={p.eski} alt="Eski" draggable={false} class="karsilastir__eski" style={{ "clip-path": `inset(0 ${100 - x()}% 0 0)` }} />
      <div class="karsilastir__cizgi" style={{ left: `${x()}%` }}>
        <span>
          <Simge ad="onceki" boyut={12} />
          <Simge ad="sonraki" boyut={12} />
        </span>
      </div>
      <span class="karsilastir__etiket karsilastir__etiket--sol">Eski</span>
      <span class="karsilastir__etiket karsilastir__etiket--sag">Yeni</span>
    </div>
  );
}

export function GorselSahne(p: { oge: OgeAyrinti; onceki: OgeAyrinti | null }): JSX.Element {
  const [secili, setSecili] = createSignal(0);
  const liste = createMemo(() => gorseller(p.oge));
  const d = (): OgeDosyasi | undefined => liste()[secili()] ?? liste()[0];
  const eski = (): OgeDosyasi | undefined => {
    const x = d();
    const l = p.onceki ? gorseller(p.onceki) : [];
    return l.find((y) => x && y.hedefYol === x.hedefYol) ?? l[secili()];
  };
  const [karsilastir, setKarsilastir] = createSignal(false);
  createEffect(on(() => p.oge.id, () => (setSecili(0), setKarsilastir(false))));
  return (
    <div class="sahne sahne--gorsel">
      <div class="sahne__arac">
        <ZeminSecici />
        <Show when={eski()}>
          <button type="button" class="dg dg--k" aria-pressed={karsilastir()} onClick={() => setKarsilastir(!karsilastir())}>
            <Simge ad="katman" /> {karsilastir() ? "Karşılaştırmayı kapat" : "Eskiyle karşılaştır"}
          </button>
        </Show>
        <Show when={d()?.meta?.tur === "gorsel" && d()?.meta}>
          {(m) => {
            const g = m() as { w: number; h: number };
            return (
              <span class="cok-soluk kucuk sahne__olcu">
                {g.w}×{g.h}
              </span>
            );
          }}
        </Show>
      </div>
      <Show when={d()} fallback={<Bos simge="gorsel" baslik="Görsel yok" />}>
        {(dd) => (
          <>
            <Show
              when={karsilastir() && eski()}
              fallback={
                <div class={`sahne__tuval zemin--${zemin()}`}>
                  <img src={dosyaUrl(p.oge.id, dd().ozet)} alt={p.oge.ad} draggable={false} />
                </div>
              }
            >
              {(e) => <KarsilastirmaKaydiraci eski={dosyaUrl(p.onceki?.id ?? 0, e().ozet)} yeni={dosyaUrl(p.oge.id, dd().ozet)} />}
            </Show>
            <div class="gercek-boyut">
              <span class="cok-soluk kucuk">Oyundaki boyut</span>
              <div class="gercek-boyut__liste">
                <For each={oyunBoyutlari(dd())}>
                  {(b) => (
                    <div class="gercek-boyut__oge">
                      <div class={`gercek-boyut__kutu zemin--koyu`}>
                        <img src={dosyaUrl(p.oge.id, dd().ozet)} alt="" style={{ width: `${b}px`, height: `${b}px` }} />
                      </div>
                      <div class={`gercek-boyut__kutu zemin--acik`}>
                        <img src={dosyaUrl(p.oge.id, dd().ozet)} alt="" style={{ width: `${b}px`, height: `${b}px` }} />
                      </div>
                      <span class="cok-soluk kucuk">{b} px</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <Show when={liste().length > 1}>
              <div class="kucuk-resimler" role="tablist" aria-label="Dosyalar">
                <For each={liste()}>
                  {(x, i) => (
                    <button type="button" class={`kucuk-resim zemin--${zemin()}`} aria-selected={i() === secili()} onClick={() => setSecili(i())} title={x.ad}>
                      <img src={dosyaUrl(p.oge.id, x.ozet)} alt={x.ad} loading="lazy" />
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}

export function AnimasyonSahne(p: { oge: OgeAyrinti }): JSX.Element {
  const kareler = createMemo(() => [...gorseller(p.oge)].sort((a, b) => kareNo(a) - kareNo(b)));
  const [kare, setKare] = createSignal(0);
  const [oynuyor, setOynuyor] = createSignal(true);
  const [hiz, setHiz] = createSignal(1);
  let zaman: ReturnType<typeof setInterval> | undefined;
  createEffect(() => {
    clearInterval(zaman);
    if (oynuyor() && kareler().length > 1) zaman = setInterval(() => setKare((k) => (k + 1) % kareler().length), 125 / hiz());
  });
  onCleanup(() => clearInterval(zaman));
  const tus = (e: KeyboardEvent): void => {
    if (e.key === " " && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      setOynuyor(!oynuyor());
    }
  };
  document.addEventListener("keydown", tus);
  onCleanup(() => document.removeEventListener("keydown", tus));
  return (
    <div class="sahne sahne--gorsel">
      <div class="sahne__arac">
        <ZeminSecici />
        <span class="cok-soluk kucuk sahne__olcu">
          Kare {kare() + 1}/{kareler().length}
        </span>
      </div>
      <div class={`sahne__tuval zemin--${zemin()}`}>
        <Show when={kareler()[kare()]}>{(k) => <img src={dosyaUrl(p.oge.id, k().ozet)} alt={`Kare ${kare() + 1}`} draggable={false} />}</Show>
      </div>
      <div class="oynatici">
        <button type="button" class="dg-simge" onClick={() => (setOynuyor(false), setKare((k) => (k - 1 + kareler().length) % kareler().length))} aria-label="Önceki kare">
          <Simge ad="adim" style={{ transform: "scaleX(-1)" }} />
        </button>
        <button type="button" class="dg dg--birincil oynatici__ana" onClick={() => setOynuyor(!oynuyor())} aria-label={oynuyor() ? "Durdur" : "Oynat"}>
          <Simge ad={oynuyor() ? "durdur" : "oynat"} />
        </button>
        <button type="button" class="dg-simge" onClick={() => (setOynuyor(false), setKare((k) => (k + 1) % kareler().length))} aria-label="Sonraki kare">
          <Simge ad="adim" />
        </button>
        <div class="secim">
          <For each={[0.5, 1, 2]}>
            {(h) => (
              <button type="button" aria-pressed={hiz() === h} onClick={() => setHiz(h)}>
                {String(h).replace(".", ",")}×
              </button>
            )}
          </For>
        </div>
      </div>
      <div class="kucuk-resimler">
        <For each={kareler()}>
          {(k, i) => (
            <button type="button" class={`kucuk-resim zemin--${zemin()}`} aria-selected={i() === kare()} onClick={() => (setOynuyor(false), setKare(i()))}>
              <img src={dosyaUrl(p.oge.id, k.ozet)} alt={`Kare ${i() + 1}`} loading="lazy" />
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

function SesOynatici(p: { ogeId: number; d: OgeDosyasi; etiket?: string; dongu?: number }): JSX.Element {
  const ses = new Audio();
  ses.preload = "metadata";
  ses.src = dosyaUrl(p.ogeId, p.d.ozet);
  const [ilerleme, setIlerleme] = createSignal(0);
  const [caliyor, setCaliyor] = createSignal(false);
  let kalanDongu = 0;
  ses.addEventListener("timeupdate", () => setIlerleme(ses.duration ? ses.currentTime / ses.duration : 0));
  ses.addEventListener("ended", () => {
    if (kalanDongu > 1) {
      kalanDongu -= 1;
      ses.currentTime = 0;
      void ses.play();
    } else {
      setCaliyor(false);
      setIlerleme(0);
    }
  });
  ses.addEventListener("pause", () => {
    if (!ses.ended) setCaliyor(false);
  });
  ses.addEventListener("play", () => setCaliyor(true));
  onCleanup(() => {
    ses.pause();
    ses.src = "";
  });
  const cal = (dongu = 1): void => {
    if (caliyor()) return void ses.pause();
    kalanDongu = dongu;
    void ses.play().catch(() => tost("Ses çalınamadı; cihazın sesini kontrol et.", { hata: true }));
  };
  const meta = (): { sure: number; kanal: number; ornekleme: number; dalga: number[] } | null => (p.d.meta?.tur === "ses" ? p.d.meta : null);
  const tus = (e: KeyboardEvent): void => {
    if (e.key === " " && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && !p.etiket) {
      e.preventDefault();
      cal();
    }
  };
  document.addEventListener("keydown", tus);
  onCleanup(() => document.removeEventListener("keydown", tus));
  return (
    <div class="ses">
      <div class="ses__bas">
        <button type="button" class="dg dg--birincil ses__oynat" onClick={() => cal()} aria-label={caliyor() ? "Durdur" : "Oynat"}>
          <Simge ad={caliyor() ? "durdur" : "oynat"} />
        </button>
        <div class="esnek">
          <div class="tasma ses__ad">{p.etiket ?? p.d.ad}</div>
          <Show when={meta()}>
            {(m) => (
              <div class="cok-soluk kucuk">
                {saniye(m().sure)} · {m().kanal === 1 ? "tek kanal" : `${m().kanal} kanal`} · {(m().ornekleme / 1000).toFixed(1).replace(".", ",")} kHz
              </div>
            )}
          </Show>
        </div>
        <Show when={p.dongu}>
          <button type="button" class="dg dg--k" onClick={() => cal(p.dongu)}>
            <Simge ad="tekrar" /> Döngüyü {p.dongu} kez çal
          </button>
        </Show>
      </div>
      <div
        class="dalga"
        onPointerDown={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (ses.duration) ses.currentTime = ((e.clientX - r.left) / r.width) * ses.duration;
        }}
      >
        <svg viewBox={`0 0 ${(meta()?.dalga.length ?? 1) * 4} 64`} preserveAspectRatio="none" aria-hidden="true">
          <For each={meta()?.dalga ?? []}>
            {(v, i) => <rect x={i() * 4 + 0.6} y={32 - Math.max(1, v * 30)} width="2.8" height={Math.max(2, v * 60)} rx="1.2" class={i() / (meta()?.dalga.length ?? 1) < ilerleme() ? "dalga__calan" : ""} />}
          </For>
        </svg>
        <div class="dalga__imlec" style={{ left: `${ilerleme() * 100}%`, opacity: caliyor() || ilerleme() > 0 ? 1 : 0 }} />
      </div>
    </div>
  );
}

export function SesSahne(p: { oge: OgeAyrinti; onceki: OgeAyrinti | null; muzik: boolean }): JSX.Element {
  return (
    <div class="sahne sahne--ses">
      <For each={sesler(p.oge)} fallback={<Bos simge="ses" baslik="Ses dosyası yok" />}>
        {(d) => {
          const eski = (): OgeDosyasi | undefined => (p.onceki ? sesler(p.onceki).find((x) => x.hedefYol === d.hedefYol) : undefined);
          return (
            <div class="ses-grup">
              <Show when={d.hedefYol}>
                <div class="cok-soluk kucuk mono tasma">{d.hedefYol}</div>
              </Show>
              <SesOynatici ogeId={p.oge.id} d={d} {...(p.muzik ? { dongu: 3 } : {})} />
              <Show when={eski()}>{(e) => <SesOynatici ogeId={p.onceki?.id ?? 0} d={e()} etiket={`Önceki sürüm · ${e().ad}`} />}</Show>
            </div>
          );
        }}
      </For>
      <Show when={!p.muzik}>
        <p class="cok-soluk kucuk">Eski (sentezle çalan) sesi oyunda duymak için “Oyunda gör”ü kullan.</p>
      </Show>
    </div>
  );
}

/** Liste satırı metni: havuz alanları, kalıp, ürün adı… */
export function satirMetni(s: unknown): { ana: string; ek: string } {
  if (s && typeof s === "object") {
    const o = s as Record<string, unknown>;
    if (o.alanlar && typeof o.alanlar === "object") return { ana: Object.values(o.alanlar as Record<string, unknown>).map(String).join(" · "), ek: [o.havuz, o.zorluk, o.tema].filter(Boolean).map(String).join(" · ") };
    if (typeof o.kalip === "string") return { ana: o.kalip, ek: [o.tur, o.risk].filter(Boolean).map(String).join(" · ") };
    if (typeof o.name === "string") return { ana: o.name, ek: [o.type, o.rarity, o.price === undefined ? "" : `${String(o.price)} Glix`].filter(Boolean).map(String).join(" · ") };
    if (typeof o.anahtar === "string") return { ana: o.anahtar, ek: String(o.neden ?? "") };
    return { ana: JSON.stringify(o).slice(0, 140), ek: "" };
  }
  return { ana: String(s), ek: "" };
}

export function ListeSahne(p: { oge: OgeAyrinti; secili: Set<number>; setSecili: (s: Set<number>) => void; karar: boolean }): JSX.Element {
  const [suzgec, setSuzgec] = createSignal<"hepsi" | "uyari" | "temiz">("hepsi");
  const satirSonucu = (i: number): KontrolSatiri["sonuc"] | null => {
    const l = p.oge.kontrol.satirlar.filter((s) => s.satir === i);
    if (l.some((s) => s.sonuc === "kaldi")) return "kaldi";
    if (l.some((s) => s.sonuc === "uyari")) return "uyari";
    return null;
  };
  const mesajlar = (i: number): string[] => p.oge.kontrol.satirlar.filter((s) => s.satir === i && s.sonuc !== "gecti").map((s) => s.mesaj);
  const gorunen = createMemo(() => p.oge.satirlar.map((s, i) => ({ s, i })).filter(({ i }) => suzgec() === "hepsi" || (suzgec() === "uyari" ? satirSonucu(i) !== null : satirSonucu(i) === null)));
  const degistir = (i: number): void => {
    const y = new Set(p.secili);
    if (y.has(i)) y.delete(i);
    else y.add(i);
    p.setSecili(y);
  };
  const uyarisizlar = (): number[] => p.oge.satirlar.map((_, i) => i).filter((i) => satirSonucu(i) === null);
  return (
    <div class="sahne sahne--liste">
      <div class="sahne__arac">
        <div class="secim" role="group" aria-label="Süzgeç">
          <button type="button" aria-pressed={suzgec() === "hepsi"} onClick={() => setSuzgec("hepsi")}>
            Hepsi {p.oge.satirlar.length}
          </button>
          <button type="button" aria-pressed={suzgec() === "uyari"} onClick={() => setSuzgec("uyari")}>
            Uyarılı {p.oge.satirlar.length - uyarisizlar().length}
          </button>
          <button type="button" aria-pressed={suzgec() === "temiz"} onClick={() => setSuzgec("temiz")}>
            Temiz {uyarisizlar().length}
          </button>
        </div>
        <Show when={p.karar}>
          <button type="button" class="dg dg--k" onClick={() => p.setSecili(new Set(uyarisizlar()))}>
            Uyarısızların hepsini seç
          </button>
          <span class="cok-soluk kucuk sahne__olcu">{p.secili.size} seçili</span>
        </Show>
      </div>
      <div class="tablo-kap liste-tablo">
        <table class="tablo">
          <thead>
            <tr>
              <Show when={p.karar}>
                <th style={{ width: "44px" }}>
                  <input
                    type="checkbox"
                    class="onay-kutusu"
                    aria-label="Hepsini seç"
                    checked={p.secili.size === p.oge.satirlar.length && p.oge.satirlar.length > 0}
                    onChange={(e) => p.setSecili(e.currentTarget.checked ? new Set(p.oge.satirlar.map((_, i) => i)) : new Set())}
                  />
                </th>
              </Show>
              <th style={{ width: "40px" }}>#</th>
              <th>Satır</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            <For each={gorunen()}>
              {({ s, i }) => {
                const m = satirMetni(s);
                return (
                  <tr data-secili={p.secili.has(i) ? "1" : "0"} data-uyari={satirSonucu(i) === "uyari" ? "1" : "0"} data-kaldi={satirSonucu(i) === "kaldi" ? "1" : "0"} onClick={() => p.karar && degistir(i)}>
                    <Show when={p.karar}>
                      <td>
                        <input type="checkbox" class="onay-kutusu" checked={p.secili.has(i)} onClick={(e) => e.stopPropagation()} onChange={() => degistir(i)} aria-label={`${i + 1}. satırı seç`} />
                      </td>
                    </Show>
                    <td class="cok-soluk">{i + 1}</td>
                    <td>
                      <div class="liste-tablo__ana">{m.ana}</div>
                      <Show when={m.ek}>
                        <div class="cok-soluk kucuk">{m.ek}</div>
                      </Show>
                    </td>
                    <td class="kucuk">
                      <For each={mesajlar(i)}>{(x) => <div class={satirSonucu(i) === "kaldi" ? "metin-kaldi" : "metin-uyari"}>{x}</div>}</For>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function KartSahne(p: { oge: OgeAyrinti }): JSX.Element {
  const dosyalar = (): OgeDosyasi[] => p.oge.dosyalar.filter((d) => d.tur === "png" || d.tur === "svg");
  return (
    <div class="sahne sahne--kart">
      <div class="sahne__arac">
        <ZeminSecici />
      </div>
      <For each={dosyalar()} fallback={<Bos simge="kart" baslik="Görsel yok" />}>
        {(d) => (
          <div class="kart-onizleme">
            <div class={`sahne__tuval sahne__tuval--kisa zemin--${zemin()}`}>
              <img src={dosyaUrl(p.oge.id, d.ozet)} alt={d.ad} />
            </div>
            <div class="gercek-boyut__liste">
              <For each={oyunBoyutlari(d)}>
                {(b) => (
                  <div class="gercek-boyut__oge">
                    <div class="gercek-boyut__kutu zemin--koyu">
                      <img src={dosyaUrl(p.oge.id, d.ozet)} alt="" style={{ width: `${b}px`, height: `${b}px`, color: "#fff" }} />
                    </div>
                    <div class="gercek-boyut__kutu zemin--acik">
                      <img src={dosyaUrl(p.oge.id, d.ozet)} alt="" style={{ width: `${b}px`, height: `${b}px` }} />
                    </div>
                    <span class="cok-soluk kucuk">{b} px</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

function DosyaMetni(p: { ogeId: number; d: OgeDosyasi }): JSX.Element {
  const [metin] = createResource(
    () => p.d.ozet,
    async () => {
      const r = await fetch(dosyaUrl(p.ogeId, p.d.ozet), { credentials: "same-origin" });
      return r.ok ? await r.text() : "";
    },
  );
  const goster = (): string => {
    const t = metin() ?? "";
    if (p.d.tur !== "json") return t;
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return t;
    }
  };
  return (
    <Show when={!metin.loading} fallback={<Iskelet y="160px" r="10px" />}>
      <pre class="kod-blogu">{goster()}</pre>
    </Show>
  );
}

export function MetinSahne(p: { oge: OgeAyrinti }): JSX.Element {
  return (
    <div class="sahne sahne--metin">
      <Show when={p.oge.aciklama}>
        <p class="metin-govde">{p.oge.aciklama}</p>
      </Show>
      <For each={p.oge.dosyalar.filter((d) => d.tur === "md" || d.tur === "json" || d.tur === "csv" || d.tur === "svg")}>
        {(d) => (
          <div class="yigin">
            <div class="cok-soluk kucuk mono">{d.hedefYol ?? d.ad}</div>
            <DosyaMetni ogeId={p.oge.id} d={d} />
          </div>
        )}
      </For>
    </div>
  );
}

interface WikiSayfa {
  ad?: string;
  slogan?: string;
  ozet?: string;
  kurallar?: unknown[];
  strateji?: unknown[];
}

export function WikiSahne(p: { oge: OgeAyrinti; onceki: OgeAyrinti | null }): JSX.Element {
  const d = (): OgeDosyasi | undefined => p.oge.dosyalar.find((x) => x.tur === "json");
  const e = (): OgeDosyasi | undefined => p.onceki?.dosyalar.find((x) => x.tur === "json" && x.hedefYol === d()?.hedefYol);
  const oku = async (id: number, oz: string): Promise<WikiSayfa> => {
    const r = await fetch(dosyaUrl(id, oz), { credentials: "same-origin" });
    return r.ok ? ((await r.json()) as WikiSayfa) : {};
  };
  const [yeni] = createResource(() => d()?.ozet, (oz) => oku(p.oge.id, oz));
  const [eski] = createResource(() => e()?.ozet, (oz) => oku(p.onceki?.id ?? 0, oz));
  const metin = (w: WikiSayfa | undefined): string => (w ? [w.ozet ?? "", ...(w.kurallar ?? []).map(String), ...(w.strateji ?? []).map(String)].join("\n") : "");
  return (
    <div class="sahne sahne--metin">
      <Show when={yeni()} fallback={<Iskelet y="200px" r="10px" />}>
        {(w) => (
          <article class="wiki">
            <h2>{w().ad}</h2>
            <Show when={w().slogan}>
              <p class="soluk">{w().slogan}</p>
            </Show>
            <Show when={eski()} fallback={<p class="metin-govde">{w().ozet}</p>}>
              {(es) => (
                <p class="metin-govde fark-metni">
                  <For each={kelimeFarki(metin(es()), metin(w()))}>{(f) => <span class={`fark--${f.tur}`}>{f.metin}</span>}</For>
                </p>
              )}
            </Show>
            <Show when={!eski() && w().kurallar?.length}>
              <h3>Kurallar</h3>
              <ul class="madde">
                <For each={w().kurallar}>{(k) => <li>{String(k)}</li>}</For>
              </ul>
            </Show>
          </article>
        )}
      </Show>
    </div>
  );
}

interface Rapor {
  ozet?: string;
  geceTest?: { oyun: string; gecti: number; kaldi: number }[];
  hatalar?: { baslik: string; onem?: string; siklik?: number; oyun?: string; neden?: string }[];
  performans?: { olcu: string; birim?: string; esik?: number; degerler: number[] }[];
}
const ONEM_SIRASI: Record<string, number> = { kritik: 0, yuksek: 1, orta: 2, dusuk: 3 };

export function Kivilcim(p: { degerler: number[]; esik?: number | undefined }): JSX.Element {
  const enb = (): number => Math.max(...p.degerler, p.esik ?? 0, 1);
  const nokta = (): string => p.degerler.map((v, i) => `${(i / Math.max(1, p.degerler.length - 1)) * 100},${30 - (v / enb()) * 28}`).join(" ");
  return (
    <svg class="kivilcim" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <Show when={p.esik !== undefined}>
        <line x1="0" x2="100" y1={30 - ((p.esik ?? 0) / enb()) * 28} y2={30 - ((p.esik ?? 0) / enb()) * 28} class="kivilcim__esik" />
      </Show>
      <polyline points={nokta()} fill="none" class="kivilcim__cizgi" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

export function RaporSahne(p: { oge: OgeAyrinti }): JSX.Element {
  const r = (): Rapor => (p.oge.rapor && typeof p.oge.rapor === "object" ? (p.oge.rapor as Rapor) : {});
  const duzelt = async (baslik: string): Promise<void> => {
    try {
      await gonder(`rapor/${p.oge.id}/duzelt`, { baslik: baslik.slice(0, 120), aciklama: `Rapor: ${p.oge.ad}` });
      tost("Yöneticiye iş açıldı");
    } catch (e) {
      hataTost(e);
    }
  };
  return (
    <div class="sahne sahne--rapor">
      <Show when={r().ozet ?? p.oge.aciklama}>
        <p class="metin-govde">{r().ozet ?? p.oge.aciklama}</p>
      </Show>
      <Show when={r().geceTest?.length}>
        <section class="yigin">
          <h3>Gece testleri</h3>
          <div class="test-izgara">
            <For each={r().geceTest}>
              {(t) => (
                <div class={`test-hucre ${t.kaldi > 0 ? "test-hucre--kaldi" : ""}`}>
                  <span class="tasma">{t.oyun}</span>
                  <span class="kucuk">
                    <Show when={t.kaldi > 0} fallback={<span class="metin-gecti">{t.gecti} geçti</span>}>
                      <span class="metin-kaldi">{t.kaldi} kaldı</span>
                    </Show>
                  </span>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>
      <Show when={r().hatalar?.length}>
        <section class="yigin">
          <h3>Hata kartları</h3>
          <ul class="hata-listesi">
            <For each={[...(r().hatalar ?? [])].sort((a, b) => (ONEM_SIRASI[a.onem ?? "orta"] ?? 2) - (ONEM_SIRASI[b.onem ?? "orta"] ?? 2))}>
              {(h) => (
                <li class="hata-karti">
                  <div class="satir satir--ara">
                    <span class={`etiket ${h.onem === "kritik" || h.onem === "yuksek" ? "etiket--kaldi" : h.onem === "orta" ? "etiket--uyari" : ""}`}>{h.onem ?? "orta"}</span>
                    <button type="button" class="dg dg--k" onClick={() => void duzelt(h.baslik)}>
                      <Simge ad="duzeltme" /> Düzelt
                    </button>
                  </div>
                  <strong>{h.baslik}</strong>
                  <span class="soluk kucuk">{[h.oyun, h.siklik ? `${h.siklik} kez` : "", h.neden].filter(Boolean).join(" · ")}</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
      <Show when={r().performans?.length}>
        <section class="yigin">
          <h3>Performans eğilimi</h3>
          <div class="perf-izgara">
            <For each={r().performans}>
              {(pf) => {
                const son = (): number => pf.degerler.at(-1) ?? 0;
                return (
                  <div class={`perf ${pf.esik !== undefined && son() > pf.esik ? "perf--asim" : ""}`}>
                    <div class="satir satir--ara">
                      <span class="kucuk soluk">{pf.olcu}</span>
                      <strong>
                        {son()}
                        {pf.birim ?? ""}
                      </strong>
                    </div>
                    <Kivilcim degerler={pf.degerler} esik={pf.esik} />
                  </div>
                );
              }}
            </For>
          </div>
        </section>
      </Show>
      <Show when={!r().geceTest && !r().hatalar && !r().performans}>
        <MetinSahne oge={p.oge} />
      </Show>
    </div>
  );
}

export function FikirSahne(p: { oge: OgeAyrinti; kardesler: OgeAyrinti[] }): JSX.Element {
  return (
    <div class="sahne sahne--fikir">
      <div class="fikirler">
        <For each={[p.oge, ...p.kardesler.filter((k) => k.id !== p.oge.id)]}>
          {(f, i) => (
            <article class={`fikir ${i() === 0 ? "fikir--secili" : ""}`}>
              <span class="cok-soluk kucuk">{i() === 0 ? "İncelenen fikir" : "Diğer fikir"}</span>
              <h2>{f.ad}</h2>
              <p class="metin-govde">{f.aciklama}</p>
              <Show when={f.gorunus}>
                <div class="fikir__alan">
                  <span class="cok-soluk kucuk">Görünüş, renk, hareket</span>
                  <p>{f.gorunus}</p>
                </div>
              </Show>
              <Show when={f.gerekce}>
                <div class="fikir__alan">
                  <span class="cok-soluk kucuk">Neden</span>
                  <p>{f.gerekce}</p>
                </div>
              </Show>
            </article>
          )}
        </For>
      </div>
    </div>
  );
}

export function FarkGorunumu(p: { oge: OgeAyrinti }): JSX.Element {
  return (
    <div class="yigin">
      <For each={p.oge.degisiklikler}>
        {(d) => (
          <div class="fark-kart">
            <Show when={d.id}>
              <div class="cok-soluk kucuk mono">{d.id}</div>
            </Show>
            <For each={alanFarklari(d.eski, d.yeni)}>
              {(f) => (
                <div class="fark-satir">
                  <span class="fark-satir__ad">{f.anahtar}</span>
                  <Switch>
                    <Match when={typeof f.eski === "number" && typeof f.yeni === "number"}>
                      <span class="fark-sayi">
                        <span class="fark--silindi">{degerMetni(f.eski)}</span>
                        <Simge ad="sonraki" boyut={14} />
                        <span class="fark--eklendi">{degerMetni(f.yeni)}</span>
                        <span class={`etiket ${(f.yeni as number) < (f.eski as number) ? "etiket--gecti" : "etiket--uyari"}`}>
                          {(f.yeni as number) > (f.eski as number) ? "+" : ""}
                          {Math.round((((f.yeni as number) - (f.eski as number)) / Math.max(1, Math.abs(f.eski as number))) * 100)}%
                        </span>
                      </span>
                    </Match>
                    <Match when={true}>
                      <span class="fark-metni">
                        <For each={kelimeFarki(degerMetni(f.eski), degerMetni(f.yeni))}>{(x) => <span class={`fark--${x.tur}`}>{x.metin}</span>}</For>
                      </span>
                    </Match>
                  </Switch>
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}

export const notMetinleri = HAZIR_NOTLAR;
