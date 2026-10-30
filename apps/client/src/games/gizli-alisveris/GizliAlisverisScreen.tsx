import type { AlisverisProduct } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { hapticError, hapticPress, hapticTick } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./gizli-alisveris.css";
import { AlisverisSonuc, type SonucEntry } from "./AlisverisSonuc.js";
import { fly } from "./fly.js";
import { Alev, Kupon, Poset } from "./Parcalar.js";
import { bip, fisilti, geri, kasa, sonTik } from "./sounds.js";
import { UrunArt } from "./Urun.js";
import { basketCost, heatLabel, paidPrice, parseAlisverisView } from "./view.js";

/** Son bu kadar ms: süre şeridi kızarır, saniye tiki, bekleten avatarlar sallanır. */
const TENSE_MS = 10_000;
/** Son bu kadar ms: "Kasa kapanıyor!" ve kepenk biraz iner. */
const CLOSING_MS = 3_000;
/** "Vitrin fısıldıyor…" geçişinin ekranda kalma süresi. */
const WHISPER_MS = 1_800;
/** Kabuk saati son 5 sn'de kendi tikini çalar; oyun yalnız 10..6. saniyeleri tikler. */
const SHELL_TICK_FROM = 5;

/** Sayı hızla döner (60 → 36); azaltılmış harekette doğrudan yeni değer. */
function createRolling(target: () => number): () => number {
  const [shown, setShown] = createSignal(target());
  let raf = 0;
  createEffect(
    on(target, (to) => {
      cancelAnimationFrame(raf);
      if (reducedMotion() || typeof requestAnimationFrame === "undefined") {
        setShown(to);
        return;
      }
      const from = shown();
      const t0 = performance.now();
      const step = (t: number): void => {
        const k = Math.min(1, (t - t0) / 320);
        setShown(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }),
  );
  onCleanup(() => cancelAnimationFrame(raf));
  return shown;
}

export default function GizliAlisverisScreen(props: GameScreenProps) {
  const view = createMemo(() => parseAlisverisView(props.match.publicView, props.match.view));
  const entries = createMemo<SonucEntry[]>(() =>
    props.match.participants.map((id) => {
      const p = props.players.find((x) => x.id === id);
      return {
        id,
        avatar: p?.avatar ?? 0,
        nickname: p?.nickname ?? "Oyuncu",
        connected: p?.connected ?? true,
      };
    }),
  );
  const spectator = () => props.spectator === true;
  const coupon = () => view()?.coupon ?? null;

  // Dokunuşa anında yanıt: istenen durum sunucu onaylayana kadar yerelde tutulur.
  const [want, setWant] = createSignal<Record<number, boolean>>({});
  const [shake, setShake] = createSignal(0);
  const [bump, setBump] = createSignal(0);
  createEffect(
    on(
      () => view()?.basket,
      (basket) => {
        if (!basket) return;
        setWant((w) => {
          const next: Record<number, boolean> = {};
          for (const [k, val] of Object.entries(w))
            if (basket.includes(Number(k)) !== val) next[Number(k)] = val;
          return next;
        });
      },
    ),
  );
  const basket = createMemo<number[]>(() => {
    const v = view();
    if (!v) return [];
    const w = want();
    const list = v.basket.filter((id) => w[id] !== false);
    for (const [k, val] of Object.entries(w)) if (val && !list.includes(Number(k))) list.push(Number(k));
    return list;
  });
  const remaining = () => {
    const v = view();
    return v ? v.budget - basketCost(basket(), v.products, coupon()) : 0;
  };
  const shownBudget = createRolling(remaining);
  const left = () => {
    const v = view();
    return v ? v.endsAt - props.now() : 0;
  };
  const closed = () => {
    const v = view();
    return spectator() || !v || v.locked || props.now() >= v.endsAt || v.reveal !== null;
  };
  const tense = () => {
    const v = view();
    return !!v && v.reveal === null && left() > 0 && left() <= TENSE_MS;
  };
  const closing = () => tense() && left() <= CLOSING_MS;

  // Son 10 sn: her saniye hafif tik (yalnız hâlâ alışveriş yapana; son 5 sn'yi kabuk saati tikler).
  const sec = createMemo(() => (tense() ? Math.ceil(left() / 1000) : 0));
  createEffect(
    on(sec, (s, prev) => {
      if (s === 0 || s === prev || s <= SHELL_TICK_FROM || closed()) return;
      sonTik();
      hapticTick();
    }),
  );

  // Vitrin fısıltısı: ateş ilk kez gelince kısa geçiş ve ses (geç bağlanana tekrar çalmaz).
  const [whisper, setWhisper] = createSignal(false);
  let whisperTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(whisperTimer));
  createEffect(
    on(
      () => view()?.heat !== null && view()?.heat !== undefined,
      (on_, was) => {
        const v = view();
        if (!on_ || was || !v || v.reveal !== null || props.now() - v.heatAt > WHISPER_MS) return;
        setWhisper(true);
        fisilti();
        whisperTimer = setTimeout(() => setWhisper(false), WHISPER_MS);
      },
    ),
  );

  const itemEls = new Map<number, HTMLElement>();
  let cartEl: HTMLElement | undefined;
  const miniEls = new Map<number, HTMLElement>();

  const toggle = (p: AlisverisProduct): void => {
    if (closed()) return;
    const id = p.id;
    const has = basket().includes(id);
    const cost = paidPrice(p, coupon());
    if (!has && cost > remaining()) {
      bip();
      hapticError();
      setShake((n) => n + 1);
      return;
    }
    hapticPress(has ? 8 : [10, 30, 10]);
    if (has) {
      geri();
      fly(miniEls.get(id)?.querySelector(".uart"), itemEls.get(id)?.querySelector(".uart"), true);
    } else {
      kasa();
      fly(itemEls.get(id)?.querySelector(".uart"), cartEl);
      setBump((n) => n + 1);
    }
    setWant((w) => ({ ...w, [id]: !has }));
    void sendActionAck({ kind: has ? "remove" : "add", product: id }).then((ack) => {
      if (ack.ok || ack.reason === "timeout") return;
      // Reddedildi: yerel istek geri alınır.
      setWant((w) => {
        const { [id]: _drop, ...rest } = w;
        return rest;
      });
      bip();
      hapticError();
    });
  };

  const ratio = () => {
    const v = view();
    return v ? Math.max(0, Math.min(1, remaining() / v.budget)) : 1;
  };
  const productOf = (id: number) => view()?.products.find((p) => p.id === id);
  const readyIds = () => view()?.ready ?? [];

  /** Alttaki hazır şeridi: Tamam diyenin üstüne poşet düşer, bekleten son 10 sn'de sallanır. */
  const Crew = () => (
    <ul class="gacrew" aria-label="Hazır olanlar">
      <For each={entries()}>
        {(e) => {
          const on_ = () => readyIds().includes(e.id);
          return (
            <li
              class="gacrew__p"
              data-on={on_() ? "1" : undefined}
              data-wait={tense() && !on_() ? "1" : undefined}
            >
              <Avatar
                index={e.avatar}
                size={26}
                connected={e.connected}
                mood={on_() ? "happy" : "idle"}
                ring={on_() ? "#B6FF3B" : undefined}
              />
              <Show when={on_()}>
                <Poset class="gacrew__bag" />
                <CbState kind="ok" size={10} class="gacrew__cb" />
              </Show>
              <span class="sr-only">
                {e.nickname}: {on_() ? "hazır" : "alışverişte"}
              </span>
            </li>
          );
        }}
      </For>
    </ul>
  );

  return (
    <Screen class="aa">
      <Show when={view()}>{(v) => <PhaseClock startedAt={v().startedAt} endsAt={v().endsAt} urgency />}</Show>

      <Show when={view()}>
        {(v) => (
          <Show
            when={v().reveal}
            fallback={
              <div
                class="gashop"
                data-tense={tense() ? "1" : undefined}
                data-closing={closing() ? "1" : undefined}
                data-spectator={spectator() ? "1" : undefined}
              >
                <div class="gatense" aria-hidden="true" />
                <div class="gashutter" aria-hidden="true" />
                <Show when={closing() && !closed()}>
                  <p class="gaclose" role="status">
                    Kasa kapanıyor!
                  </p>
                </Show>
                <Show when={whisper()}>
                  <p class="gawhisper" role="status">
                    Vitrin fısıldıyor…
                  </p>
                </Show>

                <Show
                  when={!spectator()}
                  fallback={
                    <div class="gavitrin">
                      <span class="overline">Herkes gizlice alışveriş yapıyor</span>
                      <Show when={v().heat}>
                        <span class="gavitrin__note">Vitrinde ateşli ürünler var</span>
                      </Show>
                    </div>
                  }
                >
                  <div class="abudget" data-low={ratio() < 0.2 ? "1" : undefined} data-shake={shake() % 2}>
                    <div class="abudget__row">
                      <div class="abudget__main">
                        <span class="overline">Kalan bütçen</span>
                        <span class="abudget__num" aria-live="polite">
                          {shownBudget()}
                          <small> kredi</small>
                        </span>
                      </div>
                      <div
                        class="gacart"
                        data-bump={bump() % 2}
                        ref={(el) => {
                          cartEl = el;
                        }}
                      >
                        <svg class="gacart__ico" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 4h2.4l2.2 10.2h9.6L19.6 7H7" />
                          <circle cx="9" cy="18.5" r="1.6" />
                          <circle cx="16" cy="18.5" r="1.6" />
                        </svg>
                        <ul
                          class="gacart__items"
                          data-many={basket().length >= 5 ? "1" : undefined}
                          aria-label={`Sepetinde ${basket().length} ürün`}
                        >
                          <For each={basket()}>
                            {(id) => (
                              <li
                                ref={(el) => {
                                  miniEls.set(id, el);
                                  onCleanup(() => miniEls.delete(id));
                                }}
                              >
                                <UrunArt id={id} name={productOf(id)?.name ?? ""} decorative />
                              </li>
                            )}
                          </For>
                        </ul>
                      </div>
                    </div>
                    <div class="abar" aria-hidden="true">
                      <i class="abar__fill" style={{ transform: `scaleX(${ratio()})` }} />
                    </div>
                  </div>
                </Show>

                <Show
                  when={!(v().locked && !spectator())}
                  fallback={
                    <div class="gapack" role="status">
                      <div class="gapack__bag">
                        <Poset class="gapack__poset" />
                        <div class="gapack__items" data-many={basket().length >= 5 ? "1" : undefined}>
                          <For each={basket()}>
                            {(id, i) => (
                              <span style={{ "--i": i() }}>
                                <UrunArt id={id} name={productOf(id)?.name ?? ""} decorative />
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                      <Show when={basket().length === 0}>
                        <p class="gapack__note">Boş poşet</p>
                      </Show>
                      <p class="gapack__stamp">Sepetin kesinleşti</p>
                      <p class="gapack__note">Sepetler süre bitince açılır</p>
                    </div>
                  }
                >
                  <div class="ashelf gashelf" data-off={spectator() || v().locked ? "1" : undefined}>
                    <For each={v().products}>
                      {(p, i) => {
                        const inCart = () => basket().includes(p.id);
                        const mine = () => coupon() === p.id;
                        const cost = () => paidPrice(p, coupon());
                        const tooDear = () => !spectator() && !inCart() && cost() > remaining();
                        const heat = () => v().heat?.[String(p.id)] ?? null;
                        const press = pressable(() => toggle(p));
                        const label = () =>
                          [
                            p.name,
                            mine() ? `kuponun var: ${p.price} yerine ${cost()} kredi` : `${p.price} kredi`,
                            heat() !== null ? `talep: ${heatLabel(heat() ?? 0)}` : "",
                          ]
                            .filter(Boolean)
                            .join(", ");
                        return (
                          <button
                            type="button"
                            class="aitem gaitem"
                            ref={(el) => {
                              itemEls.set(p.id, el);
                              onCleanup(() => itemEls.delete(p.id));
                            }}
                            style={{ "--i": i() }}
                            data-in={inCart() ? "1" : undefined}
                            data-dear={tooDear() ? "1" : undefined}
                            data-coupon={mine() ? "1" : undefined}
                            disabled={spectator() || v().locked}
                            aria-pressed={spectator() ? undefined : inCart()}
                            aria-label={label()}
                            onPointerDown={press.onPointerDown}
                            onClick={press.onClick}
                          >
                            <Show when={heat() !== null && (heat() ?? 0) > 0}>
                              <Alev level={heat() ?? 0} />
                            </Show>
                            <UrunArt id={p.id} name={p.name} decorative />
                            <span class="aitem__name">{p.name}</span>
                            <span class="gatag" aria-hidden="true">
                              <Show when={mine()} fallback={p.price}>
                                <s>{p.price}</s>
                                {cost()}
                              </Show>
                            </span>
                            <Show when={mine()}>
                              <Kupon class="gaitem__coupon" />
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>

                <Show when={!spectator() && coupon() !== null && !v().locked}>
                  <p class="gahint">
                    Kuponun: <b>{productOf(coupon() ?? -1)?.name}</b> yarı fiyat
                  </p>
                </Show>

                <Crew />

                <TamamBar
                  locked={v().locked}
                  ready={v().ready.length}
                  readyIds={v().ready}
                  total={entries().length}
                  spectator={spectator()}
                  dots={false}
                  onLock={() => sendActionAck({ kind: "lock" })}
                />
              </div>
            }
          >
            {(r) => (
              <AlisverisSonuc
                reveal={r()}
                products={v().products}
                anchor={v().endsAt}
                entries={entries()}
                selfId={props.selfId}
                spectator={spectator()}
                now={props.now}
              />
            )}
          </Show>
        )}
      </Show>
    </Screen>
  );
}
