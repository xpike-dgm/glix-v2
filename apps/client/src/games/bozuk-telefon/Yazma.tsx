// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import { BOZUK_TEXT_MAX } from "@glix/engine";
import { createEffect, createSignal, For, type JSX, on, Show } from "solid-js";
import { hapticReady } from "../../fx/haptics.js";
import { ready as readySound } from "../../fx/sound.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import type { AckLike } from "../../ui/optimistic.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { Crew } from "./BozukTelefonScreen.js";
import { PhoneArt } from "./PhoneArt.js";
import { Replay } from "./Replay.js";
import { hasSentence, SentenceField } from "./SentenceField.js";
import { StepHeader } from "./StepHeader.js";
import { cableSend } from "./sounds.js";
import type { BozukScreenView, ParsedDrawing } from "./view.js";

interface Props {
  view: BozukScreenView;
  crew: Crew[];
  spectator: boolean;
  now: () => number;
  /**
   * İlk cümle ekranında "💡 İlham ver" düğmesinin yeri (BT-AI1; ortak yapay zekâ altyapısı bağlanınca verilir).
   * Karakter sayacının solunda durur; verilmezse yer boş kalır.
   */
  inspire?: JSX.Element;
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
  // İlk cümle "Tamam" ile kilitlenince kablodan sıradakine gider.
  const [sending, setSending] = createSignal(false);
  createEffect(
    on(
      () => props.view.done,
      (done) => {
        if (!done || !first() || props.spectator) return;
        setSending(true);
        cableSend();
      },
      { defer: true },
    ),
  );

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
            <div class="bt__idea">
              <PhoneArt sending={sending() || (props.view.done && !props.spectator)} />
              <p>Sıradaki arkadaşın bunu çizecek. Kısa ve komik tut!</p>
            </div>
          }
        >
          <div class="bt__stage">
            <div class="bt__square">
              <Show when={drawing()}>{(d) => <Replay strokes={d().strokes} version={d().key} play />}</Show>
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
          <div class="bt__meta">
            <span class="bt__slot">{first() ? props.inspire : null}</span>
            <p class="bt__limit" aria-hidden="true">
              {Array.from(text()).length}/{BOZUK_TEXT_MAX}
            </p>
          </div>
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
        dots={false}
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
