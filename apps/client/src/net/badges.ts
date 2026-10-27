import { createSignal } from "solid-js";
import { type BadgeInfo, newBadges } from "./badgeRules.js";
import { parseProfile } from "./profileRules.js";
import { toast } from "./store.js";

/**
 * Maç sonunda kazanılan yeni rozetler. Sunucu yalnız kimlikleri yollar; adlar profil yanıtından gelir
 * (tek kaynak sunucudur). Kart final ekranında gösterilir; kapatılınca ya da odadan çıkılınca temizlenir.
 */
const [fresh, setFresh] = createSignal<readonly BadgeInfo[]>([]);

export { fresh as freshBadges };

let seq = 0;

/** Yeni rozet kimlikleri geldi: adlar profilden okunur; okunamazsa kısa bir bildirim gösterilir. */
export async function receiveBadges(ids: readonly string[]): Promise<void> {
  const mine = ++seq;
  try {
    const res = await fetch("/api/profile", { credentials: "same-origin" });
    const profile = res.ok ? parseProfile(await res.json()) : null;
    if (mine !== seq) return;
    const list = profile ? newBadges(ids, profile.badges) : [];
    if (list.length > 0) {
      setFresh(list);
      return;
    }
  } catch {
    // ağ yok: aşağıdaki bildirim yeter
  }
  if (mine === seq) toast("Yeni rozet kazandın!", "success");
}

/** Yalnız geliştirme önizlemesi: kart doğrudan verilir. */
export function showBadges(list: readonly BadgeInfo[]): void {
  seq += 1;
  setFresh(list);
}

export function dismissBadges(): void {
  seq += 1;
  setFresh([]);
}
