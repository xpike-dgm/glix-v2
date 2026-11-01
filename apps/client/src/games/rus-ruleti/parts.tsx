import type { PlayerInfo, RusRuletiPublicView, RusRuletiShot } from "@glix/engine";
import { createSignal, For, Index, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { SkullIcon } from "./icons.js";
import { outEntries, outsLeft, outsText, recentShots, shotLine } from "./view.js";

/** RR-U2: bitiş sayacı: dolu kurukafalar elenenler, boşlar kalan elenme; "2 elenme daha → oyun biter". */
export function OutsMeter(props: { pub: RusRuletiPublicView; class?: string }) {
  const n = () => props.pub.players.length;
  const out = () => props.pub.eliminated.length;
  const left = () => outsLeft(n(), out());
  const total = () => out() + left();
  return (
    <div class={`rr-outs ${props.class ?? ""}`} data-last={left() === 1 ? "1" : undefined}>
      <span class="rr-outs__skulls" aria-hidden="true">
        <Index each={Array.from({ length: total() }, (_, i) => i < out())}>
          {(filled) => <SkullIcon filled={filled()} />}
        </Index>
      </span>
      <span class="rr-outs__text">{outsText(left())}</span>
    </div>
  );
}

/** RR-U3: son 4 atışın kaydı; dokununca bütün geçmiş açılır (herkese açık bilgi). */
export function ShotStrip(props: {
  history: readonly RusRuletiShot[];
  nameOf: (id: string) => string;
  class?: string;
  /** TV: her zaman açık, daha uzun liste. */
  count?: number;
}) {
  const [open, setOpen] = createSignal(false);
  const list = () => (open() ? [...props.history].reverse() : recentShots(props.history, props.count ?? 4));
  return (
    <Show when={props.history.length > 0}>
      <button
        type="button"
        class={`rr-shots ${props.class ?? ""}`}
        data-open={open() ? "1" : undefined}
        aria-expanded={open()}
        aria-label={open() ? "Atış geçmişini kapat" : "Bütün atış geçmişini aç"}
        onClick={() => setOpen((o) => !o)}
      >
        <ol class="rr-shots__list">
          <For each={list()}>
            {(s) => (
              <li class="rr-shots__row" data-boom={s.exploded ? "1" : undefined}>
                <span class="rr-shots__mark" aria-hidden="true">
                  {s.exploded ? "✕" : "✓"}
                </span>
                <span class="rr-shots__txt">{shotLine(s, props.nameOf)}</span>
              </li>
            )}
          </For>
        </ol>
        <Show when={!open() && props.history.length > (props.count ?? 4)}>
          <span class="rr-shots__more">Bütün atışlar ({props.history.length})</span>
        </Show>
      </button>
    </Show>
  );
}

/**
 * RR-U8: oyun içi son açılış: elenenler elenme sırasıyla tek tek ("1. Elif — Mert vurdu, %36"), sonra hayatta kalanlar
 * altın halkayla ve adlarıyla (+1), en son Kâhin rozetleri. Gecikmeler CSS'tedir (`--i`); hareket azaltmada hepsi anında.
 */
export function Outro(props: {
  pub: RusRuletiPublicView;
  playerOf: (id: string) => PlayerInfo | undefined;
  nameOf: (id: string) => string;
  avatar: string;
  /** Kendi kimliğin ("Sen vurdun" için); TV'de boş. */
  selfId?: string;
  class?: string;
}) {
  const outs = () => outEntries(props.pub.eliminated, props.pub.history);
  const survivors = () => props.pub.result?.survivors ?? props.pub.alive;
  const kahinler = () => props.pub.result?.kahinler ?? [];
  const outLine = (o: ReturnType<typeof outEntries>[number]): string => {
    if (o.shooter === null) return "elendi";
    const by = o.self
      ? "kendine sıktı"
      : o.shooter === props.selfId
        ? "sen vurdun"
        : `${props.nameOf(o.shooter)} vurdu`;
    return o.risk === null ? by : `${by}, %${o.risk}`;
  };
  const survivorsAt = () => outs().length;
  return (
    <section class={`rr-outro ${props.class ?? ""}`} aria-label="Rus Ruleti sonucu">
      <ol class="rr-outro__outs">
        <For each={outs()}>
          {(o, i) => (
            <li class="rr-outro__out" style={{ "--i": i() }}>
              <span class="rr-outro__no">{o.order}.</span>
              <Avatar index={props.playerOf(o.id)?.avatar ?? 0} size={28} mood="out" />
              <span class="rr-outro__who">{props.nameOf(o.id)}</span>
              <span class="rr-outro__by">— {outLine(o)}</span>
            </li>
          )}
        </For>
      </ol>
      <h2 class="rr-outro__head" style={{ "--i": survivorsAt() }}>
        {survivors().length === 1 ? "Tek hayatta kalan" : "Hayatta kalanlar"}
      </h2>
      <ul class="rr-outro__alive" style={{ "--i": survivorsAt() }}>
        <For each={survivors()}>
          {(id) => (
            <li class="rr-outro__card">
              <Avatar index={props.playerOf(id)?.avatar ?? 0} size={props.avatar} ring="var(--amber)" />
              <span class="rr-outro__name">{props.nameOf(id)}</span>
              <span class="rr-outro__pts">+1</span>
            </li>
          )}
        </For>
      </ul>
      <Show when={kahinler().length > 0}>
        <ul class="rr-outro__kahin" style={{ "--i": survivorsAt() + 2 }}>
          <For each={kahinler()}>{(id) => <li class="rr-outro__badge">{props.nameOf(id)} · Kâhin</li>}</For>
        </ul>
      </Show>
    </section>
  );
}
