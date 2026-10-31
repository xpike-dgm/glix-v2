import type { KontrolReveal, KontrolWaveResult } from "@glix/engine";
import { For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { CutChip } from "./Ara.js";
import { bombVictory } from "./bombSounds.js";
import type { Crew } from "./KontrolScreen.js";
import { waveCleared } from "./view.js";

interface Props {
  reveal: KontrolReveal;
  results: KontrolWaveResult[];
  crew: Crew[];
  selfId: string;
  spectator: boolean;
  /** Oyun sonu yorumu (varsa). */
  comment: string | null;
  sound: boolean;
}

/**
 * Oyun sonu: kendi mini puanın (+2 / +1 / 0) ve herkesin satırı: üç dalganın kesimi (✓/✗), toplam imha puanı ve
 * ödül. Varsa bomba uzmanının tek cümlelik yorumu. Bütün dalgalar tamamen imha edildiyse kısa zafer.
 */
export function Sonuc(props: Props) {
  const award = (id: string) => props.reveal.awards[id] ?? 0;
  const total = (id: string) => props.reveal.totals[id] ?? 0;
  const allCleared = () => props.results.length > 0 && props.results.every(waveCleared);
  const everyoneEqual = () => {
    const values = props.crew.map((m) => total(m.id));
    return values.length > 0 && values.every((v) => v === values[0]) && (values[0] ?? 0) > 0;
  };
  const verdict = (): string => {
    const a = award(props.selfId);
    if (a === 2) return "En çok imha eden sensin!";
    if (a === 1) return everyoneEqual() ? "Ekip başarısı: herkes eşit" : "İmhada ikincisin";
    return total(props.selfId) > 0 ? "İmha ettin ama ödül çıkmadı" : "Bu sefer olmadı";
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  onMount(() => {
    if (!props.sound) return;
    timer = setTimeout(() => {
      if (allCleared()) bombVictory();
      else if (props.spectator) return;
      else if (award(props.selfId) > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    }, 600);
  });
  return (
    <div class="kp__res">
      <div class="kp__head kp__head--res">
        <Show
          when={!props.spectator}
          fallback={
            <span class="kp__title">{allCleared() ? "Bomba tamamen imha edildi!" : "Bomba açıldı"}</span>
          }
        >
          <span class="kp__score" data-zero={award(props.selfId) === 0 ? "1" : undefined}>
            +{award(props.selfId)}
          </span>
          <span class="kp__verdict">{allCleared() ? "Bomba tamamen imha edildi!" : verdict()}</span>
        </Show>
      </div>

      <Show when={props.comment}>
        {(text) => (
          <p class="kp__expert">
            <span class="kp__expert-tag">Bomba uzmanı</span>
            {text()}
          </p>
        )}
      </Show>

      <ul class="kp__rows kp__rows--final" data-scroll>
        <For each={props.crew}>
          {(m, i) => (
            <li class="kp__row" data-me={m.id === props.selfId ? "1" : undefined} style={{ "--i": i() }}>
              <Avatar index={m.avatar} size={30} connected={m.connected} />
              <span class="kp__row-name">{m.nickname}</span>
              <span class="kp__waves">
                <For each={props.results}>
                  {(r) => (
                    <CutChip
                      cut={r.rows[m.id]?.cut ?? null}
                      correct={r.rows[m.id]?.correct === true}
                      compact
                    />
                  )}
                </For>
              </span>
              <span class="kp__total" title="Toplam imha puanı">
                {total(m.id)}
              </span>
              <span class="kp__pts" data-zero={award(m.id) === 0 ? "1" : undefined}>
                +{award(m.id)}
              </span>
            </li>
          )}
        </For>
      </ul>
      <p class="kp__legend">Dalga 1 · 2 · 3 kesimleri, toplam imha puanı ve ödül</p>
    </div>
  );
}
