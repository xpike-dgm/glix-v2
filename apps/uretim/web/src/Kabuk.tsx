/** Uygulama kabuğu: kenar çubuğu (geniş ekran), üst çubuk + alt gezinme (telefon), komut paleti, kısayol listesi. */
import { createMemo, createResource, createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { ALANLAR } from "../../src/ortak/alanlar.js";
import type { Pano } from "../../src/ortak/tipler.js";
import { al, gonder } from "./api.js";
import { AltSayfa } from "./bilesenler.js";
import {
  alanRengi,
  git,
  hataTost,
  kisayolAcik,
  oturum,
  paletAcik,
  setKisayolAcik,
  setPaletAcik,
  setTema,
  tost,
  yolAdi,
} from "./durum.js";
import { Simge, type SimgeAdi } from "./simgeler.js";

export const [panoVerisi, { refetch: panoYenile }] = createResource(
  () => (oturum()?.giris ? true : null),
  async () => al<Pano>("pano").catch(() => undefined),
);
export const bekleyenToplam = (): number => panoVerisi()?.alanlar.reduce((t, a) => t + a.bekleyen, 0) ?? 0;

const GEZINME: { yol: string; ad: string; simge: SimgeAdi }[] = [
  { yol: "/", ad: "Pano", simge: "pano" },
  { yol: "/incele", ad: "İnceleme", simge: "incele" },
  { yol: "/iste", ad: "İş iste", simge: "arti" },
  { yol: "/yukle", ad: "Yükle", simge: "yukle" },
  { yol: "/arsiv", ad: "Arşiv", simge: "arsiv" },
  { yol: "/raporlar", ad: "Raporlar", simge: "rapor" },
  { yol: "/ayarlar", ad: "Ayarlar", simge: "ayar" },
];

const etkin = (y: string): boolean => (y === "/" ? yolAdi() === "/" : yolAdi().startsWith(y));
export const yazmaAlaniMi = (e: EventTarget | null): boolean =>
  e instanceof HTMLElement && (e.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName));
export const macMi = (): boolean => /Mac|iPhone|iPad/.test(navigator.platform);

export function Kabuk(p: { children: JSX.Element; baslik?: string }): JSX.Element {
  const tus = (e: KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPaletAcik(!paletAcik());
      return;
    }
    if (yazmaAlaniMi(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "?") {
      e.preventDefault();
      setKisayolAcik(true);
    } else if (e.key === "/") {
      e.preventDefault();
      setPaletAcik(true);
    } else if (e.key.toLowerCase() === "i" && !yolAdi().startsWith("/incele")) git("/incele");
  };
  onMount(() => document.addEventListener("keydown", tus));
  onCleanup(() => document.removeEventListener("keydown", tus));
  return (
    <div class="kabuk">
      <aside class="kenar" aria-label="Gezinme">
        <a
          class="marka"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            git("/");
          }}
        >
          <span class="marka__simge" aria-hidden="true">
            <Simge ad="katman" boyut={18} />
          </span>
          <span>
            <strong>Üretim Merkezi</strong>
            <small>GLIX</small>
          </span>
        </a>
        <button type="button" class="kenar__ara" onClick={() => setPaletAcik(true)}>
          <Simge ad="ara" boyut={16} />
          <span>Ara ya da komut</span>
          <span class="kisayol">{macMi() ? "⌘" : "Ctrl"} K</span>
        </button>
        <nav class="kenar__gezinme">
          <For each={GEZINME}>
            {(g) => (
              <a
                href={g.yol}
                class="kenar__baglanti"
                aria-current={etkin(g.yol) ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  git(g.yol);
                }}
              >
                <Simge ad={g.simge} boyut={18} />
                <span class="esnek">{g.ad}</span>
                <Show when={g.yol === "/incele" && bekleyenToplam() > 0}>
                  <span class="sayac">{bekleyenToplam()}</span>
                </Show>
              </a>
            )}
          </For>
        </nav>
        <div class="kenar__baslik">Alanlar</div>
        <nav class="kenar__alanlar">
          <For each={ALANLAR}>
            {(a) => {
              const kart = () => panoVerisi()?.alanlar.find((x) => x.alan === a.id);
              return (
                <a
                  href={`/alan/${a.id}`}
                  class="kenar__baglanti kenar__baglanti--alan"
                  aria-current={yolAdi() === `/alan/${a.id}` ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    git(`/alan/${a.id}`);
                  }}
                >
                  <span class="nokta" style={{ "--alan-renk": alanRengi(a.id) }} />
                  <span class="esnek tasma">{a.ad}</span>
                  <Show when={(kart()?.bekleyen ?? 0) > 0}>
                    <span class="kenar__sayi">{kart()?.bekleyen}</span>
                  </Show>
                </a>
              );
            }}
          </For>
        </nav>
      </aside>
      <div class="ana">
        <header class="ust">
          <a
            class="marka marka--kucuk"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              git("/");
            }}
            aria-label="Pano"
          >
            <span class="marka__simge" aria-hidden="true">
              <Simge ad="katman" boyut={16} />
            </span>
            <span class="gizli-gorsel">Pano</span>
          </a>
          <h1 class="ust__baslik tasma">{p.baslik ?? "Üretim Merkezi"}</h1>
          <button type="button" class="dg-simge" onClick={() => setPaletAcik(true)} aria-label="Ara">
            <Simge ad="ara" />
          </button>
        </header>
        <main class="icerik" id="icerik">
          {p.children}
        </main>
        <nav class="alt-gezinme" aria-label="Alt gezinme">
          <For each={GEZINME.filter((g) => g.yol !== "/raporlar" && g.yol !== "/yukle")}>
            {(g) => (
              <a
                href={g.yol}
                class="alt-gezinme__oge"
                classList={{ "alt-gezinme__oge--ana": g.yol === "/iste" }}
                aria-current={etkin(g.yol) ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  git(g.yol);
                }}
              >
                <span class="alt-gezinme__simge">
                  <Simge ad={g.simge} boyut={22} />
                  <Show when={g.yol === "/incele" && bekleyenToplam() > 0}>
                    <span class="alt-gezinme__sayi">{bekleyenToplam() > 99 ? "99+" : bekleyenToplam()}</span>
                  </Show>
                </span>
                <span>{g.ad}</span>
              </a>
            )}
          </For>
        </nav>
      </div>
      <Show when={paletAcik()}>
        <KomutPaleti />
      </Show>
      <Show when={kisayolAcik()}>
        <KisayolListesi />
      </Show>
    </div>
  );
}

interface PaletOgesi {
  grup: string;
  ad: string;
  alt?: string;
  simge: SimgeAdi;
  renk?: string;
  kisayol?: string;
  f: () => void;
}

interface AramaSonucu {
  alanlar: { id: string; ad: string }[];
  isler: { id: number; alan: string; baslik: string }[];
  ogeler: { id: number; alan: string; ad: string; durum: string }[];
}

function KomutPaleti(): JSX.Element {
  const [q, setQ] = createSignal("");
  const [secili, setSecili] = createSignal(0);
  const [uzak, setUzak] = createSignal<AramaSonucu | null>(null);
  let zaman: ReturnType<typeof setTimeout> | undefined;
  const kapat = (): void => {
    setPaletAcik(false);
  };
  const sabit: PaletOgesi[] = [
    ...GEZINME.map((g) => ({ grup: "Git", ad: g.ad, simge: g.simge, f: () => git(g.yol) })),
    { grup: "Eylemler", ad: "İncelemeye başla", simge: "incele", kisayol: "I", f: () => git("/incele") },
    {
      grup: "Eylemler",
      ad: "Onaylananları yöneticiye gönder",
      alt: "Entegrasyon paketi hazırlanır",
      simge: "paket",
      f: () => {
        gonder<{ paket: { klasor: string; ogeSayisi: number } }>("paket")
          .then((r) => {
            tost(`Paket hazır: ${r.paket.ogeSayisi} öğe (${r.paket.klasor})`);
            void panoYenile();
          })
          .catch(hataTost);
      },
    },
    { grup: "Eylemler", ad: "Açık tema", simge: "gunes", f: () => setTema("acik") },
    { grup: "Eylemler", ad: "Koyu tema", simge: "ay", f: () => setTema("koyu") },
    { grup: "Eylemler", ad: "Sistem teması", simge: "ayar", f: () => setTema("sistem") },
    {
      grup: "Eylemler",
      ad: "Klavye kısayolları",
      simge: "klavye",
      kisayol: "?",
      f: () => setKisayolAcik(true),
    },
    ...ALANLAR.map((a) => ({
      grup: "Alanlar",
      ad: a.ad,
      simge: "katman" as SimgeAdi,
      renk: alanRengi(a.id),
      f: () => git(`/alan/${a.id}`),
    })),
  ];
  const liste = createMemo<PaletOgesi[]>(() => {
    const t = q().trim().toLocaleLowerCase("tr-TR");
    const yerel = t ? sabit.filter((s) => s.ad.toLocaleLowerCase("tr-TR").includes(t)) : sabit;
    const u = uzak();
    const ek: PaletOgesi[] = u
      ? [
          ...u.ogeler.map((o) => ({
            grup: "Teslimler",
            ad: o.ad,
            alt: ALANLAR.find((a) => a.id === o.alan)?.ad ?? "",
            simge: "dosya" as SimgeAdi,
            renk: alanRengi(o.alan),
            f: () => git(`/incele/${o.id}`),
          })),
          ...u.isler.map((i) => ({
            grup: "İşler",
            ad: i.baslik,
            alt: ALANLAR.find((a) => a.id === i.alan)?.ad ?? "",
            simge: "liste" as SimgeAdi,
            renk: alanRengi(i.alan),
            f: () => git(`/alan/${i.alan}?sekme=isler`),
          })),
        ]
      : [];
    return [...yerel, ...ek].slice(0, 40);
  });
  const ara = (v: string): void => {
    setQ(v);
    setSecili(0);
    clearTimeout(zaman);
    if (v.trim().length < 2) return void setUzak(null);
    zaman = setTimeout(() => {
      al<AramaSonucu>(`ara?q=${encodeURIComponent(v.trim())}`)
        .then(setUzak)
        .catch(() => setUzak(null));
    }, 160);
  };
  const calistir = (o: PaletOgesi | undefined): void => {
    if (!o) return;
    kapat();
    o.f();
  };
  const tus = (e: KeyboardEvent): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSecili((s) => Math.min(liste().length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSecili((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      calistir(liste()[secili()]);
    } else if (e.key === "Escape") kapat();
  };
  let kutu: HTMLInputElement | undefined;
  onMount(() => kutu?.focus());
  return (
    <>
      <button type="button" class="perde" tabindex={-1} aria-label="Kapat" onClick={kapat} />
      <div class="palet" role="dialog" aria-modal="true" aria-label="Komut paleti">
        <div class="palet__ara">
          <Simge ad="ara" />
          <input
            ref={kutu}
            placeholder="Alan, iş, teslim ya da komut ara…"
            value={q()}
            onInput={(e) => ara(e.currentTarget.value)}
            onKeyDown={tus}
            aria-label="Ara"
          />
          <span class="kisayol">Esc</span>
        </div>
        <div class="palet__liste" role="listbox">
          <Show
            when={liste().length}
            fallback={
              <div class="bos" style={{ padding: "32px 16px" }}>
                <p>Sonuç yok. Başka bir kelime dene.</p>
              </div>
            }
          >
            <For each={liste()}>
              {(o, i) => (
                <>
                  <Show when={i() === 0 || liste()[i() - 1]?.grup !== o.grup}>
                    <div class="palet__grup">{o.grup}</div>
                  </Show>
                  <button
                    type="button"
                    class="palet__oge"
                    role="option"
                    aria-selected={secili() === i()}
                    onMouseMove={() => setSecili(i())}
                    onClick={() => calistir(o)}
                  >
                    <Show when={o.renk} fallback={<Simge ad={o.simge} />}>
                      <span class="nokta" style={{ "--alan-renk": o.renk }} />
                    </Show>
                    <span class="esnek tasma">{o.ad}</span>
                    <Show when={o.alt}>
                      <span class="cok-soluk kucuk">{o.alt}</span>
                    </Show>
                    <Show when={o.kisayol}>
                      <span class="kisayol">{o.kisayol}</span>
                    </Show>
                  </button>
                </>
              )}
            </For>
          </Show>
        </div>
        <div class="palet__ayak">
          <span>
            <span class="kisayol">↑</span> <span class="kisayol">↓</span> seç
          </span>
          <span>
            <span class="kisayol">↵</span> aç
          </span>
        </div>
      </div>
    </>
  );
}

function KisayolListesi(): JSX.Element {
  const satirlar: [string, string][] = [
    [`${macMi() ? "⌘" : "Ctrl"} K`, "Komut paleti"],
    ["/", "Ara"],
    ["I", "İncelemeye başla"],
    ["O", "Onayla"],
    ["R", "Reddet (not seç)"],
    ["D", "Düzeltme iste"],
    ["→  J", "Sıradaki"],
    ["←  K", "Önceki"],
    ["U", "Son kararı geri al"],
    ["B", "Zemin değiştir (görsel)"],
    ["Boşluk", "Oynat / durdur"],
    ["Esc", "Kapat"],
    ["?", "Bu liste"],
  ];
  return (
    <AltSayfa baslik="Klavye kısayolları" kapat={() => setKisayolAcik(false)}>
      <dl class="kisayollar">
        <For each={satirlar}>
          {([k, a]) => (
            <>
              <dt>
                <For each={k.split("  ")}>{(x) => <span class="kisayol">{x}</span>}</For>
              </dt>
              <dd>{a}</dd>
            </>
          )}
        </For>
      </dl>
    </AltSayfa>
  );
}
