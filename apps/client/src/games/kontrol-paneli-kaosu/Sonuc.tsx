import type { KontrolReveal } from "@glix/engine";
import { For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { CbMarker } from "../../ui/CbMarker.js";
import { CheckIcon } from "../../ui/Icons.js";
import type { Crew } from "./KontrolScreen.js";
import { Panel } from "./Panel.js";
import { COLOR_CSS, COLOR_MARK, COLOR_NAME, outcomeOf } from "./view.js";

interface Props {
  reveal: KontrolReveal;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
}

const Cross = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" />
  </svg>
);

/** Açılış: kendi panelinde kesim (doğruysa yeşil, yanlışsa kırmızı kıvılcım), sonra herkesin sonucu ve ipucu taşıyıcıları. */
export function Sonuc(props: Props) {
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const mine = () => outcomeOf(props.reveal, props.selfId);
  const myRow = () => props.reveal.rows[props.selfId];
  const verdict = (): string => {
    const o = mine();
    if (o.own === true && o.carried) return "İkisi de doğru!";
    if (o.own === true) return "Doğru kabloyu kestin";
    if (o.carried) return "İpucun arkadaşına yaradı";
    return o.own === null ? "Kablo kesmedin" : "Bu sefer olmadı";
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  onMount(() => {
    if (props.spectator) return;
    timer = setTimeout(() => {
      if (mine().points > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    }, 700);
  });
  return (
    <>
      <div class="kp__head kp__head--res">
        <Show when={!props.spectator} fallback={<span class="kp__title">Paneller açıldı</span>}>
          <span class="kp__score" data-zero={mine().points === 0 ? "1" : undefined}>
            +{mine().points}
          </span>
          <span class="kp__verdict">{verdict()}</span>
        </Show>
      </div>

      <Show when={!props.spectator ? myRow() : undefined}>
        {(row) => (
          <div class="kp__mini">
            <Panel
              panel={row().panel}
              selected={null}
              cut={row().cut}
              verdict={row().correct ? "right" : "wrong"}
              disabled
              display
              onPick={() => undefined}
            />
          </div>
        )}
      </Show>

      <ul class="kp__rows" data-scroll>
        <For each={props.crew}>
          {(m, i) => {
            const row = () => props.reveal.rows[m.id];
            const carrier = () => member(row()?.carrier ?? "");
            const pts = () => props.reveal.scores[m.id] ?? 0;
            return (
              <li class="kp__row" data-me={m.id === props.selfId ? "1" : undefined} style={{ "--i": i() }}>
                <Avatar index={m.avatar} size={32} connected={m.connected} />
                <span class="kp__row-name">{m.nickname}</span>
                <span
                  class="kp__cutchip"
                  data-ok={row()?.correct ? "1" : "0"}
                  data-none={row()?.cut ? undefined : "1"}
                >
                  <Show when={row()?.cut} fallback={<span>kesmedi</span>}>
                    {(c) => (
                      <>
                        <i class="kp__dot" style={{ background: COLOR_CSS[c()] }} />
                        <CbMarker index={COLOR_MARK[c()]} size={13} />
                        <span>{COLOR_NAME[c()]}</span>
                        {row()?.correct ? <CheckIcon size={14} /> : <Cross />}
                      </>
                    )}
                  </Show>
                </span>
                <span class="kp__hint-by" title="İpucu taşıyıcısı">
                  <Avatar index={carrier()?.avatar ?? 0} size={22} />
                </span>
                <span class="kp__pts" data-zero={pts() === 0 ? "1" : undefined}>
                  +{pts()}
                </span>
              </li>
            );
          }}
        </For>
      </ul>
      <p class="kp__legend">Küçük portre: o panelin ipucunu taşıyan</p>
    </>
  );
}
