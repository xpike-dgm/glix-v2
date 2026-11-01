import type { CizgiRadar, CizgiReveal } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticPress } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { stepValue } from "../../ui/numberPicker.js";
import { borderTick, heightTone, peakBell } from "./sounds.js";
import {
  bandLabel,
  type ClimbPlan,
  decadeOf,
  groupByZone,
  initialOf,
  isDense,
  isPeak,
  pinAt,
  shortName,
  statusOf,
  towerRatio,
  valueAtRatio,
  zoneCount,
  zoneLabel,
  zoneOf,
  zonesTopDown,
} from "./view.js";

export interface TowerEntry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

/** Büyütecin parmak kalktıktan sonra ekranda kaldığı süre (CZ-U1). */
export const LOUPE_HOLD_MS = 600;

const rowLabel = (z: number, width: number, mine: number | null, fire: boolean): string | null => {
  if (isPeak(z, width)) return "Zirve";
  if (z === mine || fire || !isDense(width)) return zoneLabel(z, width);
  // Kendi platformunun tam etiketi komşu kuşak etiketiyle üst üste binmesin.
  if (mine !== null && Math.abs(z - mine) === 1) return null;
  return bandLabel(z, width);
};

interface ChooseProps {
  width: number;
  /** Seçimin; yoksa null (pin yok, "Dokun ve tırman"). */
  value: number | null;
  onChange?: (value: number, final: boolean) => void;
  /** İzleyici/TV: dokunulmaz, pin yok. */
  readonly?: boolean;
  disabled?: boolean;
  locked?: boolean;
  avatar: number;
  radar: CizgiRadar | null;
  /** Radar taraması şimdi oynasın (radar yeni çekildi, hareket azaltma kapalı). */
  scan?: boolean;
  /** Son 5 sn: kule ışıkları nabız atar. */
  urgent?: boolean;
  tv?: boolean;
}

/**
 * Seçim kulesi (CZ-U1, U2, U11): kulenin kendisi kaydırıcıdır; dokunduğun yüksekliğe pin çıkar, sürüklerken büyüteç
 * bulunduğun platformu ve bir altını/üstünü büyük yazar. Yoğun kulede (5+ kişi) platformlar onluk kuşaklara ayrılır,
 * etiket kuşağa yazılır; kendi platformunun etiketi her zaman tam görünür. Zirve en üstte taçlı.
 */
export function ChooseTower(props: ChooseProps) {
  let bars: HTMLDivElement | undefined;
  const [dragging, setDragging] = createSignal(false);
  const [loupe, setLoupe] = createSignal(false);
  let loupeTimer: ReturnType<typeof setTimeout> | undefined;
  let lastZone: number | null = null;
  let lastTone = 0;
  onCleanup(() => {
    if (loupeTimer !== undefined) clearTimeout(loupeTimer);
  });

  const zones = createMemo(() => zonesTopDown(props.width));
  const myZone = () => (props.value === null ? null : zoneOf(props.value, props.width));
  const fire = createMemo(() => new Set(props.radar?.zones ?? []));
  const active = () => !props.readonly && !props.disabled && !props.locked;

  const commit = (v: number, final: boolean): void => {
    if (!active()) return;
    const z = zoneOf(v, props.width);
    if (lastZone !== null && z !== lastZone) {
      if (isPeak(z, props.width)) {
        peakBell();
        hapticPress([20, 30, 20]);
      } else {
        borderTick();
        hapticPress(8);
      }
    }
    lastZone = z;
    const t = performance.now();
    if (t - lastTone > 70) {
      lastTone = t;
      heightTone(v / 100);
    }
    props.onChange?.(v, final);
  };
  const fromPointer = (e: PointerEvent): number => {
    const rect = (bars as HTMLDivElement).getBoundingClientRect();
    return valueAtRatio(1 - (e.clientY - rect.top) / Math.max(1, rect.height), props.width);
  };
  const onDown = (e: PointerEvent): void => {
    if (!active() || !bars) return;
    e.preventDefault();
    unlockAudio();
    bars.setPointerCapture(e.pointerId);
    lastZone = myZone();
    setDragging(true);
    setLoupe(true);
    if (loupeTimer !== undefined) clearTimeout(loupeTimer);
    commit(fromPointer(e), false);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging()) return;
    const v = fromPointer(e);
    if (v !== props.value) commit(v, false);
  };
  const onUp = (e: PointerEvent): void => {
    if (!dragging()) return;
    setDragging(false);
    if (bars?.hasPointerCapture(e.pointerId)) bars.releasePointerCapture(e.pointerId);
    commit(fromPointer(e), true);
    loupeTimer = setTimeout(() => setLoupe(false), LOUPE_HOLD_MS);
  };
  const onKey = (e: KeyboardEvent): void => {
    const delta =
      e.key === "ArrowUp" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowDown" || e.key === "ArrowLeft"
          ? -1
          : e.key === "PageUp"
            ? 10
            : e.key === "PageDown"
              ? -10
              : 0;
    if (delta === 0 || !active()) return;
    e.preventDefault();
    lastZone = myZone();
    commit(stepValue(props.value, delta, 0, 100, 0), true);
  };

  const loupeRows = () => {
    const z = myZone();
    if (z === null) return [];
    const n = zoneCount(props.width);
    return [z + 1, z, z - 1].filter((x) => x >= 0 && x < n);
  };
  const valueText = () => {
    const v = props.value;
    if (v === null) return "Seçim yok";
    const z = zoneOf(v, props.width);
    return isPeak(z, props.width) ? `${v}, Zirve` : `${v}, platform ${zoneLabel(z, props.width)}`;
  };

  return (
    <div
      class="cztower"
      classList={{ "cztower--tv": props.tv === true }}
      data-dense={isDense(props.width) ? "1" : undefined}
      data-urgent={props.urgent ? "1" : undefined}
      data-locked={props.locked ? "1" : undefined}
      data-active={active() ? "1" : undefined}
    >
      <div
        class="cztower__bars"
        ref={bars}
        role="slider"
        tabIndex={props.readonly ? -1 : 0}
        aria-label="Gizli pinin"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={props.value ?? undefined}
        aria-valuetext={valueText()}
        aria-disabled={active() ? undefined : "true"}
        aria-hidden={props.readonly ? "true" : undefined}
        style={{ "--n": zoneCount(props.width) }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <For each={zones()}>
          {(z) => {
            const on = () => !props.readonly && myZone() === z;
            const label = () => rowLabel(z, props.width, props.readonly ? null : myZone(), fire().has(z));
            return (
              <div
                class="czrow"
                data-on={on() ? "1" : undefined}
                data-fire={fire().has(z) ? "1" : undefined}
                data-peak={isPeak(z, props.width) ? "1" : undefined}
                data-dec={decadeOf(z, props.width) % 2 === 0 ? "a" : "b"}
              >
                <span class="czrow__label">{label()}</span>
                <span class="czrow__bar">
                  <Show when={isPeak(z, props.width)}>
                    <i class="czrow__crown" aria-hidden="true">
                      👑
                    </i>
                  </Show>
                </span>
              </div>
            );
          }}
        </For>
        <Show when={props.scan}>
          <i class="czscan" aria-hidden="true" />
        </Show>
        <Show when={!props.readonly && props.value !== null}>
          <div class="czpin" style={{ "--y": towerRatio(props.value ?? 0, props.width) }} aria-hidden="true">
            <i class="czpin__stem" />
            <span class="czpin__head">
              <Avatar index={props.avatar} size={props.tv ? 44 : 28} />
              <Show when={props.locked}>
                <i class="czpin__flag">🔒</i>
              </Show>
            </span>
          </div>
        </Show>
        <Show when={!props.readonly && props.value === null && active()}>
          <p class="cztower__cta" aria-hidden="true">
            <span>☝</span> Dokun ve tırman
          </p>
        </Show>
      </div>
      <Show when={loupe() && props.value !== null && !props.readonly}>
        <div class="czloupe" style={{ "--y": towerRatio(props.value ?? 0, props.width) }} aria-hidden="true">
          <For each={loupeRows()}>
            {(z) => (
              <span class="czloupe__row" data-on={z === myZone() ? "1" : undefined}>
                {isPeak(z, props.width) ? "👑 100 · Zirve" : zoneLabel(z, props.width)}
                <Show when={z === myZone()}>
                  <small> · senin platformun</small>
                </Show>
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

interface ResultProps {
  reveal: CizgiReveal;
  plan: ClimbPlan;
  /** Açılıştan geçen süre (ms). */
  elapsed: number;
  entries: TowerEntry[];
  /** İzleyici/TV: "". */
  selfId: string;
  tv?: boolean;
  /** Dar ekran: adlar 6 harfe kısalır. */
  narrow?: boolean;
}

/**
 * Sonuç kulesi (CZ-U6, U7, U11, U13): boş platformlar dahil tam kule; pinler en düşükten en yükseğe tırmanıp platformuna
 * oturur (sayı sayaç gibi akar), dolu platforma oturan pinle çarpışır. Çiplerde kısa ad; çarpışan kırmızı çerçeveli ve
 * çapraz çizgili (ad okunur), tek kalan yeşil çerçeveli "tek kaldı". Seçmeyenler kulenin dibinde gri zemin satırında.
 */
export function ResultTower(props: ResultProps) {
  let tower: HTMLDivElement | undefined;
  const rows = new Map<number, HTMLDivElement>();
  const [rise, setRise] = createSignal<Map<number, number>>(new Map());
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const groups = createMemo(() => groupByZone(props.reveal));
  const pins = createMemo(() => new Map(props.plan.pins.map((p) => [p.id, p])));
  const width = () => props.reveal.zoneWidth;
  const passive = createMemo(() =>
    props.entries.filter((e) => statusOf(props.reveal, e.id) === "none").map((e) => e.id),
  );
  const nameMax = () => (props.narrow ? 6 : props.tv ? 10 : 8);

  // Tırmanış mesafesi: kulenin dibinden platformun ortasına (px). Yerleşim değişince yeniden ölçülür.
  const measure = (): void => {
    if (!tower) return;
    // Pin kulenin dibinden (çip yarı boyu kadar içeride) başlar.
    const base = tower.getBoundingClientRect().bottom - 16;
    const out = new Map<number, number>();
    for (const [z, el] of rows) {
      const r = el.getBoundingClientRect();
      out.set(z, Math.max(0, base - (r.top + r.height / 2)));
    }
    setRise(out);
  };
  onMount(() => {
    measure();
    if (typeof ResizeObserver === "undefined" || !tower) return;
    const ro = new ResizeObserver(measure);
    ro.observe(tower);
    onCleanup(() => ro.disconnect());
  });

  // Açılış sürprizi (CZ-U6): platform etiketi ve vurgusu ancak oraya bir pin oturunca görünür.
  const seated = (z: number): boolean =>
    (groups().get(z) ?? []).some((id) => {
      const p = pins().get(id);
      return p === undefined || props.elapsed >= p.seatAt;
    });
  const crashedNow = (z: number): boolean => {
    const at = props.plan.crashAt.get(z);
    return at !== undefined && props.elapsed >= at;
  };
  const launched = () => props.elapsed >= props.plan.launchAt;
  const pointsShown = () => props.elapsed >= props.plan.pointsAt;

  // Sonuçta kendi çipin hep görünür (CZ-U11): kule kayarsa otomatik kayar.
  let scrolled = false;
  const scrollMine = (el: HTMLElement): void => {
    if (scrolled || !props.selfId || !pointsShown()) return;
    scrolled = true;
    try {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch {
      // eski tarayıcı
    }
  };

  return (
    <div
      class="czres-tower"
      data-scroll
      classList={{ "czres-tower--tv": props.tv === true }}
      data-dense={isDense(width()) ? "1" : undefined}
      ref={tower}
    >
      <For each={zonesTopDown(width())}>
        {(z) => {
          const ids = () => groups().get(z) ?? [];
          const crowd = () => ids().length >= 3;
          return (
            <div
              class="czrrow"
              ref={(el) => rows.set(z, el)}
              data-slot={ids().length > 0 ? "1" : undefined}
              data-has={seated(z) ? "1" : undefined}
              data-crash={crashedNow(z) ? "1" : undefined}
              data-peak={isPeak(z, width()) ? "1" : undefined}
              data-dec={decadeOf(z, width()) % 2 === 0 ? "a" : "b"}
            >
              <span class="czrrow__label">
                {isPeak(z, width())
                  ? "👑 100"
                  : ids().length > 0 || !isDense(width())
                    ? zoneLabel(z, width())
                    : bandLabel(z, width())}
              </span>
              <span class="czrrow__bar">
                <For each={ids()}>
                  {(id) => {
                    const e = () => byId().get(id);
                    const pin = () => pins().get(id);
                    const state = () => {
                      const p = pin();
                      return p ? pinAt(p, props.elapsed) : { phase: "seat" as const, progress: 1, shown: 0 };
                    };
                    const st = () => statusOf(props.reveal, id);
                    const final = () => launched();
                    const kind = () =>
                      crashedNow(z)
                        ? "crashed"
                        : final()
                          ? st()
                          : state().phase === "seat"
                            ? "seated"
                            : "climb";
                    const dy = () => (rise().get(z) ?? 0) * (1 - state().progress);
                    const name = () => e()?.nickname ?? "Oyuncu";
                    return (
                      <span
                        class="czchip"
                        ref={(el) => {
                          if (id === props.selfId) queueMicrotask(() => scrollMine(el));
                        }}
                        data-status={kind()}
                        data-phase={state().phase}
                        data-me={id === props.selfId ? "1" : undefined}
                        data-launch={final() && st() === "first" ? "1" : undefined}
                        style={{ transform: dy() > 0 ? `translateY(${dy()}px)` : undefined }}
                      >
                        <Avatar
                          index={e()?.avatar ?? 0}
                          size={props.tv ? 40 : "clamp(20px, 3.2dvh, 24px)"}
                          connected={e()?.connected ?? true}
                        />
                        <span class="czchip__name">
                          {crowd() ? initialOf(name()) : shortName(name(), nameMax())}
                        </span>
                        <b class="czchip__n">{state().shown}</b>
                        <Show when={kind() === "crashed"}>
                          <CbState kind="bad" size={12} always />
                        </Show>
                        <Show when={final() && st() === "first"}>
                          <CbState kind="star" size={12} always />
                        </Show>
                        <Show when={final() && st() === "safe" && !crowd()}>
                          <em class="czchip__tag">tek kaldı</em>
                        </Show>
                        <Show when={pointsShown() && (props.reveal.points[id] ?? 0) > 0}>
                          <em class="czchip__pts">+{props.reveal.points[id]}</em>
                        </Show>
                      </span>
                    );
                  }}
                </For>
                <Show when={crashedNow(z)}>
                  <b class="czstamp">ÇARPIŞTI</b>
                </Show>
              </span>
            </div>
          );
        }}
      </For>
      <Show when={passive().length > 0}>
        <div class="czfloor">
          <For each={passive()}>
            {(id) => (
              <span class="czfloor__who" data-me={id === props.selfId ? "1" : undefined}>
                <Avatar
                  index={byId().get(id)?.avatar ?? 0}
                  size={props.tv ? 34 : 20}
                  connected={byId().get(id)?.connected ?? true}
                />
                <span>{shortName(byId().get(id)?.nickname ?? "Oyuncu", nameMax())}</span>
              </span>
            )}
          </For>
          <span class="czfloor__label">pasif</span>
        </div>
      </Show>
    </div>
  );
}
