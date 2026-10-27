/** "Bildir" penceresinin açık/kapalı durumu; ekran değişse de (sonuçtan sonraki oyuna geçiş) pencere yerinde kalır. */
import { createSignal } from "solid-js";
import { resetReport } from "./report.js";

export interface ReportUi {
  open: boolean;
  /** Önceden seçilmiş hedef (lobide oyuncuya dokunulduysa); yoksa pencere kişiyi sorar. */
  targetId: string | null;
}

const [ui, setUi] = createSignal<ReportUi>({ open: false, targetId: null });
export const reportUi = ui;

export function openReport(targetId: string | null = null): void {
  resetReport();
  setUi({ open: true, targetId });
}

export function closeReport(): void {
  setUi((u) => ({ ...u, open: false }));
}
