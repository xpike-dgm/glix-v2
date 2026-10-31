import { Show } from "solid-js";
import { yaziYazProp } from "../../ui/props.js";
import { lettersText } from "./view.js";

/**
 * Konu kartı (YY-M1/U2): daktiloya takılı kâğıt, üstünde büyük harflerle konu. Görsel yoksa CSS kâğıt çizilir.
 * Konusuz turda hiç görünmez.
 */
export function TopicCard(props: { topic: string | null; size?: "big" | "small" }) {
  const paper = yaziYazProp("konu-kagit");
  return (
    <Show when={props.topic}>
      {(t) => (
        <div class="yytc" data-size={props.size ?? "big"} data-art={paper ? "1" : undefined}>
          <Show when={paper}>{(s) => <img class="yytc__img" src={s()} alt="" draggable={false} />}</Show>
          <span class="yytc__roller" aria-hidden="true" />
          <span class="yytc__paper">
            <span class="yytc__label">KONU</span>
            <span class="yytc__topic">{t()}</span>
          </span>
        </div>
      )}
    </Show>
  );
}

/** Konu ve harf ipucu tek satırda (YY-U3/U4): "MEYVE · 5 harf · 7 harf". İkisi de yoksa görünmez. */
export function HintLine(props: { topic: string | null; letters: readonly (number | null)[] | null }) {
  const letters = () => lettersText(props.letters);
  return (
    <Show when={props.topic || letters()}>
      <p class="yyhint">
        <Show when={props.topic}>
          <span class="yyhint__topic">{props.topic}</span>
        </Show>
        <Show when={props.topic && letters()}>
          <span class="yyhint__sep" aria-hidden="true">
            ·
          </span>
        </Show>
        <Show when={letters()}>
          <span class="yyhint__letters">{letters()}</span>
        </Show>
      </p>
    </Show>
  );
}
