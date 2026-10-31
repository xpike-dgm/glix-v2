import type { KaralamaStroke, RoomSnapshot } from "@glix/engine";
import { createSignal } from "solid-js";
import { type ParsedStep, parseBozukPublicView } from "../games/bozuk-telefon/view.js";
import { parseKaralamaPublicView } from "../games/karalama-defteri/view.js";

/** Maç sonu galerisine girebilecek en çok çizim sayısı (en yeniler kalır). */
export const GALLERY_MAX = 12;

export interface GalleryItem {
  /** Aynı çizimin tekrar eklenmemesi için kararlı anahtar. */
  key: string;
  game: "karalama" | "bozuk";
  /** Çizimi yapan oyuncu. */
  playerId: string;
  strokes: KaralamaStroke[];
  /** Çizim değişince değişen kısa anahtar (DrawingCanvas için). */
  version: string;
}

const [items, setItems] = createSignal<GalleryItem[]>([]);
let roomCode = "";

/** Galerideki çizimler (en eskiden en yeniye). */
export const galleryItems = items;

export function clearGallery(): void {
  roomCode = "";
  setItems([]);
}

/** Yalnız geliştirme önizlemesi ve testler için. */
export function seedGallery(list: GalleryItem[]): void {
  setItems(list.slice(-GALLERY_MAX));
}

function add(found: GalleryItem[]): void {
  if (found.length === 0) return;
  setItems((cur) => {
    const next = [...cur];
    for (const it of found) {
      const at = next.findIndex((x) => x.key === it.key);
      if (at >= 0) next[at] = it;
      else next.push(it);
    }
    return next.slice(-GALLERY_MAX);
  });
}

const sig = (strokes: readonly KaralamaStroke[]): string =>
  `${strokes.length}:${strokes.reduce((n, s) => n + s.length, 0)}`;

/**
 * Sunucunun odaya zaten herkese açık gönderdiği çizimleri (Karalama oylaması/sonucu, Bozuk Telefon gösterisi)
 * maç boyunca biriktirir. Gizli hiçbir şey okunmaz: yalnız `publicView`. Lobiye dönünce ya da oda değişince silinir.
 */
export function collectGallery(snap: RoomSnapshot | null): void {
  if (!snap || snap.phase === "lobby") {
    if (items().length > 0 || roomCode !== "") clearGallery();
    return;
  }
  if (snap.code !== roomCode) {
    if (roomCode !== "") setItems([]);
    roomCode = snap.code;
  }
  const m = snap.match;
  if (!m) return;
  if (m.gameId === "karalama-defteri") {
    const pv = parseKaralamaPublicView(m.publicView);
    if (!pv?.drawings || (pv.phase !== "vote" && pv.phase !== "done")) return;
    const found: GalleryItem[] = [];
    for (const id of pv.players) {
      const d = pv.drawings[id];
      if (d && d.strokes.length > 0)
        found.push({
          key: `kd:${m.round}:${id}`,
          game: "karalama",
          playerId: id,
          strokes: d.strokes,
          version: sig(d.strokes),
        });
    }
    add(found);
  } else if (m.gameId === "bozuk-telefon") {
    // Yazarlar yalnız zincir sonucunda açılır (isimsiz oylama); galeriye o anda ve oyun sonu özetinden girer.
    const pv = parseBozukPublicView(m.publicView);
    if (!pv) return;
    const found: GalleryItem[] = [];
    const push = (chain: number, i: number, step: ParsedStep): void => {
      if (step.kind === "draw" && step.author !== null && step.drawing.strokes.length > 0)
        found.push({
          key: `bt:${m.round}:${chain}:${i}`,
          game: "bozuk",
          playerId: step.author,
          strokes: step.drawing.strokes,
          version: sig(step.drawing.strokes),
        });
    };
    if (pv.reveal?.stage === "result") {
      const chain = pv.reveal.chain;
      for (const [i, step] of pv.reveal.steps.entries()) push(chain, i, step);
    }
    for (const r of pv.recap ?? []) for (const [i, step] of r.steps.entries()) push(r.chain, i, step);
    add(found);
  }
}
