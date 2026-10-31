// biome-ignore-all lint/a11y/noSvgWithoutTitle: çizimler dekoratif (aria-hidden)
import { KULE_BASE_SPEED, KULE_TRACK, KULE_TURN_MS, type KuleBlock } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { atServerTime } from "../../net/serverTimer.js";
import { kuleArtUrl } from "./art.js";
import {
  collapseRumble,
  craneCreak,
  cutCrack,
  landThud,
  newTowerWinch,
  perfectDing,
  releaseClick,
  urgentTick,
  yourTurn,
} from "./sounds.js";
import { KULE_FX, KULE_URGENT_TICKS, KULE_VISIBLE_ROWS } from "./timeline.js";
import {
  isNewResult,
  type KulePhase,
  type KuleScreenView,
  pct,
  speedLabel,
  speedTone,
  windowStart,
} from "./view.js";

/** Motordaki `kuleBlockLeft` ile aynı üçgen dalga, yalnız ekranda akıcı çizim için kesirli (fark < 1 pist birimi). */
export function smoothLeft(turnStart: number, speed: number, width: number, now: number): number {
  const range = KULE_TRACK - width;
  if (range <= 0) return 0;
  const dist = (Math.max(0, now - turnStart) * KULE_BASE_SPEED * speed) / 1_000_000;
  const m = dist % (2 * range);
  return m <= range ? m : 2 * range - m;
}

interface Piece {
  id: number;
  left: number;
  width: number;
  /** Pencereye göre kat (alttan). */
  row: number;
  dir: -1 | 1;
  kind: "cut" | "fall" | "miss";
  /** Gecikme (ms). */
  delay: number;
  /** Kesilen parçada "−34" etiketi. */
  label?: string;
  hue?: number;
  /** Yıkılan kulenin tabanı (taban rengiyle düşer). */
  base?: boolean;
}

interface Props {
  view: KuleScreenView;
  phase: KulePhase;
  /** Sunucu saati (ms). */
  now: () => number;
  /** Kare kare akıcı sunucu saati (kayan blok). */
  smoothNow: () => number;
  /** Bu ekranın sahibi şu an sırası gelen oyuncu mu (uyarı ve sıra boyunca). */
  mine: boolean;
  /** Dokununca bırakılabilir (yalnız sırası gelen, kayarken, henüz dokunmadıysa). */
  canDrop: boolean;
  /** Yerel bırakış anı (sunucu onayı gelene kadar blok o anda donar). */
  frozenAt: number | null;
  selfId: string;
  spectator: boolean;
  /** TV: yan göstergeler ayrı sütunda; telefon başlığı ve dokunma bandı yok. */
  tv?: boolean;
}

/**
 * Kule sahnesi (telefon ve TV ortak): vinç kancasına asılı kayan blok, kristal katlar, kat sayacı, rekor çizgisi,
 * hız rozeti, sıra halkası ve bütün sonuç gösterileri (düşüş, kesilme, kusursuz, yıkılış). Gösteri zamanlamaları
 * `timeline.ts`'te; hepsi bırakışın sunucu anına bağlıdır. Yalnız herkese açık görünümü okur.
 */
export function Tower(props: Props) {
  const v = () => props.view;
  const own = (player: string): boolean => !props.spectator && player === props.selfId;
  const texture = kuleArtUrl("blok-doku");
  const hookArt = kuleArtUrl("kanca");

  // ---- Efekt zamanlayıcıları (sunucu saatine bağlı) ----
  const cancels = new Set<() => void>();
  const at = (target: number, fn: () => void): void => {
    let cancel: () => void = () => {};
    cancel = atServerTime(
      target,
      () => {
        cancels.delete(cancel);
        fn();
      },
      props.now,
    );
    cancels.add(cancel);
  };
  onCleanup(() => {
    for (const c of cancels) c();
  });

  const [pieces, setPieces] = createSignal<Piece[]>([]);
  let pieceId = 0;
  /** Parçalar sonucun sunucu anına (`from`) göre başlar: sonuç erken (ya da ileri tarihli) gelse de gösteri kaymaz. */
  const addPieces = (list: Omit<Piece, "id">[], from: number, until: number): void => {
    if (list.length === 0 || reducedMotion()) return;
    const lead = Math.max(0, from - props.now());
    const made = list.map((p) => ({ ...p, delay: p.delay + lead, id: ++pieceId }));
    setPieces((cur) => [...cur, ...made]);
    const ids = new Set(made.map((p) => p.id));
    at(until, () => setPieces((cur) => cur.filter((p) => !ids.has(p.id))));
  };

  /** Yeni oturan katın düşüşü (mutlak indeks) ve gösteri bayrakları. */
  const [landing, setLanding] = createSignal(-1);
  const [stamp, setStamp] = createSignal<{ streak: number } | null>(null);
  const [wave, setWave] = createSignal(-1);
  const [dust, setDust] = createSignal<{ row: number; key: number } | null>(null);
  const [collapsing, setCollapsing] = createSignal(false);
  const [arrive, setArrive] = createSignal(false);
  const [newRecord, setNewRecord] = createSignal(false);
  const [shake, setShake] = createSignal(0);
  const [bump, setBump] = createSignal(0);

  // ---- Pencere ----
  const start = createMemo(() => windowStart(v().tower.length, KULE_VISIBLE_ROWS));
  const rows = createMemo(() => {
    const s = start();
    return v()
      .tower.slice(s)
      .map((b, i) => ({ b, row: i, abs: s + i }));
  });
  const topRow = () => v().tower.length - 1 - start();
  /** Kanca, kulenin bir kat (boşluk) yukarısında: üst kat + 2. */
  const moverRow = () => topRow() + 2;
  const recordRow = (): number | null => {
    const r = v().record;
    if (r <= 0) return null;
    const row = r + 1 - start();
    return row >= 1 && row <= KULE_VISIBLE_ROWS ? row : null;
  };

  // ---- Sonuç gösterileri ----
  let seenTurn: number | null = null;
  createEffect(() => {
    const view = v();
    untrack(() => {
      const seen = seenTurn;
      seenTurn = Math.max(seenTurn ?? -1, view.last?.turn ?? 0);
      const last = view.last;
      if (!last) return;
      // Açılışta yalnız az önce olmuş bir sonuç (yeniden bağlanma) gösterilir; eskisi sessiz kalır.
      const fresh = seen === null && props.now() - last.at < KULE_FX.fresh;
      if (!fresh && !isNewResult(last, seen)) return;
      const mineDrop = own(last.player);
      // Kendi dokunuşunun "klik"i dokunduğu anda çalar (ekran); burada yalnız diğerleri ve kendiliğinden bırakış.
      if (!mineDrop || last.auto) releaseClick(mineDrop);
      const s = start();
      if (last.kind === "miss") {
        const fallen: KuleBlock[] = last.fallen ?? [];
        const fs = windowStart(fallen.length, KULE_VISIBLE_ROWS);
        const visible = fallen.slice(fs);
        const topIdx = visible.length - 1;
        const list: Omit<Piece, "id">[] = [
          {
            left: last.dropLeft,
            width: last.dropWidth,
            row: visible.length + 1,
            dir: last.dropLeft + last.dropWidth / 2 < KULE_TRACK / 2 ? -1 : 1,
            kind: "miss",
            delay: 0,
          },
        ];
        visible.forEach((b, i) => {
          list.push({
            left: b.left,
            width: b.width,
            row: i,
            dir: (topIdx - i) % 2 === 0 ? 1 : -1,
            kind: "fall",
            delay: KULE_FX.dropFall + (topIdx - i) * KULE_FX.collapseStep,
            hue: (fs + i) % 6,
            base: fs + i === 0,
          });
        });
        setCollapsing(true);
        setArrive(false);
        addPieces(list, last.at, last.at + KULE_FX.newBaseAt);
        at(last.at + KULE_FX.dropFall, () => {
          collapseRumble(mineDrop);
          setShake((n) => n + 1);
          setDust({ row: 0, key: Date.now() });
        });
        at(last.at + KULE_FX.newBaseAt, () => {
          setCollapsing(false);
          setDust(null);
          if (v().active !== null) {
            setArrive(true);
            newTowerWinch();
            at(last.at + KULE_FX.newBaseAt + KULE_FX.newBase, () => setArrive(false));
          }
        });
        return;
      }
      const landAbs = view.tower.length - 1;
      const landRow = landAbs - s;
      setLanding(landAbs);
      if (last.cutWidth > 0) {
        addPieces(
          [
            {
              left: last.cutLeft,
              width: last.cutWidth,
              row: landRow,
              dir: last.cutLeft <= last.dropLeft ? -1 : 1,
              kind: "cut",
              delay: 0,
              label: `−${last.cutWidth}`,
            },
          ],
          last.at,
          last.at + KULE_FX.cutFall + 200,
        );
      }
      at(last.at + KULE_FX.dropFall, () => {
        setLanding(-1);
        landThud();
        setBump((n) => n + 1);
        setDust({ row: landRow, key: Date.now() });
        at(last.at + KULE_FX.dropFall + KULE_FX.landDust, () => setDust(null));
        if (last.cutWidth > 0) cutCrack();
        if (last.kind === "perfect") {
          perfectDing(view.streak, mineDrop);
          setStamp({ streak: view.streak });
          setWave(landRow);
          at(last.at + KULE_FX.dropFall + KULE_FX.stamp, () => {
            setStamp(null);
            setWave(-1);
          });
        }
        if (view.record > 0 && view.floors === view.record + 1) {
          // Kusursuz damgası varsa "Yeni rekor!" damgadan sonra yazılır (üst üste binmesin).
          const from = last.at + KULE_FX.dropFall + (last.kind === "perfect" ? KULE_FX.stamp : 0);
          at(from, () => setNewRecord(true));
          at(from + KULE_FX.stamp + 300, () => setNewRecord(false));
        }
      });
    });
  });

  // "Sıra sende!" uyarısı: sıranın başlangıcına bağlı, bir kez.
  let warnedTurn = -1;
  createEffect(() => {
    if (props.phase !== "warn" || !props.mine) return;
    const t = v().turn;
    if (t === warnedTurn) return;
    warnedTurn = t;
    untrack(() => yourTurn(true));
  });

  // ---- Kayan blok, halka ve son 2 saniye: kare kare doğrudan DOM'a ----
  let crane: HTMLDivElement | undefined;
  let ring: SVGCircleElement | undefined;
  let raf = 0;
  let lastLeft = -1;
  let lastDir = 0;
  let urgentOn = false;
  let tickIdx = 0;
  let tickTurn = -1;
  const frame = (): void => {
    const view = v();
    if (crane) {
      const frozen = props.frozenAt;
      const now = props.smoothNow();
      const t = frozen ?? Math.min(now, view.deadline);
      const left = smoothLeft(view.turnStart, view.speed, view.blockWidth, t);
      crane.style.transform = `translate3d(${(left / view.blockWidth) * 100}%, 0, 0)`;
      const moving = props.phase === "moving" && frozen === null;
      // Vinç cızırtısı: yön değişiminde, yalnız sırası gelenin ekranında (masada sekiz telefon çalmasın).
      if (moving && lastLeft >= 0 && props.mine) {
        const dir = Math.sign(left - lastLeft);
        if (dir !== 0 && lastDir !== 0 && dir !== lastDir) craneCreak();
        if (dir !== 0) lastDir = dir;
      }
      lastLeft = moving ? left : -1;
      const remain = view.deadline - now;
      if (ring) {
        const frac = props.phase === "moving" ? Math.max(0, Math.min(1, remain / KULE_TURN_MS)) : 1;
        ring.style.strokeDashoffset = String(100 - frac * 100);
      }
      const urgent = moving && remain <= KULE_FX.urgent;
      if (urgent !== urgentOn) {
        urgentOn = urgent;
        crane.toggleAttribute("data-urgent", urgent);
      }
      if (urgent && props.mine) {
        if (tickTurn !== view.turn) {
          tickTurn = view.turn;
          tickIdx = 0;
        }
        const next = KULE_URGENT_TICKS[tickIdx];
        if (next !== undefined && remain <= next) {
          tickIdx++;
          urgentTick();
        }
      }
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  onCleanup(() => cancelAnimationFrame(raf));

  const craneState = (): string => {
    switch (props.phase) {
      case "moving":
        return props.frozenAt !== null ? "open" : "run";
      case "warn":
        return "lower";
      default:
        return "up";
    }
  };
  const tone = () => speedTone(v().speed);

  return (
    <div
      class="kt"
      data-tv={props.tv ? "1" : undefined}
      data-shake={shake() > 0 ? shake() % 2 : undefined}
      data-tex={texture ? "1" : undefined}
      style={texture ? { "--kt-tex": `url("${texture}")` } : undefined}
    >
      <div class="kt__sky" aria-hidden="true" />
      <Show when={!props.tv}>
        <div class="kt__hud" aria-hidden="true">
          <span class="kt__floor">
            <small>KAT</small>
            <b data-bump={bump() % 2}>{v().floors}</b>
          </span>
          <span class="kt__speed" data-tone={tone()}>
            <small>HIZ</small>
            {speedLabel(v().speed)}
          </span>
        </div>
      </Show>

      <div class="kt__track">
        <Show when={recordRow()}>
          {(r) => (
            <div
              class="kt__record"
              data-beaten={v().floors > v().record ? "1" : undefined}
              style={{ "--r": r() }}
              aria-hidden="true"
            >
              <span class="kt__recordlabel">{newRecord() ? "Yeni rekor!" : `Rekor ${v().record}`}</span>
            </div>
          )}
        </Show>

        <Show when={!collapsing()}>
          <For each={rows()}>
            {(r) => (
              <i
                class="kt__blk cbpat"
                data-base={r.abs === 0 ? "1" : undefined}
                data-perfect={r.b.perfect ? "1" : undefined}
                data-p={r.b.perfect ? "1" : undefined}
                data-land={landing() === r.abs ? "1" : undefined}
                data-arrive={r.abs === 0 && arrive() ? "1" : undefined}
                style={{
                  left: `${pct(r.b.left)}%`,
                  width: `${pct(r.b.width)}%`,
                  "--r": r.row,
                  "--h": r.abs % 6,
                }}
              >
                <Show when={r.b.perfect}>
                  <svg class="kt__star" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" />
                  </svg>
                </Show>
              </i>
            )}
          </For>
        </Show>

        <div class="kt__fx" aria-hidden="true">
          <For each={pieces()}>
            {(p) => (
              <i
                class="kt__piece"
                data-kind={p.kind}
                data-base={p.base ? "1" : undefined}
                style={{
                  left: `${pct(p.left)}%`,
                  width: `${pct(p.width)}%`,
                  "--r": p.row,
                  "--dir": p.dir,
                  "--d": `${p.delay}ms`,
                  "--h": p.hue ?? 0,
                }}
              ></i>
            )}
          </For>
        </div>

        <For each={pieces().filter((p) => p.label !== undefined)}>
          {(p) => (
            <span
              class="kt__cutlabel"
              data-side={p.dir < 0 ? "l" : "r"}
              style={{
                left: p.dir < 0 ? undefined : `${pct(p.left + p.width)}%`,
                right: p.dir < 0 ? `${100 - pct(p.left)}%` : undefined,
                "--r": p.row,
                "--d": `${p.delay}ms`,
              }}
              aria-hidden="true"
            >
              {p.label}
            </span>
          )}
        </For>

        <Show when={wave() >= 0}>
          <span class="kt__wave" style={{ "--r": wave() }} aria-hidden="true" />
        </Show>
        <Show when={dust()} keyed>
          {(d) => <span class="kt__dust" style={{ "--r": d.row }} aria-hidden="true" />}
        </Show>

        <div
          class="kt__crane"
          data-state={craneState()}
          data-mine={props.mine ? "1" : undefined}
          style={{ width: `${pct(v().blockWidth)}%`, "--r": moverRow() }}
          ref={crane}
        >
          <span class="kt__rope" />
          <span class="kt__hook" data-art={hookArt ? "1" : undefined}>
            <Show
              when={hookArt}
              fallback={
                <svg viewBox="0 0 40 46" class="kt__hooksvg">
                  <rect x="14" y="0" width="12" height="12" rx="3" class="kt__hookblock" />
                  <path class="kt__claw kt__claw--l" d="M18 12 L10 30 Q8 36 14 38 L19 38" />
                  <path class="kt__claw kt__claw--r" d="M22 12 L30 30 Q32 36 26 38 L21 38" />
                </svg>
              }
            >
              {(src) => <img class="kt__hookimg" src={src()} alt="" draggable={false} />}
            </Show>
          </span>
          <Show when={props.phase === "moving" || props.phase === "warn"}>
            <svg class="kt__ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle class="kt__ringbg" cx="18" cy="18" r="15" />
              <circle class="kt__ringfg" cx="18" cy="18" r="15" pathLength="100" ref={ring} />
            </svg>
          </Show>
          <i class="kt__mover cbpat" data-p="2" />
        </div>
      </div>

      <Show when={stamp()}>
        {(st) => (
          <div class="kt__stamp" aria-hidden="true">
            <span class="display kt__stampword">KUSURSUZ!</span>
            <Show when={st().streak >= 2}>
              <span class="kt__streak">SERİ ×{st().streak}</span>
            </Show>
          </div>
        )}
      </Show>
      <Show when={arrive()}>
        <span class="display kt__newtower" aria-hidden="true">
          Yeni kule!
        </span>
      </Show>

      <div
        class="kt__band"
        data-on={props.mine && props.phase === "warn" ? "1" : undefined}
        aria-hidden="true"
      >
        <span class="display kt__bandword">SIRA SENDE!</span>
      </div>

      <div class="kt__ground" aria-hidden="true">
        <Show when={props.canDrop}>
          <span class="kt__tap">
            <svg viewBox="0 0 24 24" class="kt__finger">
              <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.5-2.5 6.5-6 6.5h-.6c-2 0-3.4-.8-4.6-2.4L4.4 14.6a1.5 1.5 0 0 1 2.3-1.9L9 15V11" />
            </svg>
            DOKUN · BIRAK
          </span>
        </Show>
      </div>
    </div>
  );
}
