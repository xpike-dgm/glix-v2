import { propSrc } from "../../ui/props.js";

/** Reaktör çekirdeği: halkalar ve çekirdek görseli (tehlikede aşırı yüklü hâli). Hiçbir doluluk göstergesi yoktur (toplam gizlidir). */
export function Core(props: { danger?: boolean; boom?: boolean; pressed?: boolean }) {
  return (
    <div
      class="ay-core"
      data-danger={props.danger ? "1" : undefined}
      data-boom={props.boom ? "1" : undefined}
      data-pressed={props.pressed ? "1" : undefined}
      aria-hidden="true"
    >
      <i class="ay-core__halo" />
      <svg class="ay-core__rings" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="94" class="ay-core__ring ay-core__ring--outer" />
        <circle cx="100" cy="100" r="76" class="ay-core__ring ay-core__ring--mid" />
      </svg>
      <span class="ay-core__orb">
        <img
          class="ay-core__img ay-core__img--calm"
          src={propSrc("genel/enerji-cekirdegi")}
          alt=""
          draggable={false}
          width="384"
          height="384"
        />
        <img
          class="ay-core__img ay-core__img--hot"
          src={propSrc("genel/enerji-cekirdegi-asiri")}
          alt=""
          draggable={false}
          width="384"
          height="384"
        />
      </span>
    </div>
  );
}
