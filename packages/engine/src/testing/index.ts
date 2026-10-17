/**
 * Oyun test altyapısı. Bot yazarken:
 * `generate(rng, playerId, publicView, privateView, connected)` eylem anındaki görünümleri ve bağlı katılımcıları
 * (katılım sırasıyla; `ctx.connected` ile aynı) alır. Hedef seçen oyun botu hedefi `connected` içinden seçer:
 * `const targets = connected.filter((id) => id !== playerId); return { kind: "target", target: targets[rng.int(targets.length)] }`.
 * Yalnız argümanlara ve `rng`'ye bakın. `runSimulation` rastgele kopma/dönüş üretir, `ctx.connected`'ı her çağrıda
 * günceller ve `GameLog.presence`'a yazar (`disconnectProbability: 0` kapatır).
 */
export { BOTS } from "../games/bots.js";
export * from "./deep.js";
export * from "./invariants.js";
export * from "./simulate.js";
