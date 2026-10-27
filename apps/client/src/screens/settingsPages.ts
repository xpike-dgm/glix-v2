import type { SettingsPage } from "../net/store.js";

/** Ayarlar ana listesindeki bir kategori. */
export interface SettingsCategory {
  id: Exclude<SettingsPage, "main">;
  title: string;
  /** Satırın altındaki kısa özet (teknik söz yok). */
  summary: string;
}

export interface CategoryContext {
  loggedIn: boolean;
  /** Bildirim satırı bu cihazda gösterilebilir mi (tarayıcı destekliyorsa). */
  pushVisible: boolean;
}

/** Ana listedeki kategoriler, sırasıyla. Hesap yalnız girişliyken, Bildirimler yalnız destekleyen cihazda. */
export function settingsCategories(ctx: CategoryContext): SettingsCategory[] {
  const out: SettingsCategory[] = [
    {
      id: "oyuncu",
      title: "Oyuncu",
      summary: ctx.loggedIn ? "Karakterin" : "Takma adın ve karakterin",
    },
    { id: "cihaz", title: "Cihaz", summary: "Ses, titreşim, görünüm, indirme" },
  ];
  if (ctx.pushVisible) out.push({ id: "bildirim", title: "Bildirimler", summary: "Oyun ve sıra haberleri" });
  if (ctx.loggedIn) out.push({ id: "hesap", title: "Hesap", summary: "E-posta, şifre, kullanıcı adı" });
  out.push({ id: "hakkinda", title: "Hakkında", summary: "Sürüm, gizlilik, koşullar" });
  return out;
}

/** Açık sayfa artık listede yoksa (çıkış yapıldı, bildirim kapandı) ana listeye döner. */
export function visiblePage(page: SettingsPage, categories: readonly SettingsCategory[]): SettingsPage {
  return page === "main" || categories.some((c) => c.id === page) ? page : "main";
}

/** Başlık çubuğundaki ad. */
export function pageTitle(page: SettingsPage, categories: readonly SettingsCategory[]): string {
  if (page === "main") return "Ayarlar";
  return categories.find((c) => c.id === page)?.title ?? "Ayarlar";
}
