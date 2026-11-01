import { createMemo, Show } from "solid-js";
import type { GameScreenProps } from "../registry.js";
import "./son-kisi.css";
import { formatSeconds, parseSonKisiPublicView, roundHeadline } from "./view.js";

/**
 * Genel sonuç ekranının üstündeki kısa satır (SK-U5, SK-U10): alarm anı ve son kişi oyun içinde görüldüğü için tek satır.
 * Son alarmın son kaçanı ve alarm anı; üç alarmda puan alan yoksa "Kimse kurtulamadı · alarm 11,2 sn'de"; taç yok. Ses çalmaz (siren oyun içinde bir kez çaldı).
 */
export default function Reveal(props: GameScreenProps) {
  const pub = createMemo(() => parseSonKisiPublicView(props.match.publicView));
  const line = () => {
    const p = pub();
    const fin = p?.final;
    const last = p?.results[p.results.length - 1];
    if (!p || !fin || !last) return null;
    // SK-U10: üç alarmda kimse puan alamadıysa.
    if (!fin.some((s) => s.total > 0))
      return `Kimse kurtulamadı · alarm ${formatSeconds(last.alarmMs).replace(" sn", " sn'de")}`;
    // SK-U5: son alarmın tek satırı.
    return roundHeadline(last, (id) => props.players.find((x) => x.id === id)?.nickname ?? "Oyuncu");
  };
  return (
    <Show when={line()}>
      {(l) => (
        <p class="skr rise">
          <i class="skr__siren" aria-hidden="true" />
          {l()}
        </p>
      )}
    </Show>
  );
}
