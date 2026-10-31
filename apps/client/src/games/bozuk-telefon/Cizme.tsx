import { BOZUK_MAX_STROKES, BOZUK_MAX_TOTAL_POINTS } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { DrawBoard } from "../karalama-defteri/DrawBoard.js";
import { FULL_PENS } from "../karalama-defteri/draw.js";
import type { Crew } from "./BozukTelefonScreen.js";
import { FitText } from "./FitText.js";
import { StepHeader } from "./StepHeader.js";
import { penScratch } from "./sounds.js";
import type { BozukScreenView } from "./view.js";

interface Props {
  view: BozukScreenView;
  crew: Crew[];
  spectator: boolean;
  now: () => number;
}

/** Çizme adımı: elindeki cümleyi çiz (ortak çizim tahtası); izleyici yalnız hazır sayacını görür. */
export function Cizme(props: Props) {
  const sentence = () => {
    const p = props.view.prompt;
    return p?.kind === "write" ? p.text : "";
  };
  const header = () => (
    <>
      <StepHeader
        chip={`ADIM ${props.view.step + 1}/${props.view.steps}`}
        title={props.spectator ? "Arkadaşların çiziyor" : "Cümleyi çiz"}
        startedAt={props.view.stepStartedAt ?? props.view.startedAt}
        endsAt={props.view.stepEndsAt ?? props.view.startedAt}
      />
      <Show when={!props.spectator}>
        <p class="bt__say" data-blank={sentence() === "…" ? "1" : undefined}>
          <Show when={sentence() !== "…"} fallback={<span>Cümle gelmedi, aklına geleni çiz!</span>}>
            <FitText text={sentence()} max={20} min={12} class="bt__saytext" />
          </Show>
        </p>
      </Show>
    </>
  );
  return (
    <Show
      when={!props.spectator}
      fallback={
        <>
          {header()}
          <div class="kd__watch">
            <svg viewBox="0 0 96 96" class="kd__watchart" aria-hidden="true">
              <path d="M10 80c8-14 16 6 24-4" />
              <path d="M64 14l18 18-38 38-22 4 4-22z" />
              <path d="M56 22l18 18" />
            </svg>
            <div class="kd__crew">
              <For each={props.crew}>
                {(p) => (
                  <Avatar
                    index={p.avatar}
                    size={40}
                    connected={p.connected}
                    ready={props.view.doneIds.includes(p.id)}
                  />
                )}
              </For>
            </div>
            <TamamBar
              spectator
              locked={false}
              ready={props.view.doneIds.length}
              readyIds={props.view.doneIds}
              total={props.crew.length}
              onLock={() => undefined}
            />
          </div>
        </>
      }
    >
      <DrawBoard
        strokes={props.view.strokes}
        endsAt={props.view.stepEndsAt ?? 0}
        done={props.view.done}
        readyCount={props.view.doneIds.length}
        total={props.crew.length}
        maxStrokes={BOZUK_MAX_STROKES}
        maxPoints={BOZUK_MAX_TOTAL_POINTS}
        header={header()}
        now={props.now}
        pens={FULL_PENS}
        sizes={[1, 2, 3, 4]}
        compact
        inset={2}
        onInk={(k) => {
          if (k !== "end") penScratch();
        }}
      />
    </Show>
  );
}
