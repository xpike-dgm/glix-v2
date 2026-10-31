/** Bileşen kütüphanesi: boş durum, iskelet, halka, alt sayfa, tost, etiketler, sekmeler. */
import { createEffect, createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { DURUM_ADI, type Durum } from "../../src/ortak/durum.js";
import type { KontrolSonucu } from "../../src/ortak/tipler.js";
import { alanBul, alanRengi, tostKapat, tostlar } from "./durum.js";
import { Simge, type SimgeAdi } from "./simgeler.js";

export function Bos(p: {
  simge: SimgeAdi;
  baslik: string;
  children?: JSX.Element;
  eylem?: JSX.Element;
}): JSX.Element {
  return (
    <div class="bos">
      <div class="bos__simge">
        <Simge ad={p.simge} />
      </div>
      <h3>{p.baslik}</h3>
      <Show when={p.children}>
        <p>{p.children}</p>
      </Show>
      {p.eylem}
    </div>
  );
}

export function Iskelet(p: { g?: string; y?: string; r?: string; class?: string }): JSX.Element {
  return (
    <div
      class={`iskelet ${p.class ?? ""}`}
      style={{ width: p.g ?? "100%", height: p.y ?? "14px", "border-radius": p.r }}
      aria-hidden="true"
    />
  );
}

export function IskeletKartlar(p: { adet: number; y?: string }): JSX.Element {
  return (
    <For each={Array.from({ length: p.adet })}>
      {() => (
        <div class="kart kart--ic yigin" aria-hidden="true">
          <Iskelet g="40%" />
          <Iskelet y={p.y ?? "64px"} r="10px" />
          <Iskelet g="70%" y="12px" />
        </div>
      )}
    </For>
  );
}

/** İlerleme halkası (0..1). `null` ise boş halka ve tire. */
export function Halka(p: {
  oran: number | null;
  boyut?: number;
  renk?: string;
  etiket?: string;
}): JSX.Element {
  const b = (): number => p.boyut ?? 40;
  const r = (): number => b() / 2 - 4;
  const cevre = (): number => 2 * Math.PI * r();
  return (
    <svg
      class="halka"
      width={b()}
      height={b()}
      viewBox={`0 0 ${b()} ${b()}`}
      style={{ "--alan-renk": p.renk }}
      role="img"
      aria-label={p.etiket ?? (p.oran === null ? "Veri yok" : `%${Math.round(p.oran * 100)}`)}
    >
      <circle class="halka__iz" cx={b() / 2} cy={b() / 2} r={r()} fill="none" stroke-width="4" />
      <circle
        class="halka__dolu"
        cx={b() / 2}
        cy={b() / 2}
        r={r()}
        fill="none"
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray={String(cevre())}
        stroke-dashoffset={String(cevre() * (1 - (p.oran ?? 0)))}
        transform={`rotate(-90 ${b() / 2} ${b() / 2})`}
      />
      <text class="halka__metin" x="50%" y="50%" text-anchor="middle" dominant-baseline="central">
        {p.oran === null ? "–" : Math.round(p.oran * 100)}
      </text>
    </svg>
  );
}

export function AlanIsareti(p: { alan: string; kisa?: boolean }): JSX.Element {
  return (
    <span class="alan-isareti">
      <span class="nokta" style={{ "--alan-renk": alanRengi(p.alan) }} />
      <Show when={!p.kisa}>{alanBul(p.alan)?.ad ?? p.alan}</Show>
    </span>
  );
}

const DURUM_TONU: Partial<Record<Durum, string>> = {
  bekliyor: "vurgu",
  havuzda: "gecti",
  pakette: "gecti",
  oyuna_eklendi: "gecti",
  canlida: "gecti",
  reddedildi: "kaldi",
  kaldi: "kaldi",
  duzeltme_istendi: "uyari",
};

export function DurumEtiketi(p: { durum: Durum }): JSX.Element {
  return <span class={`etiket etiket--${DURUM_TONU[p.durum] ?? "notr"}`}>{DURUM_ADI[p.durum]}</span>;
}

const SONUC: Record<KontrolSonucu, { ad: string; simge: SimgeAdi }> = {
  gecti: { ad: "Geçti", simge: "onay" },
  uyari: { ad: "Uyarı", simge: "uyari" },
  kaldi: { ad: "Kaldı", simge: "ret" },
};
export function SonucEtiketi(p: { sonuc: KontrolSonucu }): JSX.Element {
  return (
    <span class={`etiket etiket--${p.sonuc}`}>
      <Simge ad={SONUC[p.sonuc].simge} boyut={12} />
      {SONUC[p.sonuc].ad}
    </span>
  );
}

export function Sekmeler<T extends string>(p: {
  secenekler: { id: T; ad: string; sayi?: number }[];
  secili: T;
  sec: (t: T) => void;
  etiket: string;
}): JSX.Element {
  return (
    <div class="sekmeler" role="tablist" aria-label={p.etiket}>
      <For each={p.secenekler}>
        {(s) => (
          <button
            type="button"
            class="sekme"
            role="tab"
            aria-selected={p.secili === s.id}
            onClick={() => p.sec(s.id)}
          >
            {s.ad}
            <Show when={s.sayi}>
              <span class="sayac sayac--sessiz">{s.sayi}</span>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
}

/** Telefonda alttan açılan sayfa, geniş ekranda ortada diyalog. Esc ve perdeye dokunma kapatır. */
export function AltSayfa(p: {
  baslik: string;
  kapat: () => void;
  children: JSX.Element;
  ayak?: JSX.Element;
  genis?: boolean;
}): JSX.Element {
  let kutu: HTMLDivElement | undefined;
  const tus = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      p.kapat();
    }
  };
  onMount(() => {
    document.addEventListener("keydown", tus, true);
    const ilk = kutu?.querySelector<HTMLElement>(
      "[data-ilk-odak], textarea, input, button:not([data-kapat])",
    );
    ilk?.focus({ preventScroll: true });
  });
  onCleanup(() => document.removeEventListener("keydown", tus, true));
  // Sürükleyerek kapatma (telefon).
  let y0 = 0;
  const [kayma, setKayma] = createSignal(0);
  return (
    <Portal>
      <button type="button" class="perde" tabindex={-1} aria-label="Kapat" onClick={() => p.kapat()} />
      <div
        ref={kutu}
        class={`alt-sayfa ${p.genis ? "alt-sayfa--genis" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={p.baslik}
        style={kayma() > 0 ? { transform: `translateY(${kayma()}px)` } : {}}
      >
        <div
          class="alt-sayfa__tutamak"
          onPointerDown={(e) => {
            y0 = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (y0) setKayma(Math.max(0, e.clientY - y0));
          }}
          onPointerUp={() => {
            if (kayma() > 80) p.kapat();
            setKayma(0);
            y0 = 0;
          }}
        />
        <div class="alt-sayfa__bas">
          <h2>{p.baslik}</h2>
          <button type="button" class="dg-simge" data-kapat onClick={() => p.kapat()} aria-label="Kapat">
            <Simge ad="kapat" />
          </button>
        </div>
        <div class="alt-sayfa__govde">{p.children}</div>
        <Show when={p.ayak}>
          <div class="alt-sayfa__ayak">{p.ayak}</div>
        </Show>
      </div>
    </Portal>
  );
}

export function Tostlar(): JSX.Element {
  return (
    <div class="tostlar" role="status" aria-live="polite">
      <For each={tostlar()}>
        {(t) => (
          <div class={`tost ${t.hata ? "tost--hata" : ""}`}>
            <span class="tost__metin">{t.metin}</span>
            <Show when={t.eylem}>
              {(e) => (
                <>
                  <GeriSayim sure={t.sure} baslangic={t.baslangic} />
                  <button
                    type="button"
                    class="dg dg--k"
                    onClick={() => {
                      e().f();
                      tostKapat(t.id);
                    }}
                  >
                    {e().ad}
                  </button>
                </>
              )}
            </Show>
            <Show when={!t.eylem}>
              <button
                type="button"
                class="dg-simge"
                style={{ width: "32px", height: "32px", color: "inherit" }}
                onClick={() => tostKapat(t.id)}
                aria-label="Kapat"
              >
                <Simge ad="kapat" boyut={16} />
              </button>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

function GeriSayim(p: { sure: number; baslangic: number }): JSX.Element {
  const [kalan, setKalan] = createSignal(1);
  const z = setInterval(() => setKalan(Math.max(0, 1 - (Date.now() - p.baslangic) / p.sure)), 100);
  onCleanup(() => clearInterval(z));
  const c = 2 * Math.PI * 9;
  return (
    <svg class="tost__surec" viewBox="0 0 22 22" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.25"
        stroke-width="2"
      />
      <circle
        cx="11"
        cy="11"
        r="9"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-dasharray={String(c)}
        stroke-dashoffset={String(c * (1 - kalan()))}
        transform="rotate(-90 11 11)"
        stroke-linecap="round"
      />
    </svg>
  );
}

/** Kopyala düğmesi: kısa onay. */
export function Kopyala(p: { metin: string; etiket?: string }): JSX.Element {
  const [oldu, setOldu] = createSignal(false);
  createEffect(() => {
    if (oldu()) setTimeout(() => setOldu(false), 1600);
  });
  return (
    <button
      type="button"
      class="dg dg--k"
      onClick={() => {
        void navigator.clipboard?.writeText(p.metin).then(() => setOldu(true));
      }}
    >
      <Simge ad={oldu() ? "onay" : "kopyala"} />
      {oldu() ? "Kopyalandı" : (p.etiket ?? "Kopyala")}
    </button>
  );
}
