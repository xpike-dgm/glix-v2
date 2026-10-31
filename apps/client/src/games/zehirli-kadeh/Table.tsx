import type { PlayerInfo, ZehirliKadehCheck } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { Avatar } from "../../ui/Avatar.js";
import { pressable } from "../../ui/press.js";
import { artUrl, optionalArt } from "./art.js";
import { Cup } from "./Cup.js";
import { cupSeats, seatLayout, ZK_SWAP_FLIGHT_MS } from "./view.js";

const AMBER = "#FFC23B";
const CYAN = "#2EF2FF";

export interface TableProps {
  crew: PlayerInfo[];
  /** Oyuncu kimliği → şu an gösterilen kadeh numarası (iyimser takas dahil). */
  holdings: Record<string, number>;
  /** Takas hakkını kullananlar (herkese açık). */
  swapped: readonly string[];
  selfId: string;
  spectator: boolean;
  nameOf: (id: string) => string;
  /** Seçili oyuncu (kadehine dokunulan). */
  selected?: string | null;
  canPick?: (id: string) => boolean;
  onPick?: (id: string) => void;
  /** Yalnız bu cihazda: kendi kontrolünün sonucu (kadeh numarasına bağlı). */
  check?: ZehirliKadehCheck | null;
  /** Kontrol animasyonu oynayan kadeh numarası (yalnız bu cihazda). */
  peek?: number | null;
  /** Kontrol isteği gönderildi, sonuç bekleniyor: hedef oyuncu. */
  checking?: string | null;
  tense?: boolean;
  /** "Şerefe!" açılışı: oyuncunun kadehi açıldıysa sonucu, açılmadıysa null. Verilmezse oyun sürüyor demektir. */
  outcome?: ((id: string) => "clean" | "poison" | null) | undefined;
  /** Açılışın ilk anı: bütün kadehler kalkar ve ortaya eğilir. */
  cheers?: boolean;
  /** Tokuşturma parlaması. */
  clink?: boolean;
}

/**
 * Ziyafet masası (yukarıdan bakış): uzun masa ortada, kadehler masanın kenarında büyük; her kadehin arkasında
 * sahibinin avatarı ve adı. Kadehler numaralarıyla çizilir ve sahibinin önüne yerleşir; takasta iki kadeh masanın
 * üstünden yay çizerek yer değiştirir. Kontrol rozeti kadehin kendisine bağlıdır, kadehle birlikte gider.
 */
export function Table(props: TableProps) {
  const art = optionalArt("zehirli-kadeh/masa");
  const seats = createMemo(() => seatLayout(props.crew.length));
  const ids = createMemo(() => props.crew.map((p) => p.id));
  const where = createMemo(() => cupSeats(ids(), props.holdings));
  const cups = createMemo(() => [...where().keys()].sort((a, b) => a - b));
  const rows = () => Math.max(1, Math.ceil(props.crew.length / 2));

  // Yer değiştiren kadehler kısa süre "uçar" (yay animasyonu); ilk çizimde uçuş yok.
  const [flying, setFlying] = createSignal<ReadonlySet<number>>(new Set());
  let flyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(flyTimer));
  createEffect(
    on(
      where,
      (now, before) => {
        if (!before || reducedMotion()) return;
        const moved = new Set<number>();
        for (const [cup, seat] of now) if (before.get(cup) !== seat) moved.add(cup);
        if (moved.size === 0) return;
        setFlying(moved);
        clearTimeout(flyTimer);
        flyTimer = setTimeout(() => setFlying(new Set<number>()), ZK_SWAP_FLIGHT_MS + 60);
      },
      { defer: false },
    ),
  );

  return (
    <div
      class="zkt"
      data-n={props.crew.length}
      data-tense={props.tense ? "1" : undefined}
      data-reveal={props.outcome ? "1" : undefined}
      data-cheers={props.cheers ? "1" : undefined}
      data-art={art() ? "1" : undefined}
      style={{ "--rows": rows(), "--masa": artUrl("zehirli-kadeh/masa", art()) }}
    >
      <div class="zkt__board" data-head={props.crew.length % 2 === 1 ? "1" : undefined} aria-hidden="true">
        <i class="zkt__cloth" />
        <i class="zkt__runner" />
        <i class="zkt__clink" data-on={props.clink ? "1" : undefined} />
      </div>

      <For each={props.crew}>
        {(p, i) => {
          const seat = () => seats()[i()];
          const mine = () => p.id === props.selfId && !props.spectator;
          const used = () => props.swapped.includes(p.id);
          const out = () => props.outcome?.(p.id) ?? null;
          return (
            <Show when={seat()}>
              {(s) => (
                <div
                  class="zkt__seat"
                  data-side={s().side}
                  data-me={mine() ? "1" : undefined}
                  data-out={out() ?? undefined}
                  style={{ left: `${s().ax}%`, top: `${s().ay}%` }}
                >
                  <span class="zkt__av">
                    <Avatar
                      index={p.avatar}
                      size="var(--zk-av)"
                      connected={p.connected}
                      ring={props.selected === p.id ? AMBER : mine() ? CYAN : undefined}
                    />
                    <Show
                      when={props.outcome}
                      fallback={
                        <span
                          class="zkt__right"
                          data-used={used() ? "1" : undefined}
                          title={used() ? "Takas hakkını kullandı" : "Takas hakkı duruyor"}
                        >
                          {used() ? "✓" : "⇄"}
                        </span>
                      }
                    >
                      <Show when={out()}>
                        {(o) => <span class="zkt__pts">{o() === "clean" ? "+1" : "0"}</span>}
                      </Show>
                    </Show>
                  </span>
                  <span class="zkt__name">{props.nameOf(p.id)}</span>
                  <span class="sr-only">
                    {props.outcome
                      ? out() === "clean"
                        ? "temiz kadeh, artı bir"
                        : out() === "poison"
                          ? "zehirli kadeh, sıfır"
                          : "kadehi henüz açılmadı"
                      : used()
                        ? "takas hakkını kullandı"
                        : "takas hakkı duruyor"}
                  </span>
                </div>
              )}
            </Show>
          );
        }}
      </For>

      <For each={cups()}>
        {(cup) => {
          const seatIndex = () => where().get(cup) ?? 0;
          const seat = () => seats()[seatIndex()];
          const holder = () => ids()[seatIndex()] ?? "";
          const mineCup = () => holder() === props.selfId && !props.spectator;
          const known = () => (props.check && props.check.cup === cup ? props.check : null);
          const enabled = () => !mineCup() && (props.canPick?.(holder()) ?? false);
          const press = pressable(() => {
            if (enabled()) props.onPick?.(holder());
          });
          return (
            <div
              class="zkt__slot"
              data-side={seat()?.side}
              data-fly={flying().has(cup) ? "1" : undefined}
              style={{ "--x": seat()?.cx ?? 50, "--y": seat()?.cy ?? 50 }}
            >
              <button
                type="button"
                class="zkt__cup"
                data-me={mineCup() ? "1" : undefined}
                data-picked={props.selected === holder() ? "1" : undefined}
                data-peek={props.peek === cup ? (known()?.poisoned ? "poison" : "clean") : undefined}
                data-checking={props.checking === holder() ? "1" : undefined}
                data-out={props.outcome?.(holder()) ?? undefined}
                disabled={!enabled()}
                aria-pressed={props.selected === holder()}
                aria-label={`${mineCup() ? "Senin kadehin" : `Kadeh: ${props.nameOf(holder())}`}${
                  known() ? (known()?.poisoned ? ", kontrol ettin: zehirli" : ", kontrol ettin: temiz") : ""
                }`}
                onPointerDown={press.onPointerDown}
                onClick={press.onClick}
              >
                <span class="zkt__arrow" aria-hidden="true" />
                <span class="zkt__ring" aria-hidden="true" />
                <span class="zkt__lift">
                  <Cup cup={cup} mode={props.outcome?.(holder()) ?? "unknown"} class="zkt__img" />
                  <span class="zkt__cloche" aria-hidden="true" />
                  <span class="zkt__liquid" aria-hidden="true" />
                </span>
                <Show when={known() && !props.outcome ? known() : null}>
                  {(k) => (
                    <span class="zkt__badge" data-poison={k().poisoned ? "1" : undefined} aria-hidden="true">
                      {k().poisoned ? "☠ zehirli" : "✓ temiz"}
                    </span>
                  )}
                </Show>
              </button>
            </div>
          );
        }}
      </For>
    </div>
  );
}
