/** Kelime farkı (UM-U6): en uzun ortak alt dizi ile eklenen/silinen kelimeler. */

export type FarkParcasi = { tur: "ayni" | "eklendi" | "silindi"; metin: string };

export function kelimeFarki(eski: string, yeni: string): FarkParcasi[] {
  const a = eski.split(/(\s+)/).filter((x) => x !== "");
  const b = yeni.split(/(\s+)/).filter((x) => x !== "");
  // Çok uzun metinde (performans) satır bazına düş.
  if (a.length * b.length > 400_000)
    return [
      { tur: "silindi", metin: eski },
      { tur: "eklendi", metin: yeni },
    ];
  const n = a.length;
  const m = b.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) {
      const satir = t[i] as number[];
      satir[j] =
        a[i] === b[j] ? (t[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(t[i + 1]?.[j] ?? 0, satir[j + 1] ?? 0);
    }
  const out: FarkParcasi[] = [];
  const ekle = (tur: FarkParcasi["tur"], metin: string): void => {
    const son = out.at(-1);
    if (son && son.tur === tur) son.metin += metin;
    else out.push({ tur, metin });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ekle("ayni", a[i] ?? "");
      i++;
      j++;
    } else if ((t[i + 1]?.[j] ?? 0) >= (t[i]?.[j + 1] ?? 0)) ekle("silindi", a[i++] ?? "");
    else ekle("eklendi", b[j++] ?? "");
  }
  while (i < n) ekle("silindi", a[i++] ?? "");
  while (j < m) ekle("eklendi", b[j++] ?? "");
  return out;
}

/** Değer metni: sayı, metin ya da JSON. */
export const degerMetni = (v: unknown): string =>
  typeof v === "string"
    ? v
    : typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : v === undefined
        ? "—"
        : JSON.stringify(v);

/** Değişiklik satırları: anahtar başına eski → yeni (yalnız değişenler). */
export function alanFarklari(
  eski: Record<string, unknown>,
  yeni: Record<string, unknown>,
): { anahtar: string; eski: unknown; yeni: unknown }[] {
  const anahtarlar = [...new Set([...Object.keys(eski), ...Object.keys(yeni)])];
  return anahtarlar
    .filter((k) => JSON.stringify(eski[k]) !== JSON.stringify(yeni[k]))
    .map((k) => ({ anahtar: k, eski: eski[k], yeni: yeni[k] }));
}
