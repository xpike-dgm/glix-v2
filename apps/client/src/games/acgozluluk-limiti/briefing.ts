import { acgozlulukBand } from "@glix/engine";

/**
 * AL-U16: anlatım masanın kendi sayılarıyla. Motor maddelerindeki genel ifadeleri bu masanın sayılarıyla değiştirir (anlatım kurulumdan
 * önce gösterildiği için katılımcı sayısından hesaplanır; örnek her zaman sığan sayıdır: ⌊bant altı ÷ N⌋).
 */
export function acgozlulukBriefing(steps: readonly string[], players: number): readonly string[] {
  const n = Math.min(8, Math.max(3, Math.trunc(players)));
  const { low, high } = acgozlulukBand(n);
  const x = Math.floor(low / n);
  return steps.map((step) =>
    step
      .replace("0 ile oyuncu sayısı arasında", `0 ile ${n} arasında`)
      .replace(
        "Toplam sisli limiti geçmesin.",
        `Toplam ${low}–${high} arası gizli limiti geçmesin: herkes ${x} derse ${x * n}, sığar.`,
      ),
  );
}
