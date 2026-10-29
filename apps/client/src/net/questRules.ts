import { type QuestCompleted, type QuestView, questById } from "@glix/engine";
import { balanceText } from "./glixRules.js";

/** Günlük görev verisi ve saf yardımcıları (ağdan gelen hiçbir şeye güvenilmez). Metin her zaman yerel havuzdan gelir. */

export type QuestsState =
  | { enabled: false }
  | {
      enabled: true;
      quests: QuestView[];
      /** İstanbul gece yarısı (sunucu saatiyle, ms). */
      endsAt: number;
      /** Sunucu - yerel saat farkı (ms). */
      clockOffset: number;
    };

const MAX_REWARD = 10_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonNeg(v: unknown, max = Number.MAX_SAFE_INTEGER): number | null {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max ? v : null;
}

function parseQuest(v: unknown): QuestView | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.done !== "boolean") return null;
  const def = questById(v.id);
  const progress = nonNeg(v.progress, 1_000_000);
  const reward = nonNeg(v.reward, MAX_REWARD);
  const target = nonNeg(v.target, 1_000_000);
  if (!def || progress === null || reward === null || target === null || target === 0) return null;
  return {
    id: def.id,
    text: def.text,
    target,
    progress: Math.min(progress, target),
    reward,
    done: v.done || progress >= target,
  };
}

/** `GET /api/quests` yanıtı; geçersizse null. Kapalıysa `{enabled:false}` (kart çizilmez). */
export function parseQuestsState(data: unknown, localNow: number): QuestsState | null {
  if (!isRecord(data) || data.ok !== true || typeof data.enabled !== "boolean") return null;
  if (!data.enabled) return { enabled: false };
  const endsAt = nonNeg(data.endsAt);
  const serverNow = nonNeg(data.serverNow);
  if (endsAt === null || serverNow === null || !Array.isArray(data.quests) || data.quests.length > 3)
    return null;
  const quests: QuestView[] = [];
  for (const raw of data.quests) {
    const q = parseQuest(raw);
    if (q === null) return null;
    quests.push(q);
  }
  if (quests.length === 0) return null;
  return { enabled: true, quests, endsAt, clockOffset: serverNow - localNow };
}

export interface QuestsDoneInfo {
  quests: QuestCompleted[];
  balance: number;
}

/** `questsDone` mesajının gövdesi; geçersizse null. */
export function parseQuestsDone(data: unknown): QuestsDoneInfo | null {
  if (!isRecord(data) || !Array.isArray(data.quests) || data.quests.length === 0 || data.quests.length > 3)
    return null;
  const balance = nonNeg(data.balance);
  if (balance === null) return null;
  const quests: QuestCompleted[] = [];
  for (const raw of data.quests) {
    if (!isRecord(raw) || typeof raw.id !== "string") return null;
    const def = questById(raw.id);
    const reward = nonNeg(raw.reward, MAX_REWARD);
    if (!def || reward === null || reward === 0) return null;
    if (quests.some((q) => q.id === def.id)) return null;
    quests.push({ id: def.id, text: def.text, reward });
  }
  return { quests, balance };
}

/** "Görev tamamlandı: +50 Glix" (birden çoksa toplam). */
export function questDoneText(info: QuestsDoneInfo): string {
  const total = info.quests.reduce((s, q) => s + q.reward, 0);
  return `${info.quests.length > 1 ? "Görevler tamamlandı" : "Görev tamamlandı"}: +${balanceText(total)} Glix`;
}

/** Kartın geri sayımı: "05:12:33 kaldı". */
export const questResetText = (clock: string): string => `${clock} kaldı`;

/** Tamamlanan görev sayısı ("1/3"). */
export const questCountText = (quests: readonly QuestView[]): string =>
  `${quests.filter((q) => q.done).length}/${quests.length}`;

/** Satırdaki ilerleme metni ("2/3"); her görevde aynı hizada, tek seferlik görevde de ("0/1"). */
export const questProgressText = (q: QuestView): string => `${q.progress}/${q.target}`;
