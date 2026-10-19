import type { YaziYazRole } from "@glix/engine";
import { createSignal, onCleanup, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";

interface Props {
  role: YaziYazRole | null;
}

/**
 * Rol yalnız bu düğme basılı tutulurken görünür: ekrana yan yan bakan biri rolü okuyamaz ve yazan ile masumun
 * ekranı aynı görünür.
 */
export function RolePeek(props: Props) {
  const [held, setHeld] = createSignal(false);
  const down = (e: PointerEvent): void => {
    if (props.role === null) return;
    unlockAudio();
    tap();
    hapticTap();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setHeld(true);
  };
  const up = (): void => {
    setHeld(false);
  };
  onCleanup(up);
  return (
    <Show when={props.role}>
      {(role) => (
        <button
          type="button"
          class="yy__peek"
          data-held={held() ? role() : undefined}
          aria-label="Rolünü gör, basılı tut"
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Show
            when={held()}
            fallback={
              <>
                <i class="yy__peek-eye" aria-hidden="true" />
                <span>Rolüm · basılı tut</span>
              </>
            }
          >
            <span class="yy__peek-role">
              {role() === "writer" ? "Yazansın · kelimeni yaz" : "Masumsun · MASUM yaz"}
            </span>
          </Show>
        </button>
      )}
    </Show>
  );
}
