import type { SonKisiTension } from "@glix/engine";
import { For, Show } from "solid-js";
import { propSrc, sonKisiProp } from "../../ui/props.js";
import { worldAllowed } from "../../ui/world.js";
import "./son-kisi.css";

/**
 * SK-U1 koridor sahnesi (çerçevesiz, tam ekran): zemin oyunun dünya görselidir (arkada, `WorldBackdrop`); bu katman
 * koridorun sonundaki kaçış kapısını, kolunu ve alarmda inen kepengi çizer. Kapı/kepenk görseli yoksa CSS/SVG
 * karşılığı çizilir (dosya gelince kod değişmeden kullanılır). Dünya görseli kapalıysa (veri tasarrufu) çizgi koridor.
 */
export function Corridor(props: {
  /** Kapı kapalı (kendi kaçışından sonra çarpar). */
  shut: boolean;
  /** Alarm: kepenk iner. */
  shutter: boolean;
}) {
  const closed = () => sonKisiProp("kapi-kapali");
  const open = () => sonKisiProp("kapi-acik");
  const shutterImg = () => sonKisiProp("kepenk");
  return (
    <div class="skcor" data-shut={props.shut ? "1" : undefined} data-alarm={props.shutter ? "1" : undefined}>
      <Show when={!worldAllowed()}>
        <svg
          class="skcor__lines"
          viewBox="0 0 200 260"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path d="M0 260 L72 70 M200 260 L128 70 M0 160 L72 70 M200 160 L128 70 M0 40 L72 70 M200 40 L128 70" />
          <path class="skcor__floor" d="M72 70h56M58 104h84M40 150h120M14 214h172" />
        </svg>
      </Show>
      <div class="skcor__door" aria-hidden="true">
        <Show
          when={(props.shut ? closed() : open()) ?? null}
          fallback={
            <>
              <i class="skcor__frame" />
              <i class="skcor__leaf skcor__leaf--l" />
              <i class="skcor__leaf skcor__leaf--r" />
            </>
          }
        >
          {(src) => <img class="skcor__doorimg" src={src()} alt="" draggable={false} />}
        </Show>
        <img class="skcor__lever" src={propSrc("genel/kacis-kolu")} alt="" draggable={false} />
        <div class="skcor__shutter">
          <Show when={shutterImg()} fallback={<i class="skcor__slats" />}>
            {(src) => <img src={src()} alt="" draggable={false} />}
          </Show>
        </div>
      </div>
    </div>
  );
}

/**
 * SK-U4 tavan lambaları: düzey arttıkça bir lamba daha yanar (mavi → turuncu → kırmızı); bilgi durağandır, bugünkü
 * nabız hızlanması da sürer.
 */
export function Lamps(props: { level: SonKisiTension; class?: string }) {
  return (
    <div
      class={`sklamps ${props.class ?? ""}`}
      data-level={props.level}
      role="img"
      aria-label={`Gerilim ${props.level}/3`}
    >
      <For each={[1, 2, 3]}>
        {(i) => (
          <span class="sklamp" data-i={i} data-on={props.level >= i ? "1" : undefined}>
            <i />
          </span>
        )}
      </For>
    </div>
  );
}
