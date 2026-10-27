import { PhaseClock } from "../../ui/PhaseClock.js";

interface Props {
  chip: string;
  title: string;
  startedAt: number;
  endsAt: number;
}

/** Üst şerit: adım rozeti, başlık, süre çubuğu ve kalan saniye (Karalama Defteri'yle aynı iskelet). */
export function StepHeader(props: Props) {
  return (
    <>
      <header class="kd__top bt__top">
        <div class="kd__center">
          <span class="bt__chip">{props.chip}</span>
          <span class="kd__title bt__title">{props.title}</span>
        </div>
      </header>
      <PhaseClock startedAt={props.startedAt} endsAt={props.endsAt} urgency />
    </>
  );
}
