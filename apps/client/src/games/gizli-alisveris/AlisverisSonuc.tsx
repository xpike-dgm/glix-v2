import type { AlisverisProduct, AlisverisReveal } from "@glix/engine";
import { formatKredi } from "@glix/engine";
import { createEffect, createMemo, For, on, Show } from "solid-js";
import { hapticMatch, hapticResult, hapticSolo, hapticTick } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { fly } from "./fly.js";
import { Kupon } from "./Parcalar.js";
import { altin, cekmece, kepenk, kirilma } from "./sounds.js";
import { UrunArt } from "./Urun.js";
import {
  buyersOf,
  productValueText,
  ranking,
  SONUC_ZAMANI,
  sepetAcilis,
  sonucSahne,
  urunAcilis,
} from "./view.js";

export interface SonucEntry {
  id: string;
  avatar: number;
  nickname: string;
  connected: boolean;
}

interface Props {
  reveal: AlisverisReveal;
  products: AlisverisProduct[];
  /** Alışveriş bitişi: sonuç açılışı buradan başlar. */
  anchor: number;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}

/** Bir ürün kartında gösterilen en çok alıcı avatarı; fazlası "+n". */
const MAX_FACES = 3;

/**
 * Sahne sahne sonuç (zaman çizelgesi `SONUC_ZAMANI`): kepenk kalkar → ürün ürün alıcılar ve bölünme →
 * sepetler en değersizden en değerliye → puanlar üstteki puan yazısına uçar. Her şey geçen süreden türetilir;
 * geç bağlanan oyuncu kaldığı sahneden görür (geçmiş sahnelerin sesi çalmaz).
 */
export function AlisverisSonuc(props: Props) {
  const r = () => props.reveal;
  const order = () => props.entries.map((e) => e.id);
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const desc = createMemo(() => ranking(r(), order()));
  /** Açılış sırası: en değersiz önce (k = 0), en değerli en son. */
  const openK = createMemo(() => {
    const asc = [...desc()].reverse();
    return new Map(asc.map((id, k) => [id, k]));
  });
  const buyers = createMemo(() => buyersOf(r(), order()));
  const productName = (id: number) => props.products.find((p) => p.id === id)?.name ?? "";

  const elapsed = () => props.now() - props.anchor;
  const mountedAt = elapsed();
  const stage = createMemo(() => sonucSahne(elapsed()));
  const productOpen = (i: number) => elapsed() >= urunAcilis(i, props.products.length);
  const rowOpen = (id: string) => elapsed() >= sepetAcilis(openK().get(id) ?? 0, desc().length);
  const myPoints = () => r().points[props.selfId] ?? 0;
  const inGame = () => props.selfId in r().values;

  /** Bir eşik bu oturumda geçildiyse true (geç bağlanınca geçmiş sesleri çalmamak için). */
  const crossedLive = (at: number) => at > mountedAt;

  // Sesler ve titreşim: sahne geçişlerinde bir kez.
  createEffect(
    on(stage, (s, prev) => {
      if (prev === undefined) {
        // Kepenk sesi yalnız açılışın başında bağlı olana çalar.
        if (s === 0 && mountedAt < SONUC_ZAMANI.kepenk + 400) kepenk();
        return;
      }
      if (s === 3 && prev !== 3) {
        if (props.spectator || !inGame()) return;
        if (myPoints() === 2) {
          cekmece();
          hapticResult();
        } else if (myPoints() === 1) {
          matchSound();
          hapticMatch();
        } else {
          soloSound();
          hapticSolo();
        }
      }
    }),
  );
  // Ürün başına ses: bölünme cam kırığı, tek başına altın çınlama (yalnız canlı geçişte).
  const playedProducts = new Set<number>();
  createEffect(() => {
    props.products.forEach((p, i) => {
      const at = urunAcilis(i, props.products.length);
      if (playedProducts.has(p.id) || elapsed() < at) return;
      playedProducts.add(p.id);
      if (!crossedLive(at)) return;
      const n = r().buyers[String(p.id)] ?? 0;
      if (n > 1) kirilma();
      else if (n === 1) altin();
      if (i === 0) hapticTick();
    });
  });

  // Puanlar uçar: satırdaki çip, üstteki puan yazısına.
  let headEl: HTMLElement | undefined;
  const chipEls = new Map<string, HTMLElement>();
  createEffect(
    on(stage, (s, prev) => {
      if (s !== 3 || prev === 3 || prev === undefined) return;
      for (const [id, el] of chipEls) if ((r().points[id] ?? 0) > 0) fly(el, headEl);
    }),
  );

  /** Kendi sıran (eşit değerler aynı sırayı paylaşır) ve puanın: "2. sıra · +1" / "4. sıra · puan yok". */
  const mySub = (): string | null => {
    if (stage() < 3 || props.spectator || !inGame()) return null;
    const mine = r().values[props.selfId] ?? 0;
    const rank = 1 + desc().filter((id) => (r().values[id] ?? 0) > mine).length;
    return `${rank}. sıra · ${myPoints() > 0 ? `+${myPoints()}` : "puan yok"}`;
  };

  const head = (): { label: string; value: string; kind: string } => {
    const s = stage();
    if (s === 0) return { label: "Raf kepengi", value: "Açılıyor", kind: "n" };
    if (s === 1) return { label: "Kim neyi aldı?", value: "Bölünüyor", kind: "n" };
    if (s === 2) return { label: "Sepetler", value: "Açılıyor", kind: "n" };
    if (props.spectator || !inGame()) {
      const w = r().winners.map((id) => byId().get(id)?.nickname ?? "Oyuncu");
      return w.length === 0
        ? { label: "En değerli sepet", value: "Kimse yok", kind: "dim" }
        : {
            label: "En değerli sepet",
            value: w.length === 1 ? (w[0] ?? "") : `${w.length} kişi`,
            kind: "gold",
          };
    }
    const pts = myPoints();
    return pts > 0
      ? { label: pts === 2 ? "En değerli sepet" : "İkinci sepet", value: `Puanın +${pts}`, kind: "gold" }
      : { label: "Sepetin", value: formatKredi(r().values[props.selfId] ?? 0), kind: "dim" };
  };

  return (
    <div class="ares" data-stage={stage()}>
      <div class="ares__head" role="status" aria-live="polite">
        <span class="overline">{head().label}</span>
        <span
          class="ares__val"
          data-k={head().kind}
          data-s={stage()}
          ref={(el) => {
            headEl = el;
          }}
        >
          {head().value}
        </span>
        <Show when={mySub()}>{(t) => <span class="ares__sub">{t()}</span>}</Show>
      </div>

      <Show
        when={stage() >= 2}
        fallback={
          <div class="ashelf ashelf--res">
            <For each={props.products}>
              {(p, i) => {
                const n = () => r().buyers[String(p.id)] ?? 0;
                const faces = () => buyers()[String(p.id)] ?? [];
                const open = () => stage() >= 1 && productOpen(i());
                return (
                  <div
                    class="aitem aitem--res gares"
                    data-n={n() > 2 ? "m" : n()}
                    data-open={open() ? "1" : undefined}
                  >
                    <UrunArt id={p.id} name={p.name} decorative />
                    <span class="aitem__name">{p.name}</span>
                    <span class="gares__faces" aria-hidden="true">
                      <Show when={open()}>
                        <For each={faces().slice(0, MAX_FACES)}>
                          {(id) => <Avatar index={byId().get(id)?.avatar ?? 0} size={18} />}
                        </For>
                        <Show when={faces().length > MAX_FACES}>
                          <em>+{faces().length - MAX_FACES}</em>
                        </Show>
                      </Show>
                    </span>
                    <span class="gatag gares__tag">
                      <Show when={open()} fallback={p.price}>
                        <Show
                          when={n() > 1}
                          fallback={n() === 1 ? <b class="gares__solo">TEK BAŞINA!</b> : p.price}
                        >
                          <s>{p.price}</s>
                          <i class="gares__div">÷{n()}</i>
                          {productValueText(p.price, n())}
                        </Show>
                      </Show>
                    </span>
                    <span class="sr-only">
                      {open() ? (n() === 0 ? "kimse almadı" : `${n()} kişi aldı`) : "kapalı"}
                    </span>
                  </div>
                );
              }}
            </For>
            <div
              class="ashutter gakepenk"
              aria-hidden="true"
              data-up={stage() >= 1 || elapsed() > 300 ? "1" : undefined}
            />
          </div>
        }
      >
        <ol class="arank">
          <For each={desc()}>
            {(id, i) => {
              const e = () => byId().get(id);
              const win = () => r().winners.includes(id);
              const pts = () => r().points[id] ?? 0;
              const open = () => rowOpen(id);
              const coupon = () => r().coupons[id];
              const items = () => r().baskets[id] ?? [];
              return (
                <li
                  class="arow garow"
                  data-open={open() ? "1" : undefined}
                  data-win={open() && win() ? "1" : undefined}
                  data-me={id === props.selfId ? "1" : undefined}
                  style={{ "--i": i() }}
                >
                  <Avatar
                    index={e()?.avatar ?? 0}
                    size="clamp(30px, 5.4dvh, 38px)"
                    connected={e()?.connected ?? true}
                  />
                  <span class="arow__main">
                    <span class="arow__name">
                      <Show when={open() && win()}>
                        <CbState kind="star" size={13} class="arow__cb" />{" "}
                      </Show>
                      {e()?.nickname ?? "Oyuncu"}
                      <Show when={coupon() !== undefined}>
                        <span class="garow__coupon">
                          <Kupon /> {productName(coupon() ?? -1)}
                        </span>
                      </Show>
                    </span>
                    <span class="arow__items">
                      <Show when={open()} fallback={<em>…</em>}>
                        <For each={items()} fallback={<em>Sepet boş</em>}>
                          {(pid, j) => (
                            <span
                              class="garow__item"
                              style={{ "--j": j() }}
                              data-coupon={pid === coupon() ? "1" : undefined}
                            >
                              <UrunArt id={pid} name={productName(pid)} />
                            </span>
                          )}
                        </For>
                      </Show>
                      <Show when={open() && win()}>
                        <span class="garow__stamp">EN DEĞERLİ SEPET</span>
                      </Show>
                    </span>
                  </span>
                  <span class="garow__badge" data-p={open() ? pts() : 0}>
                    <Show when={open() && pts() > 0}>
                      <b
                        ref={(el) => {
                          chipEls.set(id, el);
                        }}
                      >
                        +{pts()}
                      </b>
                      <span class="sr-only"> puan</span>
                    </Show>
                  </span>
                  <span class="arow__val">{open() ? formatKredi(r().values[id] ?? 0) : "?"}</span>
                  <Show when={open() && win()}>
                    <span class="gaconfetti" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  </Show>
                </li>
              );
            }}
          </For>
        </ol>
      </Show>
    </div>
  );
}
