import type { PlayerInfo } from "@glix/engine";
import { onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import "./karalama.css";
import { parseKaralamaPublicView } from "./view.js";

/** Sonuç ekranının üstüne giren açılış: bilgisiz oyuncu maskesini düşürür, iki kelime birlikte görünür. */
export default function Reveal(props: GameScreenProps) {
  const reveal = () => parseKaralamaPublicView(props.match.publicView)?.reveal ?? null;
  const outsider = (): PlayerInfo | undefined => props.players.find((p) => p.id === reveal()?.outsider);
  const votes = (): number => reveal()?.tally[reveal()?.outsider ?? ""] ?? 0;
  onMount(() => {
    if (reveal()?.caught) {
      matchSound();
      hapticMatch();
    } else {
      soloSound();
      hapticSolo();
    }
  });
  return (
    <Show when={reveal()}>
      {(r) => (
        <section class="kd__reveal rise" data-caught={r().caught ? "1" : "0"} aria-label="Kelimeyi bilmeyen">
          <div class="kd__rwho">
            <Show when={outsider()}>
              {(o) => (
                <Avatar
                  index={o().avatar}
                  size={52}
                  ring={r().caught ? "var(--lime)" : "var(--amber)"}
                  connected={o().connected}
                />
              )}
            </Show>
            <div class="kd__rtext">
              <span class="kd__rlabel">Kelimeyi bilmeyen</span>
              <span class="kd__rname">{outsider()?.nickname ?? "?"}</span>
            </div>
            <span class="kd__rbadge">{r().caught ? "Yakalandı!" : "Kurtuldu!"}</span>
          </div>
          <div class="kd__rwords">
            <span class="kd__rword kd__rword--main">
              <em>Ortak</em>
              {r().mainWord}
            </span>
            <span class="kd__rword kd__rword--near">
              <em>Yakın</em>
              {r().nearWord}
            </span>
          </div>
          <span class="sr-only">{votes()} oy aldı</span>
        </section>
      )}
    </Show>
  );
}
