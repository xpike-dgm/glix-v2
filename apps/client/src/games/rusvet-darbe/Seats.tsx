import { createMemo, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { pressable } from "../../ui/press.js";
import { Dice, Seal } from "./Art.js";
import { seatRows } from "./view.js";

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

export type SeatMark = "seal" | "dice";

interface Props {
  players: readonly CrewMember[];
  selfId: string;
  /** Mühürlenen (seçilen) portre: %8 büyür, diğerleri hafif söner (RD-U1). */
  selected?: string | null | undefined;
  /** Dokunulabilir portreler; verilmezse ızgara yalnız gösterir. */
  onPick?: ((id: string) => void) | undefined;
  canPick?: ((m: CrewMember) => boolean) | undefined;
  /** Portrenin köşesindeki işaret: mühür (sana oy verdi) ya da zar (oyu rastgele düştü). */
  marks?: Record<string, SeatMark> | undefined;
  /** Portrenin altındaki şerit (vaat bandı, jeton yığını, "−" düğmesi, etiket). */
  below?: ((m: CrewMember) => JSX.Element) | undefined;
  /** Vurgulanan portreler (ör. darbe hak sahipleri). */
  highlight?: readonly string[] | undefined;
  label: (m: CrewMember) => string;
  class?: string;
}

/**
 * Rüşvet ve Darbe portre ızgarası (RD-U1, RD-U11): son satır ortalanır (5 → 3+2, 8 → 3+3+2), portre en az 72 px;
 * bağlantısı kopan "bağlantı yok" etiketi taşır (RD-U12). Dokunma hedefi portrenin kendisidir (≥ 48 px).
 */
export function Seats(props: Props) {
  const query =
    typeof window === "undefined"
      ? null
      : window.matchMedia("(orientation: landscape) and (max-height: 500px)");
  const [wide, setWide] = createSignal(query?.matches === true);
  const onChange = (): void => {
    setWide(query?.matches === true);
  };
  query?.addEventListener("change", onChange);
  onCleanup(() => query?.removeEventListener("change", onChange));
  const rows = createMemo(() => {
    const n = props.players.length;
    // Yatay (alçak) ekranda satırlar daha geniş: 6 kişiye kadar tek satır, 7–8 kişi 4+4 / 4+3.
    const sizes = seatRows(n, wide() ? (n <= 6 ? n : 4) : undefined);
    const out: CrewMember[][] = [];
    let i = 0;
    for (const n of sizes) {
      out.push(props.players.slice(i, i + n));
      i += n;
    }
    return out;
  });
  const cols = () => Math.max(1, ...rows().map((r) => r.length));
  const pickable = (m: CrewMember): boolean => {
    if (!props.onPick || m.id === props.selfId) return false;
    return props.canPick ? props.canPick(m) : m.connected;
  };
  return (
    <div class={`rd__seats-stage ${props.class ?? ""}`}>
      <div
        class="rd__seats"
        style={{ "--cols": cols(), "--rows": rows().length }}
        data-picked={props.selected ? "1" : undefined}
      >
        <For each={rows()}>
          {(row) => (
            <div class="rd__seat-row">
              <For each={row}>
                {(m) => {
                  const picked = () => props.selected === m.id;
                  const self = () => m.id === props.selfId;
                  const press = pressable(() => {
                    if (pickable(m)) props.onPick?.(m.id);
                  });
                  return (
                    <div
                      class="rd__seat"
                      data-picked={picked() ? "1" : undefined}
                      data-self={self() ? "1" : undefined}
                      data-off={m.connected ? undefined : "1"}
                      data-hi={props.highlight?.includes(m.id) ? "1" : undefined}
                      style={{ "--tc": look(m.avatar).color }}
                    >
                      <button
                        type="button"
                        class="rd__seat-btn"
                        disabled={!pickable(m)}
                        aria-pressed={props.onPick ? picked() : undefined}
                        aria-label={props.label(m)}
                        onPointerDown={press.onPointerDown}
                        onClick={press.onClick}
                      >
                        <span class="rd__seat-av">
                          <Avatar index={m.avatar} size="var(--rd-sav)" connected={m.connected} />
                          <Show when={picked()}>
                            <span class="rd__seat-seal">
                              <Seal size="46%" />
                            </span>
                          </Show>
                          <Show when={props.marks?.[m.id]}>
                            {(k) => (
                              <span class="rd__seat-mark" data-k={k()}>
                                {k() === "seal" ? <Seal size="100%" /> : <Dice size="100%" />}
                              </span>
                            )}
                          </Show>
                        </span>
                        <span class="rd__name">{m.nickname}</span>
                      </button>
                      <Show when={!m.connected}>
                        <span class="rd__off">bağlantı yok</span>
                      </Show>
                      <Show when={props.below}>{(b) => b()(m)}</Show>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
