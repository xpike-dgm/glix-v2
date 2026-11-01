import type { Pledge } from "@glix/engine";
import { createSignal, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { BottomSheet } from "../../ui/BottomSheet.js";
import { createOptimistic } from "../../ui/optimistic.js";
import { createPendingPick } from "../../ui/playerPicker.js";
import { TamamBar } from "../../ui/TamamBar.js";
import { Ballot } from "./Art.js";
import { type CrewMember, Seats } from "./Seats.js";
import { seal } from "./sounds.js";
import { PLEDGE_LABEL, type RusvetScreenView } from "./view.js";

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

/**
 * Başkanlık seçimi (RD-U1) ve kalabalık eşitlikte ikinci oylama (RD-M4). Seçim mühürle gösterilir, "Tamam" diyenler
 * alttaki şeritte; başlık seçtiğin kişinin adını büyük yazmaz (göz atma koruması). Seçimde vaatler portrelerin altında.
 */
export function Secim(props: Props) {
  const runoff = () => props.view.phase === "runoff";
  const open = () => props.view.phase === "vote" || props.view.phase === "runoff";
  const pick = createPendingPick({
    server: () => props.view.myVote,
    send: (id) => sendActionAck({ kind: "vote", target: id }),
    closed: () => props.spectator || !open() || props.view.locked,
  });
  const onPick = (id: string): void => {
    const changed = pick.value() !== id;
    pick.pick(id);
    // Mühür "tok"u: yeni mühür basılınca (eski mühür silinir).
    if (changed) seal();
  };
  const shown = () => {
    if (!runoff()) return props.crew;
    const c = props.view.runoff?.candidates ?? [];
    return c.flatMap((id) => props.crew.filter((m) => m.id === id));
  };
  const chosen = () => props.crew.find((m) => m.id === pick.value()) ?? null;

  // Vaat (RD-M3): kendi portrenin altındaki "Vaadim" düğmesi, iki seçenekli alt sayfa.
  const [sheet, setSheet] = createSignal(false);
  const [myPledge, setMyPledge] = createOptimistic<Pledge | null>(
    () => props.view.pledges[props.selfId] ?? null,
  );
  const choosePledge = (p: Pledge | null): void => {
    setSheet(false);
    if (props.spectator || runoff()) return;
    unlockAudio();
    hapticTap();
    setMyPledge(p, () => sendActionAck({ kind: "pledge", pledge: p }));
  };
  const pledgeOf = (id: string): Pledge | null =>
    id === props.selfId ? myPledge() : (props.view.pledges[id] ?? null);

  const sealed = () => props.view.ready.length;
  const title = () => {
    if (props.spectator)
      return runoff() ? `Eşitlik! ${shown().length} aday` : `Mühürleyenler: ${sealed()}/${props.crew.length}`;
    if (chosen()) return "Oyun mühürlendi";
    return runoff() ? `EŞİTLİK! ${shown().length} aday` : "Kimi seçiyorsun?";
  };

  return (
    <>
      <div class="rd__head rd__head--vote">
        <span class="overline rd__overline">
          <Ballot size="22px" />
          {runoff() ? "İkinci oylama" : "Başkanlık seçimi"}
        </span>
        <span class="rd__title" data-runoff={runoff() ? "1" : undefined}>
          {title()}
        </span>
        <Show
          when={!props.spectator && chosen()}
          fallback={
            <span class="rd__sub rd__rule">
              {runoff()
                ? "Yalnız eşit adaylardan birine oy ver; vermeyenin oyu sayılmaz"
                : "En çok oy alan başkan olur ve aldığı oy kadar jeton dağıtır"}
            </span>
          }
        >
          {(m) => <span class="rd__sub rd__chosen">Seçimin: {m().nickname}</span>}
        </Show>
      </div>
      <Seats
        players={shown()}
        selfId={props.selfId}
        selected={props.spectator ? null : pick.value()}
        onPick={props.spectator || !open() || props.view.locked ? undefined : onPick}
        label={(m) =>
          runoff() ? `${m.nickname} adlı adaya oy ver` : `${m.nickname} adlı oyuncuya başkanlık oyu ver`
        }
        below={(m) => (
          <Show
            when={!runoff()}
            fallback={
              <Show when={!m.connected}>
                <span class="rd__band rd__band--muted">oy veremez</span>
              </Show>
            }
          >
            <Show
              when={m.id === props.selfId && !props.spectator}
              fallback={
                <Show
                  when={pledgeOf(m.id)}
                  fallback={
                    <Show when={!m.connected}>
                      <span class="rd__band rd__band--muted">oyu rastgele gidecek</span>
                    </Show>
                  }
                >
                  {(p) => (
                    <span class="rd__band" data-p={p()}>
                      {PLEDGE_LABEL[p()]}
                    </span>
                  )}
                </Show>
              }
            >
              <button
                type="button"
                class="rd__pledge-btn"
                data-p={myPledge() ?? undefined}
                aria-haspopup="dialog"
                onClick={() => setSheet(true)}
              >
                {myPledge() ? PLEDGE_LABEL[myPledge() as Pledge] : "Vaadim"}
              </button>
            </Show>
          </Show>
        )}
      />
      <TamamBar
        locked={props.view.locked}
        ready={props.view.ready.length}
        readyIds={props.view.ready}
        total={props.crew.length}
        disabled={pick.value() === null}
        spectator={props.spectator}
        onLock={() => sendActionAck({ kind: "lock" })}
      />
      <BottomSheet open={sheet()} onClose={() => setSheet(false)} title="Vaadin">
        <div class="rd__pledges">
          <p class="rd__pledge-note">
            Herkes görür; puanı yok. Başkan olursan sonda tuttun mu bozdun mu açılır.
          </p>
          <For each={["voters", "all"] as const}>
            {(p) => (
              <button
                type="button"
                class="rd__pledge-opt"
                aria-pressed={myPledge() === p}
                onClick={() => choosePledge(p)}
              >
                <b>{PLEDGE_LABEL[p]}</b>
                <span>
                  {p === "voters"
                    ? "Bana gerçekten oy veren herkese en az 1 jeton"
                    : "Jetonu olabildiğince çok kişiye yayarım"}
                </span>
              </button>
            )}
          </For>
          <Show when={myPledge() !== null}>
            <button
              type="button"
              class="rd__pledge-opt rd__pledge-opt--none"
              onClick={() => choosePledge(null)}
            >
              <b>Vaadi indir</b>
            </button>
          </Show>
        </div>
      </BottomSheet>
    </>
  );
}
