import type { PlayerInfo, ReportReason } from "@glix/engine";
import { REPORT_NOTE_MAX } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { sendReport } from "../net/client.js";
import { reportStatus, resetReport } from "../net/report.js";
import {
  canSendReport,
  clipNote,
  noteLeft,
  REPORT_CHIPS,
  REPORT_THANKS,
  reportTargets,
} from "../net/reportRules.js";
import { closeReport, reportUi } from "../net/reportUi.js";
import { state } from "../net/store.js";
import { Avatar } from "./Avatar.js";
import { BottomSheet } from "./BottomSheet.js";
import { GhostButton } from "./GhostButton.js";
import { PrimaryButton } from "./PrimaryButton.js";

/**
 * "Bildir" penceresi (uygulama genelinde bir tane): kişi (dokunulmadıysa listeden), sebep düğmesi, isteğe bağlı kısa not.
 * Başarıda "Bildirimin alındı. Teşekkürler."; kimseye bildirim gitmez.
 */
export function ReportSheet() {
  const [picked, setPicked] = createSignal<string | null>(null);
  const [reason, setReason] = createSignal<ReportReason | null>(null);
  const [note, setNote] = createSignal("");

  const snap = () => state.snapshot;
  const targets = createMemo<PlayerInfo[]>(() => {
    const s = snap();
    return s ? reportTargets(s.players, s.selfId) : [];
  });
  const target = () => targets().find((p) => p.id === picked()) ?? null;
  const status = reportStatus;

  // Açılınca baştan başlar; hedef odadan çıkarsa kişi seçimine döner.
  createEffect(
    on(
      () => reportUi().open,
      (open) => {
        if (!open) return;
        setPicked(reportUi().targetId);
        setReason(null);
        setNote("");
      },
    ),
  );
  createEffect(() => {
    if (picked() !== null && target() === null && status().phase !== "done") setPicked(null);
  });
  // Oda kalmadıysa (örn. atıldın) pencere kapanır.
  createEffect(() => {
    if (reportUi().open && snap() === null) closeReport();
  });

  const submit = (e?: Event): void => {
    e?.preventDefault();
    const id = picked();
    const r = reason();
    if (id === null || !canSendReport(r, status().phase === "sending") || r === null) return;
    sendReport(id, r, note());
  };

  const close = (): void => {
    closeReport();
    resetReport();
  };

  const title = () => (status().phase === "done" ? "Teşekkürler" : "Oyuncuyu bildir");

  return (
    <BottomSheet open={reportUi().open} onClose={close} title={title()}>
      <Show
        when={status().phase !== "done"}
        fallback={
          <>
            <p class="sheet__text rep__thanks" role="status">
              {REPORT_THANKS}
            </p>
            <div class="sheet__actions">
              <PrimaryButton onClick={close}>Tamam</PrimaryButton>
            </div>
          </>
        }
      >
        <Show
          when={target()}
          fallback={
            <>
              <p class="sheet__text">Kimi bildirmek istiyorsun?</p>
              <Show
                when={targets().length > 0}
                fallback={<p class="sheet__text">Odada bildirebileceğin başka oyuncu yok.</p>}
              >
                <ul class="rep__people">
                  <For each={targets()}>
                    {(p) => (
                      <li>
                        <button type="button" class="rep__person" onClick={() => setPicked(p.id)}>
                          <Avatar index={p.avatar} size={36} connected={p.connected} />
                          <span class="rep__nick">{p.nickname}</span>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <div class="sheet__actions">
                <GhostButton size="small" onClick={close}>
                  Vazgeç
                </GhostButton>
              </div>
            </>
          }
        >
          {(t) => (
            <form class="rep" onSubmit={submit}>
              <div class="rep__who">
                <Avatar index={t().avatar} size={40} connected={t().connected} />
                <span class="rep__nick">{t().nickname}</span>
                <Show when={reportUi().targetId === null}>
                  <button type="button" class="rep__change" onClick={() => setPicked(null)}>
                    Değiştir
                  </button>
                </Show>
              </div>
              {/* biome-ignore lint/a11y/useSemanticElements: fieldset sayfa düzenini bozar; düğmeler aria-pressed ile işaretli */}
              <div class="rep__chips" role="group" aria-label="Sebep">
                <For each={REPORT_CHIPS}>
                  {(c) => (
                    <button
                      type="button"
                      class="rep__chip"
                      aria-pressed={reason() === c.id}
                      data-on={reason() === c.id ? "1" : undefined}
                      onClick={() => setReason(c.id)}
                    >
                      {c.label}
                    </button>
                  )}
                </For>
              </div>
              <label class="rep__label" for="rep-note">
                Eklemek istersen kısa not
              </label>
              <textarea
                id="rep-note"
                class="rep__note"
                rows="3"
                maxlength={REPORT_NOTE_MAX}
                placeholder="İsteğe bağlı"
                value={note()}
                onInput={(e) => setNote(clipNote(e.currentTarget.value))}
              />
              <p class="rep__count" aria-live="off">
                {noteLeft(note())} karakter kaldı
              </p>
              <Show when={status().phase === "error"}>
                <p class="rep__error" role="alert">
                  {status().message}
                </p>
              </Show>
              <div class="sheet__actions">
                <PrimaryButton
                  type="submit"
                  disabled={!canSendReport(reason(), false)}
                  busy={status().phase === "sending"}
                  reason={reason() === null ? "Önce bir sebep seç" : undefined}
                >
                  Bildir
                </PrimaryButton>
                <GhostButton size="small" onClick={close}>
                  Vazgeç
                </GhostButton>
              </div>
            </form>
          )}
        </Show>
      </Show>
    </BottomSheet>
  );
}
