import { createEffect, createMemo, createSignal, on, onCleanup, Show, untrack } from "solid-js";
import { hapticError, hapticReady, hapticTap, hapticTick } from "../../fx/haptics.js";
import { fail, tap, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { Status } from "../../ui/Status.js";
import type { GameScreenProps } from "../registry.js";
import { Candle } from "./Candle.js";
import { createOpening } from "./opening.js";
import { SwapHistory } from "./SwapHistory.js";
import { heartbeatSound, peekSound, swapSound } from "./sounds.js";
import { Table } from "./Table.js";
import "./zehirli-kadeh.css";
import {
  candleLeft,
  isTense,
  parseZehirliKadehView,
  secondsLeft,
  ZK_PEEK_MS,
  ZK_SWAP_BANNER_MS,
} from "./view.js";

/** Kontrol sonucu bildirimi (yalnız bu ekranda) bu kadar kalır; rozet kadehin üstünde kalıcıdır. */
const PEEK_NOTE_MS = 4_000;

export default function ZehirliKadehScreen(props: GameScreenProps) {
  const view = createMemo(() => parseZehirliKadehView(props.match.publicView, props.match.view));
  const [clock, setClock] = createSignal(props.now());
  const timer = setInterval(() => setClock(props.now()), 100);
  onCleanup(() => clearInterval(timer));

  const crew = createMemo(() => {
    const v = view();
    if (!v) return [];
    return v.pub.players.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [p] : [];
    });
  });
  const nameOf = (id: string): string =>
    id === props.selfId && !props.spectator ? "Sen" : (crew().find((p) => p.id === id)?.nickname ?? "Oyuncu");

  const player = () => !props.spectator && view()?.priv.role === "player";
  const closed = () => {
    const v = view();
    return !v || v.pub.ended || clock() >= v.pub.endsAt;
  };

  // ---- Takas: dokununca kadehler hemen yer değiştirir; sunucu aynı takası onaylar, reddederse geri döner.
  const serverSwap = (): string | null =>
    view()?.pub.swaps.find((w) => w.from === props.selfId)?.to ??
    (view()?.pub.swapped.includes(props.selfId) ? props.selfId : null);
  let localSwapDone = false;
  const [mySwap, setMySwap] = createOptimistic<string | null>(serverSwap, {
    onReject: () => {
      localSwapDone = false;
      setBanner(null);
      fail();
      hapticError();
    },
  });
  /** Sunucu henüz onaylamadı: yalnız bu sürede yerel yer değiştirme kadehlere uygulanır. */
  const swapOverlay = (): string | null => {
    const t = mySwap();
    return t !== null && serverSwap() === null ? t : null;
  };
  const swapUsed = () => (view()?.pub.swapped.includes(props.selfId) ?? false) || mySwap() !== null;
  const shownHoldings = createMemo(() => {
    const h = { ...(view()?.pub.holdings ?? {}) };
    const t = swapOverlay();
    if (t !== null && h[t] !== undefined && h[props.selfId] !== undefined) {
      const a = h[props.selfId] as number;
      h[props.selfId] = h[t] as number;
      h[t] = a;
    }
    return h;
  });
  const shownSwapped = () => {
    const s = view()?.pub.swapped ?? [];
    return swapUsed() && !s.includes(props.selfId) ? [...s, props.selfId] : s;
  };

  // ---- Kontrol: sonucu yalnız sunucu bilir; bekleme sırasında kadeh "açılıyor" görünür.
  const [checking, setChecking] = createSignal<string | null>(null);
  const check = () => view()?.priv.check ?? null;
  const checkUsed = () => check() !== null || checking() !== null;
  const [peek, setPeek] = createSignal<number | null>(null);
  const [peekNote, setPeekNote] = createSignal<string | null>(null);
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(peekTimer);
    clearTimeout(noteTimer);
  });
  createEffect(
    on(
      check,
      (c, before) => {
        // İlk çizimde (yeniden bağlanınca) animasyon yok; rozet doğrudan görünür.
        if (!c || before) return;
        const target = untrack(checking);
        setChecking(null);
        if (target === null) return;
        peekSound();
        hapticReady();
        setPeek(c.cup);
        clearTimeout(peekTimer);
        peekTimer = setTimeout(() => setPeek(null), ZK_PEEK_MS);
        setPeekNote(`Kontrol ettiğin kadeh (${nameOf(target)}) ${c.poisoned ? "zehirli ☠" : "temiz ✓"}`);
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => setPeekNote(null), PEEK_NOTE_MS);
      },
      { defer: true },
    ),
  );

  const canAct = () => player() && !closed() && (!swapUsed() || !checkUsed());
  const [sel, setSel] = createSignal<string | null>(null);
  createEffect(() => {
    if (!canAct()) setSel(null);
  });

  const pick = (id: string): void => {
    if (!canAct() || id === props.selfId) return;
    unlockAudio();
    tap();
    hapticTap();
    setSel(sel() === id ? null : id);
  };
  const doSwap = (): void => {
    const target = sel();
    if (!canAct() || swapUsed() || target === null) return;
    localSwapDone = true;
    swapSound();
    hapticReady();
    setSel(null);
    showBanner({ seq: -1, from: props.selfId, to: target });
    setMySwap(target, () => sendActionAck({ kind: "swap", target }));
  };
  const doCheck = (): void => {
    const target = sel();
    if (!canAct() || checkUsed() || target === null) return;
    unlockAudio();
    hapticTap();
    setSel(null);
    setChecking(target);
    void sendActionAck({ kind: "check", target }).then((ack) => {
      if (ack.ok || untrack(check) !== null) return;
      setChecking(null);
      fail();
      hapticError();
    });
  };
  const swapPress = pressable(doSwap);
  const checkPress = pressable(doCheck);

  // ---- Takas anı: üstte "Mert ⇄ Elif" şeridi (2 sn), ses; ilk açılışta tekrar çalmaz.
  let seen: number | null = null;
  const [banner, setBanner] = createSignal<{ seq: number; from: string; to: string } | null>(null);
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(bannerTimer));
  const showBanner = (b: { seq: number; from: string; to: string }): void => {
    setBanner(b);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => setBanner(null), ZK_SWAP_BANNER_MS);
  };
  createEffect(
    on(
      () => view()?.pub.swaps.length ?? 0,
      (count) => {
        const prev = seen;
        seen = count;
        const last = untrack(view)?.pub.swaps[count - 1];
        if (prev === null || !last || count <= prev) return;
        // Kendi takasımın sesi ve şeridi dokunuşta zaten oynadı.
        if (last.from === props.selfId && localSwapDone) {
          localSwapDone = false;
          setBanner((b) => (b ? { ...b, seq: last.seq } : b));
          return;
        }
        showBanner({ seq: last.seq, from: last.from, to: last.to });
        swapSound();
        if (props.spectator) return;
        if (last.from === props.selfId || last.to === props.selfId) hapticReady();
        else hapticTick();
      },
    ),
  );

  // ---- Son saniyeler: mum titrer, masa kararır, her saniye kalp atışı ve hafif titreşim.
  const secs = () => secondsLeft(view()?.pub.endsAt ?? 0, clock());
  const tense = () => {
    const v = view();
    return v ? isTense(v.pub.endsAt, clock(), v.pub.ended) : false;
  };
  createEffect(
    on(secs, (s, before) => {
      if (before === undefined || s === before || !untrack(tense)) return;
      heartbeatSound();
      if (!props.spectator) hapticTick();
    }),
  );

  const left = () => {
    const v = view();
    return v ? candleLeft(v.pub.startedAt, v.pub.endsAt, clock()) : 0;
  };

  const head = (): { text: string; sub: string } => {
    if (props.spectator) return { text: "Kadehleri izliyorsun", sub: "Zehir sonda açılır" };
    if (closed()) return { text: "Süre doldu", sub: "Kadehler açılıyor…" };
    if (swapUsed() && checkUsed()) return { text: "Haklarını kullandın", sub: "Şimdi sonucu bekle" };
    const s = sel();
    if (s !== null) return { text: "Ne yapacaksın?", sub: `Seçtiğin kadeh: ${nameOf(s)}` };
    return { text: "Zehir kimde?", sub: "Bir kadehe dokun: kontrol et ya da takas et" };
  };

  const rights = () => {
    const out: string[] = [];
    out.push(checkUsed() ? "Kontrol hakkın bitti" : "Kontrol hakkın: 1");
    out.push(swapUsed() ? "Takas hakkın bitti" : "Takas hakkın: 1");
    return out.join(" · ");
  };

  // ---- "Şerefe!" açılış evresi: süre bitince oyun ekranı tam ekran açılışa döner (masa büyür, kadehler açılır).
  const opening = createOpening(() => view()?.pub ?? null, props.selfId, props.spectator === true, clock);

  return (
    <Show when={!opening.active()} fallback={<OpeningView />}>
      <PlayView />
    </Show>
  );

  function OpeningView() {
    return (
      <Screen class="game zk zk--open">
        <header class="zk__opentop">
          <h2 class="zk__title" data-tone={opening.tone()} data-cheers={opening.cheers() ? "1" : undefined}>
            {opening.title()}
          </h2>
        </header>
        <div class="zk__stage">
          <Table
            crew={crew()}
            holdings={view()?.pub.holdings ?? {}}
            swapped={view()?.pub.swapped ?? []}
            selfId={props.selfId}
            spectator={props.spectator === true}
            nameOf={nameOf}
            outcome={opening.outcome}
            cheers={opening.cheers()}
            clink={opening.clink()}
          />
        </div>
        <SwapHistory swaps={view()?.pub.swaps ?? []} nameOf={nameOf} />
      </Screen>
    );
  }

  function PlayView() {
    return (
      <Screen class="game zk">
        <header class="zk__top">
          <Candle
            left={left()}
            secs={secs()}
            tense={tense()}
            bump={banner() ? String(banner()?.seq) : undefined}
          />
          <Status class="zk__text" titleClass="zk__head" subClass="zk__sub" sub={head().sub}>
            {head().text}
          </Status>
        </header>

        <div class="zk__stage">
          <Table
            crew={crew()}
            holdings={shownHoldings()}
            swapped={shownSwapped()}
            selfId={props.selfId}
            spectator={props.spectator === true}
            nameOf={nameOf}
            selected={sel()}
            canPick={() => canAct()}
            onPick={pick}
            check={props.spectator ? null : check()}
            peek={peek()}
            checking={checking()}
            tense={tense()}
          />
          <Show when={banner()}>
            {(b) => (
              <p class="zk__banner" role="status">
                <span>{nameOf(b().from)}</span>
                <b aria-hidden="true">⇄</b>
                <span class="sr-only">ile takas etti</span>
                <span>{nameOf(b().to)}</span>
              </p>
            )}
          </Show>
        </div>

        <SwapHistory swaps={view()?.pub.swaps ?? []} nameOf={nameOf} />

        <footer class="zk__foot">
          <Show
            when={canAct() && sel() !== null}
            fallback={
              <p class="zk__note" role="status" data-peek={peekNote() ? "1" : undefined}>
                {peekNote() ??
                  (props.spectator
                    ? "Takaslar herkese açık"
                    : !player() || closed()
                      ? "Süre doldu"
                      : checking() !== null
                        ? "Kadeh gizlice açılıyor…"
                        : canAct()
                          ? rights()
                          : "Haklarını kullandın")}
              </p>
            }
          >
            <div class="zk__acts">
              <Show when={!checkUsed()}>
                <button
                  type="button"
                  class="zk__act zk__act--check"
                  onPointerDown={(e) => {
                    unlockAudio();
                    tap();
                    checkPress.onPointerDown(e);
                  }}
                  onClick={checkPress.onClick}
                >
                  Kontrol et
                  <small>Yalnız sen görürsün</small>
                </button>
              </Show>
              <Show when={!swapUsed()}>
                <button
                  type="button"
                  class="zk__act zk__act--swap"
                  onPointerDown={swapPress.onPointerDown}
                  onClick={swapPress.onClick}
                >
                  Takas et
                  <small>Herkes görür · +5 sn</small>
                </button>
              </Show>
            </div>
          </Show>
        </footer>
      </Screen>
    );
  }
}
