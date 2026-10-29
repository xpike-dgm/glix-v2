import { type GlixPart, type GlixPartKind, matchBase } from "@glix/engine";

/** Glix verisi ve saf yardımcıları (ağdan gelen hiçbir şeye güvenilmez). */

export interface GlixEarnedInfo {
  total: number;
  parts: GlixPart[];
  balance: number;
  capped: boolean;
}

/** Tek maçta en çok: 3 maç parçası + yirmiye yakın rozet. Üstü bozuk mesajdır. */
const MAX_PARTS = 30;
/** Makul üst sınır (tek maç + tüm rozetler çok altında); bozuk değerleri ayıklar. */
const MAX_AMOUNT = 100_000;
const KINDS: readonly GlixPartKind[] = ["mac", "sira", "gununIlki", "rozet"];
const BADGE_ID = /^[a-z0-9-]{1,40}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function amount(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_AMOUNT ? v : null;
}

function parsePart(v: unknown): GlixPart | null {
  if (!isRecord(v)) return null;
  const kind = KINDS.find((k) => k === v.kind);
  const amt = amount(v.amount);
  if (kind === undefined || amt === null || amt === 0) return null;
  if (kind === "rozet") {
    return typeof v.badgeId === "string" && BADGE_ID.test(v.badgeId)
      ? { kind, amount: amt, badgeId: v.badgeId }
      : null;
  }
  return v.badgeId === undefined ? { kind, amount: amt } : null;
}

/** `glixEarned` mesajının gövdesi; geçersizse null. Toplam parçaların toplamına eşit olmalıdır. */
export function parseGlixEarned(data: unknown): GlixEarnedInfo | null {
  if (!isRecord(data) || !Array.isArray(data.parts) || data.parts.length > MAX_PARTS) return null;
  const total = amount(data.total);
  const balance = amount(data.balance);
  if (total === null || balance === null || typeof data.capped !== "boolean") return null;
  const parts: GlixPart[] = [];
  for (const raw of data.parts) {
    const p = parsePart(raw);
    if (p === null) return null;
    parts.push(p);
  }
  if (parts.reduce((s, p) => s + p.amount, 0) !== total) return null;
  // Gösterilecek bir şey yok: ne kazanç ne sınır uyarısı.
  if (total === 0 && !data.capped) return null;
  return { total, parts, balance, capped: data.capped };
}

export interface GlixLine {
  label: string;
  amount: number;
}

/**
 * Kısa döküm satırları ("Maç +10 · 1. +15 · İlk maç ×2 +25 · Rozet +50"). `placeOf`: maçtaki sıra (bilinmiyorsa null).
 * Birden çok rozet tek "Rozet" satırında toplanır.
 */
export function glixLines(earned: GlixEarnedInfo, placeOf: number | null): GlixLine[] {
  const out: GlixLine[] = [];
  let badge = 0;
  for (const p of earned.parts) {
    switch (p.kind) {
      case "mac":
        out.push({ label: "Maç", amount: p.amount });
        break;
      case "sira":
        out.push({ label: placeOf === null ? "Sıra" : `${placeOf}.`, amount: p.amount });
        break;
      case "gununIlki":
        out.push({ label: "İlk maç ×2", amount: p.amount });
        break;
      default:
        badge += p.amount;
    }
  }
  if (badge > 0) out.push({ label: "Rozet", amount: badge });
  return out;
}

/** Tek satırlık döküm metni. */
export const glixInline = (lines: readonly GlixLine[]): string =>
  lines.map((l) => `${l.label} +${balanceText(l.amount)}`).join(" · ");

export const GLIX_CAP_TEXT = "Bugünlük sınır doldu";

/** "+25 Glix" */
export function glixText(n: number): string {
  return `${n > 0 ? "+" : ""}${balanceText(n)} Glix`;
}

/** Misafire gösterilen metin ("Kayıt ol" bağlantısı yanına eklenir): tamamlama + sıralama eki; ikiye katlama ve sınır yok. */
export function guestGlixText(place: number): string {
  return `Hesap açsan +${balanceText(matchBase(place))} Glix kazanırdın`;
}

/** Bakiye rakamı: "1.250" (Türkçe binlik ayırıcı). */
export function balanceText(n: number): string {
  return n.toLocaleString("tr-TR");
}
