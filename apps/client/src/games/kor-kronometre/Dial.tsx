import { propSrc } from "../../ui/props.js";

/**
 * Karanlık kronometre. Rakam ve ibre yoktur; nabız zamandan bağımsız bir döngüdür,
 * bu yüzden hedef ana dair hiçbir ipucu vermez. Basılınca nabız durur ve parıltı yeşile döner.
 */
export function Dial(props: { locked?: boolean; demo?: boolean }) {
  return (
    <div class="kro-dial" data-locked={props.locked ? "1" : undefined} aria-hidden="true">
      <img
        class="kro-dial__img"
        src={propSrc("genel/kronometre")}
        alt=""
        draggable={false}
        width="384"
        height="384"
      />
      <i class="kro-dial__pulse kro-dial__pulse--a" />
      <i class="kro-dial__pulse kro-dial__pulse--b" />
      <i class="kro-dial__core" />
    </div>
  );
}
