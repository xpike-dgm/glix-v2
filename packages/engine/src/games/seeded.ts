import { createRng, type Rng } from "../rng.js";

/**
 * Oyun kurulurken `ctx.rng`'den bir kez alınan tohumdan, ada bağlı bağımsız rastgele akışlar türetir.
 * Böylece "eksik oy/işaret/jeton için rastgele doldurma" tick ya da eylem zamanlamasından bağımsız ve tekrar
 * oynatılabilir olur (ortak `ctx.rng` akışının tüketim sırasına bağlı kalmaz).
 */
export function drawSeed(rng: Rng): number {
  return rng.int(2 ** 31);
}

export function derivedRng(seed: number, ...parts: readonly (string | number)[]): Rng {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (const part of parts) {
    const text = `${part}|`;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return createRng(h);
}
