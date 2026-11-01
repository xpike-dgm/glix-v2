/**
 * GK-U17: anlatımın ilk maddesi bu oyunun ızgarasını söyler ("bu oyunda 4×4"). Motor maddesi iki boyutu birden yazar;
 * anlatım kurulumdan önce gösterildiği için boyut katılımcı sayısından hesaplanır (2–4 kişi 3×3, 5–8 kişi 4×4).
 */
export function karelerBriefing(steps: readonly string[], players: number): readonly string[] {
  const grid = players <= 4 ? "3×3" : "4×4";
  return steps.map((s) => s.replace("(2–4 kişide 3×3, 5–8 kişide 4×4)", `(bu oyunda ${grid})`));
}
