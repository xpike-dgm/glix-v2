/** Arayüz biçimlendirme: göreli zaman, boyut, yüzde. Saf işlevler (testli). */

export function goreliZaman(t: number, simdi: number): string {
  const fark = Math.max(0, simdi - t);
  const dk = Math.floor(fark / 60_000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  const gun = Math.floor(sa / 24);
  if (gun === 1) return "dün";
  if (gun < 7) return `${gun} gün önce`;
  return new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function tarihSaat(t: number): string {
  return new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function boyut(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0).replace(".", ",")} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(b / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}

export const yuzde = (x: number): string => `%${Math.round(x * 100)}`;

export function sure(ms: number): string {
  const dk = Math.round(ms / 60_000);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  return sa < 48 ? `${sa} sa` : `${Math.round(sa / 24)} gün`;
}

export function saniye(sn: number): string {
  if (sn < 60) return `${sn.toFixed(sn < 10 ? 2 : 1).replace(".", ",")} sn`;
  const d = Math.floor(sn / 60);
  return `${d}:${String(Math.round(sn % 60)).padStart(2, "0")}`;
}

/** Günün saatine göre selam. */
export function selam(saat: number): string {
  if (saat < 6) return "İyi geceler";
  if (saat < 12) return "Günaydın";
  if (saat < 18) return "İyi günler";
  return "İyi akşamlar";
}
