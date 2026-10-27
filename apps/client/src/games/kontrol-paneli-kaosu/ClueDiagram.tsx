import type { Clue, WireColor } from "@glix/engine";
import { For } from "solid-js";
import { CbGlyph } from "../../ui/CbMarker.js";
import { COLOR_CSS, COLOR_MARK, clueText } from "./view.js";

const ROWS = [1, 2, 3, 4] as const;
const ROW_H = 20;
const ROW_GAP = 5;
const TOP = 5;

const rowY = (i: number): number => TOP + i * (ROW_H + ROW_GAP);

/**
 * İpucunun mini panel çizimi: solda dört kablo yuvası (koşulu olan yuvalar o renkte dolu, diğerleri sönük),
 * sağda "bu rengi kes" kablosu. Metindeki bilgiyle birebir aynıdır; erişilebilir etiket metnin kendisidir.
 */
export function ClueDiagram(props: { clue: Clue }) {
  const colorAt = (pos: number): WireColor | undefined =>
    props.clue.conditions.find((c) => c.position === pos)?.color;
  return (
    <svg class="kp__diagram" viewBox="0 0 220 104" role="img" aria-label={clueText(props.clue)}>
      <title>{clueText(props.clue)}</title>
      <rect x="2" y="1" width="118" height="102" rx="12" class="kp__dg-frame" />
      <For each={ROWS}>
        {(pos, i) => {
          const c = () => colorAt(pos);
          return (
            <g>
              <rect
                x="10"
                y={rowY(i())}
                width="102"
                height={ROW_H}
                rx="10"
                class={c() ? "kp__dg-slot kp__dg-slot--on" : "kp__dg-slot"}
                style={c() ? { fill: COLOR_CSS[c() as WireColor] } : undefined}
              />
              <text x="22" y={rowY(i()) + 14.5} class={c() ? "kp__dg-no kp__dg-no--on" : "kp__dg-no"}>
                {pos}
              </text>
              {c() ? (
                <CbGlyph
                  index={COLOR_MARK[c() as WireColor]}
                  cx={96}
                  cy={rowY(i()) + ROW_H / 2}
                  size={14}
                  color="#0a1030"
                />
              ) : null}
            </g>
          );
        }}
      </For>
      <path d="M126 52h30m-8-8l8 8-8 8" class="kp__dg-arrow" />
      <rect
        x="164"
        y="38"
        width="52"
        height="28"
        rx="14"
        class="kp__dg-cut"
        style={{ fill: COLOR_CSS[props.clue.cut] }}
      />
      <path d="M178 46l24 12m0-12l-24 12" class="kp__dg-scissors" />
      <CbGlyph
        index={COLOR_MARK[props.clue.cut]}
        cx={171}
        cy={52}
        size={11}
        color="#0a1030"
        class="kp__dg-cbcut"
      />
    </svg>
  );
}
