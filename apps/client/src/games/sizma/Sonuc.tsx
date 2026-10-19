import { createMemo, For, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { look } from "../../ui/avatars.js";
import { Mask } from "./Mask.js";
import { type CrewMember, outcomeOf, type SizmaScreenView } from "./view.js";

interface Props {
  view: SizmaScreenView;
  crew: CrewMember[];
  selfId: string;
  spectator: boolean;
}

export function Sonuc(props: Props) {
  const reveal = () => props.view.reveal;
  const odd = createMemo(() => props.crew.find((m) => m.id === reveal()?.infiltrator) ?? null);
  const iAmOdd = () => !props.spectator && reveal()?.infiltrator === props.selfId;
  const mine = () => reveal()?.scores[props.selfId] ?? 0;
  const ranked = createMemo(() => {
    const r = reveal();
    return [...props.crew].sort(
      (a, b) =>
        (r?.tally[b.id] ?? 0) - (r?.tally[a.id] ?? 0) ||
        props.crew.findIndex((c) => c.id === a.id) - props.crew.findIndex((c) => c.id === b.id),
    );
  });
  const verdict = (): string => {
    const r = reveal();
    if (!r) return "";
    if (props.spectator) return r.caught ? "Sızma yakalandı" : "Sızma kurtuldu";
    if (iAmOdd()) return r.caught ? "Yakalandın" : "Kimse seni yakalayamadı";
    return r.caught ? "Sızmayı yakaladınız" : "Sızma aranızdan kaçtı";
  };

  onMount(() => {
    if (props.spectator || !reveal()) return;
    const t = setTimeout(() => {
      if (outcomeOf(reveal() as NonNullable<ReturnType<typeof reveal>>, props.selfId) === "win") {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    }, 500);
    return () => clearTimeout(t);
  });

  return (
    <Show when={reveal()}>
      {(r) => (
        <div class="sz__rev">
          <div class="sz__head sz__head--reveal" data-caught={r().caught ? "1" : "0"}>
            <span class="overline">{r().caught ? "Yakalandı!" : "Kurtuldu!"}</span>
            <span class="sz__verdict">{verdict()}</span>
          </div>

          <div class="sz__rbody">
            <div class="sz__culprit" style={{ "--tc": look(odd()?.avatar ?? 0).color }}>
              <div class="sz__culprit-av">
                <Show when={odd()}>
                  {(o) => <Avatar index={o().avatar} size="var(--sz-cav)" connected={o().connected} />}
                </Show>
                <span class="sz__mask-drop">
                  <Mask size="100%" />
                </span>
              </div>
              <span class="sz__culprit-name">{odd()?.nickname ?? "?"}</span>
              <div class="sz__words">
                <span class="sz__wchip">
                  <em>Ortak</em>
                  {r().commonWord}
                </span>
                <span class="sz__wchip sz__wchip--odd">
                  <em>Sızma</em>
                  {r().infiltratorWord}
                </span>
              </div>
            </div>

            <ul class="sz__tally" aria-label="Alınan oylar" data-n={ranked().length}>
              <For each={ranked()}>
                {(m) => {
                  const votes = () => r().tally[m.id] ?? 0;
                  return (
                    <li
                      class="sz__tcell"
                      data-me={m.id === props.selfId ? "1" : undefined}
                      data-odd={m.id === r().infiltrator ? "1" : undefined}
                    >
                      <span class="sz__tav">
                        <Avatar index={m.avatar} size="var(--sz-tav)" connected={m.connected} />
                        <span class="sz__tbadge" data-zero={votes() === 0 ? "1" : undefined}>
                          {votes()}
                        </span>
                      </span>
                      <span class="sz__tname">{m.nickname}</span>
                    </li>
                  );
                }}
              </For>
            </ul>
          </div>

          <Show
            when={!props.spectator}
            fallback={
              <p class="sz__hint" role="status">
                Yakalanırsa herkes +1, kurtulursa sızma +2
              </p>
            }
          >
            <p class="sz__hint sz__hint--score" role="status" data-zero={mine() === 0 ? "1" : undefined}>
              <b>+{mine()}</b> genel skora eklendi
            </p>
          </Show>
        </div>
      )}
    </Show>
  );
}
