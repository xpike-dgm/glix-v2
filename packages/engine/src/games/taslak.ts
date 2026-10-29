/**
 * TASLAK oyunlar: kuralları sahip tarafından henüz onaylanmamış oyunlar (docs/TASLAK-OYUNLAR.md).
 *
 * Bu kayıt `GAMES`'ten AYRIDIR: taslak bir oyun varsayılan olarak hiçbir katalogda, rastgele havuzda, lobi
 * seçicisinde ya da `setGames` doğrulamasında yoktur. Yalnız açık bir geliştirme/test yolu `taslakOyunlariAc()`
 * çağırınca `GAMES`'e eklenir (sunucuda `GLIX_TASLAK_OYUNLAR=1` ya da testlerde `draftGames: true`). Açılsa bile
 * hepsi `randomPool: false` taşır: rastgele seçime girmez, yalnız ev sahibi elle seçebilir.
 * Sahip bir oyunu onaylayınca oyun buradan çıkarılıp `games/index.ts`'teki `GAMES`'e taşınır.
 */
import type { AnyGame } from "../game.js";
import type { GameBot } from "../testing/simulate.js";
import { GAMES } from "./index.js";
import { ortakNoktaBot } from "./ortak-nokta/bots.js";
import { ortakNokta } from "./ortak-nokta/index.js";
import { sessizSiraBot } from "./sessiz-sira/bots.js";
import { sessizSira } from "./sessiz-sira/index.js";
import { tekVeKucukBot } from "./tek-ve-kucuk/bots.js";
import { tekVeKucuk } from "./tek-ve-kucuk/index.js";

/** Taslak oyunlar (kimlik -> tanım). */
export const TASLAK_OYUNLAR: Readonly<Record<string, AnyGame>> = {
  [ortakNokta.id]: ortakNokta,
  [tekVeKucuk.id]: tekVeKucuk,
  [sessizSira.id]: sessizSira,
};

/** Taslak oyunların test botları (`BOTS`'a girmez; taslak.test.ts kullanır). */
export const TASLAK_BOTLAR: Readonly<Record<string, GameBot>> = {
  [ortakNokta.id]: ortakNoktaBot,
  [tekVeKucuk.id]: tekVeKucukBot,
  [sessizSira.id]: sessizSiraBot,
};

/** Bu kimlik bir taslak oyuna mı ait (açık ya da kapalı fark etmez). */
export function isTaslakOyun(id: string): boolean {
  return Object.hasOwn(TASLAK_OYUNLAR, id);
}

/**
 * Taslak oyunları `GAMES`'e ekler (yalnız açık bir geliştirme/test yolundan çağrılır). Tekrar çağrı zararsızdır.
 * Eklenen kimlikleri döner.
 */
export function taslakOyunlariAc(): string[] {
  for (const [id, game] of Object.entries(TASLAK_OYUNLAR)) GAMES[id] = game;
  return Object.keys(TASLAK_OYUNLAR);
}
