import { Show } from "solid-js";
import { PrimaryButton } from "./PrimaryButton.js";

interface Props {
  /** Bu oyuncu kilitledi mi. */
  locked: boolean;
  /** Kilitleyen sayısı ve kilitleyebilecek toplam kişi. */
  ready: number;
  total: number;
  /** Seçim yokken pasif. */
  disabled?: boolean;
  /** İzleyici: yalnız hazır sayacı görünür. */
  spectator?: boolean;
  /** Düğme yazısı (varsayılan "Tamam"). */
  label?: string;
  /** Kilitlenince düğmede görünen yazı. */
  doneLabel?: string;
  onLock: () => void;
}

/** "Tamam" ile seçimi kesinleştirme: büyük düğme, kilitlenince "Diğerleri bekleniyor · 3/5 hazır". */
export function TamamBar(props: Props) {
  const count = () => `${props.ready}/${props.total} hazır`;
  return (
    <div class="tamam">
      <Show when={!props.spectator} fallback={<p class="tamam__count">{count()}</p>}>
        <Show
          when={props.locked}
          fallback={
            <PrimaryButton disabled={props.disabled ?? false} onClick={props.onLock}>
              {props.label ?? "Tamam"}
            </PrimaryButton>
          }
        >
          <PrimaryButton variant="done" disabled>
            {props.doneLabel ?? "Hazırsın"}
          </PrimaryButton>
          <p class="tamam__count" role="status">
            Diğerleri bekleniyor · {count()}
          </p>
        </Show>
        <Show when={!props.locked}>
          <p class="tamam__count" data-quiet="1">
            {props.total > 0 ? count() : ""}
          </p>
        </Show>
      </Show>
    </div>
  );
}
