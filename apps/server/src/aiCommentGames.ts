/**
 * Oyun sonu yorumu için oyuna özel özetler: herkese açık sonuç görünümünden (`publicView`) yalnız oyun bilgisi
 * (oyundaki takma adlar, oyundaki hamleler, puanlar) çıkarılır. E-posta, hesap ya da oyuncu kimliği gitmez.
 * Bir oyun buraya eklenmediyse o oyunda yorum yoktur. Sonuç henüz açılmadıysa kurucu null döner.
 */
import { GAME_COMMENT_MAX } from "@glix/engine";
import type { AiPrompt } from "./aiComment.js";

/** Oyuncunun oyundaki takma adı (kimlik -> ad); bilinmiyorsa null. */
export type NicknameOf = (playerId: string) => string | null;

type PromptBuilder = (publicView: unknown, nickname: NicknameOf) => AiPrompt | null;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** Takma adı modele güvenle koyar: tek satır, kısa, işaretlemesiz. */
export function promptName(raw: string): string {
  const clean = raw
    .replace(/[\p{Cc}<>`*#_[\]{}|\\"]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(clean).slice(0, 24).join("") || "Oyuncu";
}

const KONTROL_COLOR: Record<string, string> = {
  blue: "mavi",
  green: "yeşil",
  red: "kırmızı",
  yellow: "sarı",
  purple: "mor",
};

const system = (theme: string): string =>
  `Sen bir parti oyununda ${theme}. Verilen oyun özetinden tek cümlelik, en çok ${GAME_COMMENT_MAX - 10} ` +
  "karakterlik, esprili ve sevecen bir Türkçe yorum yaz. Bir ya da iki oyuncunun adını kullanabilirsin. Kimseyi " +
  "aşağılama, argo ve küfür kullanma. Yalnız cümleyi yaz: tırnak, emoji, liste, başlık ya da açıklama ekleme.";

/** Kontrol Paneli Kaosu: dalga dalga kim ne kesti, doğru mu, toplam imha puanı ve ödül. */
export const kontrolPrompt: PromptBuilder = (publicView, nickname) => {
  if (!isRec(publicView) || !isRec(publicView.reveal) || !Array.isArray(publicView.results)) return null;
  const players = publicView.players;
  if (!Array.isArray(players) || players.length === 0) return null;
  const totals = isRec(publicView.reveal.totals) ? publicView.reveal.totals : {};
  const awards = isRec(publicView.reveal.awards) ? publicView.reveal.awards : {};
  const lines: string[] = [];
  for (const id of players) {
    if (typeof id !== "string") return null;
    const name = promptName(nickname(id) ?? "Oyuncu");
    const cuts = publicView.results.map((r, i) => {
      const row = isRec(r) && isRec(r.rows) ? r.rows[id] : undefined;
      if (!isRec(row) || typeof row.cut !== "string") return `dalga ${i + 1}: kesmedi`;
      const color = KONTROL_COLOR[row.cut] ?? "bir kablo";
      return `dalga ${i + 1}: ${color} (${row.correct === true ? "doğru" : "yanlış"})`;
    });
    const total = typeof totals[id] === "number" ? totals[id] : 0;
    const award = typeof awards[id] === "number" ? awards[id] : 0;
    lines.push(`- ${name}: ${cuts.join(", ")}; imha puanı ${total}, ödül +${award}`);
  }
  return {
    system: system("bomba imha uzmanısın; oyuncular üç dalgada doğru kabloyu kesmeye çalıştı"),
    user: `Oyun: Kontrol Paneli Kaosu (bomba imhası, üç dalga). Sonuçlar:\n${lines.join("\n")}`,
  };
};

const BUILDERS: Record<string, PromptBuilder> = {
  "kontrol-paneli-kaosu": kontrolPrompt,
};

/** Bu oyunun yorum özeti (oyun yorum desteklemiyorsa ya da sonuç açılmadıysa null). */
export function commentPrompt(gameId: string, publicView: unknown, nickname: NicknameOf): AiPrompt | null {
  const build = BUILDERS[gameId];
  return build ? build(publicView, nickname) : null;
}

/** Oyun yorum destekliyor mu (desteklemiyorsa görünüm bile hesaplanmaz). */
export const hasCommentPrompt = (gameId: string): boolean => Object.hasOwn(BUILDERS, gameId);
