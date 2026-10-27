import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { NumberPicker } from "../../ui/NumberPicker.js";
import { createChoiceSync } from "../../ui/numberPicker.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./cizgiyi-gecme.css";
import { Sonuc, type SonucEntry } from "./Sonuc.js";
import { parseCizgiView, ZONE_COUNT, zoneFill, zoneLabel, zoneOf, zonesTopDown } from "./view.js";

export default function CizgiyiGecmeScreen(props: GameScreenProps) {
  const view = createMemo(() => parseCizgiView(props.match.publicView, props.match.view));
  const entries = createMemo<SonucEntry[]>(() =>
    props.match.participants.map((id) => {
      const p = props.players.find((x) => x.id === id);
      return {
        id,
        avatar: p?.avatar ?? 0,
        nickname: p?.nickname ?? "Oyuncu",
        connected: p?.connected ?? true,
      };
    }),
  );
  const me = () => entries().find((e) => e.id === props.selfId);
  const reveal = () => view()?.reveal ?? null;
  const [sentLock, setSentLock] = createSignal(false);
  const lockedIds = () => view()?.lockedIds ?? [];
  const locked = () => (view()?.locked ?? false) || sentLock();
  const closed = () => {
    const v = view();
    return props.spectator === true || !v || locked() || props.now() >= v.endsAt || v.reveal !== null;
  };

  const sync = createChoiceSync({
    serverValue: () => view()?.myChoice,
    send: (value) => {
      sendAction({ kind: "choose", value });
    },
    closed,
  });
  const mine = (): number | null => sync.value() ?? view()?.myChoice ?? null;
  const zone = () => zoneOf(mine() ?? 0);

  const lock = (): AckLike => {
    const v = view();
    const value = mine();
    if (!v || value === null || closed()) return false;
    // Sürükleme bitmeden basıldıysa en son değer önce gider (iletiler sıralı ulaşır).
    if (v.myChoice !== value) sendAction({ kind: "choose", value });
    setSentLock(true);
    const ack = sendActionAck({ kind: "lock" });
    // Reddedilirse kilit geri açılır.
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setSentLock(false);
    });
    return ack;
  };

  return (
    <Screen class="cg">
      <Show when={view()}>{(v) => <PhaseClock startedAt={v().startedAt} endsAt={v().endsAt} urgency />}</Show>

      <Show when={view()}>
        {(v) => (
          <Show
            when={reveal()}
            fallback={
              <>
                <div class="cg__hero">
                  <p class="overline">{props.spectator ? "Herkes gizlice seçiyor" : "Gizli pinin"}</p>
                  <div class="cg__num" data-set={mine() === null ? undefined : "1"}>
                    {props.spectator ? "?" : (mine() ?? "?")}
                  </div>
                  <p class="cg__sub">
                    {props.spectator
                      ? "Sonuç süre bitince açılır"
                      : mine() === null
                        ? "Seçmezsen pasif kalırsın"
                        : locked()
                          ? `${zoneLabel(zone())} platformunda kesinleştin`
                          : `${zoneLabel(zone())} platformundasın`}
                  </p>
                </div>

                <div class="cg__tower" aria-hidden="true">
                  <For each={zonesTopDown()}>
                    {(z) => (
                      <div
                        class="cgrow"
                        data-on={!props.spectator && mine() !== null && z === zone() ? "1" : undefined}
                      >
                        <span class="cgrow__label">{zoneLabel(z)}</span>
                        <span class="cgrow__bar" />
                      </div>
                    )}
                  </For>
                  <Show when={!props.spectator}>
                    <div
                      class="cgpin"
                      data-empty={mine() === null ? "1" : undefined}
                      style={{
                        "--z": mine() === null ? 0 : zone(),
                        "--f": mine() === null ? 0.5 : zoneFill(mine() ?? 0),
                        "--n": ZONE_COUNT,
                      }}
                    >
                      <i class="cgpin__stem" />
                      <span class="cgpin__head">
                        <Avatar index={me()?.avatar ?? 0} size={30} />
                      </span>
                    </div>
                  </Show>
                </div>

                <Show
                  when={!props.spectator}
                  fallback={
                    <div class="cg__pick">
                      <TamamBar
                        spectator
                        locked={false}
                        ready={lockedIds().length}
                        readyIds={lockedIds()}
                        total={entries().length}
                        onLock={lock}
                      />
                    </div>
                  }
                >
                  <div class="cg__pick">
                    <NumberPicker
                      min={0}
                      max={100}
                      startAt={50}
                      value={mine()}
                      label="Gizli pinin"
                      disabled={closed()}
                      onChange={(n, final) => {
                        if (final) hapticTap();
                        sync.set(n, final);
                      }}
                    />
                    <TamamBar
                      locked={locked()}
                      disabled={mine() === null || closed()}
                      ready={lockedIds().length}
                      readyIds={lockedIds()}
                      total={entries().length}
                      onLock={lock}
                    />
                  </div>
                </Show>
              </>
            }
          >
            {(r) => (
              <Sonuc
                reveal={r()}
                endsAt={v().endsAt}
                entries={entries()}
                selfId={props.selfId}
                spectator={props.spectator === true}
                now={props.now}
              />
            )}
          </Show>
        )}
      </Show>
    </Screen>
  );
}
