import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { sendAction, sendActionAck } from "../../net/client.js";
import { look } from "../../ui/avatars.js";
import { NumberPicker } from "../../ui/NumberPicker.js";
import { createChoiceSync } from "../../ui/numberPicker.js";
import type { AckLike } from "../../ui/optimistic.js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import { Screen } from "../../ui/Screen.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./ortalamanin-yarisi.css";
import { Sonuc, type SonucEntry } from "./Sonuc.js";
import { formatNumber, multiplierLabel, parseOrtalamaView, targetName } from "./view.js";

/** Tek turun ekranı: seçim durumu (yerel değer, kilit) her turda sıfırdan kurulur. */
function RoundScreen(props: GameScreenProps) {
  const view = createMemo(() => parseOrtalamaView(props.match.publicView, props.match.view));
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
  const reveal = () => view()?.reveal ?? null;
  // 2. turdan itibaren bir önceki turun ortalaması ve hedefi.
  const prev = () => {
    const p = view()?.previous ?? [];
    return p[p.length - 1] ?? null;
  };
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
                <div class="ort__stage">
                  <div class="ort__round" role="status">
                    <b class="ort__roundNo">
                      Tur {v().round}/{v().rounds}
                    </b>
                    <span class="ort__roundGoal">
                      Hedef: {multiplierLabel(v().multiplier)} · {targetName(v().multiplier)}
                    </span>
                  </div>
                  <Show when={prev()}>
                    {(p) => (
                      <p class="ort__prev">
                        Önceki tur · ortalama {formatNumber(p().mean)} · hedef {formatNumber(p().target)}
                      </p>
                    )}
                  </Show>
                  <p class="overline">{props.spectator ? "Herkes gizlice seçiyor" : "Gizli sayın"}</p>
                  <div class="ort__capsule" data-set={mine() === null ? undefined : "1"}>
                    <span class="ort__big">{props.spectator ? "?" : (mine() ?? "?")}</span>
                  </div>
                  <p class="ort__sub">
                    {props.spectator
                      ? "Sonuç süre bitince açılır"
                      : mine() === null
                        ? "Seçmezsen sana rastgele bir sayı verilir"
                        : locked()
                          ? "Sayın kesinleşti"
                          : "Değiştirebilir ya da Tamam diyebilirsin"}
                  </p>
                  <div class="ort__pods" aria-hidden="true">
                    <For each={entries()}>
                      {(e) => (
                        <span
                          class="ort__pod"
                          data-me={e.id === props.selfId ? "1" : undefined}
                          data-ready={lockedIds().includes(e.id) ? "1" : undefined}
                          style={{ "--c": look(e.avatar).color }}
                        >
                          {lockedIds().includes(e.id) ? "✓" : "?"}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
                <Show
                  when={!props.spectator}
                  fallback={
                    <div class="ort__pick">
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
                  <div class="ort__pick">
                    <NumberPicker
                      min={0}
                      max={100}
                      startAt={30}
                      value={mine()}
                      label="Gizli sayın"
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
                // Her turun sonucu kendi animasyonuyla yeniden kurulur.
                reveal={r()}
                round={v().round}
                rounds={v().rounds}
                multiplier={v().multiplier}
                totals={v().totals}
                final={v().final}
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
