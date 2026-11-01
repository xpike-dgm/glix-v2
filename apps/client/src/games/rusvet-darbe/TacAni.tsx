import { onMount, Show } from "solid-js";
import { hapticCrown, hapticTick } from "../../fx/haptics.js";
import { Avatar } from "../../ui/Avatar.js";
import { Crown } from "./Art.js";
import type { CrewMember } from "./Seats.js";
import { crownFanfare } from "./sounds.js";

/**
 * RD-U7: "Başkan seçildi" anı (1,5 sn): herkeste "BAŞKAN: ELİF · 3 JETON" bandı; seçilenin ekranında taç yukarıdan
 * iner, uzun çift titreşim ve fanfar. Dağıtım süresi bu anın bitiminden sayılır (süreden yemez).
 */
export function TacAni(props: {
  president: CrewMember | null;
  budget: number;
  mine: boolean;
  spectator: boolean;
}) {
  onMount(() => {
    crownFanfare();
    if (props.spectator) return;
    if (props.mine) hapticCrown();
    else hapticTick();
  });
  return (
    <div class="rd__crown-band" data-mine={props.mine ? "1" : undefined} role="status">
      <Show when={props.president}>
        {(p) => (
          <>
            <span class="rd__crown-av">
              <span class="rd__crown-drop">
                <Crown size="100%" />
              </span>
              <Avatar index={p().avatar} size="clamp(72px, 24vw, 112px)" connected={p().connected} />
            </span>
            <span class="rd__crown-text">
              BAŞKAN: {p().nickname.toLocaleUpperCase("tr")}
              <small> · {props.budget} JETON</small>
            </span>
            <Show when={props.mine}>
              <span class="rd__crown-sub">Sen başkansın!</span>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
