import type { Clue, ClueCondition, WireColor } from "@glix/engine";
import { For, Show } from "solid-js";
import { CbGlyph } from "../../ui/CbMarker.js";
import { COLOR_CSS, COLOR_MARK, clueText } from "./view.js";

const ROW_H = 20;
const ROW_GAP = 5;
const TOP = 5;
const REL_H = 30;
const W = 220;

const rowY = (i: number): number => TOP + i * (ROW_H + ROW_GAP);

type Positional = Extract<ClueCondition, { position: number }>;
type Relation = Extract<ClueCondition, { a: WireColor }>;
const isPositional = (c: ClueCondition): c is Positional => c.kind === "at" || c.kind === "notAt";

/** Küçük renk hapı (renk körlüğü şekliyle). */
function Chip(props: { color: WireColor; x: number; y: number }) {
  return (
    <g>
      <rect
        x={props.x}
        y={props.y}
        width="34"
        height="18"
        rx="9"
        class="kp__dg-chip"
        style={{ fill: COLOR_CSS[props.color] }}
      />
      <CbGlyph index={COLOR_MARK[props.color]} cx={props.x + 17} cy={props.y + 9} size={11} color="#0a1030" />
    </g>
  );
}

/**
 * İpucunun mini panel çizimi: solda kablo yuvaları ("N. kablo R" yuvası o renkte dolu; "değil" yuvası üstü çizili
 * renk; diğerleri sönük), altta ilişkiler (yan yana: bağ işareti; yukarıda: aşağı ok), sağda kesilecek renk ya da
 * konum oku. Metindeki bilgiyle birebir aynıdır; erişilebilir etiket metnin kendisidir.
 */
export function ClueDiagram(props: { clue: Clue }) {
  const rows = () => Array.from({ length: props.clue.wires }, (_, i) => i + 1);
  const slot = (pos: number): Positional | undefined =>
    props.clue.conditions.find((c): c is Positional => isPositional(c) && c.position === pos);
  const relations = () => props.clue.conditions.filter((c): c is Relation => !isPositional(c));
  const panelH = () => TOP * 2 + props.clue.wires * (ROW_H + ROW_GAP) - ROW_GAP;
  const height = () => panelH() + relations().length * REL_H + (relations().length > 0 ? 4 : 0);
  const mid = () => panelH() / 2;
  const cut = () => props.clue.cut;
  const cutRowY = () => {
    const c = cut();
    return c.kind === "position" ? rowY(c.position - 1) + ROW_H / 2 : mid();
  };
  return (
    <svg class="kp__diagram" viewBox={`0 0 ${W} ${height()}`} role="img" aria-label={clueText(props.clue)}>
      <title>{clueText(props.clue)}</title>
      <rect x="2" y="1" width="118" height={panelH() - 2} rx="12" class="kp__dg-frame" />
      <For each={rows()}>
        {(pos, i) => {
          const c = () => slot(pos);
          const on = () => c()?.kind === "at";
          const not = () => c()?.kind === "notAt";
          const color = () => c()?.color as WireColor;
          return (
            <g>
              <rect
                x="10"
                y={rowY(i())}
                width="102"
                height={ROW_H}
                rx="10"
                class={
                  on()
                    ? "kp__dg-slot kp__dg-slot--on"
                    : not()
                      ? "kp__dg-slot kp__dg-slot--not"
                      : "kp__dg-slot"
                }
                style={c() ? { fill: COLOR_CSS[color()] } : undefined}
              />
              <text x="22" y={rowY(i()) + 14.5} class={c() ? "kp__dg-no kp__dg-no--on" : "kp__dg-no"}>
                {pos}
              </text>
              <Show when={c()}>
                <CbGlyph
                  index={COLOR_MARK[color()]}
                  cx={96}
                  cy={rowY(i()) + ROW_H / 2}
                  size={14}
                  color="#0a1030"
                />
              </Show>
              <Show when={not()}>
                <path d={`M36 ${rowY(i()) + ROW_H - 2}L106 ${rowY(i()) + 2}`} class="kp__dg-strike" />
              </Show>
            </g>
          );
        }}
      </For>
      <For each={relations()}>
        {(r, i) => {
          const y = () => panelH() + 4 + i() * REL_H;
          return (
            <g>
              <Show
                when={r.kind === "adjacent"}
                fallback={
                  <>
                    <Chip color={r.a} x={14} y={y()} />
                    <path d={`M54 ${y() + 6}l18 10m-6 0h6v-6`} class="kp__dg-rel" />
                    <Chip color={r.b} x={78} y={y() + 8} />
                  </>
                }
              >
                <Chip color={r.a} x={14} y={y() + 4} />
                <g class="kp__dg-rel">
                  <rect x="52" y={y() + 8} width="14" height="10" rx="5" />
                  <rect x="60" y={y() + 8} width="14" height="10" rx="5" />
                </g>
                <Chip color={r.b} x={80} y={y() + 4} />
              </Show>
            </g>
          );
        }}
      </For>
      <Show
        when={cut().kind === "color" ? (cut() as { color: WireColor }).color : undefined}
        fallback={
          <>
            <path d={`M164 ${cutRowY()}H122m8-8l-8 8 8 8`} class="kp__dg-arrow" />
            <rect
              x="164"
              y={cutRowY() - 14}
              width="52"
              height="28"
              rx="14"
              class="kp__dg-cut kp__dg-cut--pos"
            />
            <path
              d={`M178 ${cutRowY() - 6}l24 12m0-12l-24 12`}
              class="kp__dg-scissors kp__dg-scissors--pos"
            />
          </>
        }
      >
        {(color) => (
          <>
            <path d={`M126 ${mid()}h30m-8-8l8 8-8 8`} class="kp__dg-arrow" />
            <rect
              x="164"
              y={mid() - 14}
              width="52"
              height="28"
              rx="14"
              class="kp__dg-cut"
              style={{ fill: COLOR_CSS[color()] }}
            />
            <path d={`M178 ${mid() - 6}l24 12m0-12l-24 12`} class="kp__dg-scissors" />
            <CbGlyph
              index={COLOR_MARK[color()]}
              cx={171}
              cy={mid()}
              size={11}
              color="#0a1030"
              class="kp__dg-cbcut"
            />
          </>
        )}
      </Show>
    </svg>
  );
}
