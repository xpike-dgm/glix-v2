/** Gönderilmekte olan "Bildir" isteğinin durumu (tek istek aynı anda). */
import { createSignal } from "solid-js";
import { REPORT_FAILED } from "./reportRules.js";

export type ReportPhase = "idle" | "sending" | "done" | "error";
export interface ReportStatus {
  phase: ReportPhase;
  message: string;
}

/** Sunucu yanıtı gelmezse bu sürede hata sayılır. */
export const REPORT_TIMEOUT_MS = 8000;

const [status, setStatus] = createSignal<ReportStatus>({ phase: "idle", message: "" });
export const reportStatus = status;
let timer: ReturnType<typeof setTimeout> | undefined;

export function resetReport(): void {
  clearTimeout(timer);
  setStatus({ phase: "idle", message: "" });
}

export function beginReport(): void {
  clearTimeout(timer);
  setStatus({ phase: "sending", message: "" });
  timer = setTimeout(() => markReportFailed(REPORT_FAILED), REPORT_TIMEOUT_MS);
}

export function markReportDone(message: string): void {
  clearTimeout(timer);
  if (status().phase === "sending") setStatus({ phase: "done", message });
}

export function markReportFailed(message: string): void {
  clearTimeout(timer);
  if (status().phase === "sending") setStatus({ phase: "error", message });
}

export const reportSending = (): boolean => status().phase === "sending";
