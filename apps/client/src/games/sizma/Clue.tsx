import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { Mask } from "./Mask.js";
import { type CrewMember, wordSize } from "./view.js";

/** Kelime kristali: yalnız kendi kelimen, büyük. Kristalin biçimi herkes için aynıdır. */
export function WordGem(props: { word: string | null; mini?: boolean }) {
  return (
    <div class="sz__gem" data-mini={props.mini ? "1" : undefined} role="img" aria-label="Kelimen">
      <span class="sz__gem-in">
        <Show when={props.word} fallback={<Mask size={32} class="sz__gem-mask" />}>
          <span class="sz__word" style={{ "--ws": `${wordSize(props.word ?? "")}px` }}>
            {props.word}
          </span>
        </Show>
      </span>
    </div>
  );
}

interface OrderProps {
  crew: CrewMember[];
  order: readonly string[];
  selfId: string;
  /** "Oylamaya geç" diyenler. */
  ready: readonly string[];
}

/** Söyleme sırası: numaralı portreler; iki turda da aynı sıra. */
export function Order(props: OrderProps) {
  const seats = () =>
    props.order.flatMap((id, i) => {
      const m = props.crew.find((c) => c.id === id);
      return m ? [{ m, n: i + 1 }] : [];
    });
  return (
    <ol class="sz__order" aria-label="Söyleme sırası" data-n={seats().length}>
      <For each={seats()}>
        {(s) => (
          <li class="sz__seat" data-me={s.m.id === props.selfId ? "1" : undefined}>
            <span class="sz__avnum">
              <Avatar
                index={s.m.avatar}
                size={34}
                connected={s.m.connected}
                ready={props.ready.includes(s.m.id)}
              />
              <span class="sz__num">{s.n}</span>
            </span>
            <span class="sz__who">{s.m.nickname}</span>
          </li>
        )}
      </For>
    </ol>
  );
}
