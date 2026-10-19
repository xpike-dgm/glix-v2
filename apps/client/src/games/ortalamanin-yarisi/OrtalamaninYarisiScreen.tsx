import { createMemo, createSignal, For, Show } from "solid-js";
import { hapticTap } from "../../fx/haptics.js";
import { sendAction } from "../../net/client.js";
import { serverNow } from "../../net/store.js";
import { look } from "../../ui/avatars.js";
import { NumberPicker } from "../../ui/NumberPicker.js";
import { createChoiceSync } from "../../ui/numberPicker.js";
import { ProgressBar } from "../../ui/ProgressBar.js";
import { Screen } from "../../ui/Screen.js";
import { SoundToggle } from "../../ui/SoundToggle.js";
import { TamamBar } from "../../ui/TamamBar.js";
import type { GameScreenProps } from "../registry.js";
import "./ortalamanin-yarisi.css";
import { Sonuc, type SonucEntry } from "./Sonuc.js";
import { parseOrtalamaView } from "./view.js";

export default function OrtalamaninYarisiScreen(props: GameScreenProps) {
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

  const lock = (): void => {
    const v = view();
    const value = mine();
    if (!v || value === null || closed()) return;
    // Sürükleme bitmeden basıldıysa en son değer önce gider (iletiler sıralı ulaşır).
    if (v.myChoice !== value) sendAction({ kind: "choose", value });
    if (sendAction({ kind: "lock" })) setSentLock(true);
  };

  return (
    <Screen class="ort">
      <header class="game__top">
        <Show when={view()} fallback={<div class="pbar" />}>
          {(v) => <ProgressBar startedAt={v().startedAt} endsAt={v().endsAt} now={serverNow} urgency />}
        </Show>
        <div class="game__tools">
          <SoundToggle />
        </div>
      </header>

      <Show when={view()}>
        {(v) => (
          <Show
            when={reveal()}
            fallback={
              <>
                <div class="ort__stage">
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
