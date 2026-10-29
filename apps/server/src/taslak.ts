/**
 * TASLAK oyunların açık geliştirme/test yolu. Sahip onayı bekleyen oyunlar (docs/TASLAK-OYUNLAR.md) varsayılan
 * olarak sunucuda YOKTUR: `GAMES`'te, katalogta, lobi seçicisinde, `setGames` doğrulamasında ve rastgele havuzda
 * görünmezler. Yalnız sunucu `GLIX_TASLAK_OYUNLAR=1` ile (ya da testte `draftGames: true` ile) açılırsa eklenirler;
 * yine de rastgele havuza girmezler (`randomPool: false`; yönetici ayarı bile bunu açamaz), yalnız ev sahibi elle seçer.
 */
import { getCatalog, taslakOyunlariAc } from "@glix/engine";
import { ENGINE_CATALOG } from "./gameSwitches.js";

/** Taslak oyunları açar; açılan kimlikleri döner. Tekrar çağrı zararsızdır. */
export function enableDraftGames(): string[] {
  const opened = taslakOyunlariAc();
  for (const info of getCatalog()) {
    if (opened.includes(info.id) && !ENGINE_CATALOG.some((g) => g.id === info.id)) ENGINE_CATALOG.push(info);
  }
  return opened;
}
