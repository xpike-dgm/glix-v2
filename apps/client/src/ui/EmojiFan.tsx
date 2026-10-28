import type { LobbyEmoji, ReactionId } from "@glix/engine";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap } from "../fx/sound.js";
import { ensureShopLoaded, ownPacks } from "../net/shop.js";
import { state } from "../net/store.js";
import { RESULT_EMOJIS } from "./EmojiBar.js";
import { SmileIcon } from "./ResultIcons.js";
import { reactionPages } from "./reactionPages.js";

/** Dilimlerin dizildiği çeyrek daire: düğme merkezinden emojilerin uzaklığı (px); halka ölçüleri CSS'te. */
const RADIUS = 150;

/**
 * Ekranın bir köşesinde duran küçük tepki düğmesi; dokununca tepkiler mandalina dilimleri gibi çeyrek daire
 * biçiminde açılır. `up`: düğme altta, yelpaze yukarı-sola açılır; `down`: düğme üstte, aşağı-sola açılır.
 * Bir tepkiye dokunmak gönderir ve kapatır; dışarı dokunmak ya da Escape yalnız kapatır.
 * Yalnız `transform` ve `opacity` canlandırılır. Hareket azaltmada bütün geçişler kökteki kuralla anında olur.
 */
export function EmojiFan(props: {
  onPick: (emoji: ReactionId) => void;
  emojis?: readonly LobbyEmoji[];
  /** `up` (varsayılan): köşe altta. `down`: köşe üstte. */
  open?: "up" | "down";
  class?: string;
}) {
  const [shown, setShown] = createSignal(false);
  // Sayfalar: emojiler + sahip olunan her tepki paketi (çıkartmalar). Paket yoksa tek sayfa, değiştirici görünmez.
  const [pageNo, setPageNo] = createSignal(0);
  onMount(() => {
    if (state.account) ensureShopLoaded();
  });
  const pages = createMemo(() => reactionPages(props.emojis ?? RESULT_EMOJIS, ownPacks()));
  const page = () => pages()[Math.min(pageNo(), pages().length - 1)] ?? pages()[0];
  const nextPage = (): void => {
    tap();
    setPageNo((n) => (n + 1) % pages().length);
  };
  let btn: HTMLButtonElement | undefined;
  let first: HTMLButtonElement | undefined;
  const list = () => page()?.items ?? [];
  const down = () => props.open === "down";
  /** Saat yönünde, yukarıdan ölçülen açı: yukarı-sol çeyrek 270..360, aşağı-sol çeyrek 180..270. */
  const from = () => (down() ? 180 : 270);
  const step = () => 90 / Math.max(1, list().length - 1);
  const place = (i: number): { x: number; y: number } => {
    const a = ((from() + i * step()) * Math.PI) / 180;
    // Beş ve daha çok düğme çeyrekte yan yana sığmaz (48 px kutular binerdi): tekler bir sıra dışarıda durur.
    const r = list().length > 4 && i % 2 === 1 ? RADIUS + 54 : RADIUS;
    return { x: Math.round(r * Math.sin(a) * 10) / 10, y: Math.round(-r * Math.cos(a) * 10) / 10 };
  };
  /** Dilimler arasında ince boşluk bırakan koni: her dilim emojisini ortalar, kenarlarda 1,2° boşluk. */
  const slices = (): string => {
    const n = list().length;
    const w = step();
    const gap = 1.2;
    const stops: string[] = [];
    for (let i = 0; i < n; i++) {
      const a = i * w;
      stops.push(
        `transparent ${a}deg ${a + gap / 2}deg`,
        `var(--efan-c) ${a + gap / 2}deg ${a + w - gap / 2}deg`,
      );
      stops.push(`transparent ${a + w - gap / 2}deg ${a + w}deg`);
    }
    stops.push(`transparent ${n * w}deg`);
    // İlk ve son dilim, çeyreğin kenarındaki emojiyi ortalar: dilimler yarım adım taşar.
    return `conic-gradient(from ${from() - w / 2}deg at 50% 50%, ${stops.join(", ")})`;
  };

  const close = (refocus: boolean): void => {
    setShown(false);
    document.removeEventListener("keydown", onKey);
    if (refocus) btn?.focus();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") close(true);
  }
  const toggle = (): void => {
    if (shown()) {
      close(false);
      return;
    }
    setShown(true);
    document.addEventListener("keydown", onKey);
    queueMicrotask(() => first?.focus({ preventScroll: true }));
  };
  onCleanup(() => document.removeEventListener("keydown", onKey));

  return (
    <div
      class={`efan ${props.class ?? ""}`}
      data-open={shown() ? "1" : undefined}
      data-dir={props.open ?? "up"}
    >
      <Show when={shown()}>
        {/* Dışarı dokunma: ekranı kaplayan görünmez katman; klavye için Escape ve düğme yeter. */}
        <div class="efan__scrim" aria-hidden="true" onPointerDown={() => close(false)} />
      </Show>
      <div class="efan__ring" aria-hidden="true" style={{ "--efan-bg": slices() }} />
      <Show when={shown() && pages().length > 1}>
        <button
          type="button"
          class="efan__page"
          aria-label={`Tepki sayfası: ${page()?.label}. Değiştirmek için dokun`}
          onClick={nextPage}
        >
          <Show when={page()?.icon} fallback={<span class="efan__page-ico">😀</span>}>
            {(src) => <img class="efan__page-ico" src={src()} alt="" draggable={false} />}
          </Show>
          <span class="efan__dots" aria-hidden="true">
            <For each={pages()}>{(_, i) => <i data-on={i() === pageNo() ? "1" : undefined} />}</For>
          </span>
        </button>
      </Show>
      {/* biome-ignore lint/a11y/useSemanticElements: açılır tepki listesi; düğmeler kendi adlarını taşır */}
      <div class="efan__items" role="group" aria-label="Tepkiler">
        <For each={list()}>
          {(choice, i) => (
            <button
              type="button"
              class="efan__item"
              data-sticker={choice.src ? "1" : undefined}
              tabIndex={shown() ? 0 : -1}
              aria-label={`Tepki: ${choice.label}`}
              ref={(el) => {
                if (i() === 0) first = el;
              }}
              style={{
                "--x": `${place(i()).x}px`,
                "--y": `${place(i()).y}px`,
                "--k": i(),
              }}
              onClick={() => {
                tap();
                hapticTap();
                props.onPick(choice.id);
                close(true);
              }}
            >
              <Show when={choice.src} fallback={choice.text}>
                {(src) => <img class="efan__sticker" src={src()} alt="" draggable={false} decoding="async" />}
              </Show>
            </button>
          )}
        </For>
      </div>
      <button
        type="button"
        class="efan__btn"
        ref={btn}
        aria-label="Tepki gönder"
        aria-expanded={shown()}
        aria-haspopup="true"
        onClick={toggle}
      >
        <SmileIcon size={26} />
      </button>
    </div>
  );
}
