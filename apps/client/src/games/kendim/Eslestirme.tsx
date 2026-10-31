import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { hapticReady, hapticTap } from "../../fx/haptics.js";
import { ready as readySound, tap, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { BottomSheet } from "../../ui/BottomSheet.js";
import { CbState } from "../../ui/CbState.js";
import { type AckLike, createOptimistic } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { clampToViewport, type DropTarget, exceedsDragThreshold, hitTest } from "./dragMatch.js";
import type { Crew } from "./KendimScreen.js";
import { pairClick, ropeStretch } from "./sounds.js";
import { KN_PLAN } from "./timeline.js";
import { cardOfPlayer, type KendimScreenView, pairOf, wordLen } from "./view.js";
import { CrewStrip, TopicLine } from "./Yazma.js";

interface Props {
  view: KendimScreenView;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
  tv?: boolean;
}

const LockMark = () => (
  <svg class="kn__lock" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="3" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
  </svg>
);

/**
 * İzleyici ve TV (KN-U7): kelime kartları sahipsiz ve büyük; kimin kimi seçtiği yok, yalnız kimin Tamam dediği.
 */
function Watch(props: Props) {
  return (
    <>
      <div class="kn__head">
        <TopicLine topic={props.view.topic} size="small" />
        <span class="kn__title">{props.tv ? "Bu kelimeler kimin?" : "Herkes eşleştiriyor"}</span>
      </div>
      <ul class="kn__cards kn__cards--watch" data-count={props.view.allCards.length}>
        <For each={props.view.allCards}>
          {(card, i) => (
            <li style={{ "--i": i() }}>
              <div class="kn__card" data-idle="1">
                <span
                  class="kn__word"
                  data-long={wordLen(card.text) > 7 ? "1" : undefined}
                  style={{ "--len": wordLen(card.text) }}
                >
                  {card.text}
                </span>
              </div>
            </li>
          )}
        </For>
      </ul>
      <CrewStrip crew={props.crew} ready={props.view.ready} />
      <Show when={!props.tv}>
        <TamamBar
          locked={false}
          ready={props.view.ready.length}
          total={props.crew.length}
          spectator
          onLock={() => false}
        />
      </Show>
    </>
  );
}

const samePairs = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

interface Drag {
  card: number;
  text: string;
  x: number;
  y: number;
  over: string | null;
}

/**
 * Eşleştirme: karışık hologram kartlar; kartı oyuncunun avatarına sürükle ya da karta dokunup kimin olduğunu seç. Eşleştirmeler Tamam'a kadar
 * değiştirilebilir, boş bırakılan kart 0'dır.
 */
export function Eslestirme(props: Props) {
  return (
    <Show when={!props.spectator} fallback={<Watch {...props} />}>
      <Matcher {...props} />
    </Show>
  );
}

interface Rope {
  x0: number;
  y0: number;
}

function Matcher(props: Props) {
  const [open, setOpen] = createSignal<number | null>(null);
  const closed = () => props.spectator || props.view.locked;
  const member = (id: string | null) => (id === null ? undefined : props.crew.find((m) => m.id === id));
  const candidates = createMemo(() =>
    props.crew.filter((m) => m.id !== props.selfId && props.view.owners.includes(m.id)),
  );
  // Eşleştirme dokununca hemen görünür; sunucu aynı eşleşmeleri onaylar, reddederse eskiye döner.
  const [pairs, setPairs] = createOptimistic<Record<string, string>>(() => props.view.myPairs, {
    equals: samePairs,
  });
  const lv = () => ({ cards: props.view.cards, myPairs: pairs() });
  const openCard = () => props.view.cards.find((c) => c.id === open()) ?? null;
  const paired = () => props.view.cards.filter((c) => pairOf(lv(), c.id) !== null).length;

  const [snap, setSnap] = createSignal<number | null>(null);
  let snapTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(snapTimer));
  const assign = (card: number, target: string | null): void => {
    unlockAudio();
    if (target === null) tap();
    else pairClick();
    hapticTap();
    if (target !== null) {
      setSnap(card);
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => setSnap(null), KN_PLAN.snapMs);
    }
    const next: Record<string, string> = {};
    for (const [k, who] of Object.entries(pairs())) if (who !== target) next[k] = who;
    if (target === null) delete next[String(card)];
    else next[String(card)] = target;
    setPairs(next, () => sendActionAck({ kind: "match", card, target }));
  };
  const choose = (target: string | null): void => {
    const card = open();
    if (card === null) return;
    assign(card, target);
    setOpen(null);
  };

  // Sürükle-bırak: kart parmakla avatarın üstüne taşınır. Dokunma yolu (alt sayfa) yedek olarak durur.
  const [drag, setDrag] = createSignal<Drag | null>(null);
  // KN-U2: sürüklerken karttan parmağa neon ip.
  const [rope, setRope] = createSignal<Rope | null>(null);
  const trayRefs = new Map<string, HTMLElement>();
  let session: {
    card: number;
    text: string;
    pointer: number;
    x: number;
    y: number;
    active: boolean;
    el: HTMLElement;
  } | null = null;
  let swallowClick = false;
  let swallowTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(swallowTimer));
  const targets = (): DropTarget[] =>
    [...trayRefs].map(([id, el]) => {
      const r = el.getBoundingClientRect();
      return { id, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });
  const moveTo = (e: PointerEvent): void => {
    if (!session || e.pointerId !== session.pointer) return;
    if (!session.active) {
      if (!exceedsDragThreshold(e.clientX - session.x, e.clientY - session.y)) return;
      session.active = true;
      unlockAudio();
      ropeStretch();
      hapticTap();
      const r = session.el.getBoundingClientRect();
      setRope({ x0: r.left + r.width / 2, y0: r.top + r.height / 2 });
    }
    const p = clampToViewport(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
    setDrag({
      card: session.card,
      text: session.text,
      x: p.x,
      y: p.y,
      over: hitTest(e.clientX, e.clientY, targets()),
    });
  };
  const endDrag = (e: PointerEvent, drop: boolean): void => {
    if (!session || e.pointerId !== session.pointer) return;
    const s = session;
    session = null;
    if (!s.active) return;
    const target = drop ? hitTest(e.clientX, e.clientY, targets()) : null;
    setDrag(null);
    setRope(null);
    // Sürüklemeden sonra gelen `click` kısa dokunuş sayılmasın (alt sayfa açılmasın).
    swallowClick = true;
    clearTimeout(swallowTimer);
    swallowTimer = setTimeout(() => {
      swallowClick = false;
    }, 120);
    if (target !== null && pairOf(lv(), s.card) !== target) assign(s.card, target);
  };
  const lock = (): AckLike => {
    if (closed()) return false;
    readySound();
    hapticReady();
    return sendActionAck({ kind: "lock" });
  };

  const hot = () => member(drag()?.over ?? null);
  return (
    <>
      <div class="kn__head">
        <TopicLine topic={props.view.topic} size="small" />
        <span class="kn__title">Kim yazdı?</span>
        <span class="kn__count">{`${paired()}/${props.view.cards.length} eşleşti`}</span>
      </div>

      <ul
        class="kn__cards"
        data-count={props.view.cards.length}
        data-dragging={drag() ? "1" : undefined}
        data-locked={props.view.locked ? "1" : undefined}
        data-scroll
      >
        <For each={props.view.cards}>
          {(card, i) => {
            const who = () => member(pairOf(lv(), card.id));
            return (
              <li style={{ "--i": i() }}>
                <button
                  type="button"
                  class="kn__card"
                  data-paired={who() ? "1" : undefined}
                  data-idle={closed() ? "1" : undefined}
                  data-lifted={drag()?.card === card.id ? "1" : undefined}
                  data-snap={snap() === card.id ? "1" : undefined}
                  style={{ "--pc": who() ? look(who()?.avatar ?? 0).color : "var(--cyan)" }}
                  disabled={closed()}
                  aria-label={`${card.text} kartı${who() ? `, eşi ${who()?.nickname}` : ", eşi yok"}`}
                  onPointerDown={(e) => {
                    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
                    session = {
                      card: card.id,
                      text: card.text,
                      pointer: e.pointerId,
                      x: e.clientX,
                      y: e.clientY,
                      active: false,
                      el: e.currentTarget,
                    };
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // yakalama desteklenmiyorsa sürükleme pencere düzeyinde izlenemez; dokunma yolu çalışır
                    }
                  }}
                  onPointerMove={moveTo}
                  onPointerUp={(e) => endDrag(e, true)}
                  onPointerCancel={(e) => endDrag(e, false)}
                  onClick={() => {
                    if (swallowClick) return;
                    unlockAudio();
                    tap();
                    hapticTap();
                    setOpen(card.id);
                  }}
                >
                  <span
                    class="kn__word"
                    data-long={wordLen(card.text) > 7 ? "1" : undefined}
                    style={{ "--len": wordLen(card.text) }}
                  >
                    {card.text}
                  </span>
                  <span class="kn__slot">
                    <Show when={who()} fallback={<span class="kn__who-empty">Kim?</span>}>
                      {(m) => (
                        <>
                          <span class="kn__arrow" aria-hidden="true">
                            →
                          </span>
                          <Avatar index={m().avatar} size={22} />
                          <span class="kn__slot-name">{m().nickname}</span>
                        </>
                      )}
                    </Show>
                  </span>
                  <Show when={props.view.locked}>
                    <LockMark />
                  </Show>
                </button>
              </li>
            );
          }}
        </For>
      </ul>

      <Show
        when={!closed()}
        fallback={
          <p class="kn__locknote" role="status">
            <LockMark />
            Kartların kilitlendi
          </p>
        }
      >
        <div class="kn__tray" data-active={drag() ? "1" : undefined}>
          <Show when={paired() === 0}>
            <p class="kn__traytip">Kartı avatara sürükle ya da karta dokun</p>
          </Show>
          <ul
            class="kn__drops"
            data-n={candidates().length}
            style={{
              "--cols": candidates().length > 4 ? Math.ceil(candidates().length / 2) : candidates().length,
            }}
          >
            <For each={candidates()}>
              {(m) => {
                const taken = () => cardOfPlayer(lv(), m.id) !== null;
                return (
                  <li
                    class="kn__drop"
                    ref={(el) => {
                      trayRefs.set(m.id, el);
                      onCleanup(() => trayRefs.delete(m.id));
                    }}
                    data-hot={drag()?.over === m.id ? "1" : undefined}
                    data-taken={taken() ? "1" : undefined}
                    style={{ "--pc": look(m.avatar).color }}
                  >
                    <Avatar index={m.avatar} size="var(--kn-dav)" />
                    <Show when={taken()}>
                      <CbState kind="ok" size={12} class="kn__cb" always />
                    </Show>
                    <span class="kn__drop-name">{m.nickname}</span>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </Show>

      <TamamBar
        locked={props.view.locked}
        ready={props.view.ready.length}
        readyIds={props.view.ready}
        total={props.crew.length}
        spectator={props.spectator}
        onLock={lock}
      />

      <Show when={drag() && rope()}>
        <Portal>
          <svg
            class="kn__rope"
            aria-hidden="true"
            style={{ "--pc": hot() ? look(hot()?.avatar ?? 0).color : "var(--cyan)" }}
          >
            <line x1={rope()?.x0 ?? 0} y1={rope()?.y0 ?? 0} x2={drag()?.x ?? 0} y2={drag()?.y ?? 0} />
          </svg>
        </Portal>
      </Show>
      <Show when={drag()}>
        {(d) => (
          <Portal>
            <div
              class="kn__ghost"
              aria-hidden="true"
              style={{ transform: `translate(${d().x}px, ${d().y}px) translate(-50%, -150%)` }}
            >
              {d().text}
            </div>
          </Portal>
        )}
      </Show>

      <BottomSheet open={open() !== null} onClose={() => setOpen(null)} title={openCard()?.text ?? ""}>
        <p class="kn__ask">Bu kelime kimin?</p>
        <ul class="kn__who">
          <For each={candidates()}>
            {(m) => {
              const current = () => pairOf(lv(), open() ?? -1) === m.id;
              const elsewhere = () => {
                const c = cardOfPlayer(lv(), m.id);
                return c && c.id !== open() ? c.text : null;
              };
              return (
                <li>
                  <button
                    type="button"
                    class="kn__pick"
                    data-on={current() ? "1" : undefined}
                    aria-pressed={current()}
                    aria-label={`${m.nickname} adlı oyuncuyu seç`}
                    onClick={() => choose(m.id)}
                  >
                    <Avatar index={m.avatar} size={48} ring={current() ? "var(--lime)" : undefined} />
                    <span class="kn__pick-name">{m.nickname}</span>
                    <span class="kn__pick-tag" data-on={elsewhere() ? "1" : undefined}>
                      {elsewhere() ?? ""}
                    </span>
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
        <button
          type="button"
          class="kn__clear"
          disabled={pairOf(lv(), open() ?? -1) === null}
          onClick={() => choose(null)}
        >
          Boş bırak
        </button>
      </BottomSheet>
    </>
  );
}
