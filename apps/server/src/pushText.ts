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

/**
 * Arkadaş daveti bildirimi. Kullanıcı adı yalnız harf/rakam/alt çizgidir; `url` hizmet çalışanının tıklamada
 * açtığı adrestir (oda kodu `?oda=` ile gelir, ana sayfa katılma ekranını açar).
 */
export function invitePayload(from: string, roomCode: string): string {
  return JSON.stringify({
    title: "GLIX daveti",
    body: `${from} seni GLIX odasına çağırıyor`,
    tag: `glix-davet-${roomCode}`,
    url: `/?oda=${roomCode}`,
  });
}
