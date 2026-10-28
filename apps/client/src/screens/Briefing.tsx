import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createSignal, For, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { hapticReady } from "../fx/haptics.js";
import { ready as readySound } from "../fx/sound.js";
import { gameEntry } from "../games/registry.js";
import { sendReady } from "../net/client.js";
import { Avatar } from "../ui/Avatar.js";
import { BriefingPanels } from "../ui/BriefingPanels.js";
import { BadCardNotice } from "../ui/CardNotices.js";
import { HandTray } from "../ui/HandTray.js";
import { CheckIcon, EyeIcon, RotateIcon } from "../ui/Icons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { WorldBackdrop } from "../ui/WorldBackdrop.js";

export function Briefing(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const snap = () => props.snap;
  const match = () => props.match;
  const [sent, setSent] = createSignal(false);
  const participant = () => match().participants.includes(snap().selfId);
  const ready = () => sent() || match().readyIds.includes(snap().selfId);
  const strip = () => snap().players.filter((p) => match().participants.includes(p.id));
  const isReady = (id: string): boolean => match().readyIds.includes(id) || (id === snap().selfId && sent());
  const art = () => gameEntry(match().gameId)?.Art;
  const [panel, setPanel] = createSignal(0);

  return (
    <>
      <WorldBackdrop gameId={match().gameId} />
      <Screen class="briefing">
        <p class="overline rise" style={{ "--i": 0 }}>
          Oyun {match().round + 1} / {match().total}
        </p>
        <h1 class="display brief__name rise" style={{ "--i": 1 }}>
          {match().gameName}
        </h1>
        <BadCardNotice cards={match().cards} players={snap().players} />
        <Show when={match().orientation === "landscape"}>
          <p class="brief__turn rise" style={{ "--i": 2 }}>
            <RotateIcon size={20} />
            <span>Bu oyunu yatay oynayacaksın</span>
          </p>
        </Show>

        <div class="brief__main">
          <div class="brief__art rise" style={{ "--i": 2 }}>
            <BriefingPanels
              gameId={match().gameId}
              index={panel}
              onIndex={setPanel}
              fallback={() => (
                <Suspense>
                  <Show when={art()}>{(a) => <Dynamic component={a()} />}</Show>
                </Suspense>
              )}
            />
          </div>

          <div class="brief__text">
            <p class="brief__goal rise" style={{ "--i": 3 }}>
              {match().briefing.goal}
            </p>
            <ol class="steps">
              <For each={match().briefing.steps}>
                {(step, i) => (
                  <li class="rise" style={{ "--i": 4 + i() }} data-on={panel() === i() ? "1" : undefined}>
                    <b class="steps__n">{i() + 1}</b>
                    <span>{step}</span>
                  </li>
                )}
              </For>
            </ol>
          </div>
        </div>

        <div class="brief__foot">
          <div class="strip" style={{ "--n": strip().length }}>
            <For each={strip()}>
              {(p) => (
                <Avatar
                  index={p.avatar}
                  size="var(--strip-av, 48px)"
                  connected={p.connected}
                  ready={isReady(p.id)}
                  ring={isReady(p.id) ? "#B6FF3B" : undefined}
                  live={isReady(p.id) ? "breathe" : undefined}
                  class={isReady(p.id) ? "" : "av--wait"}
                />
              )}
            </For>
          </div>
          <Show
            when={participant()}
            fallback={
              <div class="watch" role="status">
                <EyeIcon size={24} />
                <span class="watch__text">
                  <b>İzliyorsun</b>
                  <span>Sonraki oyunda katılırsın</span>
                </span>
              </div>
            }
          >
            <div class="kc-actions">
              <HandTray snap={snap()} match={match()} />
              <PrimaryButton
                variant={ready() ? "done" : "cyan"}
                disabled={ready()}
                onClick={() => {
                  setSent(true);
                  readySound();
                  hapticReady();
                  sendReady();
                }}
              >
                {ready() ? (
                  <span class="inline-icon">
                    <CheckIcon size={22} /> Hazırım
                  </span>
                ) : (
                  "Hazırım"
                )}
              </PrimaryButton>
            </div>
            <p class="brief__wait" data-on={ready() ? "1" : undefined}>
              Diğerleri bekleniyor…
            </p>
          </Show>
        </div>
      </Screen>
    </>
  );
}
