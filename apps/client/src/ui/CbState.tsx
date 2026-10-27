import { CheckIcon, CloseIcon, StarIcon } from "./Icons.js";

interface Props {
  /** ok: doğru/temiz/başarılı, bad: yanlış/zehirli/elendi, star: ödül/öne çıkan. */
  kind: "ok" | "bad" | "star";
  size?: number;
  /** Mod kapalıyken de görünür. */
  always?: boolean;
  class?: string;
}

/**
 * Yeşil/kırmızı gibi renkle verilen durumun yanına konan ✓ / ✗ / ★ işareti.
 * Renk körlüğü dostu modda görünür (ya da `always`); kapalıyken yer tutmaz.
 */
export function CbState(props: Props) {
  const size = () => props.size ?? 14;
  return (
    <span class={`cbs ${props.class ?? ""}`} data-kind={props.kind} data-always={props.always ? "1" : undefined}>
      {props.kind === "ok" ? (
        <CheckIcon size={size()} />
      ) : props.kind === "bad" ? (
        <CloseIcon size={size()} />
      ) : (
        <StarIcon size={size()} />
      )}
    </span>
  );
}
