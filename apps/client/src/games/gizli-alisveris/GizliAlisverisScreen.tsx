import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticError, hapticTap } from "../../fx/haptics.js";
import { fail, tap } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { pressable } from "../../ui/press.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./gizli-alisveris.css";
import { AlisverisSonuc, type SonucEntry } from "./AlisverisSonuc.js";
import { UrunArt } from "./Urun.js";
import { basketCost, parseAlisverisView } from "./view.js";

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

  // Dokunuşa anında yanıt: istenen durum sunucu onaylayana kadar yerelde tutulur.
  const [want, setWant] = createSignal<Record<number, boolean>>({});
  const [shake, setShake] = createSignal(0);
  const [spent, setSpent] = createSignal<{ n: number; text: string } | null>(null);
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
    const set = new Set(v.basket);
    for (const [k, val] of Object.entries(w)) {
      if (val) set.add(Number(k));
      else set.delete(Number(k));
    }
    return [...set];
  });
  const remaining = () => {
    const v = view();
    return v ? v.budget - basketCost(basket(), v.products) : 0;
  };
  const closed = () => {
    const v = view();
    return spectator() || !v || v.locked || props.now() >= v.endsAt || v.reveal !== null;
  };

  const toggle = (id: number, price: number): void => {
    if (closed()) return;
    const has = basket().includes(id);
    if (!has && price > remaining()) {
      fail();
      hapticError();
      setShake((n) => n + 1);
      return;
    }
    hapticTap();
    tap();
    setWant((w) => ({ ...w, [id]: !has }));
    setSpent((s) => ({ n: (s?.n ?? 0) + 1, text: has ? `+${price}` : `−${price}` }));
    void sendActionAck({ kind: has ? "remove" : "add", product: id }).then((ack) => {
      if (ack.ok || ack.reason === "timeout") return;
      // Reddedildi: yerel istek geri alınır.
      setWant((w) => {
        const { [id]: _drop, ...rest } = w;
        return rest;
      });
      fail();
      hapticError();
    });
  };

  const ratio = () => {
    const v = view();
    return v ? Math.max(0, Math.min(1, remaining() / v.budget)) : 1;
  };

  return (
    <Screen class="aa">
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          {(v) => <ProgressBar startedAt={v().startedAt} endsAt={v().endsAt} now={serverNow} urgency />}
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <Show when={view()}>
        {(v) => (
          <Show
            when={v().reveal}
            fallback={
              <>
                <div class="abudget" data-low={ratio() < 0.2 ? "1" : undefined} data-shake={shake() % 2}>
                  <div class="abudget__row">
                    <div class="abudget__main">
                      <span class="overline">
                        {spectator()
                          ? "Herkes gizlice alışveriş yapıyor"
                          : v().locked
                            ? "Sepetin kesinleşti"
                            : "Kalan bütçen"}
                      </span>
                      <Show when={!spectator()}>
                        <span class="abudget__num">
                          {remaining()}
                          <small> kredi</small>
                        </span>
                      </Show>
                    </div>
                    <Show when={!spectator()}>
                      <div class="abudget__cart" aria-live="polite">
                        <b>{basket().length}</b>
                        <span>ürün</span>
                        <Show when={spent()} keyed>
                          {(s) => (
                            <em class="abudget__delta" data-key={s.n}>
                              {s.text}
                            </em>
                          )}
                        </Show>
                      </div>
                    </Show>
                  </div>
                  <div class="abar" aria-hidden="true">
                    <i class="abar__fill" style={{ transform: `scaleX(${ratio()})` }} />
                  </div>
                </div>

                <div class="ashelf" data-off={spectator() || v().locked ? "1" : undefined}>
                  <For each={v().products}>
                    {(p) => {
                      const inCart = () => basket().includes(p.id);
                      const tooDear = () => !inCart() && p.price > remaining();
                      const press = pressable(() => toggle(p.id, p.price));
                      return (
                        <button
                          type="button"
                          class="aitem"
                          data-in={inCart() ? "1" : undefined}
                          data-dear={tooDear() ? "1" : undefined}
                          disabled={spectator() || v().locked}
                          aria-pressed={inCart()}
                          aria-label={`${p.name}, ${p.price} kredi`}
                          onPointerDown={press.onPointerDown}
                          onClick={press.onClick}
                        >
                          <UrunArt id={p.id} name={p.name} decorative />
                          <span class="aitem__name">{p.name}</span>
                          <span class="aitem__price">{p.price}</span>
                        </button>
                      );
                    }}
                  </For>
                </div>

                <TamamBar
                  locked={v().locked}
                  ready={v().ready.length}
                  total={entries().length}
                  spectator={spectator()}
                  onLock={() => sendActionAck({ kind: "lock" })}
                />
              </>
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
