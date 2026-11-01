import { createMemo, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { tap, unlockAudio } from "../../fx/sound.js";
import type { ActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { Crown, Fist, Stack } from "./Art.js";
import { type CrewMember, Seats } from "./Seats.js";
import { coupRuleLine, joinNames, type RusvetScreenView } from "./view.js";

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  /** Darbe oyu: true = Darbe, false = Darbe yok. */
  onCoup: (yes: boolean) => Promise<ActionAck>;
}

/**
 * Darbe oylaması (RD-U6): üstte tahtta taçlı başkan, jeton alanlar altın yığınla; hak sahipleri ayrı sırada kırmızı
 * çerçevede. DARBE kırmızı ve yumruklu, DARBE YOK gri ve sakin; basınca seçilen kalır. Oylar hiç açılmaz.
 */
export function Darbe(props: Props) {
  const coup = () => props.view.coup;
  const eligible = () => coup()?.eligible ?? [];
  const canVote = () => !props.spectator && props.view.canCoup;
  const [mine, setMine] = createOptimistic<boolean | null>(() => props.view.myCoup);
  const done = () => mine() !== null;
  const voted = () =>
    Math.min(eligible().length, props.view.ready.length + (done() && props.view.myCoup === null ? 1 : 0));
  const total = () => eligible().length;
  const president = () => props.crew.find((m) => m.id === props.view.president) ?? null;
  const receivers = createMemo(() =>
    props.crew.filter((m) => m.id !== props.view.president && (coup()?.tokens[m.id] ?? 0) > 0),
  );
  const deciders = createMemo(() => props.crew.filter((m) => eligible().includes(m.id)));

  const choose = (yes: boolean): void => {
    if (!canVote() || done()) return;
    unlockAudio();
    tap();
    hapticTap();
    setMine(yes, () => props.onCoup(yes));
  };
  const title = () => {
    if (props.spectator) return `Karar verenler: ${joinNames(deciders().map((m) => m.nickname))}`;
    if (!canVote()) return "Karar onlarda";
    if (total() === 1) return "Tek karar veren sensin";
    return "Karar senin";
  };

  return (
    <>
      <div class="rd__head rd__head--coup">
        <span class="overline">Darbe oylaması</span>
        <span class="rd__title rd__title--coup">{title()}</span>
        <Show when={president()}>
          {(p) => <span class="rd__sub rd__rule">{coupRuleLine(p().nickname)}</span>}
        </Show>
      </div>
      <div class="rd__court">
        <Show when={president()}>
          {(p) => (
            <div class="rd__court-pres" style={{ "--tc": look(p().avatar).color }}>
              <span class="rd__throne-crown rd__throne-crown--sm">
                <Crown size="60%" />
              </span>
              <Avatar index={p().avatar} size="var(--rd-pav)" connected={p().connected} />
              <span class="rd__name">{p().nickname}</span>
            </div>
          )}
        </Show>
        <div class="rd__court-row">
          <For each={receivers()}>
            {(m) => (
              <div class="rd__court-cell" data-me={m.id === props.selfId ? "1" : undefined}>
                <Avatar index={m.avatar} size="var(--rd-rav)" connected={m.connected} />
                <span class="rd__name">{m.nickname}</span>
                <Stack n={coup()?.tokens[m.id] ?? 0} />
              </div>
            )}
          </For>
        </div>
      </div>
      <p class="rd__note rd__note--dim">Jeton alamayanlar karar veriyor</p>
      <Seats
        class="rd__deciders"
        players={deciders()}
        selfId=""
        highlight={eligible()}
        label={(m) =>
          `${m.nickname}, darbe hakkı var${props.view.ready.includes(m.id) ? ", karar verdi" : ""}`
        }
        below={(m) => (
          <Show when={props.view.ready.includes(m.id) || (m.id === props.selfId && done())}>
            <span class="rd__band rd__band--muted">karar verdi</span>
          </Show>
        )}
      />
      <Show
        when={canVote()}
        fallback={
          <p class="rd__hint" role="status">
            Oylar gizli · {voted()}/{total()} karar verdi
          </p>
        }
      >
        <div class="rd__signs rd__signs--two" data-chosen={done() ? "1" : undefined}>
          <Show when={!done() || mine() === true}>
            <button
              type="button"
              class="rd__sign rd__sign--coup"
              data-on={mine() === true ? "1" : undefined}
              disabled={done()}
              aria-pressed={mine() === true}
              onClick={() => choose(true)}
            >
              <Fist size="30px" />
              <span>DARBE</span>
            </button>
          </Show>
          <Show when={!done() || mine() === false}>
            <button
              type="button"
              class="rd__sign rd__sign--calm"
              data-on={mine() === false ? "1" : undefined}
              disabled={done()}
              aria-pressed={mine() === false}
              onClick={() => choose(false)}
            >
              <span class="rd__calm-ico" aria-hidden="true" />
              <span>DARBE YOK</span>
            </button>
          </Show>
        </div>
        <p class="rd__hint" role="status">
          {done()
            ? `Oyun gizli · ${voted()}/${total()} karar verdi`
            : "Jeton almadın: oyun gizli ve tek seferlik"}
        </p>
      </Show>
    </>
  );
}
