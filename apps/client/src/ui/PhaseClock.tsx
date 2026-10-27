import { createEffect, onCleanup } from "solid-js";
import { useShell } from "./shell.js";

interface Props {
  startedAt: number;
  endsAt: number;
  /** Son 5 sn kırmızı + sayı + tik (karar süreleri için). */
  urgency?: boolean;
}

/**
 * Oyunun aşama süresini kabuk üst şeridindeki `<Clock>`a bildirir; kendisi bir şey çizmez.
 * Gizli kalması gereken süreler (Kör Kronometre, Son Kişi) bunu hiç kullanmaz.
 */
export function PhaseClock(props: Props) {
  const shell = useShell();
  createEffect(() => {
    shell.setClock({ startedAt: props.startedAt, endsAt: props.endsAt, urgency: props.urgency === true });
  });
  onCleanup(() => shell.setClock(null));
  return null;
}
