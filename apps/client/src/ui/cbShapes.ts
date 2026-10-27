/**
 * Renk körlüğü dostu mod: renkle verilen bilgiye ikinci ipucu. Her renk sırasına ayrı bir şekil ve ayrı bir desen düşer.
 * Zaman Bombası tuşlarındaki dört şekille (kare, üçgen, yıldız, daire) tutarlıdır: kablo ve tuş renkleri aynı şekli taşır.
 */
export interface CbShape {
  /** Ekran okuyucu ve ipucu için kısa ad. */
  name: string;
  /** 24x24 kutuda çizim; dolgu `currentColor`. */
  path: string;
  /** Yalnız çizgi (içi boş) mi. */
  outline?: boolean;
}

export const CB_SHAPES: readonly CbShape[] = [
  { name: "daire", path: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z" },
  { name: "kare", path: "M5 5h14v14H5z" },
  { name: "üçgen", path: "M12 3.5L21.5 20h-19z" },
  { name: "yıldız", path: "M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8z" },
  { name: "baklava", path: "M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" },
  { name: "artı", path: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" },
  { name: "altıgen", path: "M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" },
  { name: "halka", path: "M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z", outline: true },
];

export const CB_COUNT = CB_SHAPES.length;

/** Herhangi bir sayı (negatifler dahil) 0–7 arasına sarılır. */
export function cbIndex(i: number): number {
  return ((Math.trunc(i) % CB_COUNT) + CB_COUNT) % CB_COUNT;
}

export function cbShape(i: number): CbShape {
  return CB_SHAPES[cbIndex(i)] as CbShape;
}

/** Bir değerin bir listedeki sırası; yoksa 0. */
export function cbIndexIn<T>(list: readonly T[], value: T): number {
  const at = list.indexOf(value);
  return at < 0 ? 0 : at;
}
