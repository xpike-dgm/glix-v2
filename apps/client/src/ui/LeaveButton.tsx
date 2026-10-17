import { createSignal } from "solid-js";
import { leaveRoom } from "../net/client.js";
import { BottomSheet } from "./BottomSheet.js";
import { GhostButton } from "./GhostButton.js";
import { ExitIcon } from "./Icons.js";
import { PrimaryButton } from "./PrimaryButton.js";

/** Sol üst çıkış simgesi + onay sayfası. */
export function LeaveButton() {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <button type="button" class="icon-btn" aria-label="Odadan çık" onClick={() => setOpen(true)}>
        <ExitIcon size={24} class="flip" />
      </button>
      <BottomSheet open={open()} onClose={() => setOpen(false)} title="Odadan çıkılsın mı?">
        <div class="sheet__actions">
          <PrimaryButton variant="danger" onClick={leaveRoom}>
            Çık
          </PrimaryButton>
          <GhostButton size="small" onClick={() => setOpen(false)}>
            Vazgeç
          </GhostButton>
        </div>
      </BottomSheet>
    </>
  );
}
