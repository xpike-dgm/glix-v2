/** İttifak — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §16, docs/A6-OYUNLAR.md. */

/** Sözlü pazarlık: uygulamada eylem yoktur. */
export const ITTIFAK_TALK_MS = 60_000;
export const ITTIFAK_VOTE_MS = 15_000;
/** Oylar açıldıktan sonra oy akışının gösterildiği süre (oyun bu sürenin sonunda biter). */
export const ITTIFAK_REVEAL_MS = 8_000;
export const ITTIFAK_DURATION_MS = ITTIFAK_TALK_MS + ITTIFAK_VOTE_MS + ITTIFAK_REVEAL_MS;

/** Kendin dışındaki bağlı bir katılımcıya oy ver; oylama bitene kadar değiştirilebilir (son oy geçerli). */
export type IttifakAction = { kind: "vote"; target: string };

export type IttifakPhase = "talk" | "vote" | "reveal";

export interface IttifakReveal {
  /** Her katılımcının (kendisi dışındaki) oyu: kim kime. Oy vermeyenin oyu rastgele atanmıştır. */
  votes: Record<string, string>;
  /** Oyuncu başına alınan oy sayısı (= genel skora eklenen puan). */
  scores: Record<string, number>;
}

/** Herkese açık görünüm: oylama sonuçları açılana kadar hiçbir oy ya da sayı içermez. */
export interface IttifakPublicView {
  players: string[];
  phase: IttifakPhase;
  startedAt: number;
  talkEndsAt: number;
  voteEndsAt: number;
  finishAt: number;
  reveal: IttifakReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi oyun. İzleyicide null. */
export interface IttifakView {
  myVote: string | null;
}
