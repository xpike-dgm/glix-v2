import { type Accessor, createMemo } from "solid-js";

/**
 * Kaynağın son dolu değerini tutan okuyucu: kaynak `null`/`undefined` olunca bir önceki değer kalır.
 *
 * Ekran ağacı `<Match when={...}>{(x) => ...}</Match>` biçiminde daraltılmış bir okuyucu kullanırsa, koşul
 * bozulduğu anda (ör. maç biterken sonuçtan finale geçiş) o okuyucuyu okuyan her hesap Solid'in
 * "Stale read from <Match>." hatasını fırlatır. Bu hata o anki güncelleme turunu yarıda keser; Solid'in
 * kuyruğunda bekleyen hesaplar (ekran seçimi dahil) bir daha çalışmaz ve uygulama donar. Ekranlar bu yüzden
 * daraltılmış okuyucu yerine bunu okur: geçiş sırasında geç kalan bir hesap fırlatmaz, son geçerli değeri görür
 * ve ekran değişince zaten kaldırılır. Değer anahtarlı (`keyed`) değildir: aynı nesne (store vekili) kaldıkça
 * okuyucu değişmez, yamalarda ekran yeniden kurulmaz.
 */
export function createHeld<T>(source: Accessor<T | null | undefined>): Accessor<T | undefined> {
  return createMemo<T | undefined>((prev) => source() ?? prev);
}
