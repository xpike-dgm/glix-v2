import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap } from "../fx/sound.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { ShareIcon } from "../ui/Icons.js";
import { renderMomentCard } from "./drawCard.js";
import type { Moment } from "./momentCards.js";
import { canShareFiles, cardFile, downloadCard, shareCard } from "./shareFile.js";
import "./share.css";

interface Item {
  moment: Moment;
  file: File | null;
  url: string | null;
  failed: boolean;
}

/** Kartlar sayfa açılınca, bu cihazda (canvas ile) sırayla üretilir; hiçbir görüntü sunucuya gitmez. */
function Cards(props: { moments: Moment[] }) {
  const [items, setItems] = createSignal<Item[]>(
    props.moments.map((moment) => ({ moment, file: null, url: null, failed: false })),
  );
  let gone = false;
  const urls: string[] = [];
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const [canShare, setCanShare] = createSignal(false);

  onMount(() => {
    void (async () => {
      for (const [i, moment] of props.moments.entries()) {
        if (gone) return;
        try {
          const blob = await renderMomentCard(moment);
          if (gone) return;
          const file = cardFile(blob, `glix-an-${i + 1}`);
          const url = URL.createObjectURL(blob);
          urls.push(url);
          if (i === 0) setCanShare(canShareFiles(nav, file));
          setItems((cur) => cur.map((it, j) => (j === i ? { ...it, file, url } : it)));
        } catch {
          if (!gone) setItems((cur) => cur.map((it, j) => (j === i ? { ...it, failed: true } : it)));
        }
      }
    })();
  });
  onCleanup(() => {
    gone = true;
    for (const u of urls) URL.revokeObjectURL(u);
  });

  const act = async (file: File): Promise<void> => {
    tap();
    hapticTap();
    if (canShare()) {
      const r = await shareCard(nav, file);
      if (r !== "unsupported") return;
    }
    downloadCard(file);
  };

  const [cur, setCur] = createSignal(0);
  const onScroll = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (const [i, c] of [...el.children].entries()) {
      const k = c as HTMLElement;
      const d = Math.abs(k.offsetLeft - el.offsetLeft + k.offsetWidth / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setCur(best);
  };
  const ready = () => items().filter((it) => it.url !== null).length;
  const current = () => items()[cur()];
  const status = () =>
    ready() < items().length
      ? `Kartlar hazırlanıyor… ${ready()}/${items().length}`
      : `${cur() + 1} / ${items().length} · kaydır, beğendiğini paylaş`;

  return (
    <div class="kart">
      <ul class="kart__strip" onScroll={onScroll}>
        <For each={items()}>
          {(it, i) => (
            <li class="kart__card" aria-label={`Kart ${i() + 1} / ${items().length}: ${it.moment.title}`}>
              <div class="kart__frame">
                <Show when={it.url} fallback={<div class="kart__wait" role="status" />}>
                  {(url) => (
                    <img class="kart__img" src={url()} alt={`${it.moment.title} kartı`} draggable={false} />
                  )}
                </Show>
              </div>
            </li>
          )}
        </For>
      </ul>
      <div class="kart__bar">
        <p class="kart__hint" role="status">
          {status()}
        </p>
        <button
          type="button"
          class="kart__btn"
          disabled={!current()?.file}
          onClick={() => {
            const f = current()?.file;
            if (f) void act(f);
          }}
        >
          <ShareIcon size={20} />
          {canShare() ? "Paylaş" : "İndir"}
        </button>
      </div>
    </div>
  );
}

export function ShareSheet(props: { open: boolean; onClose: () => void; moments: () => Moment[] }) {
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Anları paylaş">
      <Cards moments={props.moments()} />
    </BottomSheet>
  );
}
