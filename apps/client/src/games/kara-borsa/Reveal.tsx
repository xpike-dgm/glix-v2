import type { BorsaRoundResult, PlayerInfo } from "@glix/engine";
import { createMemo, For, onCleanup, Show, untrack } from "solid-js";
import { atServerTime } from "../../net/serverTimer.js";
import { serverNow } from "../../net/store.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbState } from "../../ui/CbState.js";
import { boxFor } from "./art.js";
import { Crate, CrewStrip, Gavel } from "./Parts.js";
import * as sfx from "./sounds.js";
import { countedValue, REVEAL_TIMELINE, revealSchedule } from "./timeline.js";
import {
  type BorsaScreenView,
  isBigRound,
  profitLeaders,
  profitOf,
  revealOrder,
  signed,
  verdictOf,
  verdictText,
  wonOnTie,
} from "./view.js";

interface Props {
  view: BorsaScreenView;
  result: BorsaRoundResult;
  crew: PlayerInfo[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  /** Mezatçı yorumu (yalnız son turun açılışında; boşsa hiç çizilmez). */
  comment: string | null;
  tv?: boolean;
}

/**
 * Tur açılışı (KB-U1/U2): tokmak iner "SATILDI!", teklifler düşükten yükseğe tek tek açılır (kazanan en son), kutunun
 * kapağı kalkar ve değer sayarak yükselir, kazanan satırına kâr/zarar damgası basılır, şerit kâra döner. Zamanlar
 * sunucu saatine bağlıdır (açılışın başı `stageStartedAt`); geç gelen oyuncu sahneyi kaldığı yerden görür.
 */
export function Reveal(props: Props) {
  const start = untrack(() => props.view.stageStartedAt);
  const el = () => props.now() - start;
  const r = () => props.result;
  const rows = createMemo(() => revealOrder(r(), props.view.players));
  const plan = createMemo(() => revealSchedule(rows().length));
  const cursed = () => r().value < 0;
  const sold = () => r().winner !== null;
  const verdict = createMemo(() => verdictOf(r()));
  const big = () => isBigRound(props.view);
  const final = () => props.view.round === props.view.rounds - 1;
  const person = (id: string | null) => props.crew.find((p) => p.id === id);
  const name = (id: string) =>
    id === props.selfId && !props.spectator ? "Sen" : (person(id)?.nickname ?? "?");

  const lidOpen = () => el() >= plan().lidAt;
  const shownRows = () => rows().filter((_, i) => el() >= plan().rowAt(i)).length;
  const verdictShown = () => el() >= plan().verdictAt;
  const summary = () => el() >= plan().summaryAt;

  // Şerit: damgaya kadar bu turdan önceki kâr (değer ele verilmesin), sonra güncel kâr.
  const profits = createMemo(() => {
    const out: Record<string, number> = {};
    for (const id of props.view.players) out[id] = profitOf(props.view, id);
    if (!summary() && r().winner !== null) {
      const w = r().winner as string;
      out[w] = (out[w] ?? 0) + r().price - r().value;
    }
    return out;
  });
  const leaders = createMemo(() => {
    const p = profits();
    const best = Math.max(0, ...Object.values(p));
    return best > 0 ? Object.keys(p).filter((id) => p[id] === best) : [];
  });

  // Sesler: her olay sunucu saatinde bir kez (geçmiş olaylar çalmaz).
  const timers: (() => void)[] = [];
  const at = (t: number, fn: () => void): void => {
    if (untrack(el) > t + 150 || props.tv) return;
    timers.push(atServerTime(start + t, fn, serverNow));
  };
  onCleanup(() => {
    for (const off of timers) off();
  });
  {
    const p = untrack(plan);
    const n = untrack(rows).length;
    at(REVEAL_TIMELINE.stampAt, sfx.gavel);
    for (let i = 0; i < n; i++) at(p.rowAt(i), () => sfx.drum(i === n - 1 && sold()));
    at(p.lidAt, sfx.creak);
    const v = untrack(verdict);
    const mine = untrack(r).winner === props.selfId && !props.spectator;
    if (v?.kind === "cursed") at(p.lidAt + 120, sfx.thunder);
    if (v) {
      at(p.verdictAt, () => {
        if (v.kind === "bargain" && (v.net >= 20 || mine)) sfx.kaching();
        else if (v.kind === "bargain" || v.kind === "even") sfx.coin();
        else if (v.kind === "ripoff") sfx.groan();
      });
    }
  }

  const shown = () => {
    if (!lidOpen()) return null;
    return countedValue(r().value, el(), plan().countAt);
  };
  const finalLine = createMemo(() => {
    if (!final()) return null;
    const all = props.view.players.map((id) => ({ id, p: profitOf(props.view, id) }));
    const best = Math.max(...all.map((x) => x.p));
    if (best <= 0) return "Kimse kâr edemedi";
    const top = all.filter((x) => x.p === best).map((x) => name(x.id));
    return `${top.length > 1 ? "En çok kâr edenler" : "En çok kâr"}: ${top.join(", ")} ${signed(best)}`;
  });
  const quip = () => {
    const c = props.comment;
    return final() && c !== null && c.trim() !== "" ? c : null;
  };

  return (
    <div
      class="kb__reveal"
      data-cursed={cursed() && lidOpen() ? "1" : undefined}
      data-final={final() ? "1" : undefined}
      data-many={rows().length > 5 ? "1" : undefined}
    >
      <Show when={el() < REVEAL_TIMELINE.gavelOutAt}>
        <div class="kbg" data-sold={sold() ? "1" : undefined} aria-hidden="true">
          <div class="kbg__gavel">
            <Gavel />
          </div>
          <span class="kbg__stamp">{sold() ? "SATILDI!" : "SATILMADI"}</span>
        </div>
      </Show>
      <div class="kb__open">
        <div class="kb__openin">
          <Crate
            box={boxFor(props.view.round, props.view.rounds, cursed())}
            open={lidOpen()}
            cursed={cursed()}
            big={big()}
          />
          <div
            class="kb__value"
            data-cursed={cursed() && lidOpen() ? "1" : undefined}
            data-big={big() ? "1" : undefined}
          >
            <span class="kb__valuelabel">
              {!lidOpen()
                ? big()
                  ? "Büyük Kutu"
                  : "Kutunun değeri"
                : cursed()
                  ? "Lanetli kutu"
                  : "Kutunun değeri"}
            </span>
            <span class="kb__valuenum">{shown() === null ? "?" : signed(shown() ?? 0).replace("+", "")}</span>
          </div>
        </div>
      </div>
      <ul class="kb__bids" data-many={rows().length > 5 ? "1" : undefined} aria-label="Teklifler">
        <For each={rows().slice(0, shownRows())}>
          {(row) => {
            const win = () => r().winner === row.id;
            return (
              <li
                data-win={win() ? "1" : undefined}
                data-verdict={win() && verdictShown() ? verdict()?.kind : undefined}
                data-me={row.id === props.selfId && !props.spectator ? "1" : undefined}
              >
                <Show when={person(row.id)}>
                  {(p) => <Avatar index={p().avatar} size="var(--kb-row-av)" connected={p().connected} />}
                </Show>
                <span class="kb__bidwho">
                  <span class="kb__bidname">{name(row.id)}</span>
                  <Show when={win() && wonOnTie(r())}>
                    <span class="kb__first">önce verdi</span>
                  </Show>
                </span>
                <Show when={win() && verdictShown()}>
                  <CbState kind={verdict()?.kind === "bargain" ? "star" : "bad"} size={13} class="kb__cb" />
                </Show>
                <b class="kb__amount">{row.amount === 0 ? "geçti" : row.amount}</b>
                <Show when={win() && verdictShown() ? verdict() : null}>
                  {(v) => <span class="kb__stamp">{verdictText(v())}</span>}
                </Show>
              </li>
            );
          }}
        </For>
      </ul>
      <Show when={!sold() && shownRows() >= rows().length}>
        <p class="kb__winner" data-none="1" role="status">
          Kimse almadı, kutu kapandı
        </p>
      </Show>
      <Show when={final() && summary()}>
        <div class="kb__final" role="status">
          <p class="kb__finalline">{finalLine()}</p>
          <Show when={quip()}>{(q) => <p class="kb__quip">{q()}</p>}</Show>
        </div>
      </Show>
      <CrewStrip
        crew={props.crew}
        selfId={props.spectator ? "" : props.selfId}
        mode="profit"
        values={profits()}
        leaders={summary() ? profitLeaders(props.view) : leaders()}
      />
    </div>
  );
}
