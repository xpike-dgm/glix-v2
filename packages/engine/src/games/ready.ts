/**
 * Erken bitiş ortak kuralı: gönderim bekleyen aşamada, bağlı katılımcıların (en az biri) hepsi gönderdiyse true.
 * Bağlantısı kopuk katılımcı ve izleyici beklenmez (izleyici zaten `players` içinde değildir). `connected` yalnız
 * `reduce` içinde okunur ve kayda (presence) yazılır; böylece kayıttan tekrar oynatma birebir aynı kalır.
 */
export function everyoneReady(
  players: readonly string[],
  connected: readonly string[],
  done: (id: string) => boolean,
): boolean {
  const active = players.filter((id) => connected.includes(id));
  return active.length > 0 && active.every(done);
}
