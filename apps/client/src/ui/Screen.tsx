import type { JSX } from "solid-js";

interface Props {
  children: JSX.Element;
  class?: string;
  /** Kenar boşluğu olmadan tam sahne. */
  bleed?: boolean;
}

/** Tam yükseklikli sahne: güvenli alanlar, en çok 480 px sütun, giriş geçişi. */
export function Screen(props: Props) {
  return (
    <section class={`screen ${props.bleed ? "screen--bleed" : ""} ${props.class ?? ""}`}>
      <div class="col">{props.children}</div>
    </section>
  );
}
