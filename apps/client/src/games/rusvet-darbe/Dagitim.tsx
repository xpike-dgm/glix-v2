import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { fail, unlockAudio } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { type AckLike, createOptimistic, toAck } from "../../ui/optimistic.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { propSrc } from "../../ui/props.js";
import { Crown, Purse, Stack } from "./Art.js";
import { type CrewMember, type SeatMark, Seats } from "./Seats.js";
import { coin } from "./sounds.js";
import {
  addToken,
  joinNames,
  ofName,
  PLEDGE_LABEL,
  type RusvetScreenView,
  removeToken,
  tokenMap,
  tokensToAllocations,
  tokenTotal,
  toName,
} from "./view.js";

interface Props {
  view: RusvetScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  onGive: (tokens: { to: string; n: number }[]) => void;
  /** Başkan "Bitti" dedi. */
  onDone: () => AckLike;
}

/** Tahtın önü (RD-U4): başkan tahtta, bütçe kadar jeton önünde; kime gittiği gizli. */
export function ThroneFront(props: {
  president: CrewMember | null;
  budget: number;
  done: boolean;
  big?: boolean;
}) {
  return (
    <div
      class="rd__throne-stage"
      data-done={props.done ? "1" : undefined}
      data-big={props.big ? "1" : undefined}
    >
      <Show when={props.president}>
        {(p) => (
          <div class="rd__throne" style={{ "--tc": look(p().avatar).color }}>
            <img
              class="rd__seat-img"
              src={propSrc("genel/taht")}
              alt=""
              aria-hidden="true"
              draggable={false}
              width="320"
              height="320"
            />
            <span class="rd__throne-av">
              <span class="rd__throne-crown">
                <Crown size="64%" />
              </span>
              <Avatar index={p().avatar} size="var(--rd-tav)" connected={p().connected} />
            </span>
            <span class="rd__name rd__name--big">{p().nickname}</span>
          </div>
        )}
      </Show>
      <div class="rd__coins" aria-hidden="true">
        <Show when={props.done}>
          <span class="rd__coins-purse">
            <Purse size="44px" />
          </span>
        </Show>
        <For each={Array.from({ length: Math.min(8, props.budget) }, (_, i) => i)}>
          {(i) => <i class="rd__coin rd__coin--idle" style={{ "--i": i }} />}
        </For>
      </div>
      <span class="rd__budget">
        <b>{props.budget}</b> jeton
      </span>
    </div>
  );
}

/** Dağıtım: başkan jetonları keseden portrelere verir (RD-U3); diğerleri tahtın önünü görür (RD-U4). */
export function Dagitim(props: Props) {
  const budget = () => props.view.budget ?? 0;
  const president = () => props.crew.find((m) => m.id === props.view.president) ?? null;
  const iAmPresident = () => !props.spectator && props.view.president === props.selfId;
  const order = createMemo(() => props.crew.map((m) => m.id));
  const nameOf = (id: string) => props.crew.find((m) => m.id === id)?.nickname ?? "Oyuncu";

  // Yerel (iyimser) dağıtım: sunucu aynı durumu onaylayana kadar gösterilir.
  const [local, setLocal] = createSignal<Record<string, number> | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const serverTokens = () => tokenMap(props.view.myTokens);
  const tokens = (): Record<string, number> => local() ?? serverTokens();
  createEffect(() => {
    const server = serverTokens();
    const l = untrack(local);
    if (
      l &&
      JSON.stringify(tokensToAllocations(l, untrack(order))) ===
        JSON.stringify(tokensToAllocations(server, untrack(order)))
    )
      setLocal(null);
  });
  const remaining = () => budget() - tokenTotal(tokens());

  const [doneSent, setDoneSent] = createOptimistic<boolean>(() => props.view.locked);
  const locked = () => props.view.locked || doneSent();

  const send = (updated: Record<string, number>): void => {
    setLocal(updated);
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (local() !== null) {
        setLocal(null);
        fail();
      }
    }, 1600);
    props.onGive(tokensToAllocations(updated, order()));
  };
  let ring = 0;
  const give = (id: string): void => {
    if (!iAmPresident() || locked()) return;
    const member = props.crew.find((m) => m.id === id);
    if (!member) return;
    unlockAudio();
    const current = tokens()[id] ?? 0;
    const next = addToken(current, remaining(), member.connected);
    if (next === current) return;
    coin(ring++);
    hapticTap();
    send({ ...tokens(), [id]: next });
  };
  const takeBack = (id: string): void => {
    if (!iAmPresident() || locked()) return;
    const current = tokens()[id] ?? 0;
    if (current === 0) return;
    unlockAudio();
    hapticTap();
    send({ ...tokens(), [id]: removeToken(current) });
  };

  // RD-M1: başkanın defteri.
  const ledger = () => props.view.ledger;
  const marks = createMemo(() => {
    const out: Record<string, SeatMark> = {};
    for (const id of ledger()?.voters ?? []) out[id] = "seal";
    for (const id of ledger()?.random ?? []) out[id] = "dice";
    return out;
  });
  const ledgerLine = () => {
    const l = ledger();
    if (!l) return "";
    const total = l.voters.length + l.random.length;
    const parts = [`${total} oy`];
    if (l.voters.length > 0) parts.push(joinNames(l.voters.map(nameOf)));
    if (l.random.length > 0) parts.push(`zarla: ${joinNames(l.random.map(nameOf))}`);
    return parts.join(" · ");
  };

  const secsLeft = () => Math.max(0, Math.ceil((props.view.phaseEndsAt - props.now()) / 1000));
  const urgent = () => iAmPresident() && !locked() && remaining() > 0 && secsLeft() <= 5;

  // Bekleyenler (RD-U4).
  const presOffline = () => president()?.connected === false && props.view.ready.length === 0;
  const pledge = () => {
    const id = props.view.president;
    return id ? (props.view.pledges[id] ?? null) : null;
  };
  const myVoteLine = () => {
    const v = props.view.myVote;
    if (props.spectator || v === null) return "";
    return props.view.myVoteRandom ? `Oyun rastgele ${toName(nameOf(v))} gitti` : `Senin oyun: ${nameOf(v)}`;
  };

  return (
    <Show
      when={iAmPresident()}
      fallback={
        <>
          <div class="rd__head">
            <span class="overline">Rüşvet zamanı</span>
            <span class="rd__title">
              {props.view.ready.length > 0
                ? "Dağıtım bitti"
                : `${president()?.nickname ?? "Başkan"} dağıtıyor`}
            </span>
            <span class="rd__sub">
              {props.view.ready.length > 0 ? "Sonuç darbeden sonra" : "Kime kaç jeton gideceği gizli"}
            </span>
          </div>
          <ThroneFront president={president()} budget={budget()} done={props.view.ready.length > 0} />
          <div class="rd__lines-info">
            <Show when={presOffline()}>
              <p class="rd__note rd__note--warn" role="status">
                Başkanın bağlantısı koptu · jetonlar seçmenlerine gidecek
              </p>
            </Show>
            <Show when={myVoteLine()}>
              <p class="rd__note">{myVoteLine()}</p>
            </Show>
            <Show when={pledge()}>
              {(p) => (
                <p class="rd__note">
                  {ofName(president()?.nickname ?? "Başkan")} vaadi: <b>{PLEDGE_LABEL[p()]}</b>
                </p>
              )}
            </Show>
          </div>
        </>
      }
    >
      <div class="rd__head rd__head--give">
        <span class="overline">Sen başkansın</span>
        <div class="rd__purse" aria-hidden="true">
          <Purse size="40px" />
          <span class="rd__purse-coins">
            <For each={Array.from({ length: budget() }, (_, i) => i)}>
              {(i) => <i class="rd__coin rd__coin--purse" data-spent={i >= remaining() ? "1" : undefined} />}
            </For>
          </span>
        </div>
        <span class="rd__title rd__title--coins">{remaining()} jeton kaldı</span>
        <Show when={ledger()}>
          <span class="rd__ledger">
            <b>Sana oy verenler</b> {ledgerLine()}
          </span>
        </Show>
      </div>
      <Seats
        players={props.crew}
        selfId={props.selfId}
        marks={marks()}
        onPick={locked() ? undefined : give}
        canPick={(m) => m.connected && remaining() > 0 && (tokens()[m.id] ?? 0) < 2}
        label={(m) => `${m.nickname} adlı oyuncuya jeton ver`}
        below={(m) => (
          <Show when={(tokens()[m.id] ?? 0) > 0}>
            <span class="rd__give-row">
              <Stack n={tokens()[m.id] ?? 0} />
              <Show when={!locked()}>
                <button
                  type="button"
                  class="rd__minus"
                  aria-label={`${m.nickname} adlı oyuncudan bir jeton geri al`}
                  onClick={() => takeBack(m.id)}
                >
                  −
                </button>
              </Show>
            </span>
          </Show>
        )}
      />
      <Show when={urgent()}>
        <p class="rd__note rd__note--warn" role="alert">
          Dağıtmadığın {remaining()} jeton rastgele gidecek!
        </p>
      </Show>
      <Show
        when={!locked()}
        fallback={
          <p class="rd__hint" role="status">
            Dağıtım kesinleşti
          </p>
        }
      >
        <PrimaryButton
          instant
          disabled={tokenTotal(tokens()) === 0}
          reason="En az 1 jeton ver"
          onClick={() => {
            const r = props.onDone();
            if (r !== false) setDoneSent(true, () => toAck(r));
          }}
        >
          Bitti
        </PrimaryButton>
        <p class="rd__hint rd__give-hint" role="status">
          {remaining() === 0 ? "Hepsini dağıttın, Bitti'ye bas" : "Dokun: +1 jeton · kişi başı en çok 2"}
        </p>
      </Show>
    </Show>
  );
}
