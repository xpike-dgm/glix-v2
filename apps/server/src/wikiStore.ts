import type { DatabaseSync } from "node:sqlite";
import {
  isWikiFeedbackSection,
  isWikiFeedbackStatus,
  type WikiBox,
  type WikiFeedback,
  type WikiFeedbackSection,
  type WikiFeedbackStatus,
  type WikiImageType,
} from "@glix/engine";

/** En çok bu kadar not tutulur (dolunca yenisi reddedilir; eski notlar silinerek yer açılır). */
export const WIKI_FEEDBACK_MAX = 1000;

/** Oyun ansiklopedisi notları (`wiki_feedback`). Yalnız yöneticiler yazar ve okur; görsel satırın içindedir. */
export const WIKI_SCHEMA = `CREATE TABLE wiki_feedback (
  id INTEGER PRIMARY KEY,
  game_id TEXT NOT NULL,
  section TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'acik',
  screen TEXT,
  box_x REAL, box_y REAL, box_w REAL, box_h REAL,
  image BLOB,
  image_type TEXT,
  reply TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX wiki_feedback_game ON wiki_feedback (game_id, created_at);`;

export interface WikiFeedbackInput {
  gameId: string;
  section: WikiFeedbackSection;
  text: string;
  screen: string | null;
  box: WikiBox | null;
  image: { type: WikiImageType; data: Uint8Array } | null;
}

export interface WikiStore {
  wikiFeedbackList(): WikiFeedback[];
  /** Yeni notun kimliği; üst sınır doluysa null. */
  wikiFeedbackAdd(input: WikiFeedbackInput, now: number): number | null;
  /** Not yoksa false. */
  wikiFeedbackStatus(id: number, status: WikiFeedbackStatus, now: number): boolean;
  wikiFeedbackDelete(id: number): boolean;
  wikiFeedbackImage(id: number): { type: string; data: Uint8Array } | null;
}

interface Row {
  id: number;
  game_id: string;
  section: string;
  body: string;
  status: string;
  screen: string | null;
  box_x: number | null;
  box_y: number | null;
  box_w: number | null;
  box_h: number | null;
  has_image: number;
  reply: string;
  created_at: number;
  updated_at: number;
}

const toFeedback = (r: Row): WikiFeedback => ({
  id: r.id,
  gameId: r.game_id,
  section: isWikiFeedbackSection(r.section) ? r.section : "Genel",
  text: r.body,
  status: isWikiFeedbackStatus(r.status) ? r.status : "acik",
  screen: r.screen,
  box:
    r.box_x !== null && r.box_y !== null && r.box_w !== null && r.box_h !== null
      ? { x: r.box_x, y: r.box_y, w: r.box_w, h: r.box_h }
      : null,
  hasImage: r.has_image === 1,
  reply: r.reply,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function createWikiStore(db: DatabaseSync): WikiStore {
  const list = db.prepare(
    `SELECT id, game_id, section, body, status, screen, box_x, box_y, box_w, box_h,
            image IS NOT NULL AS has_image, reply, created_at, updated_at
       FROM wiki_feedback ORDER BY created_at, id`,
  );
  const count = db.prepare("SELECT COUNT(*) AS n FROM wiki_feedback");
  const insert = db.prepare(
    `INSERT INTO wiki_feedback (game_id, section, body, status, screen, box_x, box_y, box_w, box_h, image, image_type,
                                created_at, updated_at)
     VALUES (?, ?, ?, 'acik', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const setStatus = db.prepare("UPDATE wiki_feedback SET status = ?, updated_at = ? WHERE id = ?");
  const remove = db.prepare("DELETE FROM wiki_feedback WHERE id = ?");
  const image = db.prepare("SELECT image, image_type FROM wiki_feedback WHERE id = ? AND image IS NOT NULL");
  return {
    wikiFeedbackList() {
      return (list.all() as unknown as Row[]).map(toFeedback);
    },
    wikiFeedbackAdd(input, now) {
      if ((count.get() as { n: number }).n >= WIKI_FEEDBACK_MAX) return null;
      const b = input.box;
      const r = insert.run(
        input.gameId,
        input.section,
        input.text,
        input.screen,
        b?.x ?? null,
        b?.y ?? null,
        b?.w ?? null,
        b?.h ?? null,
        input.image?.data ?? null,
        input.image?.type ?? null,
        now,
        now,
      );
      return Number(r.lastInsertRowid);
    },
    wikiFeedbackStatus(id, status, now) {
      return setStatus.run(status, now, id).changes > 0;
    },
    wikiFeedbackDelete(id) {
      return remove.run(id).changes > 0;
    },
    wikiFeedbackImage(id) {
      const r = image.get(id) as { image: Uint8Array; image_type: string } | undefined;
      return r ? { type: r.image_type, data: r.image } : null;
    },
  };
}
