/** İstatistik özeti metni (son 30 gün, salt okunur). Kişisel veri zaten tutulmaz. */
import { loadSqlite, RETENTION_MS } from "./statsStore.js";

const DAY_MS = 24 * 3600 * 1000;
const WINDOW_DAYS = 30;

interface Row {
  [key: string]: number | string | null;
}

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const fmt1 = (n: number): string => n.toFixed(1).replace(".", ",");
const pct = (a: number, b: number): string => (b === 0 ? "-" : `%${Math.round((a / b) * 100)}`);
const date = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
const secs = (ms: number): string => `${fmt1(ms / 1000)} sn`;

export function summarize(path: string, now = Date.now()): string {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(path, { readOnly: true });
  const since = now - WINDOW_DAYS * DAY_MS;
  const all = (sql: string): Row[] => db.prepare(sql).all(since) as Row[];
  const out: string[] = [];

  const m = all(
    "SELECT COUNT(*) AS n, COALESCE(SUM(completed),0) AS done, AVG(player_count) AS avg FROM matches WHERE started_at >= ?",
  )[0] as Row;
  out.push(`GLIX istatistikleri (son ${WINDOW_DAYS} gün, saklama ${Math.round(RETENTION_MS / DAY_MS)} gün)`);
  out.push("");
  out.push(`Maç sayısı: ${num(m.n)}`);
  out.push(`Tamamlanan: ${num(m.done)} (${pct(num(m.done), num(m.n))})`);
  out.push(`Ortalama oyuncu: ${num(m.n) === 0 ? "-" : fmt1(num(m.avg))}`);

  const games = all(
    `SELECT game_id AS id, COUNT(*) AS plays, AVG(duration_ms) AS avg_ms,
       SUM(outcome = 'aborted') AS aborted, SUM(outcome = 'failed') AS failed
     FROM game_plays WHERE started_at >= ? GROUP BY game_id ORDER BY plays DESC`,
  );
  out.push("");
  out.push("Oyunlar (oynanma / ort. süre / yarıda kalan / hata):");
  if (games.length === 0) out.push("  henüz kayıt yok");
  for (const g of games) {
    out.push(
      `  ${String(g.id).padEnd(24)} ${String(num(g.plays)).padStart(4)}  ${secs(num(g.avg_ms)).padStart(9)}  ${String(num(g.aborted)).padStart(3)}  ${String(num(g.failed)).padStart(3)}`,
    );
  }

  const f = db
    .prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM feedback WHERE created_at >= ?")
    .get(since) as Row;
  out.push("");
  out.push(`Geri bildirim: ${num(f.n)} adet, ortalama puan ${num(f.n) === 0 ? "-" : fmt1(num(f.avg))} / 5`);
  const texts = all(
    "SELECT rating, text, created_at FROM feedback WHERE created_at >= ? AND text IS NOT NULL AND text <> '' ORDER BY created_at DESC LIMIT 20",
  );
  if (texts.length > 0) {
    out.push("Son yazılanlar:");
    for (const t of texts) out.push(`  ${date(num(t.created_at))}  ${num(t.rating)}/5  ${String(t.text)}`);
  }
  db.close();
  return out.join("\n");
}
