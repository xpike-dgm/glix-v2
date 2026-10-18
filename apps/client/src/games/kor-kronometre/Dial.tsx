import { For } from "solid-js";

const TICKS = Array.from({ length: 60 }, (_, i) => i);

/**
 * Karanlık kronometre kadranı. Rakam ve ibre yoktur; nabız zamandan bağımsız bir döngüdür,
 * bu yüzden hedef ana dair hiçbir ipucu vermez. Basılınca nabız durur ve halka donar.
 */
export function Dial(props: { locked?: boolean; demo?: boolean }) {
  return (
    <div class="kk-dial" data-locked={props.locked ? "1" : undefined} aria-hidden="true">
      <i class="kk-dial__pulse kk-dial__pulse--a" />
      <i class="kk-dial__pulse kk-dial__pulse--b" />
      <svg class="kk-dial__face" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="92" class="kk-dial__ring" />
        <For each={TICKS}>
          {(i) => (
            <line
              x1="100"
              y1={i % 5 === 0 ? 14 : 18}
              x2="100"
              y2="24"
              class="kk-dial__tick"
              data-major={i % 5 === 0 ? "1" : undefined}
              transform={`rotate(${i * 6} 100 100)`}
            />
          )}
        </For>
        <rect x="90" y="-2" width="20" height="10" rx="3" class="kk-dial__crown" />
        <circle cx="100" cy="100" r="9" class="kk-dial__core" />
      </svg>
    </div>
  );
}
