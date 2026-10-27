import { type JSX, Show } from "solid-js";

/**
 * Her değiştirici işlemden önceki onay adımı: ne olacağı yazılır, "Onayla" ya da "Vazgeç" seçilir.
 * Ekranın altına yapışır; uzun listelerde de görünür kalır.
 */
export function Confirm(props: {
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: JSX.Element;
}) {
  return (
    <div class="adm-confirm adm-confirm--sticky" role="alertdialog" aria-labelledby="adm-confirm-h">
      <h4 id="adm-confirm-h" class="adm-h4">
        Emin misin?
      </h4>
      <p>{props.text}</p>
      <Show when={props.children}>{props.children}</Show>
      <div class="adm-inline">
        <button
          type="button"
          class="adm-btn adm-btn--small"
          classList={{ "adm-btn--danger": props.danger === true }}
          disabled={props.busy || props.disabled === true}
          onClick={props.onConfirm}
        >
          {props.busy ? "İşleniyor..." : (props.confirmLabel ?? "Onayla")}
        </button>
        <button
          type="button"
          class="adm-btn adm-btn--ghost adm-btn--small"
          disabled={props.busy}
          onClick={props.onCancel}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
