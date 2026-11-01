import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticSingle, hapticTap, hapticTick } from "../../fx/haptics.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { look } from "../../ui/avatars.js";
import { createChoiceSync } from "../../ui/numberPicker.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { RevealContinue } from "../../ui/RevealContinue.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./ortalamanin-yarisi.css";
import { ortalamaChooseCues } from "./cues.js";
import { NumberRoad } from "./NumberRoad.js";
import { type Entry, Pods, RoundCard, RoundStrip, RoundsTable } from "./parts.js";
import { Sonuc } from "./Sonuc.js";
import { seal, whoosh } from "./sounds.js";
import { lastChoice, lastSeconds, parseOrtalamaView, roundPhase, targetName } from "./view.js";

/** Tur kartının şeride küçülerek çekilmesi (son 0,25 sn). */
export const CARD_LEAVE_MS = 250;

/** Katılımcılar, oyuncu bilgisiyle (kapsüller, sonuç ve tablo için). */
export function entriesOf(props: GameScreenProps): Entry[] {
  return props.match.participants.map((id) => {
    const p = props.players.find((x) => x.id === id);
    return { id, avatar: p?.avatar ?? 0, nickname: p?.nickname ?? "Oyuncu", connected: p?.connected ?? true };
  });
}

/** Tek turun ekranı: seçim durumu (yerel değer, kilit) her turda sıfırdan kurulur. */
function RoundScreen(props: GameScreenProps) {
  const view = createMemo(() => parseOrtalamaView(props.match.publicView, props.match.view));
  const entries = createMemo<Entry[]>(() => entriesOf(props));
  const reveal = () => view()?.reveal ?? null;
  const phase = () => {
    const v = view();
    return v ? roundPhase(v, props.now()) : "card";
  };
  const prev = () => {
    const p = view()?.previous ?? [];
    return p[p.length - 1] ?? null;
  };
  const [sentLock, setSentLock] = createSignal(false);
  const lockedIds = () => view()?.lockedIds ?? [];
  const locked = () => (view()?.locked ?? false) || sentLock();
  const closed = () => {
    const v = view();
    return props.spectator === true || !v || locked() || phase() !== "choose";
  };

  const sync = createChoiceSync({
    serverValue: () => view()?.myChoice,
    send: (value) => {
      sendAction({ kind: "choose", value });
    },
    closed,
  });
  const mine = (): number | null => sync.value() ?? view()?.myChoice ?? null;
  const last = () => {
    const v = view();
    return v ? lastSeconds(v, props.now()) : null;
  };
  // OY-U4: son 3 saniyede, kilitlememiş oyuncunun yolu nabız gibi parlar.
  const urgent = () => last() !== null && !locked() && props.spectator !== true;
  const color = () => look(entries().find((e) => e.id === props.selfId)?.avatar ?? 0).color;

  ortalamaChooseCues(
    () => {
      const v = view();
      return v ? { round: v.round, phase: phase(), lastSecond: last(), locked: locked() } : null;
    },
    {
      card: () => whoosh(),
      // Saniye tiki kabuk saatinden gelir (son 5 sn); burada yalnız seçmemiş/kilitlememiş oyuncu titrer.
      last: () => {
        if (props.spectator !== true && !locked()) hapticTick();
      },
      lock: () => {
        seal();
        hapticSingle();
      },
    },
  );

  const lock = (): AckLike => {
    const v = view();
    const value = mine();
    if (!v || value === null || closed()) return false;
    if (v.myChoice !== value) sendAction({ kind: "choose", value });
    setSentLock(true);
    const ack = sendActionAck({ kind: "lock" });
    void ack.then((a) => {
      if (!a.ok && a.reason !== "timeout") setSentLock(false);
    });
    return ack;
  };

  const caption = () => {
    const v = view();
    if (!v) return undefined;
    return v.previous.length === 0 ? `Herkes ne yazacak? Hedef ${targetName(v.multiplier)}.` : undefined;
  };
  const sub = () =>
    props.spectator
      ? "Sonuç süre bitince açılır"
      : last() !== null && mine() === null
        ? "Seçmezsen 🎲 rastgele!"
        : mine() === null
          ? "Seçmezsen sana rastgele bir sayı düşer ve puan alamazsın"
          : locked()
            ? "Sayın mühürlendi"
            : "Değiştirebilir ya da Tamam diyebilirsin";

  return (
    <Screen class="ort">
      <Show when={view()}>
        {(v) => <PhaseClock startedAt={v().roundStartedAt} endsAt={v().endsAt} urgency />}
      </Show>

      <Show when={view()}>
        {(v) => (
          <Show
            when={reveal()}
            fallback={
              <>
                <Show when={phase() === "card"}>
                  <RoundCard
                    round={v().round}
                    rounds={v().rounds}
                    multiplier={v().multiplier}
                    leaving={v().roundStartedAt - props.now() < CARD_LEAVE_MS}
                  />
                </Show>
                <div class="ort__stage" data-card={phase() === "card" ? "1" : undefined}>
                  <RoundStrip round={v().round} rounds={v().rounds} multiplier={v().multiplier} />
                  <NumberRoad
                    value={props.spectator ? null : mine()}
                    readonly={props.spectator === true}
                    disabled={closed()}
                    locked={locked()}
                    urgent={urgent()}
                    prev={prev()}
                    mine={props.spectator ? null : lastChoice(v().previous, props.selfId)}
                    color={color()}
                    caption={caption()}
                    label="Gizli sayın"
                    onChange={(n, final) => {
                      if (final) hapticTap();
                      sync.set(n, final);
                    }}
                  />
                  <p class="ort__sub" data-warn={last() !== null && mine() === null ? "1" : undefined}>
                    {sub()}
                  </p>
                  <Pods
                    entries={entries()}
                    selfId={props.selfId}
                    lockedIds={lockedIds()}
                    previous={v().previous}
                  />
                  <Show when={props.spectator && v().previous.length > 0}>
                    <RoundsTable
                      entries={entries()}
                      selfId={props.selfId}
                      played={v().previous}
                      rounds={v().rounds}
                      final={null}
                    />
                  </Show>
                </div>
                <div class="ort__pick">
                  <TamamBar
                    spectator={props.spectator === true}
                    locked={locked()}
                    disabled={mine() === null || closed()}
                    ready={lockedIds().length}
                    readyIds={lockedIds()}
                    total={entries().length}
                    onLock={lock}
                  />
                </div>
              </>
            }
          >
            {(r) => (
              <Sonuc
                reveal={r()}
                round={v().round}
                rounds={v().rounds}
                multiplier={v().multiplier}
                totals={v().totals}
                final={v().final}
                previous={v().previous}
                endsAt={v().endsAt}
                revealEndsAt={v().revealEndsAt}
                entries={entries()}
                selfId={props.selfId}
                spectator={props.spectator === true}
                now={props.now}
              />
            )}
          </Show>
        )}
      </Show>
      <RevealContinue match={props.match} selfId={props.selfId} now={props.now} spectator={props.spectator} />
    </Screen>
  );
}

/** Tur numarası değişince tur ekranı yeniden kurulur: önceki turun seçimi ve kilidi bir sonrakine taşınmaz. */
export default function OrtalamaninYarisiScreen(props: GameScreenProps) {
  const round = createMemo(() => parseOrtalamaView(props.match.publicView, props.match.view)?.round ?? 0);
  return (
    <Show when={round() > 0} fallback={<Screen class="ort">{null}</Screen>}>
      {/* Her tur numarası ayrı bir öğedir: tur değişince ekran yeniden kurulur. */}
      <For each={[round()]}>{() => <RoundScreen {...props} />}</For>
    </Show>
  );
}
