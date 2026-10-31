/**
 * Önizleme sayfası protokolü (UM-U4, MG-6; sözleşme `docs/uretim/SOZLESME.md` bölüm 4). Saf: kaynak denetimi ve
 * iletinin doğrulanması. Sayfa yalnız Üretim Merkezi'nin içinde (iframe) çalışır; iletiler yalnız onun kaynağından
 * kabul edilir.
 */
import { type CosmeticItem, parseShopItem, validateShopItem } from "@glix/engine";
import { isDraftUrl, normalizeGamePath } from "../ui/assetOverride.js";

export const PREVIEW_PROTOCOL_VERSION = 1;
/** Canlıda iletisi kabul edilen tek kaynak. */
export const URETIM_ORIGIN = "https://uretim.dgmcraft.online";

export const PREVIEW_SCREENS = [
  "magaza-kart",
  "avatar-lobi",
  "skor-seridi",
  "kursu",
  "zafer",
  "giris",
  "kart-arkasi",
  "koleksiyon",
  "ses-ani",
  "oyun-ani",
] as const;
export type PreviewScreen = (typeof PREVIEW_SCREENS)[number];

/** Bir istekte en çok taslak dosya. */
export const PREVIEW_MAX_FILES = 64;

export interface PreviewRequest {
  ekran: PreviewScreen;
  /** Doğrulanmış taslak ürün satırları (ilk satır ekranın ürünüdür). */
  items: CosmeticItem[];
  /** Oyun yolu (`/assets/...`) -> taslak adresi. */
  files: Map<string, string>;
  oyun: string | null;
  an: string | null;
}

/** Sayfanın kendi adresine göre: yerelde yerel kaynaklar da kabul edilir; canlıda yalnız Üretim Merkezi. */
export function originAllowed(origin: string, pageHost: string): boolean {
  if (origin === URETIM_ORIGIN) return true;
  const local = pageHost === "localhost" || pageHost === "127.0.0.1";
  return local && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(origin);
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Ürün satırını (katalog biçimi) ürüne çevirir; geçersizse hata metinleri. */
export function draftItem(row: unknown): CosmeticItem | string[] {
  const it = parseShopItem(row);
  if (it) return it;
  const errors = validateShopItem(row, []).errors;
  return errors.length > 0 ? errors : ["ürün satırı geçersiz"];
}

/** `goster` iletisini doğrular; geçersizse Türkçe neden. */
export function parsePreviewMessage(
  data: unknown,
): { ok: true; req: PreviewRequest } | { ok: false; neden: string } {
  if (!isRec(data) || data.tur !== "goster") return { ok: false, neden: "Bilinmeyen ileti." };
  const ekran = PREVIEW_SCREENS.find((s) => s === data.ekran);
  if (!ekran) return { ok: false, neden: `Bilinmeyen ekran. Ekranlar: ${PREVIEW_SCREENS.join(", ")}.` };
  const items: CosmeticItem[] = [];
  const rows =
    data.katalogSatiri === undefined
      ? []
      : Array.isArray(data.katalogSatiri)
        ? data.katalogSatiri
        : [data.katalogSatiri];
  if (rows.length > 12) return { ok: false, neden: "En çok 12 katalog satırı." };
  for (const r of rows) {
    const it = draftItem(r);
    if (Array.isArray(it)) return { ok: false, neden: `Katalog satırı geçersiz: ${it.join("; ")}` };
    items.push(it);
  }
  const files = new Map<string, string>();
  if (data.dosyalar !== undefined) {
    if (!isRec(data.dosyalar)) return { ok: false, neden: "dosyalar bir nesne olmalı." };
    const entries = Object.entries(data.dosyalar);
    if (entries.length > PREVIEW_MAX_FILES) return { ok: false, neden: `En çok ${PREVIEW_MAX_FILES} dosya.` };
    for (const [path, url] of entries) {
      const p = normalizeGamePath(path);
      if (p === null) return { ok: false, neden: `Dosya yolu geçersiz: ${path}` };
      if (typeof url !== "string" || !isDraftUrl(url))
        return { ok: false, neden: `Dosya adresi data: ya da blob: olmalı: ${path}` };
      files.set(p, url);
    }
  }
  let oyun: string | null = null;
  let an: string | null = null;
  if (data.secenekler !== undefined) {
    if (!isRec(data.secenekler)) return { ok: false, neden: "secenekler bir nesne olmalı." };
    const s = data.secenekler;
    if (s.oyun !== undefined) {
      if (typeof s.oyun !== "string" || !/^[a-z0-9-]{1,40}$/.test(s.oyun))
        return { ok: false, neden: "secenekler.oyun geçersiz." };
      oyun = s.oyun;
    }
    if (s.an !== undefined) {
      if (typeof s.an !== "string" || !/^[a-z0-9-]{1,40}$/.test(s.an))
        return { ok: false, neden: "secenekler.an geçersiz." };
      an = s.an;
    }
    if (s.tema !== undefined && s.tema !== "koyu")
      return { ok: false, neden: 'secenekler.tema yalnız "koyu".' };
  }
  const needsItem: readonly PreviewScreen[] = [
    "magaza-kart",
    "avatar-lobi",
    "skor-seridi",
    "kursu",
    "zafer",
    "giris",
    "kart-arkasi",
    "koleksiyon",
  ];
  if (needsItem.includes(ekran) && items.length === 0)
    return { ok: false, neden: "Bu ekran katalogSatiri ister." };
  if (ekran === "oyun-ani" && (oyun === null || an === null))
    return { ok: false, neden: "oyun-ani ekranı secenekler.oyun ve secenekler.an ister." };
  if (ekran === "ses-ani" && oyun === null)
    return { ok: false, neden: "ses-ani ekranı secenekler.oyun ister." };
  return { ok: true, req: { ekran, items, files, oyun, an } };
}

/** Ekran ile ürün türü uyumu: hangi ekranda hangi türler gösterilebilir. */
export function screenFits(ekran: PreviewScreen, type: CosmeticItem["type"]): boolean {
  switch (ekran) {
    case "magaza-kart":
    case "koleksiyon":
      return true;
    case "avatar-lobi":
    case "skor-seridi":
      return type === "unvan" || type === "ad-efekti" || type === "cerceve";
    case "kursu":
      return ["dans", "sapka", "ust", "alt", "ayakkabi", "aksesuar", "kostum"].includes(type);
    case "zafer":
      return type === "zafer";
    case "giris":
      return type === "giris";
    case "kart-arkasi":
      return type === "kart-arkasi";
    default:
      return false;
  }
}
