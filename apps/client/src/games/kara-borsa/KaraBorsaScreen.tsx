import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { hapticError, hapticMatch, hapticReady, hapticResult } from "../../fx/haptics.js";
import { fail, match as matchSound, ready as readySound, roundResult } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { Avatar } from "../../ui/Avatar.js";
import { GhostButton } from "../../ui/GhostButton.js";
import { NumberPicker } from "../../ui/NumberPicker.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { type PropPath, propSrc } from "../../ui/props.js";
import { Screen } from "../../ui/Screen.js";
import type { GameScreenProps } from "../registry.js";
import "./kara-borsa.css";
import { type BorsaScreenView, hintText, parseBorsaView, sortedBids } from "./view.js";
import { CbState } from "../../ui/CbState.js";

const BOXES = ["kutu-ahsap", "kutu-celik", "kutu-hediye", "kutu-antika"] as const;

/** Tura göre sabit kutu görseli (değeri ele vermez); lanetli açılışta lanet kutusu. */
const Crate = (props: { round: number; value?: number | null }) => {
  const art = (): PropPath => {
    if (props.value != null && props.value < 0) return "kara-borsa/kutu-lanet";
    return `kara-borsa/${BOXES[Math.abs(props.round) % BOXES.length] ?? "kutu-ahsap"}`;
  };
  return (
    <img
      class="kb__crate"
      data-open={props.value != null ? "1" : undefined}
      src={propSrc(art())}
      alt=""
      aria-hidden="true"
      draggable={false}
      width="384"
      height="384"
    />
  );
};

const Coin = () => <span class="kb__coin" aria-hidden="true" />;

export default function KaraBorsaScreen(props: GameScreenProps) {
  const view = createMemo(() => parseBorsaView(props.match.publicView, props.match.view));
  const crew = createMemo<PlayerInfo[]>(() =>
    props.match.participants.flatMap((id) => {
      const p = props.players.find((q) => q.id === id);
      return p ? [p] : [];
    }),
  );
  return (
    <Screen class="kb">
      <Show
        when={view()}
        fallback={
          <div class="center-stack">
            <span class="loader" aria-hidden="true" />
          </div>
        }
      >
        {(v) => (
          <>
            <header class="kb__top">
              <div class="kb__center">
                <span class="kb__chip">
                  TUR {Math.min(v().round + 1, v().rounds)}/{v().rounds}
                </span>
                <span class="kb__title">{v().phase === "bid" ? "Teklifini ver" : "Kutu açıldı"}</span>
              </div>
            </header>
            <PhaseClock startedAt={v().stageStartedAt} endsAt={v().stageEndsAt} urgency />
            <Show
              when={v().phase === "bid"}
              fallback={<Reveal view={v()} crew={crew()} selfId={props.selfId} />}
            >
              <Bid
                view={v()}
                crew={crew()}
                selfId={props.selfId}
                spectator={props.spectator === true}
                now={props.now}
              />
            </Show>
          </>
        )}
      </Show>
    </Screen>
  );
}

function Bid(props: {
  view: BorsaScreenView;
  crew: PlayerInfo[];
  selfId: string;
  spectator: boolean;
  now: () => number;
}) {
  const coins = () => props.view.coins[props.selfId] ?? 0;
  const [value, setValue] = createSignal<number | null>(null);
  const [sent, setSent] = createSignal<number | null>(null);
  const bid = () => props.view.myBid ?? sent();
  const closed = () => props.spectator || bid() !== null || props.now() >= props.view.stageEndsAt;
  // Yeni turda yerel durum sıfırlanır.
  createEffect(
    on(
      () => props.view.round,
      () => {
        setValue(null);
        setSent(null);
      },
      { defer: true },
    ),
  );
  const send = (amount: number): void => {
    if (closed() || amount < 0 || amount > coins()) return;
    // Teklif hemen mühürlenir; sunucu reddederse geri açılır.
    setSent(amount);
    readySound();
    hapticReady();
    void sendActionAck({ kind: "bid", amount }).then((ack) => {
      if (ack.ok || ack.reason === "timeout") return;
      setSent(null);
      fail();
      hapticError();
    });
  };
  const broke = () => coins() <= 0;
  return (
    <>
      <div class="kb__stage">
        <Crate round={props.view.round} />
        <Show when={!props.spectator}>
          <div class="kb__hint">
            <span class="kb__hintlabel">Sana özel ipucu</span>
            <span class="kb__hinttext">{props.view.hint ? hintText(props.view.hint) : "…"}</span>
          </div>
        </Show>
        <Show when={props.spectator}>
          <p class="kb__watch">Arkadaşların teklif veriyor</p>
        </Show>
      </div>
      <Show when={!props.spectator}>
        <div class="kb__wallet">
          <Coin />
          <span>
            Jetonun <b>{coins()}</b>
          </span>
        </div>
        <Show
          when={bid() === null}
          fallback={
            <p class="kb__sealed" role="status">
              {bid() === 0 ? "Bu turu geçtin" : `Teklifin gizli: ${bid()}`} · {props.view.bidIds.length}/
              {props.crew.length} hazır
            </p>
          }
        >
          <Show when={!broke()} fallback={<p class="kb__sealed">Jetonun kalmadı, bu turu izle</p>}>
            <div class="kb__bidval" aria-live="polite">
              {value() ?? 0}
            </div>
            <NumberPicker
              min={0}
              max={coins()}
              value={value()}
              startAt={0}
              tickEvery={coins() > 60 ? 20 : 10}
              label="Teklif"
              onChange={(n) => setValue(n)}
            />
            <div class="kb__actions">
              <PrimaryButton
                disabled={value() === null || value() === 0 || closed()}
                instant
                onClick={() => send(value() ?? 0)}
              >
                Teklif ver
              </PrimaryButton>
              <GhostButton size="small" onClick={() => send(0)}>
                Bu turu geç
              </GhostButton>
            </div>
          </Show>
        </Show>
      </Show>
      <ul class="kb__crew" aria-label="Oyuncular">
        <For each={props.crew}>
          {(p) => (
            <li>
              <Avatar
                index={p.avatar}
                size={34}
                connected={p.connected}
                ready={props.view.bidIds.includes(p.id)}
                self={false}
              />
              <span class="kb__bal">{props.view.coins[p.id] ?? 0}</span>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}

function Reveal(props: { view: BorsaScreenView; crew: PlayerInfo[]; selfId: string }) {
  const r = () => props.view.reveal;
  const person = (id: string | null): PlayerInfo | undefined => props.crew.find((p) => p.id === id);
  const cursed = () => (r()?.value ?? 0) < 0;
  const mine = () => r()?.winner === props.selfId;
  createEffect(
    on(
      () => `${props.view.round}:${props.view.phase}`,
      () => {
        const rr = r();
        if (!rr) return;
        if (mine() && !cursed()) {
          matchSound();
          hapticMatch();
        } else if (cursed() && rr.winner !== null) {
          fail();
          hapticError();
        } else {
          roundResult();
          hapticResult();
        }
      },
    ),
  );
  const rows = createMemo(() => {
    const rr = r();
    return rr ? sortedBids(rr, props.view.players) : [];
  });
  return (
    <Show when={r()}>
      {(rr) => (
        <>
          <div class="kb__stage kb__stage--open">
            <Crate round={props.view.round} value={rr().value} />
            <div class="kb__value rise" data-cursed={cursed() ? "1" : undefined}>
              <span class="kb__valuelabel">{cursed() ? "Lanetli kutu" : "Kutunun değeri"}</span>
              <span class="kb__valuenum">{rr().value}</span>
            </div>
          </div>
          <p class="kb__winner" role="status" data-none={rr().winner === null ? "1" : undefined}>
            <Show when={rr().winner !== null} fallback="Kimse almadı, kutu kapandı">
              <b>{rr().winner === props.selfId ? "Sen" : (person(rr().winner)?.nickname ?? "?")}</b> aldı ·{" "}
              {rr().price} jeton
            </Show>
          </p>
          <ul class="kb__bids" data-many={rows().length > 5 ? "1" : undefined}>
            <For each={rows()}>
              {(row) => (
                <li
                  data-win={rr().winner === row.id ? "1" : undefined}
                  data-me={row.id === props.selfId ? "1" : undefined}
                >
                  <Show when={person(row.id)}>
                    {(p) => <Avatar index={p().avatar} size={30} connected={p().connected} />}
                  </Show>
                  <span class="kb__bidname">
                    {row.id === props.selfId ? "Sen" : (person(row.id)?.nickname ?? "?")}
                  </span>
                  <Show when={rr().winner === row.id}>
                    <CbState kind="star" size={14} class="kb__cb" />
                  </Show>
                  <b>{row.amount === 0 ? "geçti" : row.amount}</b>
                </li>
              )}
            </For>
          </ul>
          <ul class="kb__crew kb__crew--wealth" aria-label="Servet">
            <For each={props.crew}>
              {(p) => (
                <li>
                  <Avatar index={p.avatar} size={30} connected={p.connected} />
                  <span class="kb__bal">{(props.view.coins[p.id] ?? 0) + (props.view.boxes[p.id] ?? 0)}</span>
                </li>
              )}
            </For>
          </ul>
        </>
      )}
    </Show>
  );
}
