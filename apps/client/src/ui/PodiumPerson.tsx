import type { PlayerInfo } from "@glix/engine";
import { Show } from "solid-js";
import { formatScore } from "../screens/ranking.js";
import { Avatar } from "./Avatar.js";
import type { Mood } from "./avatars.js";
import { frameOf, PlayerName, PlayerTitle } from "./Cosmetic.js";
import { CrownIcon } from "./Icons.js";

/**
 * Kürsüdeki kişi: ad (yanında küçük avatar rozeti), unvan, puan ve karakterin duracağı kutu (`data-cslot`).
 * Karakter tuvali (`CharacterStage`) kutuya oturur; hazır olana kadar kutuda eski büyük avatar görünür,
 * hazır olunca (`.podium[data-chars="ready"]`) avatar silinir, karakter belirir. Sırayla: ad, unvan, puan, karakter;
 * blok (`PodiumBlock`) bunun altına gelir, karakter bloğun üstünde durur.
 */
export function PodiumPerson(props: {
  player: PlayerInfo;
  rank: number;
  score: number;
  self: boolean;
  mood: Mood;
  live: "joy" | undefined;
  /** CSS uzunluğu: yer tutucu avatarın boyu. */
  avatarSize: string;
}) {
  return (
    <>
      <span class="podium__who">
        <span class="podium__tagwrap">
          <Avatar
            class="podium__tag"
            index={props.player.avatar}
            size={26}
            connected={props.player.connected}
            frame={frameOf(props.player.cosmetics)}
          />
          <Show when={props.rank === 1}>
            <span class="podium__crown" aria-hidden="true">
              <CrownIcon size="100%" />
            </span>
          </Show>
        </span>
        <span class="podium__name">
          <PlayerName name={props.player.nickname} cosmetics={props.player.cosmetics} />
        </span>
      </span>
      <PlayerTitle cosmetics={props.player.cosmetics} class="podium__title" />
      <span class="podium__score">
        <Show when={props.self}>
          <span class="podium__you">Sen</span>
        </Show>
        {formatScore(props.score)}
      </span>
      <div class="podium__char" data-cslot={props.player.id}>
        <div class="podium__ph">
          <Avatar
            index={props.player.avatar}
            size={props.avatarSize}
            mood={props.mood}
            live={props.live}
            winner={props.rank === 1}
            connected={props.player.connected}
            self={props.self}
            frame={frameOf(props.player.cosmetics)}
          />
        </div>
      </div>
    </>
  );
}
