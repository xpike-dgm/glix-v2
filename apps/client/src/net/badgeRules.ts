/** Rozet verisi ve saf yardımcıları (sunucu yanıtı doğrulanır; ağdan gelen hiçbir şeye güvenilmez). */

export interface BadgeInfo {
  /** Kazanılmamış gizli rozette anlamsız bir yer tutucu ("gizli-1"); simge seçmek için kullanılmaz. */
  id: string;
  name: string;
  description: string;
  secret: boolean;
  earned: boolean;
}

/** Sunucu 20'ye yakın rozet tutar; bunun çok üstü bozuk yanıttır. */
const MAX_BADGES = 60;
/** Tek bir maçta kazanılabilecek rozet sayısı üst sınırı (mesaj doğrulaması). */
export const MAX_NEW_BADGES = 20;
const ID = /^[a-z0-9-]{1,40}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

function parseBadge(v: unknown): BadgeInfo | null {
  if (!isRecord(v)) return null;
  const id = typeof v.id === "string" && ID.test(v.id) ? v.id : null;
  const name = text(v.name, 40);
  const description = text(v.description, 120);
  if (id === null || name === null || description === null) return null;
  if (typeof v.earned !== "boolean" || typeof v.secret !== "boolean") return null;
  return { id, name, description, secret: v.secret, earned: v.earned };
}

/** Profil yanıtındaki `badges` listesi; alan yoksa ya da bozuksa boş liste (eski sunucu). */
export function parseBadges(v: unknown): BadgeInfo[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, MAX_BADGES)
    .map(parseBadge)
    .filter((b): b is BadgeInfo => b !== null);
}

/** `badgesEarned` mesajındaki kimlikler: geçerli, tekrarsız, sınırlı. Hiç geçerli yoksa null. */
export function parseBadgeIds(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_NEW_BADGES) return null;
  const ids: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !ID.test(x)) return null;
    if (!ids.includes(x)) ids.push(x);
  }
  return ids;
}

/** Kazanılan kimliklerin profil listesindeki karşılıkları (listede olmayan atlanır). */
export function newBadges(ids: readonly string[], list: readonly BadgeInfo[]): BadgeInfo[] {
  return ids.flatMap((id) => {
    const found = list.find((b) => b.id === id && b.earned);
    return found ? [found] : [];
  });
}

export type MedalShape = "circle" | "hex" | "diamond" | "square";

/**
 * Madalyon şekli: renk körlüğü için renge ek olarak şekil rozet ailesini söyler
 * (daire: maç sayısı, altıgen: galibiyet, baklava: gizli, kare: diğer).
 */
export function medalShape(id: string, secret: boolean): MedalShape {
  if (secret) return "diamond";
  if (id.endsWith("-mac")) return "circle";
  if (id.includes("galibiyet")) return "hex";
  return "square";
}

/** Rozet simgesi: sayı yazan rozetlerde sayı, diğerlerinde çizim anahtarı. */
export type MedalGlyph =
  | { kind: "number"; text: string }
  | {
      kind: "icon";
      name:
        | "bayrak"
        | "kupa"
        | "yildiz"
        | "kare4"
        | "kisiler"
        | "kalp"
        | "simsek"
        | "ay"
        | "parilti"
        | "goz"
        | "kule"
        | "soru";
    };

const NUMBERS: Record<string, string> = {
  "on-mac": "10",
  "elli-mac": "50",
  "yuz-mac": "100",
  "on-galibiyet": "10",
  "yirmibes-galibiyet": "25",
};

export function medalGlyph(id: string): MedalGlyph {
  const n = NUMBERS[id];
  if (n !== undefined) return { kind: "number", text: n };
  switch (id) {
    case "ilk-mac":
      return { kind: "icon", name: "bayrak" };
    case "ilk-galibiyet":
      return { kind: "icon", name: "kupa" };
    case "cok-yonlu":
      return { kind: "icon", name: "kare4" };
    case "kalabalik-sampiyonu":
      return { kind: "icon", name: "kisiler" };
    case "can-dost":
      return { kind: "icon", name: "kalp" };
    case "seri":
      return { kind: "icon", name: "simsek" };
    case "gece-kusu":
      return { kind: "icon", name: "ay" };
    case "kahin-on":
      return { kind: "icon", name: "goz" };
    case "kule-ustasi":
      return { kind: "icon", name: "kule" };
    case "hepsi-bir-arada":
      return { kind: "icon", name: "parilti" };
    default:
      return { kind: "icon", name: "yildiz" };
  }
}

/** Profildeki özet: "5 / 15 rozet". */
export function earnedSummary(list: readonly BadgeInfo[]): string {
  return `${list.filter((b) => b.earned).length} / ${list.length} rozet`;
}
