import type { MatchSnapshot, RoomSnapshot } from "@glix/engine";
import { createSignal, For, Show, Suspense } from "solid-js";
import { Dynamic } from "solid-js/web";
import { gameEntry } from "../games/registry.js";
import { sendReady } from "../net/client.js";
import { Avatar } from "../ui/Avatar.js";
import { CheckIcon } from "../ui/Icons.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";

export function Briefing(props: { snap: RoomSnapshot; match: MatchSnapshot }) {
  const snap = () => props.snap;
  const match = () => props.match;
  const [sent, setSent] = createSignal(false);
  const participant = () => match().participants.includes(snap().selfId);
  const ready = () => sent() || match().readyIds.includes(snap().selfId);
  const strip = () => snap().players.filter((p) => match().participants.includes(p.id));
  const isReady = (id: string): boolean => match().readyIds.includes(id) || (id === snap().selfId && sent());
  const art = () => gameEntry(match().gameId)?.Art;

  return (
    <Screen class="briefing">
      <p class="overline rise" style={{ "--i": 0 }}>
        Oyun {match().round + 1} / {match().total}
      </p>
      <h1 class="display brief__name rise" style={{ "--i": 1 }}>
        {match().gameName}
      </h1>

      <div class="brief__art rise" style={{ "--i": 2 }}>
        <Suspense>
          <Show when={art()}>{(a) => <Dynamic component={a()} />}</Show>
        </Suspense>
      </div>

      <p class="brief__goal rise" style={{ "--i": 3 }}>
        {match().briefing.goal}
      </p>
      <ol class="steps">
        <For each={match().briefing.steps}>
          {(step, i) => (
            <li class="rise" style={{ "--i": 4 + i() }}>
              <b class="steps__n">{i() + 1}</b>
              <span>{step}</span>
            </li>
          )}
        </For>
      </ol>

      <div class="brief__foot">
        <div class="strip">
          <For each={strip()}>
            {(p) => (
              <Avatar
                index={p.avatar}
                size={48}
                connected={p.connected}
                ready={isReady(p.id)}
                ring={isReady(p.id) ? "#B6FF3B" : undefined}
                class={isReady(p.id) ? "" : "av--wait"}
              />
            )}
          </For>
        </div>
        <Show when={participant()} fallback={<p class="waiting">Bu oyunu izliyorsun</p>}>
          <PrimaryButton
            variant={ready() ? "done" : "cyan"}
            disabled={ready()}
            onClick={() => {
              setSent(true);
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
          <p class="brief__wait" data-on={ready() ? "1" : undefined}>
            Diğerleri bekleniyor…
          </p>
        </Show>
      </div>
    </Screen>
  );
}
