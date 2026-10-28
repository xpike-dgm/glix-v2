import { MedalIcon } from "./ResultIcons.js";

/**
 * Podyum bloğu: sıra numarası yazmaz (puanla karışıyordu); altın/gümüş/bronz neon blok ve madalya gösterir.
 * Görünüm `.podium__block` sınıfına ve `--pod-art` CSS değişkenine bağlıdır: hazır görsel gelince
 * yalnız değişken (`background-image`) değiştirilir. `class` verilirse (TV) taban sınıf onun yerine geçer. Sıra, ekran okuyucuya gizli metinle verilir.
 */
export function PodiumBlock(props: { rank: number; class?: string }) {
  return (
    <div class={props.class ?? "podium__block"} data-rank={props.rank}>
      <span class="podium__medal" aria-hidden="true">
        <MedalIcon size="100%" />
      </span>
      <span class="sr-only">{props.rank}. sıra</span>
    </div>
  );
}
