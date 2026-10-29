import { createSignal } from "solid-js";
import { parseQuestsState, type QuestsDoneInfo, type QuestsState } from "./questRules.js";

/** Günlük görevler (hesaplı oyuncu, anahtar açıksa). Kapalıyken ya da hata olunca durum `null`/kapalıdır: kart çizilmez. */
const [quests, setQuests] = createSignal<QuestsState | null>(null);
/** Maç sonunda tamamlanan görevler (Final satırı); odadan çıkılınca temizlenir. */
const [questsDone, setQuestsDone] = createSignal<QuestsDoneInfo | null>(null);

export { quests, questsDone };

let seq = 0;
let frozen = false;

/** Yalnız geliştirme önizlemesi: durum sabitlenir, ağ kullanılmaz. */
export function freezeQuests(next: QuestsState): void {
  frozen = true;
  seq++; // uçuştaki istek sonucu ezmesin
  setQuests(next);
}

export async function loadQuests(): Promise<void> {
  if (frozen) return;
  const mine = ++seq;
  try {
    const res = await fetch("/api/quests", { credentials: "same-origin" });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // gövde okunamadı
    }
    if (mine !== seq) return;
    setQuests(res.status === 200 ? parseQuestsState(data, Date.now()) : null);
  } catch {
    if (mine === seq) setQuests(null);
  }
}

export function resetQuests(): void {
  seq++;
  if (frozen) return;
  setQuests(null);
}

/** Sunucudan `questsDone`: Final satırı gösterilir, kart tazelenir. */
export function receiveQuestsDone(info: QuestsDoneInfo): void {
  setQuestsDone(info);
  void loadQuests();
}

export function freezeQuestsDone(info: QuestsDoneInfo): void {
  setQuestsDone(info);
}

export function clearQuestsDone(): void {
  setQuestsDone(null);
}
