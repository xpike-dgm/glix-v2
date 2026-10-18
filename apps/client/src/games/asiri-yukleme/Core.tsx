/** Reaktör çekirdeği: halkalar ve parlayan küre. Hiçbir doluluk göstergesi yoktur (toplam gizlidir). */
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
        <circle cx="100" cy="100" r="58" class="ay-core__ring ay-core__ring--inner" />
      </svg>
      <i class="ay-core__orb" />
      <i class="ay-core__gloss" />
    </div>
  );
}
