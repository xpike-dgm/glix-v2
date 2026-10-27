import { leadLine, type Summarize } from "../summary.js";

/** Butona Bas: en çok eşleşme puanı. */
export const summarizeButonaBas: Summarize = (result, players) =>
  leadLine(result.miniScores, players, (v) => `${v} puanla`, "turun yıldızı", "turu paylaştı") ??
  "Bu turda kimse eşleşme yakalayamadı";
