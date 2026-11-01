import type { AcgozlulukPublicView, AcgozlulukReveal, PlayerInfo } from "@glix/engine";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { propSrc } from "../../ui/props.js";
import { ledgerBoxes, roundReveal, shortName, stripOrder } from "./view.js";

/** Kasa defteri kartı dokunulduktan bu kadar sonra kendiliğinden kapanır (AL-U3). */
export const LEDGER_CARD_MS = 3_000;

/**
 * AL-U3: haznenin üstünde üç küçük kasa: oynanmış turlar "toplam/limit ✓/✗", oynanan tur yanıp söner. Kasaya dokununca
 * o turda kimin kaç koyduğu küçük bir kartta açılır (3 sn ya da dokununca kapanır; seçimi engellemez).
 */
export function Ledger(props: {
  view: AcgozlulukPublicView;
  playerOf: (id: string) => PlayerInfo | undefined;
  participants: readonly string[];
  big?: boolean;
  /** Büyük ekran: dokunulmaz (kart açılmaz). */
  tv?: boolean;
}) {
  const [open, setOpen] = createSignal<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const toggle = (round: number) => {
    clearTimeout(timer);
    if (open() === round) {
      setOpen(null);
      return;
    }
    setOpen(round);
    timer = setTimeout(() => setOpen(null), LEDGER_CARD_MS);
  };
  onCleanup(() => clearTimeout(timer));
  const card = () => {
    const r = open();
    return r === null ? null : roundReveal(props.view, r);
  };
  const firstRound = () => props.view.round === 1 && props.view.reveal === null;

  return (
    <div class="ledger" classList={{ "ledger--big": props.big === true }}>
      <Show
        when={!firstRound() || props.big}
        fallback={
          <p class="ledger__first">
            Tur {props.view.round}/{props.view.rounds}
          </p>
        }
      >
        <div class="ledger__row">
          <For each={ledgerBoxes(props.view)}>
            {(b) => {
              const state = b.over === null ? (b.current ? "now" : "next") : b.over ? "over" : "ok";
              const body = (
                <>
                  <span class="ledger__round">Tur {b.round}</span>
                  <span class="ledger__val">
                    {b.total === null
                      ? b.current
                        ? "…"
                        : "–"
                      : `${b.total}/${b.limit} ${b.over ? "✗" : "✓"}`}
                  </span>
                </>
              );
              // TV'de dokunma yok: kasalar yalnız gösterilir.
              return (
                <Show
                  when={!props.tv}
                  fallback={
                    <span class="ledger__box" data-state={state}>
                      {body}
                    </span>
                  }
                >
                  <button
                    type="button"
                    class="ledger__box"
                    data-state={state}
                    disabled={b.total === null}
                    aria-label={
                      b.total === null
                        ? `Tur ${b.round}`
                        : `Tur ${b.round}: ${b.total}/${b.limit} ${b.over ? "taştı" : "sığdı"}`
                    }
                    onClick={() => toggle(b.round)}
                  >
                    {body}
                  </button>
                </Show>
              );
            }}
          </For>
        </div>
      </Show>
      <Show when={card()}>
        {(r) => (
          <button type="button" class="ledger__card" onClick={() => setOpen(null)}>
            <span class="ledger__card-title">
              Tur {open()}: {r().total}/{r().limit} {r().over ? "✗ Taştı" : "✓ Sığdı"}
            </span>
            <span class="ledger__card-list">
              <For each={stripOrder(r(), props.participants)}>
                {(id) => (
                  <span class="ledger__card-item">
                    {shortName(props.playerOf(id)?.nickname ?? "Oyuncu")}{" "}
                    <b>{r().missing.includes(id) ? "–" : (r().choices[id] ?? 0)}</b>
                  </span>
                )}
              </For>
            </span>
          </button>
        )}
      </Show>
    </div>
  );
}

/** Oyuncular: avatar, kısa ad, o ana kadarki mini puan, kilit ✓, 👁 Gözcü, kopuk (AL-U3 / AL-U12). */
export function Crew(props: {
  ids: readonly string[];
  playerOf: (id: string) => PlayerInfo | undefined;
  selfId: string;
  totals: Record<string, number>;
  lockedIds: readonly string[];
  scoutId: string | null;
  size?: number;
  names?: boolean;
}) {
  return (
    <ul class="limcrew" classList={{ "limcrew--names": props.names === true }}>
      <For each={props.ids}>
        {(id) => {
          const p = () => props.playerOf(id);
          return (
            <li
              class="limcrew__seat"
              data-me={id === props.selfId ? "1" : undefined}
              data-off={p()?.connected === false ? "1" : undefined}
            >
              <span
                class="limcrew__av"
                data-lock={props.lockedIds.includes(id) ? "1" : undefined}
                data-scout={props.scoutId === id ? "1" : undefined}
                title={props.scoutId === id ? "Gözcü" : undefined}
              >
                <Avatar index={p()?.avatar ?? 0} size={props.size ?? 30} connected={p()?.connected ?? true} />
              </span>
              <Show when={props.names}>
                <span class="limcrew__name">{shortName(p()?.nickname ?? "Oyuncu")}</span>
              </Show>
              <span class="limcrew__pts">{p()?.connected === false ? "kopuk" : (props.totals[id] ?? 0)}</span>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

/**
 * AL-U9 / AL-U13: sonuç şeridi sayıya göre büyükten küçüğe; kısa ad, sayı + jeton, "Σ toplam", seçmeyende
 * "0 · seçmedi", kopukta "kopuk", taşıranlarda TAŞIRAN damgası (AL-U6), son turda +2 / +1 rozeti.
 */
export function Strip(props: {
  reveal: AcgozlulukReveal;
  participants: readonly string[];
  playerOf: (id: string) => PlayerInfo | undefined;
  selfId: string;
  totals: Record<string, number>;
  final: Record<string, number> | null;
  /** Karar anı geldi mi (damgalar ondan sonra). */
  stamped: boolean;
  tv?: boolean;
}) {
  const order = () => stripOrder(props.reveal, props.participants);
  return (
    <ol
      class="limstrip"
      classList={{ "limstrip--tv": props.tv === true }}
      style={{
        "--cols":
          props.participants.length > 5
            ? Math.ceil(props.participants.length / 2)
            : props.participants.length,
      }}
    >
      <For each={order()}>
        {(id) => {
          const p = () => props.playerOf(id);
          const award = () => props.final?.[id] ?? 0;
          const missing = () => props.reveal.missing.includes(id);
          return (
            <li
              class="limstrip__who"
              data-me={id === props.selfId ? "1" : undefined}
              data-off={p()?.connected === false ? "1" : undefined}
              data-spill={props.stamped && props.reveal.spillers.includes(id) ? "1" : undefined}
            >
              <span class="limstrip__av">
                <Avatar
                  index={p()?.avatar ?? 0}
                  size={props.tv ? 76 : 40}
                  connected={p()?.connected ?? true}
                />
                <Show when={props.stamped && props.reveal.spillers.includes(id)}>
                  <b class="limstrip__stamp">TAŞIRAN</b>
                </Show>
                <Show when={props.final && award() > 0}>
                  <b class="limstrip__award" data-a={award()}>
                    +{award()}
                  </b>
                </Show>
              </span>
              <span class="limstrip__name">
                {id === props.selfId ? "Sen" : shortName(p()?.nickname ?? "Oyuncu")}
              </span>
              <span class="limstrip__num">
                <Show when={!missing()} fallback={<small class="limstrip__none">0 · seçmedi</small>}>
                  {props.reveal.choices[id] ?? 0}
                  <i class="limstrip__coin" aria-hidden="true" />
                </Show>
              </span>
              <span class="limstrip__sum">
                {p()?.connected === false ? "kopuk · " : ""}Σ {props.totals[id] ?? 0}
              </span>
            </li>
          );
        }}
      </For>
    </ol>
  );
}

/** AL-U4: Tamam'dan sonra büyük, mühürlü jeton (mevcut jeton görseli + CSS mühür halkası). */
export function Seal(props: { value: number; scout: boolean }) {
  return (
    <div class="seal" role="status">
      <span class="seal__coin">
        <img src={propSrc("genel/rusvet-jetonu")} alt="" width="96" height="96" draggable={false} />
        <b class="seal__num">{props.value}</b>
        <i class="seal__ring" aria-hidden="true" />
      </span>
      <span class="seal__text">
        <b>Mühürlendi</b>
        <span>{props.scout ? "Gördüğünü söyle ya da sakla." : "Şimdi masayı ikna et: kim ne koydu?"}</span>
      </span>
    </div>
  );
}
