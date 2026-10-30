import { propSrc } from "../../ui/props.js";

/**
 * Reaktör çekirdeği: halkalar ve çekirdek görseli (tehlikede aşırı yüklü hâli). Hiçbir doluluk göstergesi yoktur
 * (toplam gizlidir). Dokunuş tepkisi `coreFx.ts` ile verilir: gövde (`__body`) ve iki halka kutusu ayrı ayrı
 * canlandırılır; CSS'teki sürekli dönüş/nabız iç öğelerdedir, böylece ikisi çakışmaz.
 */
export function Core(props: { danger?: boolean; boom?: boolean; ref?: (el: HTMLDivElement) => void }) {
  return (
    <div
      class="ay-core"
      ref={(el) => props.ref?.(el)}
      data-danger={props.danger ? "1" : undefined}
      data-boom={props.boom ? "1" : undefined}
      aria-hidden="true"
    >
      <i class="ay-core__halo" />
      <span class="ay-core__ringbox ay-core__ringbox--outer">
        <svg class="ay-core__rings" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="94" class="ay-core__ring ay-core__ring--outer" />
        </svg>
      </span>
      <span class="ay-core__ringbox ay-core__ringbox--mid">
        <svg class="ay-core__rings" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="76" class="ay-core__ring ay-core__ring--mid" />
        </svg>
      </span>
      <i class="ay-core__beat" />
      <span class="ay-core__body">
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
      </span>
    </div>
  );
}
