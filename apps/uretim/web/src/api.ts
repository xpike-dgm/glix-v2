/** Sunucu istemcisi: her yazma isteği `X-Uretim: 1` başlığı taşır (CSRF koruması). Hatalar Türkçe ve yönlendirici. */

export class ApiHatasi extends Error {
  constructor(
    readonly durum: number,
    mesaj: string,
  ) {
    super(mesaj);
  }
}

type Dinleyici = () => void;
let oturumKapandi: Dinleyici = () => undefined;
export function oturumKapaninca(f: Dinleyici): void {
  oturumKapandi = f;
}

async function istek<T>(yontem: "GET" | "POST", yol: string, govde?: unknown, ham?: Blob): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api/${yol}`, {
      method: yontem,
      credentials: "same-origin",
      headers: {
        ...(yontem === "POST" ? { "X-Uretim": "1" } : {}),
        ...(ham
          ? { "Content-Type": "application/octet-stream" }
          : govde !== undefined || yontem === "POST"
            ? { "Content-Type": "application/json" }
            : {}),
      },
      ...(ham ? { body: ham } : yontem === "POST" ? { body: JSON.stringify(govde ?? {}) } : {}),
    });
  } catch {
    throw new ApiHatasi(0, "Bağlantı kurulamadı. İnternetini kontrol edip yeniden dene.");
  }
  let j: unknown = null;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  if (r.status === 401 && yol !== "oturum") oturumKapandi();
  if (!r.ok) {
    const m =
      j && typeof j === "object" && typeof (j as { mesaj?: unknown }).mesaj === "string"
        ? (j as { mesaj: string }).mesaj
        : "Bir sorun oldu. Biraz sonra yeniden dene.";
    throw new ApiHatasi(r.status, m);
  }
  return j as T;
}

export const al = <T>(yol: string): Promise<T> => istek<T>("GET", yol);
export const gonder = <T>(yol: string, govde?: unknown): Promise<T> => istek<T>("POST", yol, govde);
export const dosyaGonder = <T>(yol: string, dosya: Blob): Promise<T> =>
  istek<T>("POST", yol, undefined, dosya);

export const dosyaUrl = (ogeId: number, ozet: string): string => `/api/oge/${ogeId}/dosya/${ozet}`;
