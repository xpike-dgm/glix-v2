import type { PlayerInfo, SonKisiRoundResult } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import "./son-kisi.css";
import {
  ALARM_PERCENT,
  closest,
  formatSeconds,
  pointsText,
  spreadPercents,
  TIMELINE_STEP_MS,
  timelinePercent,
} from "./view.js";

/**
 * SK-U6 zaman çizelgesi: dikey şerit, altta 0, üstte alarm. Kaçışlar zamanlarına göre sırayla (0,4 sn arayla) yerleşir;
 * en son alarm çizgisi düşer ("ALARM 14,3 sn"), alarma en yakın kaçan altın, aradaki boşluk büyük yazıyla ("0,3 sn
 * kala!") ve kıl payı etiketi. Yakalananlar alarm çizgisinin üstünde, kepenk arkasında soluk. Puan çipleri yanında.
 * `elapsed` null ise (hareket azaltma ya da geç gelen) her şey hemen yerindedir.
 */
export function Timeline(props: {
  result: SonKisiRoundResult;
  playerOf: (id: string) => PlayerInfo | undefined;
  selfId: string;
  elapsed: number | null;
  avatar?: number;
  /** Kısa sürüm (tur arası): yalnız son kaçan ve alarm. */
  short?: boolean;
}) {
  const size = () => props.avatar ?? 34;
  const shown = (i: number) => props.elapsed === null || props.elapsed >= i * TIMELINE_STEP_MS;
  const alarmShown = () =>
    props.elapsed === null || props.elapsed >= props.result.escapes.length * TIMELINE_STEP_MS;
  const gold = () => closest(props.result);
  /** Yakın zamanlı kaçışlar üst üste binmesin: her yanda en az bir avatar boyu aralık. */
  const placed = () =>
    spreadPercents(
      props.result.escapes.map((e) => timelinePercent(e.ms, props.result.alarmMs)),
      props.short ? 16 : 12,
    );
  const list = () => {
    const r = props.result;
    if (!props.short) return r.escapes;
    return r.escapes.filter((e) => r.last.includes(e.id) || e.id === props.selfId || e.close);
  };
  return (
    <div class="sktl" data-short={props.short ? "1" : undefined}>
      <p class="sktl__gap">
        <Show when={alarmShown() && gold()} fallback={"\u00a0"}>
          {(g) => <>{formatSeconds(g().gapMs)} kala!</>}
        </Show>
      </p>
      <div class="sktl__caught">
        <Show when={alarmShown()}>
          <For each={props.result.caught}>
            {(id) => {
              const p = props.playerOf(id);
              return (
                <span class="sktl__ghost" data-me={id === props.selfId ? "1" : undefined}>
                  <Show when={p}>
                    {(pp) => <Avatar index={pp().avatar} size={size() * 0.8} mood="out" />}
                  </Show>
                  <i>{p?.nickname ?? "Oyuncu"}</i>
                </span>
              );
            }}
          </For>
        </Show>
      </div>
      <div class="sktl__chart">
        <div class="sktl__bar" aria-hidden="true">
          <span class="sktl__zero">0</span>
        </div>
        <Show when={alarmShown()}>
          <div class="sktl__alarm" style={{ bottom: `${ALARM_PERCENT}%` }}>
            <b>
              ALARM {formatSeconds(props.result.alarmMs)}
              <Show when={!props.result.rang}>
                <small> · çalacaktı</small>
              </Show>
            </b>
          </div>
        </Show>
        <For each={list()}>
          {(e, i) => {
            const p = props.playerOf(e.id);
            const isGold = () => gold()?.escape.id === e.id || props.result.last.includes(e.id);
            return (
              <Show when={shown(props.result.escapes.indexOf(e))}>
                <div
                  class="sktl__pin"
                  data-side={i() % 2 === 0 ? "l" : "r"}
                  data-gold={isGold() ? "1" : undefined}
                  data-me={e.id === props.selfId ? "1" : undefined}
                  style={{ bottom: `${placed()[props.result.escapes.indexOf(e)] ?? 0}%` }}
                >
                  <Show when={p}>
                    {(pp) => (
                      <Avatar
                        index={pp().avatar}
                        size={size()}
                        connected={pp().connected}
                        ring={isGold() ? "var(--amber)" : undefined}
                      />
                    )}
                  </Show>
                  <span class="sktl__who">
                    <b>{p?.nickname ?? "Oyuncu"}</b>
                    <i>{formatSeconds(e.ms)}</i>
                  </span>
                  <span class="sktl__chip" data-zero={e.points === 0 ? "1" : undefined}>
                    {pointsText(e.points)}
                  </span>
                  <Show when={e.close}>
                    <span class="sktl__close">KIL PAYI +1</span>
                  </Show>
                </div>
              </Show>
            );
          }}
        </For>
      </div>
    </div>
  );
}
