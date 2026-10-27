/** Bildirim türleri ve metinleri. Metin geneldir; yalnız oda kodu geçer, oyun içeriği ya da gizli bilgi asla. */
export type PushKind = "start" | "turn" | "rematch";

const TITLES: Record<PushKind, string> = {
  start: "Oyun başlıyor!",
  turn: "Sıra sende!",
  rematch: "Yeni maç",
};

/** Hizmet çalışanının (`public/sw-push.js`) okuduğu JSON: başlık, gövde, aynı oda için tek bildirim etiketi. */
export function pushPayload(kind: PushKind, roomCode: string): string {
  return JSON.stringify({ title: TITLES[kind], body: `Oda ${roomCode}`, tag: `glix-${roomCode}` });
}
