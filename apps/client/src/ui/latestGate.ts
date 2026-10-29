/**
 * "Son istek kazanır" kapısı: her `begin()` yeni bir istek açar ve önceki isteklerin sonucunu geçersiz kılar.
 * Eşzamansız sonuç, aradan daha yeni bir istek geçtiyse (ör. önbellekten anında dönen yeni afiş, yavaş eski afişin
 * ardından) ekrana yazılmamalıdır.
 */
export function latestGate(): () => () => boolean {
  let n = 0;
  return () => {
    const mine = ++n;
    return () => mine === n;
  };
}
