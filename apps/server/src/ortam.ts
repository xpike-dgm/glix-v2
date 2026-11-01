/**
 * Ortam bayrağı (`GLIX_ORTAM`, UM-O1/O2/O7): canlı, onay ortamı (test) ve oyun alanı (test2). Canlıda (bayrak boş ya
 * da "canli") hiçbir davranış değişmez. Test ortamlarında: e-posta ve web bildirimi kapalı, yapay zekâ düşük sınırla,
 * her yanıtta `X-Robots-Tag: noindex`, `robots.txt` her şeyi kapatır ve ana sayfada küçük bir ortam şeridi görünür.
 */

export type Ortam = "canli" | "test" | "test2";

const ORTAMLAR: readonly Ortam[] = ["canli", "test", "test2"];

/** Bayrak boşsa canlıdır; tanınmayan değer açılışı durdurur (yanlış yazım sessizce canlı gibi davranmasın). */
export function parseOrtam(raw: string | undefined): Ortam {
  const text = (raw ?? "").trim();
  if (text === "") return "canli";
  const found = ORTAMLAR.find((o) => o === text);
  if (!found) throw new Error("GLIX_ORTAM geçersiz (canli, test ya da test2 olmalı)");
  return found;
}

export const isTestOrtam = (ortam: Ortam | undefined): boolean => ortam === "test" || ortam === "test2";

/** Test ortamlarında yapay zekâ isteklerinin dakikalık ve günlük üst sınırı (oyun sonu yorumu ve ilham ayrı ayrı). */
export const ORTAM_AI_PER_MINUTE = 3;
export const ORTAM_AI_PER_DAY = 100;

/** Test ortamlarının `robots.txt` yanıtı: hiçbir yol taranmaz. */
export const ORTAM_ROBOTS = "User-agent: *\nDisallow: /\n";

/** Her yanıta eklenen arama motoru başlığı. */
export const ORTAM_ROBOTS_HEADER = "noindex, nofollow";

/** Oyuncunun gördüğü şerit metni (teknik terim yok). */
export const ORTAM_SERIT_METNI: Readonly<Record<Exclude<Ortam, "canli">, string>> = {
  test: "TEST",
  test2: "OYUN ALANI",
};

const SERIT_RENGI: Readonly<Record<Exclude<Ortam, "canli">, { bg: string; fg: string }>> = {
  test: { bg: "#ffb020", fg: "#05081a" },
  test2: { bg: "#7c5cff", fg: "#ffffff" },
};

/**
 * Ortam şeridinin HTML'i; canlıda null. Satır içi biçem (CSP `style-src 'unsafe-inline'`), betik yok; dokunmayı
 * engellemez (`pointer-events: none`) ve çentikli ekranda güvenli alanın altında kalır.
 */
export function ortamSeridi(ortam: Ortam | undefined): string | null {
  if (ortam !== "test" && ortam !== "test2") return null;
  const renk = SERIT_RENGI[ortam];
  const style = [
    "position:fixed",
    "top:0",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:2147483647",
    "pointer-events:none",
    "padding:calc(env(safe-area-inset-top, 0px) + 1px) 8px 2px",
    `background:${renk.bg}`,
    `color:${renk.fg}`,
    "font:700 10px/1.3 system-ui,sans-serif",
    "letter-spacing:.12em",
    "border-radius:0 0 6px 6px",
    "opacity:.85",
  ].join(";");
  return `<div data-glix-ortam="${ortam}" style="${style}">${ORTAM_SERIT_METNI[ortam]}</div>`;
}

/** Şeridi `<body>` açılışının hemen ardına ekler; `<body>` yoksa sayfa olduğu gibi kalır. */
export function seritEkle(html: string, serit: string): string {
  const m = /<body\b[^>]*>/i.exec(html);
  if (!m) return html;
  const at = m.index + m[0].length;
  return `${html.slice(0, at)}${serit}${html.slice(at)}`;
}
