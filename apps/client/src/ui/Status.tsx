import { type JSX, Show } from "solid-js";

interface Props {
  children: JSX.Element;
  /** Küçük açıklama satırı. */
  sub?: JSX.Element;
  /** Oyunun kendi renk tonu (hold, boom, safe, dim…); büyük cümleye `data-tone` olarak işlenir. */
  tone?: string | undefined;
  /** Vurgulu an (`data-on`). */
  on?: boolean;
  /** Oyunun kendi sınıfları: sarmalayıcı, büyük cümle, açıklama. Kabuk tabanı yine uygulanır. */
  class?: string;
  titleClass?: string;
  subClass?: string;
}

/** Her an tek büyük cümle: "Seç!", "Bekle…", "Sıra Mert'te". Ekran okuyucuya nazikçe duyurulur. */
export function Status(props: Props) {
  return (
    <div class={`status ${props.class ?? ""}`} data-tone={props.tone} role="status" aria-live="polite">
      <h2
        class={`status__main ${props.titleClass ?? ""}`}
        data-tone={props.tone}
        data-on={props.on ? "1" : undefined}
      >
        {props.children}
      </h2>
      <Show when={props.sub}>
        <p class={`status__sub ${props.subClass ?? ""}`}>{props.sub}</p>
      </Show>
    </div>
  );
}
