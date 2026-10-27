import { createMemo, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";
import type { ActionAck } from "../../net/client.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { Status } from "../../ui/Status.js";
import type { CrewMember } from "./Duello.js";
import type { RusvetScreenView } from "./view.js";

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  /** Darbe oyu: true = Darbe, false = Darbe yok. */
  onCoup: (yes: boolean) => Promise<ActionAck>;
}

/**
 * Darbe oylaması: dağılım açılmıştır; jeton almayanlar gizlice "Darbe" ya da "Darbe yok" der.
 * Başkalarının oyu hiçbir yerde görünmez; yalnız kimlerin oy verdiği (işaret) bellidir.
 */
export function Darbe(props: Props) {
  const coup = () => props.view.coup;
  const eligible = () => coup()?.eligible ?? [];
  const canVote = () => !props.spectator && props.view.canCoup;
  const [mine, setMine] = createOptimistic<boolean | null>(() => props.view.myCoup);
  const done = () => mine() !== null;
  const voted = () => props.view.ready.length;
  const total = () => eligible().length;
  const eligibleNames = createMemo(() =>
    props.crew.filter((m) => eligible().includes(m.id)).map((m) => m.nickname),
  );

  const choose = (yes: boolean): void => {
    if (!canVote() || done()) return;
    unlockAudio();
    tap();
    hapticTap();
    setMine(yes, () => props.onCoup(yes));
  };

  return (
    <>
      <div class="rd__head">
        <span class="overline">Darbe oylaması</span>
        <Show when={canVote()} fallback={<span class="rd__title">Jetonlar açıldı</span>}>
          <span class="rd__title">{done() ? "Oyun gizli kaldı" : "Darbe olsun mu?"}</span>
        </Show>
      </div>
      <PlayerPicker
        players={props.crew}
        selfId={props.selfId}
        counts={coup()?.tokens}
        countLabel="jeton"
        ready={props.view.ready}
        ring="#FF5C7A"
        disabled
        label={(p) => `${p.nickname} adlı oyuncu`}
        onPick={() => undefined}
      />
      <Show
        when={canVote()}
        fallback={
          <Status
            class="rd__status"
            titleClass="rd__status-main"
            sub={
              eligibleNames().length > 0
                ? `Jeton almayanlar karar veriyor · ${voted()}/${total()} oy verdi`
                : ""
            }
          >
            Darbe oylaması sürüyor
          </Status>
        }
      >
        <div class="rd__signs rd__signs--two">
          <button
            type="button"
            class="rd__sign rd__sign--coup"
            data-on={mine() === true ? "1" : undefined}
            disabled={done()}
            aria-pressed={mine() === true}
            onClick={() => choose(true)}
          >
            <span>Darbe</span>
          </button>
          <button
            type="button"
            class="rd__sign"
            data-on={mine() === false ? "1" : undefined}
            disabled={done()}
            aria-pressed={mine() === false}
            onClick={() => choose(false)}
          >
            <span>Darbe yok</span>
          </button>
        </div>
        <p class="rd__hint" role="status">
          {done()
            ? `Diğerleri bekleniyor · ${Math.min(total(), voted() + (props.view.myCoup === null ? 1 : 0))}/${total()} oy verdi`
            : "Jeton almadın: oyun gizli ve tek seferlik"}
        </p>
      </Show>
    </>
  );
}
