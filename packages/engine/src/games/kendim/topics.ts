import type { KendimTopic } from "./types.js";

/**
 * Kendim'in yerleşik konu listesi (KN-M2). Listeyi sahip yazar (yönetici paneli: İçerik → "Kendim konuları");
 * yapay zekâyla üretilmez. Başlangıçta yalnız bugünkü konu vardır; yeni konular buraya ya da panele eklenir.
 * Her satır bir konu ve yazı kutusundaki ipucu (ör. `{ topic: "Hayvan olsaydın?", hint: "Ben bir…" }`).
 */
export const KENDIM_TOPICS: readonly KendimTopic[] = [{ topic: "Kendini anlat", hint: "Ben…" }];
