import {
  GIZLI_HIRSIZ_SIGNAL_MS,
  type GizliHirsizReveal,
  type GizliHirsizSignal,
  type PlayerInfo,
} from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import {
  crewShown,
  OUTRO_COUNT_MS,
  OUTRO_CREW_MS,
  outroStep,
  printCountLine,
  secondOf,
  shortName,
  shownCount,
  stampText,
  stirredBy,
  stripPos,
} from "./view.js";

interface Props {
  reveal: GizliHirsizReveal;
  /** Açılış başından geçen süre (ms). */
  elapsed: number;
  signal: GizliHirsizSignal | null;
  playerOf: (id: string) => PlayerInfo | undefined;
  nameOf: (id: string) => string;
  avatar: string;
  class?: string;
}

/** Kıpırtı simgesi: üç kısa dalga. */
export function StirIcon() {
  return (
    <svg class="ghicon-stir" viewBox="0 0 24 24" aria-hidden="true">
      <title>Kıpırtı</title>
      <path d="M4 12h3l2-5 3 10 2-6 2 3h4" />
    </svg>
  );
}

/** Kelepçe simgesi (GH-U5, alarm). */
export function CuffIcon() {
  return (
    <svg class="ghicon-cuff" viewBox="0 0 24 24" aria-hidden="true">
      <title>Kelepçe</title>
      <circle cx="7" cy="14" r="4.5" />
      <circle cx="17" cy="14" r="4.5" />
      <path d="M10.5 10.5l3 0" />
    </svg>
  );
}

/**
 * GH-U5 / GH-U6: oyun içi kasa açılışı. Önce yalnız parmak izi sayısı, sonra hırsızlar ÇAL sırasıyla (ad ve saniye),
 * sonra damga; altında 0–30 sn zaman şeridi. ÇALMA kararları hiçbir yerde görünmez.
 */
export function Outro(props: Props) {
  const n = () => props.reveal.thieves.length;
  const step = () => outroStep(props.elapsed, n());
  const shown = () => crewShown(props.elapsed, n());
  const crew = () => props.reveal.thieves.slice(0, shown());
  const msOf = (id: string): number => props.reveal.pressedAt[props.reveal.thieves.indexOf(id)] ?? 0;
  const tone = () => (step() === "stamp" ? props.reveal.outcome : "wait");
  const pts = () => (props.reveal.outcome === "solo" ? "+1" : "−1");
  const live = () => {
    if (step() !== "stamp") return "";
    const names = props.reveal.thieves.map(props.nameOf).join(", ");
    return `${printCountLine(n())}. ${names ? `${names}. ` : ""}${stampText(props.reveal, props.nameOf)}`;
  };

  return (
    <section
      class={`gho ${props.class ?? ""}`}
      data-step={step()}
      data-tone={tone()}
      aria-label="Kasa açılışı"
    >
      <p class="sr-only" aria-live="polite">
        {live()}
      </p>
      <Show when={props.elapsed >= OUTRO_COUNT_MS}>
        <p class="gho__count" aria-hidden="true">
          {printCountLine(step() === "count" ? shownCount(props.elapsed, n()) : n())}
        </p>
      </Show>
      <Show when={props.elapsed >= OUTRO_CREW_MS && n() > 0}>
        <ol class="gho__crew" data-n={n()} aria-hidden="true">
          <For each={crew()}>
            {(id) => {
              const p = () => props.playerOf(id);
              return (
                <li class="gho__thief">
                  <span class="gho__av">
                    <Avatar
                      index={p()?.avatar ?? 0}
                      size={props.avatar}
                      connected={p()?.connected !== false}
                      ring={
                        step() !== "stamp"
                          ? undefined
                          : props.reveal.outcome === "solo"
                            ? "var(--lime)"
                            : "var(--red)"
                      }
                    />
                    <Show when={step() === "stamp" && props.reveal.outcome === "multi"}>
                      <span class="gho__cuff">
                        <CuffIcon />
                      </span>
                    </Show>
                  </span>
                  <span class="gho__name">{shortName(props.nameOf(id))}</span>
                  <span class="gho__sec">
                    <Show when={stirredBy(msOf(id), props.signal)}>
                      <StirIcon />
                    </Show>
                    {secondOf(msOf(id))}. sn
                  </span>
                  <Show when={step() === "stamp"}>
                    <span class="gho__pts">{pts()}</span>
                  </Show>
                </li>
              );
            }}
          </For>
        </ol>
      </Show>
      <Show when={step() === "stamp"}>
        <p class="gho__stamp" aria-hidden="true">
          <span class="gho__mark">
            {props.reveal.outcome === "solo" ? "✓" : props.reveal.outcome === "multi" ? "✕" : "·"}
          </span>
          {stampText(props.reveal, props.nameOf)}
        </p>
        <TimeStrip
          reveal={props.reveal}
          signal={props.signal}
          playerOf={props.playerOf}
          nameOf={props.nameOf}
        />
      </Show>
    </section>
  );
}

/** GH-U6: 0–30 sn zaman şeridi; hırsızlar ÇAL dedikleri saniyede, işaret varsa 15. saniyede çizgi. */
export function TimeStrip(props: {
  reveal: GizliHirsizReveal;
  signal: GizliHirsizSignal | null;
  playerOf: (id: string) => PlayerInfo | undefined;
  nameOf: (id: string) => string;
  class?: string;
}) {
  const items = () => props.reveal.thieves.map((id, i) => ({ id, ms: props.reveal.pressedAt[i] ?? 0 }));
  const msOf = (id: string): number => props.reveal.pressedAt[props.reveal.thieves.indexOf(id)] ?? 0;
  return (
    <div class={`ghstrip ${props.class ?? ""}`} role="img" aria-label={stripLabel(items(), props.nameOf)}>
      <div class="ghstrip__bar">
        <Show when={props.signal !== null}>
          <i class="ghstrip__signal" style={{ left: `${stripPos(GIZLI_HIRSIZ_SIGNAL_MS)}%` }} />
        </Show>
        <For each={props.reveal.thieves}>
          {(id, i) => (
            <span
              class="ghstrip__pin"
              style={{ left: `${stripPos(msOf(id))}%` }}
              data-row={i() % 2 === 0 ? "0" : "1"}
              title={`${props.nameOf(id)} ${secondOf(msOf(id))}. sn`}
            >
              <Avatar index={props.playerOf(id)?.avatar ?? 0} size="var(--gh-pin)" />
            </span>
          )}
        </For>
      </div>
      <div class="ghstrip__scale" aria-hidden="true">
        <span>0</span>
        <Show when={props.signal !== null} fallback={<span>15</span>}>
          <span class="ghstrip__sig">15 · işaret</span>
        </Show>
        <span>30 sn</span>
      </div>
    </div>
  );
}

function stripLabel(items: { id: string; ms: number }[], nameOf: (id: string) => string): string {
  if (items.length === 0) return "Zaman şeridi: kimse çalmadı";
  return `Zaman şeridi: ${items.map((it) => `${nameOf(it.id)} ${secondOf(it.ms)}. saniye`).join(", ")}`;
}
