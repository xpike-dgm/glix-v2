import { mockPackView } from "../pwa/packController.js";

const MB = 1024 * 1024;

/** Yalnız geliştirme: `?mock=hazirlaniyor[-hucresel|-koptu|-bos]` içerik indirme ekranını sahte veriyle açar. */
export function startPackMock(kind: string): void {
  const total = Math.round(16.4 * MB);
  if (kind === "hazirlaniyor-hucresel") mockPackView("ask", null, total);
  else if (kind === "hazirlaniyor-koptu")
    mockPackView(
      "failed",
      { files: 120, totalFiles: 288, bytes: Math.round(6.8 * MB), totalBytes: total },
      total,
    );
  else if (kind === "hazirlaniyor-bos") mockPackView("checking", null, 0);
  else
    mockPackView(
      "downloading",
      { files: 140, totalFiles: 288, bytes: Math.round(8.3 * MB), totalBytes: total },
      total,
    );
}
