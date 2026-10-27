import type { JSX } from "solid-js";

interface Props {
  children: JSX.Element;
  /** Renk tonu (oyunun kendi tonları: hold, boom, safe, dim…). */
  tone?: string;
  /** Oyunun kendi tipografi sınıfı; yerleşim ve okunurluk için kabuk tabanı yine uygulanır. */
  class?: string;
  /** Yan metin (küçük, tek satır). */
  sub?: JSX.Element;
}

/** Her an tek büyük cümle: "Seç!", "Bekle…", "Sıra Mert'te". Ekran okuyucuya nazikçe duyurulur. */
export function Status(props: Props) {
  return (
    <div class="status" data-tone={props.tone}>
      <h2 class={`status__main ${props.class ?? ""}`} data-tone={props.tone} role="status" aria-live="polite">
        {props.children}
      </h2>
      {props.sub ? <p class="status__sub">{props.sub}</p> : null}
    </div>
  );
}
