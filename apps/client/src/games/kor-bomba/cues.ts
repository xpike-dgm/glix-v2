import type { Accessor } from "solid-js";
import { createOnce, onChange } from "../../fx/cue.js";
import type { KorBombaScreenView } from "./view.js";
import { myResult } from "./view.js";

/*
 * Kör Bomba ses anları. Görünüm her durum güncellemesinde yeniden üretilir; kaynaklar memo'dan geçtiği için ses
 * yalnız değer değişince, olay kimliği başına bir kez çalar. Ekran açılırken görülen hâl sessizdir.
 */

/** Tutan bahis (BM-U5): tur başına bir kez. Pasla yanan bahis sessizce çipe döner (BM-U4). */
export function betWonCue(view: Accessor<KorBombaScreenView | null>, fn: (turn: number) => void): void {
  const once = createOnce();
  onChange(
    () => {
      const v = view();
      const r = v ? myResult(v) : null;
      return r ? `${r.turn}:${r.correct}` : null;
    },
    (key, prev) => {
      if (prev === undefined || key === null) return;
      const v = view();
      const r = v ? myResult(v) : null;
      if (r?.correct) once(key, () => fn(r.turn));
    },
  );
}

/** Patlama hâli değişince bir kez (`live`: canlı geçiş; ekran patlamış açıldıysa false). */
export function blastCue(exploded: Accessor<boolean>, fn: (exploded: boolean, live: boolean) => void): void {
  onChange(exploded, (now, prev) => fn(now, prev !== undefined));
}
