import type { KareHint } from "@glix/engine";
import { hintAllows } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { showPick } from "../../settings/settings.js";
import { Avatar } from "../../ui/Avatar.js";
import { EyeIcon } from "../../ui/Icons.js";
import { createChoiceSync } from "../../ui/numberPicker.js";
import { pressable } from "../../ui/press.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { SonucEntry } from "./KareSonuc.js";
import { lockClack, pickTone } from "./sounds.js";
import { cellName, colName, hintText, type KarelerScreenView, readyLine } from "./view.js";

/** Bu aşamada ekrandaki kişinin rolü. */
export type SecimRole = "player" | "racer" | "ghost" | "out" | "spectator";

interface Props {
  v: KarelerScreenView;
  stage: 1 | 2;
  who: SecimRole;
  entries: SonucEntry[];
  selfId: string;
  now: () => number;
  /** GK-U5: bant sırasında ızgara sıfırlanmış ama henüz seçilemez. */
  band: boolean;
  /** GK-U10: son 5 sn. */
  urgent: boolean;
  /** TV: koordinat ve ızgara büyük, düğmesiz. */
  tv?: boolean;
}

/** Hold-to-peek: basılı tutunca açık, bırakınca kapalı (gözetleme koruması). */
function holdHandlers(set: (on: boolean) => void) {
  return {
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      set(true);
    },
    onPointerUp: () => set(false),
    onPointerLeave: () => set(false),
    onPointerCancel: () => set(false),
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") set(true);
    },
    onKeyUp: () => set(false),
    onBlur: () => set(false),
  };
}

/** Seçim ızgarası. Aşama başına yeni örnek oluşur; yerel seçim aşamalar arasında taşınmaz. */
export function Secim(props: Props) {
  const size = () => props.v.size;
  const cells = () => Array.from({ length: size() * size() }, (_, i) => i);
  const canPick = () => props.who === "player" || props.who === "racer" || props.who === "ghost";
  const startsAt = () => (props.stage === 1 ? props.v.startedAt : (props.v.stage2?.startsAt ?? 0));
  const endsAt = () => (props.stage === 1 ? props.v.endsAt : (props.v.stage2?.endsAt ?? props.v.endsAt));
  const closed = () =>
    !canPick() || props.band || props.v.locked || props.now() >= endsAt() || props.now() < startsAt();
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const me = () => byId().get(props.selfId);
  const nameOf = (id: string): string => byId().get(id)?.nickname ?? "Oyuncu";
  const racers = () => props.v.stage2?.players ?? [];
  const ghosts = () => props.v.stage2?.ghosts ?? [];
  const crew = () => (props.stage === 1 ? props.entries.map((e) => e.id) : [...racers(), ...ghosts()]);
  const sync = createChoiceSync({
    serverValue: () => (props.band ? null : props.v.myChoice),
    send: (cell) => sendActionAck({ kind: "pick", cell }),
    closed,
  });
  const mine = (): number | null => (canPick() && !props.band ? (sync.value() ?? props.v.myChoice) : null);

  // GK-U2: gözetleme koruması. Seçim yalnız basılı tutunca (ya da ayar açıksa) belirgin.
  const [peek, setPeek] = createSignal(false);
  const [flash, setFlash] = createSignal<number | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(flashTimer));
  const shown = () => peek() || showPick();

  // GK-M1: pusula; basılı tutunca elediği kareler kararır.
  const compass = (): KareHint | null => (props.who === "racer" ? props.v.compass : null);
  const [dim, setDim] = createSignal(false);

  /** GK-U4: 1. aşamada tek kalanların izi (herkese açık sonuç). */
  const traces = createMemo(() => {
    const out = new Map<number, string[]>();
    const s1 = props.v.stage1;
    if (props.stage !== 2 || !s1) return out;
    for (const [id, c] of Object.entries(s1.choices)) {
      if (c === null || s1.status[id] !== "solo") continue;
      out.set(c, [...(out.get(c) ?? []), id]);
    }
    return out;
  });

  const title = (): string => {
    if (props.who === "spectator") return "Gizli seçim sürüyor";
    if (props.who === "out") return "Bu aşamada izliyorsun";
    if (props.who === "ghost") return "👻 Hayaletsin";
    return mine() === null ? "Bir kare seç" : "Karen hazır";
  };
  const sub = (): string => {
    if (props.who === "spectator")
      return props.stage === 2 ? "Ödül karesi gizli" : "Sonuç süre bitince açılır";
    if (props.who === "out") return "Kalanlar 2. aşamada yarışıyor";
    if (props.who === "ghost") {
      if (props.v.locked) return "Hayaletin yerinde";
      return "Bir kare tut, rakibini düşür";
    }
    if (props.v.locked) return "Seçimin kesinleşti";
    if (props.stage === 2) return "Gizli ödül karesi var: tek başına basarsan +2";
    return mine() === null ? "Seçmezsen pasif kalırsın" : "Tamam'a basana kadar değiştirebilirsin";
  };
  const others = (ids: readonly string[]) => ids.filter((id) => id !== props.selfId).map(nameOf);
  const rivals = (): { label: string; names: string[] }[] => {
    if (props.stage !== 2) return [];
    const out: { label: string; names: string[] }[] = [];
    const r = others(racers());
    if (props.who === "racer") out.push({ label: "Rakiplerin", names: r });
    else out.push({ label: "Yarışanlar", names: racers().map(nameOf) });
    const g = props.who === "ghost" ? others(ghosts()) : ghosts().map(nameOf);
    if (g.length > 0)
      out.push({ label: props.who === "ghost" ? "Diğer hayaletler" : "Hayaletler", names: g });
    return out.filter((x) => x.names.length > 0);
  };

  const choose = (cell: number): void => {
    if (closed()) return;
    unlockAudio();
    hapticTap();
    pickTone();
    sync.set(cell, true);
    setFlash(cell);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => setFlash(null), 300);
  };

  return (
    <div
      class="ksec"
      data-role={props.who}
      data-urgent={props.urgent ? "1" : undefined}
      data-band={props.band ? "1" : undefined}
    >
      <div class="khero">
        <Show when={props.who === "out"}>
          <span class="khero__out">
            <Avatar index={me()?.avatar ?? 0} size="clamp(34px, 6dvh, 48px)" mood="out" />
          </span>
        </Show>
        <p class="overline khero__stage">{props.stage}. aşama / 2</p>
        <h2 class="khero__title" data-set={mine() === null ? undefined : "1"}>
          {title()}
        </h2>
        <p class="khero__sub">{sub()}</p>
        <Show when={rivals().length > 0}>
          <p class="krivals">
            <For each={rivals()}>
              {(r) => (
                <span class="krivals__row">
                  <b>{r.label}:</b> {r.names.join(" · ")}
                </span>
              )}
            </For>
          </p>
        </Show>
      </div>

      <Show when={compass()}>
        {(h) => (
          <button
            type="button"
            class="kcompass"
            data-held={dim() ? "1" : undefined}
            aria-label={`Pusulan: ödül karesi ${hintText(h())}. Basılı tutunca elediği kareler kararır.`}
            {...holdHandlers(setDim)}
          >
            <span class="kcompass__ico" aria-hidden="true">
              🧭
            </span>
            <span class="kcompass__text">
              <b>Pusulan:</b> ödül karesi {hintText(h())}
            </span>
            <span class="kcompass__hint">basılı tut</span>
          </button>
        )}
      </Show>

      <div class="kstage">
        <div class="kboard" style={{ "--n": size() }} data-tv={props.tv ? "1" : undefined}>
          <span class="kboard__corner" aria-hidden="true" />
          <For each={Array.from({ length: size() }, (_, i) => i)}>
            {(c) => (
              <span class="kboard__col" aria-hidden="true">
                {colName(c)}
              </span>
            )}
          </For>
          <For each={Array.from({ length: size() }, (_, i) => i)}>
            {(r) => (
              <span class="kboard__row" aria-hidden="true" style={{ "grid-row": r + 2 }}>
                {r + 1}
              </span>
            )}
          </For>
          <div
            class="kgrid"
            style={{ "--n": size() }}
            data-off={canPick() || props.who === "spectator" ? undefined : "1"}
            data-peek={shown() ? "1" : undefined}
          >
            <For each={cells()}>
              {(cell) => {
                const press = pressable(() => choose(cell));
                const trace = () => traces().get(cell) ?? [];
                const dimmed = () => {
                  const h = compass();
                  return dim() && h !== null && !hintAllows(h, cell, size());
                };
                return (
                  <button
                    type="button"
                    class="kcell"
                    data-on={mine() === cell ? "1" : undefined}
                    data-flash={flash() === cell ? "1" : undefined}
                    data-dim={dimmed() ? "1" : undefined}
                    style={{ "--i": cell, "--ph": `${((cell * 7919) % 23) * -170}ms` }}
                    disabled={!canPick() || props.v.locked || props.band}
                    aria-label={`${cellName(cell, size())}, ${mine() === cell ? "seçimin" : "boş"}`}
                    aria-pressed={mine() === cell}
                    onPointerDown={press.onPointerDown}
                    onClick={press.onClick}
                  >
                    <i class="kcell__core" />
                    <em class="kcell__name" aria-hidden="true">
                      {cellName(cell, size())}
                    </em>
                    <Show when={trace().length > 0}>
                      <span class="kcell__trace" aria-hidden="true">
                        <For each={trace()}>
                          {(id) => <Avatar index={byId().get(id)?.avatar ?? 0} size="var(--ts)" />}
                        </For>
                      </span>
                    </Show>
                    <Show when={mine() === cell}>
                      <i class="kcell__dot" aria-hidden="true" />
                      <span class="kcell__me" data-ghost={props.who === "ghost" ? "1" : undefined}>
                        <Avatar index={me()?.avatar ?? 0} size="var(--as)" />
                      </span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      <Show when={!props.tv}>
        <div class="kfoot">
          <Show when={canPick() && mine() !== null && !showPick()}>
            <button
              type="button"
              class="keye"
              data-on={peek() ? "1" : undefined}
              aria-label="Seçimini görmek için basılı tut"
              {...holdHandlers(setPeek)}
            >
              <EyeIcon size={18} />
              <span>{peek() ? `Seçimin: ${cellName(mine() ?? 0, size())}` : "Görmek için basılı tut"}</span>
            </button>
          </Show>
          <Show when={props.urgent && canPick() && mine() === null && !props.v.locked}>
            <p class="kwarn" role="status">
              Seçmezsen pasif kalırsın
            </p>
          </Show>
          <Show when={canPick() || props.who === "spectator"}>
            <div class="ktamam" data-shake={props.urgent && canPick() && mine() === null ? "1" : undefined}>
              <TamamBar
                locked={props.v.locked}
                ready={props.v.ready.length}
                readyIds={props.v.ready}
                crewIds={crew()}
                total={crew().length}
                disabled={mine() === null || props.band}
                spectator={props.who === "spectator"}
                onLock={() => {
                  lockClack();
                  return sendActionAck({ kind: "lock" });
                }}
              />
            </div>
          </Show>
          <Show when={props.who === "out"}>
            <p class="tamam__count">{readyLine(props.v.ready.length, crew().length)}</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
