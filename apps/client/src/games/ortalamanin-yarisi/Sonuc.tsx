import { type OrtalamaReveal, type OrtalamaRoundSummary, ortalamaMultiplier } from "@glix/engine";
import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticCrowd, hapticLong, hapticMatch, hapticResult, hapticSolo } from "../../fx/haptics.js";
import { reducedMotion } from "../../fx/motion.js";
import { fanfare, match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { CbMarker } from "../../ui/CbMarker.js";
import { ortalamaRevealCues } from "./cues.js";
import { DiceIcon, type Entry, RoundsTable } from "./parts.js";
import { balance, bell, dice, fizz, laser, pop, sizzle, tieChord } from "./sounds.js";
import {
  assignLanes,
  BADGE_TEXT,
  badgeOf,
  formatNumber,
  multiplierLabel,
  multiplierWord,
  pointsOf,
  poppedCount,
  type RevealStage,
  revealStage,
  revealTimeline,
  roadX,
  ropesOut,
  targetName,
  tierOf,
  whatIf,
  whatIfText,
  winningRangeText,
  ZOOM_STACK,
} from "./view.js";

export type SonucEntry = Entry;

interface Props {
  reveal: OrtalamaReveal;
  /** Gösterilen tur (1 tabanlı) ve toplam tur sayısı. */
  round: number;
  rounds: number;
  multiplier: { num: number; den: number };
  /** Bu tur dahil mini puan toplamları. */
  totals: Record<string, number>;
  /** Yalnız son turda: genel skora eklenecek puanlar (3 turun toplamından, bir kez). */
  final: Record<string, number> | null;
  /** Önceki turların açılmış özetleri (üç turun tablosu için). */
  previous: readonly OrtalamaRoundSummary[];
  /** Seçim süresinin bitişi: açılış buradan sayılır. */
  endsAt: number;
  /** Bu turun sonuç ekranının bitişi (ara turda özet son 1 sn'de çıkar). */
  revealEndsAt: number;
  entries: SonucEntry[];
  selfId: string;
  spectator: boolean;
  /** Büyük ekran: ses ve titreşim yok. */
  tv?: boolean;
  now: () => number;
}

/** Ara tur özetinin (OY-U10) görüneceği süre: sonuç ekranının son 1 sn'si. */
export const SUMMARY_LEAD_MS = 1_000;
/** Yol şeridinin yüksekliği (px): istifteki her nokta bir şerit. */
const LANE_MIN_GAP = 7;

/**
 * Tur sonucu (OY-U5 … U11): sayılar yola düşer → terazi dengelenir (ortalama) → altın ışın kesir kadar kayar (hedef)
 * → ipler uzaktan yakına söner → liste (en yakın üstte, rozetler), puan ve "ne olurdu?" satırı → son turda üç turun
 * tablosu. Ekran geç açılırsa açılış kaldığı yerden sürer (zaman çizelgesi saatten türetilir).
 */
export function Sonuc(props: Props) {
  const r = () => props.reveal;
  const byId = createMemo(() => new Map(props.entries.map((e) => [e.id, e])));
  const nameOf = (id: string) => (id === props.selfId ? "Sen" : (byId().get(id)?.nickname ?? "Oyuncu"));
  /** Düşüş sırası katılım sırasıdır (yakınlık sırası ele vermesin); liste en son yakınlığa göre gelir. */
  const ids = createMemo(() => props.entries.map((e) => e.id).filter((id) => id in r().choices));
  const order = createMemo(() => r().order.filter((id) => byId().has(id)));
  const reduced = reducedMotion();
  const tl = revealTimeline(ids().length, reduced);
  const isLast = () => props.round >= props.rounds;
  const elapsed = () => props.now() - props.endsAt;
  const stage = createMemo<RevealStage>(() => revealStage(elapsed(), tl, isLast()));
  const popped = createMemo(() => poppedCount(elapsed(), tl, ids().length));
  const out = createMemo(() => ropesOut(elapsed(), tl, ids().length));
  /** Söndürme sırası: en uzaktan en yakına. */
  const farRank = createMemo(() => new Map([...order()].reverse().map((id, i) => [id, i])));

  const baseLanes = createMemo(() =>
    assignLanes(
      ids().map((id) => roadX(r().choices[id] ?? 0, r().target, false) * 100),
      LANE_MIN_GAP,
    ),
  );
  const stack = () => Math.max(1, ...baseLanes().map((l) => l + 1));
  // OY-U11: istif 4'ü geçerse puan aşamasından sonra yol hedef çevresine yakınlaşır.
  const zoom = () => stage() >= 4 && stack() > ZOOM_STACK && !props.tv;
  const lanes = createMemo(() =>
    zoom()
      ? assignLanes(
          ids().map((id) => roadX(r().choices[id] ?? 0, r().target, true) * 100),
          LANE_MIN_GAP,
        )
      : baseLanes(),
  );
  const laneCount = () => Math.max(1, ...lanes().map((l) => l + 1));
  const xOf = (v: number) => roadX(v, r().target, zoom());

  const myPoints = () => pointsOf(r(), props.selfId);
  const myBadge = () => badgeOf(r(), props.selfId);
  const myTotal = () => props.totals[props.selfId] ?? 0;
  const myFinal = () => props.final?.[props.selfId] ?? 0;
  const played = createMemo(() => [...props.previous, { ...r() }]);
  const [showList, setShowList] = createSignal(false);

  if (!props.tv) {
    ortalamaRevealCues(() => ({ round: props.round, stage: stage(), popped: popped(), ropesOut: out() }), {
      pop: (i) => {
        const id = ids()[i];
        if (id && r().random.includes(id)) dice();
        else pop(i);
      },
      rope: () => fizz(),
      stage: (s) => {
        if (s === 1) {
          balance();
          if (r().burned.length > 0) sizzle();
        } else if (s === 2) laser();
        else if (s === 4) {
          if (props.spectator) return;
          const b = myBadge();
          if (b === "best") {
            bell();
            hapticCrowd();
          } else if (b === "tie") {
            tieChord();
            hapticMatch();
          } else if (b === "second") {
            matchSound();
            hapticMatch();
          } else if (b === "burned") {
            sizzle();
            hapticLong();
          } else {
            soloSound();
            hapticSolo();
          }
        } else if (s === 5 && !props.spectator) {
          if (myFinal() >= 2) {
            fanfare();
            hapticResult();
          } else if (myFinal() === 1) matchSound();
        }
      },
    });
  }

  const headLabel = () => {
    const s = stage();
    if (s === 0) return `Tur ${props.round}/${props.rounds} · sayılar açılıyor`;
    if (s === 1) return "Denge noktası · ortalama";
    if (s === 2 || s === 3) return `× ${multiplierLabel(props.multiplier)} → hedef`;
    if (s === 5) return "GENEL SKOR";
    if (props.spectator) return `Hedef · ${targetName(props.multiplier)}`;
    return myPoints() > 0 ? "Tur puanın" : "Bu sefer";
  };
  const headValue = () => {
    const s = stage();
    if (s === 0) return "?";
    if (s === 1) return formatNumber(r().mean);
    if (s === 2 || s === 3 || (s === 4 && props.spectator)) return formatNumber(r().target);
    const pts = s === 5 ? myFinal() : myPoints();
    if (s === 5 && props.spectator) return "";
    return pts > 0 ? `+${pts}` : "puan yok";
  };
  const headPts = () => (stage() === 5 ? myFinal() : myPoints());
  const headSub = () => {
    const s = stage();
    if (s < 4) return "";
    if (s === 5) return props.spectator ? "" : `${props.rounds} turun toplamı: ${myTotal()} puan`;
    return props.spectator ? "" : `Toplam: ${myTotal()} puan`;
  };
  const whatLine = () => {
    if (stage() < 4) return "";
    if (props.spectator) return winningRangeText(r());
    const w = whatIf(r(), props.selfId, props.multiplier);
    return w ? whatIfText(w, nameOf) : "";
  };
  const summaryOn = () => !isLast() && props.now() >= props.revealEndsAt - SUMMARY_LEAD_MS;
  const nextM = () => ortalamaMultiplier(props.round);

  return (
    <div
      class="ort-res"
      data-stage={stage()}
      data-zoom={zoom() ? "1" : undefined}
      data-table={stage() === 5 && !showList() ? "1" : undefined}
      data-reduced={reduced ? "1" : undefined}
    >
      <div class="ort-res__head" role="status" aria-live="polite">
        <span class="overline">{headLabel()}</span>
        <Show when={headValue()}>
          <span
            class="ort-res__val"
            data-k={stage() >= 4 && !(props.spectator && stage() === 4) ? "pts" : "n"}
            data-pts={headPts()}
          >
            {headValue()}
          </span>
        </Show>
        <Show when={headSub()}>
          <span class="ort-res__sub">{headSub()}</span>
        </Show>
        <Show when={whatLine() && stage() === 4}>
          <span class="ort-res__what">{whatLine()}</span>
        </Show>
      </div>

      <Show
        when={stage() === 5 && !showList()}
        fallback={
          <>
            <div class="sc" aria-hidden="true">
              <div class="sc__field" style={{ "--lanes": laneCount() }}>
                <div class="sc__beamwrap">
                  <i class="sc__mean" style={{ "--x": xOf(r().mean) }}>
                    <span>denge noktası {formatNumber(r().mean)}</span>
                  </i>
                  <i
                    class="sc__beam"
                    style={{ "--x": stage() >= 2 ? xOf(r().target) : xOf(r().mean) }}
                    data-slid={stage() >= 2 ? "1" : undefined}
                  >
                    <span>
                      × {multiplierLabel(props.multiplier)} → {formatNumber(r().target)}
                    </span>
                  </i>
                </div>
                <For each={ids()}>
                  {(id, i) => {
                    const v = () => r().choices[id] ?? 0;
                    const x = () => xOf(v());
                    const t = () => xOf(r().target);
                    const e = () => byId().get(id);
                    const tier = () => tierOf(r(), id);
                    const lane = () => lanes()[i()] ?? 0;
                    return (
                      <>
                        <i
                          class="sc__link"
                          data-tier={tier()}
                          data-dir={x() <= t() ? "r" : "l"}
                          data-out={(farRank().get(id) ?? 0) < out() && tier() === "none" ? "1" : undefined}
                          style={{
                            "--from": Math.min(x(), t()),
                            "--w": Math.abs(x() - t()),
                            "--li": lane(),
                          }}
                        />
                        <i
                          class="sc__dot"
                          data-tier={stage() >= 3 ? tier() : undefined}
                          data-me={id === props.selfId ? "1" : undefined}
                          data-shown={i() < popped() ? "1" : undefined}
                          data-burned={r().burned.includes(id) && stage() >= 1 ? "1" : undefined}
                          data-random={r().random.includes(id) ? "1" : undefined}
                          style={{ "--x": x(), "--li": lane(), "--c": look(e()?.avatar ?? 0).color }}
                        >
                          <Avatar index={e()?.avatar ?? 0} size={22} />
                          <CbMarker index={e()?.avatar ?? 0} size={10} class="sc__cb" />
                          <Show when={r().random.includes(id)}>
                            <DiceIcon size={14} class="sc__dice" />
                          </Show>
                        </i>
                      </>
                    );
                  }}
                </For>
                <Show when={r().burned.length > 0 && stage() >= 1}>
                  <For each={[...new Set(r().burned.map((id) => r().choices[id] ?? 0))]}>
                    {(v) => (
                      <b class="sc__burn" style={{ "--x": xOf(v) }}>
                        YANDI
                      </b>
                    )}
                  </For>
                </Show>
              </div>
              <div class="sc__scale">
                <span>0</span>
                <Show when={zoom()} fallback={<span>50</span>}>
                  <span class="sc__zoomed">büyütüldü</span>
                </Show>
                <span>100</span>
              </div>
            </div>

            <ol class="rrows" data-n={order().length} data-scroll>
              <For each={order()}>
                {(id, i) => {
                  const e = () => byId().get(id);
                  const pts = () => r().points[id] ?? 0;
                  const badge = () => badgeOf(r(), id);
                  return (
                    <li
                      class="rrow"
                      data-tier={tierOf(r(), id)}
                      data-badge={badge() ?? undefined}
                      data-me={id === props.selfId ? "1" : undefined}
                      style={{ "--c": look(e()?.avatar ?? 0).color, "--o": `${i() * 60}ms` }}
                    >
                      <Avatar
                        index={e()?.avatar ?? 0}
                        size="clamp(24px, 4dvh, 30px)"
                        connected={e()?.connected ?? true}
                      />
                      <span class="rrow__name">{nameOf(id)}</span>
                      <span class="rrow__badge">
                        <Show when={badge()}>{(b) => BADGE_TEXT[b()]}</Show>
                      </span>
                      <span class="rrow__num">
                        {r().random.includes(id) ? "🎲" : ""}
                        {r().choices[id]}
                      </span>
                      <span class="rrow__dist">±{formatNumber(r().distances[id] ?? 0)}</span>
                      <span class="rrow__pts" data-on={pts() > 0 ? "1" : undefined}>
                        <Show when={pts() > 0}>+{pts()}</Show>
                      </span>
                    </li>
                  );
                }}
              </For>
            </ol>
          </>
        }
      >
        <RoundsTable
          entries={props.entries}
          selfId={props.selfId}
          played={played()}
          rounds={props.rounds}
          final={props.final}
          tv={props.tv === true}
        />
      </Show>
      <Show when={stage() === 5}>
        <button type="button" class="ort-res__toggle" onClick={() => setShowList((v) => !v)}>
          {showList() ? "Üç turun tablosu" : `${props.round}. tur`}
        </button>
      </Show>
      <Show when={summaryOn()}>
        <div class="ort-res__sum" role="status">
          <span>
            Bu turun hedefi <b>{formatNumber(r().target)}</b>
            <Show when={!props.spectator && props.selfId in r().choices}>
              {" "}
              · Sen <b>{r().choices[props.selfId]}</b>
              {myPoints() > 0 ? ` (+${myPoints()})` : ""} · Toplamın <b>{myTotal()}</b>
            </Show>
          </span>
          <span class="ort-res__next">
            Sonraki: <b>{multiplierLabel(nextM())}</b> · {multiplierWord(nextM())}
          </span>
        </div>
      </Show>
    </div>
  );
}
