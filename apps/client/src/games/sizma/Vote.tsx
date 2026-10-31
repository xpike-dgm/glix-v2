import { createEffect, createMemo, on, Show } from "solid-js";
import { sendActionAck } from "../../net/client.js";
import { look } from "../../ui/avatars.js";
import { PlayerPicker } from "../../ui/PlayerPicker.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { Peek } from "./Peek.js";
import { gong } from "./sounds.js";
import { type CrewMember, runoffQuestion, type SizmaScreenView } from "./view.js";

interface Props {
  view: SizmaScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  tv?: boolean | undefined;
}

/**
 * Gizli oylama (SZ-U3) ve eşitlikte ikinci oylama (SZ-M4): son satır ortalı portre ızgarası, seçilen büyür ve
 * parlar, diğerleri sönükleşir; halka oyuncunun kendi rengidir (seçim dış parıltıdır). Bağlantısı kopmuş oyuncu
 * da seçilebilir (SZ-M6). İkinci oylamada yalnız adaylar, büyük ve yan yana.
 */
export function VoteStage(props: Props) {
  const runoff = () => props.view.phase === "runoff";
  const candidates = createMemo(() => {
    const ids = runoff() ? (props.view.runoff ?? []) : null;
    return ids ? props.crew.filter((m) => ids.includes(m.id)) : props.crew;
  });
  const closed = () => props.spectator || props.view.locked;
  const pick = createPendingPick({
    server: () => props.view.myVote,
    send: (id) => sendActionAck({ kind: "vote", target: id }),
    closed,
  });
  const chosen = () => {
    const id = pick.value();
    return id === null ? null : (candidates().find((m) => m.id === id) ?? null);
  };
  createEffect(
    on(runoff, (now, was) => {
      if (now && was === false) gong();
    }),
  );

  return (
    <div class="sz__vote" data-runoff={runoff() ? "1" : undefined} data-picked={chosen() ? "1" : undefined}>
      <div class="sz__head">
        <span class="overline" data-tie={runoff() ? "1" : undefined}>
          {runoff() ? "Eşitlik! Yeniden oyla" : props.spectator ? "Gizli oylama" : "Gizli oy"}
        </span>
        <Show
          when={!props.spectator && chosen()}
          fallback={
            <span class="sz__title">
              {runoff()
                ? runoffQuestion(candidates().map((c) => c.nickname))
                : props.spectator
                  ? "Herkes oy veriyor"
                  : "Sızma kim?"}
            </span>
          }
        >
          {(p) => (
            <span class="sz__title sz__title--locked" style={{ "--tc": look(p().avatar).color }}>
              {p().nickname}
            </span>
          )}
        </Show>
        <Show when={!props.spectator && props.view.word}>
          {(w) => (
            <Peek since={props.view.phaseStartedAt} now={props.now} enabled class="sz__minepeek">
              <span class="sz__mine">
                Kelimen <b>{w()}</b>
              </span>
            </Peek>
          )}
        </Show>
      </div>
      <PlayerPicker
        players={candidates()}
        selfId={props.selfId}
        allowSelf
        selected={props.spectator ? null : pick.value()}
        disabled={closed()}
        canPick={() => true}
        label={(p) => (p.id === props.selfId ? "Kendine oy ver" : `${p.nickname} adlı oyuncuya oy ver`)}
        ready={props.view.ready}
        onPick={(id) => pick.pick(id)}
      />
      <Show when={!props.tv}>
        <TamamBar
          locked={props.view.locked}
          ready={props.view.ready.length}
          readyIds={props.view.ready}
          total={props.crew.length}
          disabled={pick.value() === null}
          spectator={props.spectator}
          label="Oyumu ver"
          doneLabel="Hazırsın"
          onLock={() => sendActionAck({ kind: "lock" })}
        />
      </Show>
    </div>
  );
}
