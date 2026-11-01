import { createMemo, For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { ResultTower, type TowerEntry } from "./Tower.js";
import { type CizgiScreenView, climbPlan, myHeadline, shortName, tableLine, whatIfLine } from "./view.js";

interface Props {
  view: CizgiScreenView;
  entries: TowerEntry[];
  /** İzleyici/TV: "". */
  selfId: string;
  now: () => number;
  reduced: boolean;
  tv?: boolean;
  /** TV'de açılış biraz yavaş oynar (tırmanış uzaktan izlenir). */
  slow?: number;
}

/**
 * Bir turun açılışı (CZ-U6…U9, U13): tam kule ve tırmanan pinler; ardından kendi sonucun büyük yazıyla ve masanın özeti,
 * "ne olurdu?" satırı. Son turda iki turun toplamı ve genel puanlar; ara turda "2. tur geliyor".
 */
export function Sonuc(props: Props) {
  const v = () => props.view;
  const r = () => v().reveal;
  const order = createMemo(() => props.entries.map((e) => e.id));
  const data = createMemo(() => {
    const rev = r();
    return rev ? { rev, plan: climbPlan(rev, order(), props.reduced, v().round < v().rounds) } : null;
  });
  const plan = () => data()?.plan ?? null;
  const elapsed = () => (props.now() - v().endsAt) / (props.slow ?? 1);
  const pointsShown = () => {
    const p = plan();
    return p !== null && elapsed() >= p.pointsAt;
  };
  const whatIfShown = () => {
    const p = plan();
    return p !== null && elapsed() >= p.whatIfAt;
  };
  // TV: çarpışmada ekran kısa sarsılır (CZ-U12; hareket azaltmada yok).
  const shake = () => {
    const p = plan();
    if (!props.tv || props.reduced || !p) return false;
    const e = elapsed();
    return [...p.crashAt.values()].some((at) => e >= at && e - at < 400);
  };
  const nameOf = (id: string) => shortName(props.entries.find((e) => e.id === id)?.nickname ?? "Oyuncu", 10);
  const isFinal = () => v().final !== null;
  const me = () => (props.selfId && order().includes(props.selfId) ? props.selfId : null);
  const nextIn = () => Math.max(0, Math.ceil((v().revealEndsAt - props.now()) / 1000));
  const board = createMemo(() =>
    [...props.entries].sort((a, b) => (v().totals[b.id] ?? 0) - (v().totals[a.id] ?? 0)),
  );
  const roundPts = (id: string) => [...v().history, ...(r() ? [r()] : [])].map((x) => x?.points[id] ?? 0);

  return (
    <Show when={data()}>
      {(d) => (
        <div
          class="czres"
          classList={{ "czres--tv": props.tv === true }}
          data-final={isFinal() ? "1" : undefined}
          data-shake={shake() ? "1" : undefined}
        >
          <div class="czres__head" role="status" aria-live="polite">
            <Show
              when={pointsShown()}
              fallback={
                <>
                  <span class="overline">
                    Tur {v().round}/{v().rounds}
                  </span>
                  <span class="czres__big" data-k="wait">
                    Pinler tırmanıyor…
                  </span>
                </>
              }
            >
              <Show
                when={me()}
                fallback={
                  <span class="czres__big" data-k="table">
                    {tableLine(d().rev, nameOf)}
                  </span>
                }
              >
                {(id) => {
                  const h = () => myHeadline(d().rev, id());
                  return (
                    <>
                      <span class="czres__big" data-k={h().kind}>
                        {h().text}
                      </span>
                      <span class="czres__table">{tableLine(d().rev, nameOf)}</span>
                    </>
                  );
                }}
              </Show>
            </Show>
            <p class="czres__whatif" data-on={whatIfShown() ? "1" : undefined}>
              {whatIfShown() ? whatIfLine(d().rev, me()) : " "}
            </p>
          </div>

          <ResultTower
            reveal={d().rev}
            plan={d().plan}
            elapsed={elapsed()}
            entries={props.entries}
            selfId={me() ?? ""}
            tv={props.tv === true}
            narrow={typeof window !== "undefined" && window.innerWidth <= 360}
          />

          <Show
            when={isFinal()}
            fallback={
              <p class="czres__next" data-on={pointsShown() ? "1" : undefined}>
                2. tur {nextIn()} sn sonra · geçen turu gördün, şimdi masayı oku!
              </p>
            }
          >
            <Show when={pointsShown() && props.tv !== true}>
              <ol class="czboard">
                <For each={board()}>
                  {(e) => {
                    const award = () => v().final?.[e.id] ?? 0;
                    return (
                      <li class="czboard__row" data-me={e.id === me() ? "1" : undefined} data-award={award()}>
                        <Avatar index={e.avatar} size={props.tv ? 36 : 22} connected={e.connected} />
                        <span class="czboard__name">{shortName(e.nickname, 10)}</span>
                        <span class="czboard__rounds">
                          {roundPts(e.id)
                            .map((p) => (p > 0 ? `+${p}` : "0"))
                            .join(" · ")}
                        </span>
                        <b class="czboard__sum">Σ {v().totals[e.id] ?? 0}</b>
                        <em class="czboard__award">{award() > 0 ? `+${award()}` : "—"}</em>
                      </li>
                    );
                  }}
                </For>
              </ol>
            </Show>
          </Show>
        </div>
      )}
    </Show>
  );
}
