import type { PlayerInfo } from "@glix/engine";
import { createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { formatScore, playersOnly } from "../screens/ranking.js";
import { Avatar } from "../ui/Avatar.js";
import { CheckIcon } from "../ui/Icons.js";
import { fitScale } from "./tvLayout.js";

/** Bir kutuyu (mantıksal `w` x `h`) bulunduğu alana sığacak şekilde büyütür; içerik ekranın "telefonu" gibi çizilir. */
export function TvFit(props: { w: number; h: number; children: JSX.Element; class?: string }) {
  let area: HTMLDivElement | undefined;
  const [scale, setScale] = createSignal(0);
  onMount(() => {
    if (!area) return;
    const read = (): void => {
      setScale(fitScale(area?.clientWidth ?? 0, area?.clientHeight ?? 0, props.w, props.h));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(area);
    onCleanup(() => ro.disconnect());
  });
  return (
    <div class="tv__fit" ref={area}>
      <div
        class={`tv__scaled ${props.class ?? ""}`}
        style={{
          width: `${props.w}px`,
          height: `${props.h}px`,
          transform: `translate(-50%, -50%) scale(${scale()})`,
          visibility: scale() > 0 ? "visible" : "hidden",
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

export interface BoardRow {
  player: PlayerInfo;
  /** Sağdaki büyük sayı; verilmezse gösterilmez. */
  score?: number | undefined;
  /** Küçük ikincil metin (ör. oyun içi puan, sıra değişimi). */
  note?: string | undefined;
  /** Hazır işareti (Hazırım / tamam). */
  ready?: boolean | undefined;
  /** Vurgu: sırası olan / öndeki. */
  active?: boolean | undefined;
}

/** Sağ sütun: oyuncular, puanlar, hazır durumları. İzleyiciler listelenmez. */
export function TvBoard(props: {
  title: string;
  rows: BoardRow[];
  hostId: string;
  /** Sonuç ekranında ev sahibi tacı gösterilmez (taç yalnız kazananındır). */
  hideHost?: boolean;
  /** Satır sayısına göre yoğunluk: 5'ten fazlaysa satırlar sıkılaşır. */
  footer?: JSX.Element;
}) {
  const dense = () => props.rows.length > 5;
  return (
    <aside class="tv__side" aria-label={props.title}>
      <p class="tv__overline">{props.title}</p>
      <ul class="tv__board" data-dense={dense() ? "1" : undefined}>
        <For each={props.rows}>
          {(r, i) => (
            <li
              class="tv__prow"
              data-pid={r.player.id}
              data-off={r.player.connected ? undefined : "1"}
              data-active={r.active ? "1" : undefined}
              style={{ "--i": i() }}
            >
              <Avatar
                index={r.player.avatar}
                size={dense() ? 64 : 84}
                connected={r.player.connected}
                ready={r.ready === true}
                host={props.hideHost !== true && r.player.id === props.hostId}
              />
              <span class="tv__pname">
                <span class="tv__pnick">{r.player.nickname}</span>
                <Show when={r.note}>{(n) => <span class="tv__pnote">{n()}</span>}</Show>
                <Show when={!r.player.connected}>
                  <span class="tv__pnote">Bağlantı koptu</span>
                </Show>
              </span>
              <Show when={r.ready}>
                <span class="tv__pready" role="img" aria-label="Hazır">
                  <CheckIcon size={30} />
                </span>
              </Show>
              <Show when={r.score !== undefined}>
                <span class="tv__pscore">{formatScore(r.score ?? 0)}</span>
              </Show>
            </li>
          )}
        </For>
      </ul>
      {props.footer}
    </aside>
  );
}

/** Oda kodu rozeti (üst köşe): telefondan girenler kodu her an görsün. */
export function TvCodeTag(props: { code: string }) {
  return (
    <section class="tv__codetag" aria-label={`Oda kodu ${props.code}`}>
      <span class="tv__codetag-k">Oda</span>
      <span class="tv__codetag-v">{props.code}</span>
    </section>
  );
}

/** Oyuncu satırları: izleyiciler hariç, puana göre sıralı (eşitlikte oda sırası). Saf işlev; çağıran `createMemo` sarar. */
export function scoreRows(
  players: readonly PlayerInfo[],
  extra?: (p: PlayerInfo) => Partial<BoardRow>,
): BoardRow[] {
  return playersOnly(players)
    .map((player, order) => ({ player, order }))
    .sort((a, b) => b.player.score - a.player.score || a.order - b.order)
    .map(({ player }) => ({ player, score: player.score, ...(extra?.(player) ?? {}) }));
}
