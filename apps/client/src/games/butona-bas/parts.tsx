import { type ButonaBasFinal, butonaBasHighlights, type PlayerInfo } from "@glix/engine";
import { createMemo, For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { CrownIcon } from "../../ui/Icons.js";
import { type GapStep, revealOrder, ringWord } from "./view.js";

/** BB-U1: tek tur göstergesi: büyük "TUR 2", üç parçalı çubuk (biten dolu, süren nabız), pencere kelimesi. */
export function RoundBadge(props: {
  /** 0 tabanlı gösterilen tur (aradayken yaklaşan tur). */
  round: number;
  rounds: number;
  /** Tur sürüyor mu (ara ve bitişte çubuk nabız atmaz). */
  live: boolean;
  /** BB-U6: son 3 saniye: çubuk kırmızı. */
  urgent: boolean;
  /** Turun ilerlemesi (0..1): süren parçanın dolgusu. */
  progress: number;
}) {
  const segs = () => Array.from({ length: props.rounds }, (_, i) => i);
  return (
    <div class="bb__badge" data-urgent={props.urgent ? "1" : undefined}>
      <span class="bb__badgeNo">TUR {props.round + 1}</span>
      <span class="bb__bar" role="img" aria-label={`${props.rounds} turun ${props.round + 1}. turu`}>
        <For each={segs()}>
          {(i) => (
            <i
              class="bb__seg"
              data-state={
                i < props.round ? "done" : i === props.round ? (props.live ? "live" : "next") : undefined
              }
              style={i === props.round && props.live ? { "--p": props.progress.toFixed(3) } : undefined}
            />
          )}
        </For>
      </span>
      <span class="bb__badgeWord" data-ring={Math.min(2, props.round)}>
        {ringWord(props.round)}
      </span>
    </div>
  );
}

/** BB-U5: tur arası özet (3 sn): tur bitti + yıldız; tur puanları (şeritte); halka incelir, "DARALIYOR!". */
export function GapSummary(props: {
  step: GapStep;
  /** Biten turun numarası (1 tabanlı). */
  done: number;
  /** Yaklaşan tur (0 tabanlı): halkanın yeni kalınlığı. */
  next: number;
  star: { player: PlayerInfo | undefined; points: number } | null;
}) {
  return (
    <div class="bbgap" data-step={props.step} aria-hidden="true">
      <Show
        when={props.step !== "tight"}
        fallback={
          <>
            <span class="bbgap__rings" aria-hidden="true" data-ring={Math.min(2, props.next)}>
              <i class="bbgap__ringOld" data-ring={Math.max(0, Math.min(2, props.next - 1))} />
              <i class="bbgap__ringNew" />
            </span>
            <strong class="bbgap__title bbgap__title--tight">DARALIYOR!</strong>
            <span class="bbgap__line">
              Tur {props.next + 1} · {ringWord(props.next)}
            </span>
          </>
        }
      >
        <strong class="bbgap__title">TUR {props.done} BİTTİ</strong>
        <Show when={props.step === "done"} fallback={<span class="bbgap__line">Bu turun puanları</span>}>
          <Show when={props.star} fallback={<span class="bbgap__line">Bu turda yıldız çıkmadı</span>}>
            {(s) => (
              <span class="bbgap__star">
                <Show when={s().player}>{(p) => <Avatar index={p().avatar} size={34} />}</Show>
                <span class="bbgap__starName">{s().player?.nickname ?? "Oyuncu"}</span>
                <b class="bbgap__starPts">+{s().points}</b>
              </span>
            )}
          </Show>
        </Show>
      </Show>
    </div>
  );
}

/** BB-U7 zamanlaması: satır `i` (açılış sırasıyla) açılış başından bu kadar sonra görünür. */
export const FINAL_ROW_MS = 450;
export const FINAL_FIRST_MS = 400;
export const finalRowAt = (i: number, n: number): number =>
  FINAL_FIRST_MS + i * FINAL_ROW_MS + (i === n - 1 ? 300 : 0);
export const finalNotesAt = (n: number): number => finalRowAt(n - 1, n) + 700;

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/**
 * BB-U7 son açılış (uyum haritası): toplamlar sondan başa açılır, lider en son ve taçla; her satırda üç tur çubuğu;
 * altında "En uyumlu ikili" ve "Yalnız kurt"; ardından spiker cümlesi (BB-AI1, varsa).
 */
export function FinalReveal(props: {
  players: PlayerInfo[];
  scores: Record<string, number>;
  roundScores: Record<string, number[]>;
  final: ButonaBasFinal;
  /** Açılış başından geçen süre (ms). */
  elapsed: number;
  selfId: string;
  comment: string | null;
  tv?: boolean;
}) {
  const ids = () => props.players.map((p) => p.id);
  const order = createMemo(() => revealOrder(props.scores, ids()));
  const ranked = createMemo(() => [...order()].reverse());
  const top = () => {
    const v = Object.values(props.scores);
    const m = v.length > 0 ? Math.max(...v) : 0;
    return m > 0 ? m : null;
  };
  const maxAbs = createMemo(() => {
    let m = 1;
    for (const list of Object.values(props.roundScores)) for (const x of list) m = Math.max(m, Math.abs(x));
    return m;
  });
  const shownAt = (id: string): number => finalRowAt(order().indexOf(id), order().length);
  const player = (id: string): PlayerInfo | undefined => props.players.find((p) => p.id === id);
  const name = (id: string): string => player(id)?.nickname ?? "Oyuncu";
  const notes = () => props.elapsed >= finalNotesAt(order().length);
  const hl = createMemo(() => butonaBasHighlights(props.final, ids()));
  return (
    <section class="bbfin" data-tv={props.tv ? "1" : undefined} aria-label="Sonuçlar">
      <p class="overline bbfin__over">Uyum haritası</p>
      <ol class="bbfin__list">
        <For each={ranked()}>
          {(id) => {
            const lead = () => top() !== null && props.scores[id] === top();
            const rs = () => props.roundScores[id] ?? [0, 0, 0];
            return (
              <li
                class="bbfin__row"
                data-on={props.elapsed >= shownAt(id) ? "1" : undefined}
                data-lead={lead() ? "1" : undefined}
                data-me={id === props.selfId ? "1" : undefined}
              >
                <span class="bbfin__av">
                  <Avatar
                    index={player(id)?.avatar ?? 0}
                    size={props.tv ? 40 : 34}
                    connected={player(id)?.connected !== false}
                  />
                  <Show when={lead()}>
                    <span class="bbfin__crown" role="img" aria-label="Önde">
                      <CrownIcon size={props.tv ? 26 : 16} />
                    </span>
                  </Show>
                </span>
                <span class="bbfin__name">{name(id)}</span>
                <span class="sr-only">Tur puanları: {rs().map(signed).join(", ")}</span>
                <span class="bbfin__rounds" aria-hidden="true">
                  <For each={rs()}>
                    {(x) => (
                      <span class="bbfin__tr" data-sign={x > 0 ? "+" : x < 0 ? "-" : "0"}>
                        <i style={{ "--w": (Math.abs(x) / maxAbs()).toFixed(3) }} />
                        <b>{signed(x)}</b>
                      </span>
                    )}
                  </For>
                </span>
                <b class="bbfin__total">{signed(props.scores[id] ?? 0)}</b>
              </li>
            );
          }}
        </For>
      </ol>
      <div class="bbfin__notes" data-on={notes() ? "1" : undefined}>
        <Show when={hl().pair}>
          {(p) => (
            <p class="bbfin__note">
              <span class="bbfin__tag">En uyumlu ikili</span>
              <span>
                {name(p().a)} &amp; {name(p().b)} — {p().count} ortak pencere
              </span>
            </p>
          )}
        </Show>
        <Show when={hl().lone}>
          {(l) => (
            <p class="bbfin__note bbfin__note--lone">
              <span class="bbfin__tag">Yalnız kurt</span>
              <span>
                {name(l().id)} — {l().count} kez tek bastı
              </span>
            </p>
          )}
        </Show>
        <Show when={props.comment}>
          {(c) => (
            <p class="bbfin__comment">
              <span class="bbfin__tag">Spiker</span>
              <span>{c()}</span>
            </p>
          )}
        </Show>
      </div>
    </section>
  );
}
