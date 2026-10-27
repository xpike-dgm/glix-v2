// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { BOZUK_TEXT_MAX } from "@glix/engine";
import { createSignal, For, Show } from "solid-js";
import { hapticReady } from "../../fx/haptics.js";
import { ready as readySound } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import type { AckLike } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { DrawingCanvas } from "../karalama-defteri/DrawingCanvas.js";
import type { Crew } from "./BozukTelefonScreen.js";
import { hasSentence, SentenceField } from "./SentenceField.js";
import { StepHeader } from "./StepHeader.js";
import type { BozukScreenView, ParsedDrawing } from "./view.js";

interface Props {
  view: BozukScreenView;
  crew: Crew[];
  spectator: boolean;
  now: () => number;
}

/** Yazma adımı: ilk adımda kendi cümlen, sonrakilerde elindeki çizimi tek cümleyle anlat. */
export function Yazma(props: Props) {
  const first = () => props.view.step === 0;
  const [text, setText] = createSignal(props.view.text ?? "");
  let flush: () => void = () => undefined;
  const locked = () => props.view.done;
  const total = () => props.crew.length;

  const lock = (): AckLike => {
    if (props.spectator || locked() || !hasSentence(text())) return false;
    flush();
    readySound();
    hapticReady();
    return sendActionAck({ kind: "lock" });
  };
  const prompt = () => props.view.prompt;
  const drawing = (): ParsedDrawing | null => {
    const p = prompt();
    return p?.kind === "draw" ? p.drawing : null;
  };
  const empty = () => drawing()?.strokes.length === 0;

  return (
    <>
      <StepHeader
        chip={`ADIM ${props.view.step + 1}/${props.view.steps}`}
        title={
          props.spectator ? "Arkadaşların yazıyor" : first() ? "Bir cümle yaz" : "Çizimi tek cümleyle anlat"
        }
        startedAt={props.view.stepStartedAt ?? props.view.startedAt}
        endsAt={props.view.stepEndsAt ?? props.view.startedAt}
      />
      <div class="bt__body">
        <Show
          when={!first()}
          fallback={
            <div class="bt__idea" aria-hidden="true">
              <svg viewBox="0 0 96 96" class="bt__ideaart">
                <path d="M14 66l8-30 52-14 6 22-52 14z" />
                <path d="M30 76l4-10M62 62l8 14" />
                <path d="M36 44h24M38 54h16" />
              </svg>
              <p>Sıradaki arkadaşın bunu çizecek. Kısa ve komik tut!</p>
            </div>
          }
        >
          <div class="bt__stage">
            <div class="bt__square">
              <Show when={drawing()}>{(d) => <DrawingCanvas strokes={d().strokes} version={d().key} />}</Show>
              <Show when={empty()}>
                <span class="bt__blank">Boş tuval</span>
              </Show>
            </div>
          </div>
        </Show>
        <Show
          when={!props.spectator}
          fallback={
            <div class="bt__crewbig">
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
          }
        >
          <SentenceField
            value={props.view.text ?? ""}
            locked={locked()}
            label="Cümlen"
            placeholder={first() ? "Örn. Kedi uzayda pizza yiyor" : "Gördüğünü yaz…"}
            onChange={(t) => {
              sendAction({ kind: "text", text: t });
            }}
            onType={setText}
            onEnter={lock}
            onFlush={(f) => {
              flush = f;
            }}
          />
          <p class="bt__limit" aria-hidden="true">
            {Array.from(text()).length}/{BOZUK_TEXT_MAX}
          </p>
        </Show>
      </div>
      <ul class="bt__crew" aria-label="Oyuncular">
        <For each={props.crew}>
          {(p) => (
            <li>
              <Avatar
                index={p.avatar}
                size="min(36px, calc((100vw - 40px - 56px) / 8))"
                connected={p.connected}
                ready={props.view.doneIds.includes(p.id)}
              />
            </li>
          )}
        </For>
      </ul>
      <TamamBar
        spectator={props.spectator}
        locked={locked()}
        disabled={!hasSentence(text())}
        ready={props.view.doneIds.length}
        readyIds={props.view.doneIds}
        total={total()}
        onLock={lock}
      />
    </>
  );
}
