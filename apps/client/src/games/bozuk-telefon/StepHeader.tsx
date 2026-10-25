import { Show } from "solid-js";
import { serverNow } from "../../net/store.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { SoundToggle } from "../../ui/SoundToggle.js";

interface Props {
  chip: string;
  title: string;
  startedAt: number;
  endsAt: number;
  now: () => number;
  sound?: boolean;
}

/** Üst şerit: adım rozeti, başlık, süre çubuğu ve kalan saniye (Karalama Defteri'yle aynı iskelet). */
export function StepHeader(props: Props) {
  const left = () => Math.max(0, Math.ceil((props.endsAt - props.now()) / 1000));
  return (
    <>
      <header class="kd__top bt__top">
        <span />
        <div class="kd__center">
          <span class="bt__chip">{props.chip}</span>
          <span class="kd__title bt__title">{props.title}</span>
        </div>
        <div class="kd__snd">
          <Show when={props.sound !== false}>
            <SoundToggle />
          </Show>
        </div>
      </header>
      <div class="kd__time">
        <ProgressBar startedAt={props.startedAt} endsAt={props.endsAt} now={serverNow} urgency />
        <span class="kd__secs" aria-hidden="true">
          {left()}
        </span>
      </div>
    </>
  );
}
