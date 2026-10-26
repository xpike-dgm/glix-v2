export type BadgeId =
  | "blof-krali"
  | "laf-ustasi"
  | "sogukkanli"
  | "son-kacan"
  | "hayatta-kalan"
  | "acgozlu"
  | "dedektif"
  | "sanatci"
  | "hafiza-ustasi"
  | "turun-yildizi";

export interface BadgeInfo {
  id: BadgeId;
  src: string;
  label: string;
}

const entry = (id: BadgeId, label: string): BadgeInfo => ({ id, src: `/assets/badges/${id}.webp`, label });

/** Unvan rozetleri. Kazanma mantığı yok; ileride unvan sistemi bu kayıttan okur. */
export const BADGES: Readonly<Record<BadgeId, BadgeInfo>> = {
  "blof-krali": entry("blof-krali", "Blöf Kralı"),
  "laf-ustasi": entry("laf-ustasi", "Laf Ustası"),
  sogukkanli: entry("sogukkanli", "Soğukkanlı"),
  "son-kacan": entry("son-kacan", "Son Kaçan"),
  "hayatta-kalan": entry("hayatta-kalan", "Hayatta Kalan"),
  acgozlu: entry("acgozlu", "Açgözlü"),
  dedektif: entry("dedektif", "Dedektif"),
  sanatci: entry("sanatci", "Sanatçı"),
  "hafiza-ustasi": entry("hafiza-ustasi", "Hafıza Ustası"),
  "turun-yildizi": entry("turun-yildizi", "Turun Yıldızı"),
};

export function badge(id: BadgeId): BadgeInfo {
  return BADGES[id];
}
