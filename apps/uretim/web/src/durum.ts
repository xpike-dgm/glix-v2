/** Uygulama durumu: oturum, yönlendirme, tercihler (tema, yazı boyutu), bildirimler (tost), açık katmanlar. */
import { createSignal } from "solid-js";
import { ALANLAR, type AlanId, type AlanTanimi } from "../../src/ortak/alanlar.js";
import { al } from "./api.js";

export interface Oturum {
  giris: boolean;
  eposta: string | null;
  vapid: string | null;
  onizlemeUrl: string;
  sshAcik: boolean;
  oyunAcik: boolean;
  mcpUrl: string;
  surum: string;
}

export const [oturum, setOturum] = createSignal<Oturum | null>(null);
export async function oturumYukle(): Promise<void> {
  try {
    setOturum(await al<Oturum>("oturum"));
  } catch {
    setOturum({ giris: false, eposta: null, vapid: null, onizlemeUrl: "", sshAcik: false, oyunAcik: false, mcpUrl: "", surum: "" });
  }
}

// ---- Yönlendirme ----------------------------------------------------------------------------------------
const konum = (): string => `${location.pathname}${location.search}`;
export const [yol, setYol] = createSignal(konum());
window.addEventListener("popstate", () => setYol(konum()));
export function git(hedef: string, degistir = false): void {
  if (hedef === konum()) return;
  if (degistir) history.replaceState(null, "", hedef);
  else history.pushState(null, "", hedef);
  setYol(konum());
  window.scrollTo({ top: 0 });
}
export const yolAdi = (): string => yol().split("?")[0] ?? "/";
export const sorgu = (): URLSearchParams => new URLSearchParams(yol().split("?")[1] ?? "");

// ---- Tercihler -------------------------------------------------------------------------------------------
const oku = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
export const yazTercih = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Özel pencere: tercih bu oturumla sınırlı kalır.
  }
};
export type Tema = "sistem" | "acik" | "koyu";
const temaOku = (): Tema => {
  const t = oku("uretim:tema");
  return t === "acik" || t === "koyu" ? t : "sistem";
};
export const [tema, setTemaSinyal] = createSignal<Tema>(temaOku());
export const [yaziBuyuk, setYaziBuyukSinyal] = createSignal(oku("uretim:yazi") === "buyuk");
export function tercihleriUygula(): void {
  const d = document.documentElement;
  if (tema() === "sistem") delete d.dataset.tema;
  else d.dataset.tema = tema();
  if (yaziBuyuk()) d.dataset.yazi = "buyuk";
  else delete d.dataset.yazi;
}
export function setTema(t: Tema): void {
  setTemaSinyal(t);
  yazTercih("uretim:tema", t);
  tercihleriUygula();
}
export function setYaziBuyuk(b: boolean): void {
  setYaziBuyukSinyal(b);
  yazTercih("uretim:yazi", b ? "buyuk" : "normal");
  tercihleriUygula();
}
export const koyuMu = (): boolean => (tema() === "sistem" ? matchMedia("(prefers-color-scheme: dark)").matches : tema() === "koyu");
export const rehberGoruldu = (): boolean => oku("uretim:rehber") === "1";
export const rehberiKapat = (): void => yazTercih("uretim:rehber", "1");

// ---- Tost ------------------------------------------------------------------------------------------------
export interface Tost {
  id: number;
  metin: string;
  hata: boolean;
  eylem: { ad: string; f: () => void } | null;
  sure: number;
  baslangic: number;
}
export const [tostlar, setTostlar] = createSignal<Tost[]>([]);
let tostNo = 0;
export function tost(metin: string, o: { hata?: boolean; eylem?: { ad: string; f: () => void }; sure?: number } = {}): number {
  const id = ++tostNo;
  const sure = o.sure ?? (o.eylem ? 10_000 : 3200);
  setTostlar((l) => [...l.slice(-2), { id, metin, hata: o.hata ?? false, eylem: o.eylem ?? null, sure, baslangic: Date.now() }]);
  setTimeout(() => tostKapat(id), sure);
  return id;
}
export const tostKapat = (id: number): void => setTostlar((l) => l.filter((t) => t.id !== id));
export const hataTost = (e: unknown): void => {
  tost(e instanceof Error ? e.message : "Bir sorun oldu.", { hata: true, sure: 5000 });
};

// ---- Katmanlar -------------------------------------------------------------------------------------------
export const [paletAcik, setPaletAcik] = createSignal(false);
export const [kisayolAcik, setKisayolAcik] = createSignal(false);

// ---- Alanlar ---------------------------------------------------------------------------------------------
export const alanBul = (id: string): AlanTanimi | undefined => ALANLAR.find((a) => a.id === id);
export const alanRengi = (id: AlanId | string): string => `var(--a-${id})`;
export const titret = (ms = 12): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Titreşim yoksa sessizce geçilir.
  }
};
