import type { PlayerInfo } from "@glix/engine";
import { createEffect, createMemo, createSignal, on, Show, untrack } from "solid-js";
import { hapticError } from "../../fx/haptics.js";
import { fail, unlockAudio } from "../../fx/sound.js";
import { sendActionAck } from "../../net/client.js";
import { GhostButton } from "../../ui/GhostButton.js";
import { NumberPicker } from "../../ui/NumberPicker.js";
import { PrimaryButton } from "../../ui/PrimaryButton.js";
import { boxFor } from "./art.js";
import { BigBand, Coin, Crate, CrewStrip, Envelope, HintCard, Ledger } from "./Parts.js";
import * as sfx from "./sounds.js";
import { BID_TENSION } from "./timeline.js";
import { type BorsaScreenView, isBigRound, profitLeaders } from "./view.js";

interface Props {
  view: BorsaScreenView;
  crew: PlayerInfo[];
  selfId: string;
  spectator: boolean;
  now: () => number;
  tv?: boolean;
}

/** Teklif aşaması (KB-U3/U4/U5/U6): kutu, ipucu, seçici ya da mühürlü zarf, pazar defteri ve oyuncu şeridi. */
export function Bid(props: Props) {
  const coins = () => props.view.coins[props.selfId] ?? 0;
  const [value, setValue] = createSignal<number | null>(null);
  const [sent, setSent] = createSignal<number | null>(null);
  const bid = () => props.view.myBid ?? sent();
  const closed = () => props.spectator || bid() !== null || props.now() >= props.view.stageEndsAt;
  const broke = () => !props.spectator && coins() <= 0;
  const big = () => isBigRound(props.view);
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
  // Büyük Kutu bandı: tur başında boru sesi (geç gelen oyuncuya çalmaz).
  createEffect(
    on(
      () => props.view.round,
      () => {
        if (!untrack(big)) return;
        if (untrack(props.now) - props.view.stageStartedAt < 2_000) sfx.fanfare();
      },
    ),
  );
  const send = (amount: number): void => {
    if (closed() || amount < 0 || amount > coins()) return;
    unlockAudio();
    // Teklif hemen mühürlenir; sunucu reddederse geri açılır.
    setSent(amount);
    sfx.seal();
    void sendActionAck({ kind: "bid", amount }).then((ack) => {
      if (ack.ok || ack.reason === "timeout") return;
      setSent(null);
      fail();
      hapticError();
    });
  };

  // Son 5 saniye: seçici/zarf titrer; son 2 sn'de ara tikler (kabuk saatinin saniye tikine ek); teklif vermediysen
  // telefon bir kez kısa titrer.
  const left = () => props.view.stageEndsAt - props.now();
  const tense = () => !props.tv && left() > 0 && left() <= BID_TENSION.startMs;
  createEffect(
    on(
      () => (tense() ? props.view.round : -1),
      (r) => {
        if (r < 0 || props.spectator || broke() || bid() !== null) return;
        sfx.nudge();
      },
    ),
  );
  createEffect(
    on(
      () => (tense() && left() <= BID_TENSION.fastMs ? Math.ceil(left() / 500) : 0),
      (half) => {
        if (half > 0 && half % 2 === 1 && !props.spectator) sfx.clockTick(true);
      },
    ),
  );

  const leaders = createMemo(() => profitLeaders(props.view));
  const watching = () => props.spectator || broke();
  const count = () => `${props.view.bidIds.length}/${props.crew.length} teklif verdi`;
  return (
    <div class="kb__bid" data-tense={tense() ? "1" : undefined} data-watch={watching() ? "1" : undefined}>
      <div class="kb__side">
        <Show when={!watching()}>
          <Ledger view={props.view} crew={props.crew} selfId={props.selfId} />
        </Show>
        <Show when={big()}>
          <BigBand />
        </Show>
        <div class="kb__stage">
          <Crate box={boxFor(props.view.round, props.view.rounds, false)} open={false} big={big()} />
        </div>
        <Show when={watching()}>
          <Ledger view={props.view} crew={props.crew} selfId={props.selfId} big />
        </Show>
      </div>
      <div class="kb__side kb__side--act">
        <Show when={!props.spectator}>
          <HintCard hint={props.view.hint} />
        </Show>
        <Show when={bid() !== null && !broke()}>
          <Envelope amount={bid()} />
        </Show>
        <Show when={!props.spectator}>
          <Show
            when={!broke()}
            fallback={
              <p class="kb__note" role="status">
                <b>Jetonun bitti</b> · ipucunla masayı kandırabilirsin
              </p>
            }
          >
            <div class="kb__purse">
              <div class="kb__wallet">
                <Coin />
                <span>
                  Jetonun <b>{coins()}</b>
                </span>
              </div>
              <Show when={bid() === null}>
                <div class="kb__bidval" aria-live="polite" data-empty={value() === null ? "1" : undefined}>
                  <Show when={value() !== null} fallback={<span class="kb__bidhint">Teklifini seç</span>}>
                    {value()}
                  </Show>
                </div>
              </Show>
            </div>
            <Show
              when={bid() === null}
              fallback={
                <p class="kb__sealed" role="status">
                  {count()}
                </p>
              }
            >
              <div class="kb__picker">
                <NumberPicker
                  min={0}
                  max={coins()}
                  value={value()}
                  startAt={0}
                  tickEvery={coins() > 60 ? 20 : 10}
                  label="Teklif"
                  onChange={(n) => setValue(n)}
                />
              </div>
              <div class="kb__actions">
                <PrimaryButton
                  disabled={value() === null || value() === 0 || closed()}
                  instant
                  onClick={() => send(value() ?? 0)}
                >
                  Teklif ver
                </PrimaryButton>
                <GhostButton class="kb__pass" disabled={closed()} onClick={() => send(0)}>
                  Bu turu geç
                </GhostButton>
              </div>
            </Show>
          </Show>
        </Show>
        <Show when={props.spectator}>
          <p class="kb__sealed kb__sealed--watch" role="status">
            {count()}
          </p>
        </Show>
      </div>
      <CrewStrip
        crew={props.crew}
        selfId={props.spectator ? "" : props.selfId}
        mode="coins"
        values={props.view.coins}
        leaders={leaders()}
        sealed={props.view.bidIds}
      />
    </div>
  );
}
