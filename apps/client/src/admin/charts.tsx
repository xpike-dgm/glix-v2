import { For, Show } from "solid-js";
import { fmtInt } from "./format.js";

export interface BarDatum {
  label: string;
  value: number;
}

/** Sütun grafiği (satır içi SVG). Sütunun üstüne gelince/odaklanınca başlık gösterir. */
export function Bars(props: { data: BarDatum[]; color?: string; unit: string; caption: string }) {
  const max = () => Math.max(1, ...props.data.map((d) => d.value));
  const total = () => props.data.reduce((a, d) => a + d.value, 0);
  return (
    <figure class="adm-chart">
      <div class="adm-chart__max">{fmtInt(max())}</div>
      <svg
        viewBox={`0 0 ${Math.max(1, props.data.length) * 10} 100`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${props.caption}: toplam ${fmtInt(total())} ${props.unit}`}
        style={{ "--bar": props.color ?? "var(--cyan)" }}
      >
        <line x1="0" y1="99.5" x2={props.data.length * 10} y2="99.5" class="adm-chart__base" />
        <For each={props.data}>
          {(d, i) => {
            const h = () => (d.value === 0 ? 0 : Math.max(2, (d.value / max()) * 98));
            return (
              <rect class="adm-chart__bar" x={i() * 10 + 1} width="8" y={99 - h()} height={h()} rx="1">
                <title>{`${d.label}: ${fmtInt(d.value)} ${props.unit}`}</title>
              </rect>
            );
          }}
        </For>
      </svg>
      <figcaption>
        <span>{props.data[0]?.label}</span>
        <span>{props.data.at(-1)?.label}</span>
      </figcaption>
    </figure>
  );
}

/** Küçük çizgi grafik (örnek geçmişi). */
export function Spark(props: { values: number[]; color?: string; label: string }) {
  const points = () => {
    const v = props.values;
    if (v.length < 2) return "";
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    const span = hi - lo || 1;
    return v.map((y, i) => `${(i / (v.length - 1)) * 100},${28 - ((y - lo) / span) * 26}`).join(" ");
  };
  return (
    <Show when={props.values.length >= 2}>
      <svg
        class="adm-spark"
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        role="img"
        aria-label={props.label}
      >
        <polyline points={points()} style={{ stroke: props.color ?? "var(--cyan)" }} />
      </svg>
    </Show>
  );
}

/** Yatay oran çubukları (dağılımlar). */
export function HBars(props: { rows: { label: string; value: number; note?: string }[]; color?: string }) {
  const max = () => Math.max(1, ...props.rows.map((r) => r.value));
  return (
    <ul class="adm-hbars" style={{ "--bar": props.color ?? "var(--violet)" }}>
      <For each={props.rows}>
        {(r) => (
          <li>
            <span class="adm-hbars__label">{r.label}</span>
            <span class="adm-hbars__track" aria-hidden="true">
              <span class="adm-hbars__fill" style={{ width: `${(r.value / max()) * 100}%` }} />
            </span>
            <span class="adm-hbars__value">
              {fmtInt(r.value)}
              <Show when={r.note}>
                <small> {r.note}</small>
              </Show>
            </span>
          </li>
        )}
      </For>
    </ul>
  );
}
