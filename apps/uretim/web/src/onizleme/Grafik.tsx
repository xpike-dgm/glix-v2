/**
 * Bağımlılıksız SVG grafikler (rapor panosu): çizgi ve çubuk. Gerçek piksel genişliğinde çizilir (ResizeObserver),
 * böylece telefonda yazılar küçülmez. Dokunma/fare ile en yakın nokta seçilir ve değeri gösterilir; klavyeyle sol/sağ.
 * Eşik kesik çizgiyle; önceki raporun aynı serisi soluk kesik çizgiyle.
 */
import { createMemo, createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { eksenBasamaklari, sayiBicimi } from "./raporHesap.js";

export { eksenBasamaklari, sayiBicimi } from "./raporHesap.js";

export interface GrafikSerisi {
  ad: string;
  tur: "cizgi" | "cubuk";
  birim?: string;
  etiketler: string[];
  degerler: number[];
  esik?: number;
}

function genislikIzle(): [() => number, (el: HTMLElement) => void] {
  const [g, setG] = createSignal(0);
  let ro: ResizeObserver | undefined;
  const bagla = (el: HTMLElement): void => {
    onMount(() => {
      setG(el.clientWidth);
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver((e) => setG(Math.round(e[0]?.contentRect.width ?? el.clientWidth)));
        ro.observe(el);
      }
    });
    onCleanup(() => ro?.disconnect());
  };
  return [g, bagla];
}

export function Grafik(p: {
  seri: GrafikSerisi;
  onceki?: GrafikSerisi | undefined;
  yukseklik?: number;
}): JSX.Element {
  const [genislik, bagla] = genislikIzle();
  const [secili, setSecili] = createSignal<number | null>(null);
  const H = (): number => p.yukseklik ?? 200;
  const kenar = { sol: 44, sag: 12, ust: 14, alt: 28 };
  const W = (): number => Math.max(260, genislik());
  const n = (): number => p.seri.degerler.length;
  const sinir = createMemo(() => {
    const tum = [
      ...p.seri.degerler,
      ...(p.onceki?.degerler ?? []),
      ...(p.seri.esik === undefined ? [] : [p.seri.esik]),
    ];
    const enk = Math.min(0, ...tum);
    const enb = Math.max(...tum, enk + 1);
    const b = eksenBasamaklari(enk, enb);
    return { enk: b[0] ?? enk, enb: b.at(-1) ?? enb, basamak: b };
  });
  const icW = (): number => W() - kenar.sol - kenar.sag;
  const icH = (): number => H() - kenar.ust - kenar.alt;
  const y = (v: number): number =>
    kenar.ust + icH() - ((v - sinir().enk) / (sinir().enb - sinir().enk || 1)) * icH();
  const cubukMu = (): boolean => p.seri.tur === "cubuk";
  const x = (i: number): number =>
    cubukMu()
      ? kenar.sol + (icW() / n()) * (i + 0.5)
      : kenar.sol + (n() <= 1 ? icW() / 2 : (icW() / (n() - 1)) * i);
  const yol = (d: number[]): string =>
    d.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const alanYolu = (): string =>
    `${yol(p.seri.degerler)}L${x(n() - 1).toFixed(1)},${y(sinir().enk)}L${x(0).toFixed(1)},${y(sinir().enk)}Z`;
  /** Sığan kadar x etiketi (üst üste binmesin). */
  /** Etiketler kısaltılır; aralık en uzun etiketin genişliğine göre (üst üste binmesin). */
  const kisa = (e: string): string => (e.length > 10 ? `${e.slice(0, 9)}…` : e);
  const etiketG = (): number => Math.max(...p.seri.etiketler.map((e) => kisa(e).length), 3) * 6.4 + 12;
  const etiketAdimi = (): number => Math.max(1, Math.ceil(n() / Math.max(1, Math.floor(icW() / etiketG()))));
  const etiketGorunur = (i: number): boolean =>
    i % etiketAdimi() === 0 &&
    (i === n() - 1 || cubukMu() || n() - 1 - i >= etiketAdimi() || n() - 1 < etiketAdimi());
  const cubukG = (): number => Math.max(2, Math.min(36, (icW() / n()) * 0.62));
  const enYakin = (e: PointerEvent): void => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    let en = 0;
    let fark = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n(); i++) {
      const f = Math.abs(x(i) - px);
      if (f < fark) {
        fark = f;
        en = i;
      }
    }
    setSecili(en);
  };
  const tus = (e: KeyboardEvent): void => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const s = secili() ?? (e.key === "ArrowLeft" ? n() : -1);
    setSecili(Math.max(0, Math.min(n() - 1, s + (e.key === "ArrowLeft" ? -1 : 1))));
  };
  const asim = (v: number): boolean => p.seri.esik !== undefined && v > p.seri.esik;
  const birim = (): string => (p.seri.birim ? ` ${p.seri.birim}` : "");
  return (
    <figure class="grafik" ref={bagla}>
      <figcaption class="grafik__bas">
        <strong>{p.seri.ad}</strong>
        <span class="grafik__gosterge">
          <Show when={p.onceki}>
            <span class="grafik__anahtar grafik__anahtar--onceki">Önceki</span>
          </Show>
          <Show when={p.seri.esik !== undefined}>
            <span class="grafik__anahtar grafik__anahtar--esik">
              Eşik {sayiBicimi(p.seri.esik ?? 0)}
              {birim()}
            </span>
          </Show>
        </span>
      </figcaption>
      <Show when={genislik() > 0}>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: grafik klavyeyle gezilir (sol/sağ) */}
        <svg
          class="grafik__svg"
          width={W()}
          height={H()}
          viewBox={`0 0 ${W()} ${H()}`}
          role="img"
          aria-label={`${p.seri.ad}: ${p.seri.etiketler.map((e, i) => `${e} ${p.seri.degerler[i]}`).join(", ")}`}
          tabindex="0"
          onPointerMove={enYakin}
          onPointerDown={enYakin}
          onPointerLeave={() => setSecili(null)}
          onKeyDown={tus}
          onBlur={() => setSecili(null)}
        >
          <For each={sinir().basamak}>
            {(v) => (
              <g class="grafik__izgara">
                <line x1={kenar.sol} x2={W() - kenar.sag} y1={y(v)} y2={y(v)} />
                <text x={kenar.sol - 6} y={y(v) + 4} text-anchor="end">
                  {sayiBicimi(v)}
                </text>
              </g>
            )}
          </For>
          <For each={p.seri.etiketler}>
            {(e, i) => (
              <Show when={etiketGorunur(i()) || (!cubukMu() && i() === n() - 1)}>
                <text
                  class="grafik__xetiket"
                  x={x(i())}
                  y={H() - 8}
                  text-anchor={
                    !cubukMu() && i() === n() - 1 ? "end" : !cubukMu() && i() === 0 ? "start" : "middle"
                  }
                >
                  {kisa(e)}
                </text>
              </Show>
            )}
          </For>
          <Show when={p.seri.esik !== undefined}>
            <line
              class="grafik__esik"
              x1={kenar.sol}
              x2={W() - kenar.sag}
              y1={y(p.seri.esik ?? 0)}
              y2={y(p.seri.esik ?? 0)}
            />
          </Show>
          <Show
            when={cubukMu()}
            fallback={
              <>
                <Show when={p.onceki && p.onceki.degerler.length === n()}>
                  <path class="grafik__onceki" d={yol(p.onceki?.degerler ?? [])} />
                </Show>
                <path class="grafik__alan" d={alanYolu()} />
                <path class="grafik__cizgi" d={yol(p.seri.degerler)} />
                <For each={p.seri.degerler}>
                  {(v, i) => (
                    <circle
                      class="grafik__nokta"
                      classList={{
                        "grafik__nokta--asim": asim(v),
                        "grafik__nokta--secili": secili() === i(),
                      }}
                      cx={x(i())}
                      cy={y(v)}
                      r={secili() === i() ? 5 : n() > 40 ? 0 : 3}
                    />
                  )}
                </For>
              </>
            }
          >
            <For each={p.seri.degerler}>
              {(v, i) => (
                <>
                  <Show when={p.onceki && p.onceki.degerler.length === n()}>
                    <line
                      class="grafik__onceki-cubuk"
                      x1={x(i()) - cubukG() / 2 - 2}
                      x2={x(i()) + cubukG() / 2 + 2}
                      y1={y(p.onceki?.degerler[i()] ?? 0)}
                      y2={y(p.onceki?.degerler[i()] ?? 0)}
                    />
                  </Show>
                  <rect
                    class="grafik__cubuk"
                    classList={{ "grafik__cubuk--asim": asim(v), "grafik__cubuk--secili": secili() === i() }}
                    x={x(i()) - cubukG() / 2}
                    y={Math.min(y(v), y(0))}
                    width={cubukG()}
                    height={Math.max(1, Math.abs(y(0) - y(v)))}
                    rx="3"
                  />
                </>
              )}
            </For>
          </Show>
          <Show when={secili() !== null}>
            {(_) => {
              const i = (): number => secili() ?? 0;
              const metin = (): string =>
                `${p.seri.etiketler[i()] ?? ""}: ${sayiBicimi(p.seri.degerler[i()] ?? 0)}${birim()}${
                  p.onceki?.degerler[i()] !== undefined
                    ? ` (önceki ${sayiBicimi(p.onceki.degerler[i()] ?? 0)})`
                    : ""
                }`;
              const kutuG = (): number => Math.min(W() - 8, metin().length * 6.6 + 16);
              const kx = (): number => Math.min(Math.max(4, x(i()) - kutuG() / 2), W() - kutuG() - 4);
              return (
                <g class="grafik__ipucu" pointer-events="none">
                  <line x1={x(i())} x2={x(i())} y1={kenar.ust} y2={H() - kenar.alt} />
                  <rect x={kx()} y={2} width={kutuG()} height={22} rx="6" />
                  <text x={kx() + kutuG() / 2} y={17} text-anchor="middle">
                    {metin()}
                  </text>
                </g>
              );
            }}
          </Show>
        </svg>
      </Show>
    </figure>
  );
}
