import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { reducedMotion } from "../fx/motion.js";
import { tap } from "../fx/sound.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { ShareIcon } from "../ui/Icons.js";
import { browserClipEnv, planClip } from "./clipFormat.js";
import type { ClipInput, ClipResult } from "./danceClip.js";
import { renderMomentCard } from "./drawCard.js";
import type { Moment } from "./momentCards.js";
import { canShareFiles, cardFile, clipFile, downloadCard, shareCard } from "./shareFile.js";
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

type ClipState =
  | { s: "idle" }
  | { s: "making"; p: number }
  | { s: "done"; file: File; url: string; video: boolean }
  | { s: "failed"; interrupted: boolean };

/**
 * Dans klibi: kazananın dansı + alkışlayan 2. ve 3. + logo, ad, puan (~5 sn, dikey). Cihazda kaydedilir.
 * Kayıt desteklenmiyorsa ya da hareket azaltma açıksa podyumun durağan görseli (PNG) üretilir.
 */
function ClipPanel(props: { clip: ClipInput }) {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const plan = planClip(browserClipEnv(reducedMotion()));
  const video = plan.kind === "video";
  const [st, setSt] = createSignal<ClipState>({ s: "idle" });
  let abort: AbortController | null = null;
  let url: string | null = null;
  let gone = false;

  const drop = (): void => {
    if (url) URL.revokeObjectURL(url);
    url = null;
  };
  onCleanup(() => {
    gone = true;
    abort?.abort();
    drop();
  });

  const make = async (): Promise<void> => {
    tap();
    hapticTap();
    drop();
    const ctl = new AbortController();
    abort = ctl;
    setSt({ s: "making", p: 0 });
    try {
      const { makeClip } = await import("./danceClip.js");
      const low =
        (navigator.hardwareConcurrency ?? 8) <= 4 ||
        ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
      const r: ClipResult = await makeClip(props.clip, {
        mode: plan.kind === "video" ? { kind: "video", format: plan.format } : { kind: "poster" },
        signal: ctl.signal,
        low,
        onProgress: (p) => {
          if (!gone && !ctl.signal.aborted) setSt({ s: "making", p });
        },
      });
      if (gone || ctl.signal.aborted) return;
      const file = clipFile(r.blob, "glix-dans", r.ext, r.mime);
      url = URL.createObjectURL(r.blob);
      setSt({ s: "done", file, url, video: r.kind === "video" });
    } catch (e) {
      if (gone) return;
      if (e instanceof DOMException && e.name === "AbortError") {
        setSt(ctl.signal.aborted ? { s: "idle" } : { s: "failed", interrupted: true });
      } else setSt({ s: "failed", interrupted: false });
    } finally {
      if (abort === ctl) abort = null;
    }
  };
  const cancel = (): void => {
    tap();
    abort?.abort();
  };
  const send = async (file: File): Promise<void> => {
    tap();
    hapticTap();
    if (canShareFiles(nav, file)) {
      const r = await shareCard(nav, file);
      if (r !== "unsupported") return;
    }
    downloadCard(file);
  };
  const noun = video ? "klip" : "görsel";

  return (
    <section class="klip" aria-label="Dans klibi">
      <div class="klip__media" aria-hidden="true">
        <Show when={st().s === "done" ? (st() as Extract<ClipState, { s: "done" }>) : null}>
          {(d) => (
            <Show
              when={d().video}
              fallback={<img class="klip__vid" src={d().url} alt="" draggable={false} />}
            >
              <video class="klip__vid" src={d().url} autoplay loop muted playsinline />
            </Show>
          )}
        </Show>
      </div>
      <div class="klip__body">
        <p class="klip__title">{video ? "Kazananın dans klibi" : "Podyum görseli"}</p>
        <Show
          when={st().s !== "making"}
          fallback={
            <>
              <div
                class="klip__bar"
                role="progressbar"
                aria-label="Klip hazırlanıyor"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(((st() as { p: number }).p ?? 0) * 100)}
              >
                <i style={{ width: `${Math.round(((st() as { p: number }).p ?? 0) * 100)}%` }} />
              </div>
              <p class="klip__hint" role="status">
                Klip hazırlanıyor…
              </p>
              <button type="button" class="klip__btn klip__btn--ghost" onClick={cancel}>
                Vazgeç
              </button>
            </>
          }
        >
          <Show
            when={st().s === "done" ? (st() as Extract<ClipState, { s: "done" }>) : null}
            fallback={
              <>
                <p class="klip__hint" role="status">
                  {(() => {
                    const x = st();
                    if (x.s === "failed")
                      return x.interrupted
                        ? "Ekrandan çıkınca klip yarım kaldı. Tekrar dene."
                        : `Bu cihazda ${noun} hazırlanamadı. Tekrar dene.`;
                    return video
                      ? "5 saniyelik dikey klip; dansın, adların ve puanların hepsi içinde."
                      : "Dans kaydı bu cihazda olmadığı için podyumun görselini hazırlarız.";
                  })()}
                </p>
                <button type="button" class="klip__btn" onClick={() => void make()}>
                  {st().s === "failed" ? "Tekrar dene" : video ? "Klip oluştur" : "Görsel oluştur"}
                </button>
              </>
            }
          >
            {(d) => (
              <>
                <p class="klip__hint" role="status">
                  {video ? "Klip hazır." : "Görsel hazır."}
                </p>
                <div class="klip__row">
                  <button type="button" class="klip__btn" onClick={() => void send(d().file)}>
                    <ShareIcon size={20} />
                    {canShareFiles(nav, d().file) ? "Paylaş" : "İndir"}
                  </button>
                  <button type="button" class="klip__btn klip__btn--ghost" onClick={() => void make()}>
                    Yeniden
                  </button>
                </div>
              </>
            )}
          </Show>
        </Show>
      </div>
    </section>
  );
}

export function ShareSheet(props: {
  open: boolean;
  onClose: () => void;
  moments: () => Moment[];
  clip: () => ClipInput;
}) {
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Anları paylaş">
      <Cards moments={props.moments()} />
      <ClipPanel clip={props.clip()} />
    </BottomSheet>
  );
}
